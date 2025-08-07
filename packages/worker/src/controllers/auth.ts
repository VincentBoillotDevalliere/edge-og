/**
 * Authentication Controller
 * Handles all authentication-related business logic
 */

import { 
	validateEmail,
	hashEmailWithPepper,
	generateSecureUUID,
	createAccount,
	findAccountByEmailHash,
	generateMagicLinkToken,
	sendMagicLinkEmail,
	checkRateLimit,
	validateAuthEnvironment,
	verifyJWTToken,
	generateSessionToken,
	updateAccountLastLogin,
	MagicLinkPayload,
	SessionPayload
} from '../utils/auth';
import { log } from '../utils/logger';
import { WorkerError } from '../utils/error';
import type { RouteContext } from '../routes';

const RATE_LIMIT_RETRY_AFTER_SECONDS = 300; // 5 minutes

export class AuthController {
	/**
	 * Handle magic-link account creation request
	 * Implements AQ-1.1: En tant que visiteur, je crée un compte via magic-link e-mail
	 */
	async requestMagicLink(context: RouteContext): Promise<Response> {
		const { request, requestId, env } = context;

		try {
			// Validate environment configuration
			validateAuthEnvironment(env);

			// Get client IP for rate limiting (AQ-5.1)
			const clientIP = request.headers.get('CF-Connecting-IP') || 
							request.headers.get('X-Forwarded-For') || 
							'unknown';

			// Check rate limiting: 5 req / IP / 5 min
			const rateLimitPassed = await checkRateLimit(clientIP, env);
			if (!rateLimitPassed) {
				log({
					event: 'magic_link_rate_limited',
					client_ip: clientIP,
					request_id: requestId,
				});
				
				return new Response(
					JSON.stringify({
						error: 'Too many requests. Please wait 5 minutes before trying again.',
						retry_after: RATE_LIMIT_RETRY_AFTER_SECONDS,
						request_id: requestId,
					}),
					{
						status: 429,
						headers: {
							'Content-Type': 'application/json',
							'Retry-After': String(RATE_LIMIT_RETRY_AFTER_SECONDS),
						},
					}
				);
			}

			// Parse request body
			const contentType = request.headers.get('Content-Type') || '';
			let email: string;

			if (contentType.includes('application/json')) {
				const body = await request.json() as { email?: string };
				email = body.email || '';
			} else if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
				const formData = await request.formData();
				email = formData.get('email')?.toString() || '';
			} else {
				return new Response(
					JSON.stringify({
						error: 'Content-Type must be application/json or application/x-www-form-urlencoded',
						request_id: requestId,
					}),
					{
						status: 400,
						headers: { 'Content-Type': 'application/json' },
					}
				);
			}

			// Validate email format
			if (!validateEmail(email)) {
				log({
					event: 'magic_link_invalid_email',
					client_ip: clientIP,
					request_id: requestId,
				});

				return new Response(
					JSON.stringify({
						error: 'Invalid email address format',
						request_id: requestId,
					}),
					{
						status: 400,
						headers: { 'Content-Type': 'application/json' },
					}
				);
			}

			// Hash email with pepper for privacy (as per ROADMAP KV schema)
			const emailHash = await hashEmailWithPepper(email, env.EMAIL_PEPPER as string);

			// Check if account already exists
			const existingAccount = await findAccountByEmailHash(emailHash, env);
			let accountId: string;

			if (existingAccount) {
				// Use existing account
				accountId = existingAccount.accountId;
				log({
					event: 'magic_link_existing_account',
					account_id: accountId,
					request_id: requestId,
				});
			} else {
				// Create new account
				accountId = generateSecureUUID();
				await createAccount(accountId, emailHash, env);
				log({
					event: 'magic_link_new_account',
					account_id: accountId,
					request_id: requestId,
				});
			}

			// Generate magic link token (JWT, 15 min expiry)
			const magicLinkToken = await generateMagicLinkToken(
				accountId,
				emailHash,
				env.JWT_SECRET as string
			);

			// Send magic link email via MailChannels
			await sendMagicLinkEmail(email, magicLinkToken, env);

			// Return success response
			return new Response(
				JSON.stringify({
					success: true,
					message: 'Magic link sent successfully. Check your email to complete account setup.',
					request_id: requestId,
				}),
				{
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				}
			);

		} catch (error) {
			log({
				event: 'magic_link_request_failed',
				error: error instanceof Error ? error.message : 'Unknown error',
				request_id: requestId,
			});

			// Don't expose internal errors to client
			return new Response(
				JSON.stringify({
					error: 'Failed to process magic link request. Please try again.',
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
	 * Handle magic-link callback authentication
	 * Implements AQ-1.2: En tant qu'utilisateur, je suis authentifié après clic sur le lien
	 */
	async handleCallback(context: RouteContext): Promise<Response> {
		const { url, requestId, env } = context;

		try {
			// Validate environment configuration
			validateAuthEnvironment(env);

			// Get token from query parameters
			const token = url.searchParams.get('token');
			if (!token) {
				log({
					event: 'magic_link_callback_missing_token',
					request_id: requestId,
				});

				return new Response(
					JSON.stringify({
						error: 'Missing authentication token',
						request_id: requestId,
					}),
					{
						status: 400,
						headers: { 'Content-Type': 'application/json' },
					}
				);
			}

			// Verify magic link token
			const payload = await verifyJWTToken<MagicLinkPayload>(token, env.JWT_SECRET as string);
			if (!payload) {
				log({
					event: 'magic_link_callback_invalid_token',
					request_id: requestId,
				});

				return new Response(
					JSON.stringify({
						error: 'Invalid or expired authentication token',
						request_id: requestId,
					}),
					{
						status: 401,
						headers: { 'Content-Type': 'application/json' },
					}
				);
			}

			// Verify account still exists and get data
			const key = `account:${payload.account_id}`;
			const accountDataRaw = await env.ACCOUNTS.get(key);
			
			if (!accountDataRaw) {
				log({
					event: 'magic_link_callback_account_not_found',
					account_id: payload.account_id,
					request_id: requestId,
				});

				return new Response(
					JSON.stringify({
						error: 'Account not found',
						request_id: requestId,
					}),
					{
						status: 404,
						headers: { 'Content-Type': 'application/json' },
					}
				);
			}

			// Verify email hash matches (security check)
			const accountData = JSON.parse(accountDataRaw) as { email_hash: string; created: string; plan: string };
			if (accountData.email_hash !== payload.email_hash) {
				log({
					event: 'magic_link_callback_email_hash_mismatch',
					account_id: payload.account_id,
					request_id: requestId,
				});

				return new Response(
					JSON.stringify({
						error: 'Authentication failed',
						request_id: requestId,
					}),
					{
						status: 401,
						headers: { 'Content-Type': 'application/json' },
					}
				);
			}

			// Generate 24h session token
			const sessionToken = await generateSessionToken(
				payload.account_id,
				payload.email_hash,
				env.JWT_SECRET as string
			);

			// Update account last login timestamp
			await updateAccountLastLogin(payload.account_id, env);

			// Get base URL for dashboard redirect
			const baseUrl = env.BASE_URL || `${url.protocol}//${url.host}`;
			const dashboardUrl = `${baseUrl}/dashboard`;

			// Set secure session cookie and redirect
			const headers = new Headers();
			headers.set('Location', dashboardUrl);
			
			// Set secure HTTP-only session cookie
			const cookieOptions = [
				`edge_og_session=${sessionToken}`,
				'HttpOnly',
				'Secure',
				'SameSite=Lax',
				'Path=/',
				'Max-Age=86400' // 24 hours
			];
			
			headers.set('Set-Cookie', cookieOptions.join('; '));

			log({
				event: 'magic_link_callback_success',
				account_id: payload.account_id,
				request_id: requestId,
			});

			return new Response(null, {
				status: 302,
				headers,
			});

		} catch (error) {
			log({
				event: 'magic_link_callback_failed',
				error: error instanceof Error ? error.message : 'Unknown error',
				request_id: requestId,
			});

			// Return error response
			return new Response(
				JSON.stringify({
					error: 'Failed to process authentication. Please try again.',
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
	 * Handle user logout
	 * Implements AQ-1.3: En tant qu'utilisateur, je me déconnecte
	 */
	async logout(context: RouteContext): Promise<Response> {
		const { request, requestId, env } = context;

		try {
			// Extract account ID from session cookie for logging if available
			let accountId: string | undefined;
			
			const cookieHeader = request.headers.get('Cookie');
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
				
				const sessionToken = cookies['edge_og_session'];
				if (sessionToken) {
					try {
						// Try to decode the session token to get account ID for logging
						const payload = await verifyJWTToken<SessionPayload>(sessionToken, env.JWT_SECRET as string);
						if (payload) {
							accountId = payload.account_id;
						}
					} catch {
						// Ignore errors when trying to decode token for logging
					}
				}
			}

			// Clear the session cookie
			const headers = new Headers();
			headers.set('Content-Type', 'application/json');
			
			// Set cookie with immediate expiration to clear it
			const cookieOptions = [
				'edge_og_session=',
				'HttpOnly',
				'Secure',
				'SameSite=Lax',
				'Path=/',
				'Max-Age=0' // Immediately expire the cookie
			];
			
			headers.set('Set-Cookie', cookieOptions.join('; '));

			// Log successful logout
			log({
				event: 'user_logout_success',
				account_id: accountId || 'unknown',
				request_id: requestId,
				timestamp: new Date().toISOString(),
			});

			// Return success response
			return new Response(
				JSON.stringify({
					success: true,
					message: 'Successfully logged out',
					request_id: requestId,
				}),
				{
					status: 200,
					headers,
				}
			);

		} catch (error) {
			log({
				event: 'user_logout_failed',
				error: error instanceof Error ? error.message : 'Unknown error',
				request_id: requestId,
			});

			// Return error response
			return new Response(
				JSON.stringify({
					error: 'Failed to logout. Please try again.',
					request_id: requestId,
				}),
				{
					status: 500,
					headers: { 'Content-Type': 'application/json' },
				}
			);
		}
	}
}
