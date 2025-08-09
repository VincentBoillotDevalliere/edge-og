import { RequestContext } from '../types/request';
import { log } from '../utils/logger';
import { WorkerError } from '../utils/error';
import {
	validateEmail,
	hashEmailWithPepper,
	generateSecureUUID,
	createAccount,
	findAccountByEmailHash,
	generateMagicLinkToken,
	sendMagicLinkEmail,
	checkRateLimit,
	verifyTurnstileToken,
	validateAuthEnvironment,
	verifyJWTToken,
	generateSessionToken,
	updateAccountLastLogin,
	MagicLinkPayload,
	SessionPayload,
} from '../utils/auth';

// Constants for rate limiting and security
const RATE_LIMIT_RETRY_AFTER_SECONDS = 300; // 5 minutes

/**
 * Handle magic-link account creation request
 * Implements AQ-1.1: En tant que visiteur, je crée un compte via magic-link e-mail
 * 
 * Acceptance criteria:
 * • POST `/auth/request-link` avec `email`
 * • Mail envoyé (MailChannels)  
 * • Objet KV `account:{UUID}` créé
 */
export async function handleMagicLinkRequest(context: RequestContext): Promise<Response> {
	const { request, env, requestId } = context;
	
	try {
		// Validate environment configuration
		validateAuthEnvironment(env, requestId);

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

		// Parse request body (email + optional Turnstile token)
		const { email, turnstileToken } = await parseEmailAndCaptchaFromRequest(request, requestId);

		// Verify Turnstile CAPTCHA (AQ-5.1)
		const captchaOk = await verifyTurnstileToken(turnstileToken, clientIP, env, requestId);
		if (!captchaOk) {
			log({ event: 'magic_link_captcha_refused', client_ip: clientIP, request_id: requestId });
			return new Response(
				JSON.stringify({
					error: 'CAPTCHA verification failed. Please try again.',
					request_id: requestId,
				}),
				{ status: 400, headers: { 'Content-Type': 'application/json' } }
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
		await sendMagicLinkEmail(email, magicLinkToken, env, requestId);

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

		// Handle known errors
		if (error instanceof WorkerError) {
			return error.toResponse();
		}

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
 * 
 * Acceptance criteria:
 * • GET `/auth/callback?token=` pose cookie `edge_og_session` (JWT 24 h)
 * • Redirection `/dashboard`
 */
export async function handleMagicLinkCallback(context: RequestContext): Promise<Response> {
	const { url, env, requestId } = context;
	
	try {
		// Validate environment configuration
		validateAuthEnvironment(env, requestId);

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
 * Parse email from request body (handles both JSON and form data)
 */
async function parseEmailFromRequest(request: Request, requestId: string): Promise<string> {
	const contentType = request.headers.get('Content-Type') || '';
	let email: string;

	if (contentType.includes('application/json')) {
		const body = await request.json() as { email?: string };
		email = body.email || '';
	} else if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
		const formData = await request.formData();
		email = formData.get('email')?.toString() || '';
	} else {
		throw new WorkerError('Content-Type must be application/json or application/x-www-form-urlencoded', 400, requestId);
	}

	return email;
}

/**
 * Parse email and optional Turnstile token from request body
 * Accepts JSON: { email, turnstileToken } or form fields 'email', 'cf-turnstile-response'
 */
async function parseEmailAndCaptchaFromRequest(request: Request, requestId: string): Promise<{ email: string; turnstileToken?: string }> {
	const contentType = request.headers.get('Content-Type') || '';
	if (contentType.includes('application/json')) {
		const body = await request.json() as { email?: string; turnstileToken?: string };
		return { email: body.email || '', turnstileToken: body.turnstileToken };
	}
	if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
		const formData = await request.formData();
		const email = formData.get('email')?.toString() || '';
		const token = (formData.get('turnstileToken') || formData.get('cf-turnstile-response'))?.toString();
		return { email, turnstileToken: token };
	}
	throw new WorkerError('Content-Type must be application/json or application/x-www-form-urlencoded', 400, requestId);
}

/**
 * Handle logout: clear session cookie and redirect to homepage
 */
export async function handleLogout(context: RequestContext): Promise<Response> {
	const { url } = context;
	const baseUrl = `${url.protocol}//${url.host}`;

	const headers = new Headers();
	headers.set('Location', `${baseUrl}/`);
	// Expire the cookie immediately
	headers.set(
		'Set-Cookie',
		[
			'edge_og_session=deleted',
			'HttpOnly',
			'Secure',
			'SameSite=Lax',
			'Path=/',
			'Max-Age=0'
		].join('; ')
	);

	return new Response(null, { status: 302, headers });
}
