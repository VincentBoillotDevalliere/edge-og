import { RequestContext } from '../types/request';
import { log } from '../utils/logger';
import { WorkerError } from '../utils/error';
import {
	validateAuthEnvironment,
	verifyJWTToken,
	SessionPayload,
	generateAPIKey,
	storeAPIKey,
} from '../utils/auth';

/**
 * Handle API key generation for authenticated users
 * Implements AQ-2.1: Je génère une clé API depuis `/dashboard/api-keys`
 * 
 * Acceptance criteria:
 * • POST renvoie `prefix + secret` (base62 64 car.)
 * • KV `key:{kid}` stocke HMAC-SHA256 du secret
 */
export async function handleAPIKeyGeneration(context: RequestContext): Promise<Response> {
	const { request, env, requestId } = context;
	
	try {
		// Validate environment configuration
		validateAuthEnvironment(env, requestId);

		// Check for session cookie - user must be authenticated
		const sessionToken = extractSessionTokenFromCookies(request);

		if (!sessionToken) {
			log({
				event: 'api_key_generation_no_session',
				request_id: requestId,
			});

			return new Response(
				JSON.stringify({
					error: 'Authentication required. Please log in first.',
					request_id: requestId,
				}),
				{
					status: 401,
					headers: { 'Content-Type': 'application/json' },
				}
			);
		}

		// Verify session token
		const payload = await verifyJWTToken<SessionPayload>(sessionToken, env.JWT_SECRET as string);
		if (!payload) {
			log({
				event: 'api_key_generation_invalid_session',
				request_id: requestId,
			});

			return new Response(
				JSON.stringify({
					error: 'Invalid or expired session. Please log in again.',
					request_id: requestId,
				}),
				{
					status: 401,
					headers: { 'Content-Type': 'application/json' },
				}
			);
		}

		// Verify account still exists
		const accountKey = `account:${payload.account_id}`;
		const accountDataRaw = await env.ACCOUNTS.get(accountKey);
		
		if (!accountDataRaw) {
			log({
				event: 'api_key_generation_account_not_found',
				account_id: payload.account_id,
				request_id: requestId,
			});

			return new Response(
				JSON.stringify({
					error: 'Account not found.',
					request_id: requestId,
				}),
				{
					status: 404,
					headers: { 'Content-Type': 'application/json' },
				}
			);
		}

		// Parse request body to get the key name
		const keyName = await parseKeyNameFromRequest(request, requestId);

		// Validate key name
		validateKeyName(keyName, requestId);

		// Generate the API key
		const { kid, prefix, fullKey, hash } = await generateAPIKey(
			payload.account_id,
			keyName.trim(),
			env
		);

		// Store the API key data in KV
		await storeAPIKey(kid, payload.account_id, hash, keyName.trim(), env);

		// Log successful API key generation
		log({
			event: 'api_key_generated_success',
			account_id: payload.account_id,
			key_id: kid,
			key_name: keyName.trim(),
			request_id: requestId,
		});

		// Return the API key (this is the only time the full key is exposed)
		return new Response(
			JSON.stringify({
				success: true,
				message: 'API key generated successfully',
				api_key: {
					id: kid,
					name: keyName.trim(),
					prefix: prefix,
					key: fullKey, // Full key including prefix and secret
					created: new Date().toISOString(),
				},
				request_id: requestId,
				warning: 'Store this API key securely. It will not be shown again.',
			}),
			{
				status: 201,
				headers: { 'Content-Type': 'application/json' },
			}
		);

	} catch (error) {
		log({
			event: 'api_key_generation_failed',
			error: error instanceof Error ? error.message : 'Unknown error',
			request_id: requestId,
		});

		// Handle known errors
		if (error instanceof WorkerError) {
			return error.toResponse();
		}

		// Don't expose internal errors to client
		return new Response(
			JSON.stringify({
				error: 'Failed to generate API key. Please try again.',
				request_id: requestId,
			}),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' },
			}
		);
	}
}

/**
 * Extract session token from cookies
 */
function extractSessionTokenFromCookies(request: Request): string {
	const cookieHeader = request.headers.get('Cookie');
	let sessionToken = '';
	
	if (cookieHeader) {
		// Parse cookies to find edge_og_session
		const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
			const trimmed = cookie.trim();
			const equalIndex = trimmed.indexOf('=');
			if (equalIndex > 0) {
				const key = trimmed.substring(0, equalIndex);
				const value = trimmed.substring(equalIndex + 1);
				acc[key] = value;
			}
			return acc;
		}, {} as Record<string, string>);
		
		sessionToken = cookies['edge_og_session'] || '';
	}
	
	return sessionToken;
}

/**
 * Parse key name from request body (handles both JSON and form data)
 */
async function parseKeyNameFromRequest(request: Request, requestId: string): Promise<string> {
	const contentType = request.headers.get('Content-Type') || '';
	let keyName = '';

	if (contentType.includes('application/json')) {
		const body = await request.json() as { name?: string };
		keyName = body.name || '';
	} else if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
		const formData = await request.formData();
		keyName = formData.get('name')?.toString() || '';
	} else {
		throw new WorkerError('Content-Type must be application/json or application/x-www-form-urlencoded', 400, requestId);
	}

	return keyName;
}

/**
 * Validate key name
 */
function validateKeyName(keyName: string, requestId: string): void {
	if (!keyName || keyName.trim().length === 0) {
		throw new WorkerError('API key name is required', 400, requestId);
	}

	if (keyName.length > 100) {
		throw new WorkerError('API key name must be 100 characters or less', 400, requestId);
	}
}
