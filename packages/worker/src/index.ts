export {};

/**
 * Edge-OG Worker - Open Graph Image Generator at the Edge
 * 
 * Implements user story CG-1: En tant que crawler je reçois une image PNG 1200×630 <150 ms
 * Implements user story EC-1: Les images sont cachées 1 an pour réduire latence & coût
 * Criteria: Content-Type: image/png, TTFB ≤ 150 ms, Cache hit ratio ≥ 90%
 */

import { renderOpenGraphImage } from './render';
import { WorkerError } from './utils/error';
import { log, logRequest } from './utils/logger';
import { TemplateType } from './templates';
import { getHomePage } from './utils/homepage';
import { 
	getCacheStatus, 
	generateETag, 
	getCacheHeaders, 
	normalizeParams, 
	createCacheMetrics,
	// EC-2: Cache invalidation imports
	generateVersionedETag,
	extractCacheVersion,
	validateCacheVersion,
	shouldInvalidateCache,
	getVersionedCacheHeaders,
	createCacheInvalidationMetrics
} from './utils/cache';
// AQ-1.1: Authentication imports
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
	// AQ-1.2: Magic link callback imports
	verifyJWTToken,
	generateSessionToken,
	updateAccountLastLogin,
	MagicLinkPayload,
	SessionPayload
} from './utils/auth';

// Constants for rate limiting and security
const RATE_LIMIT_RETRY_AFTER_SECONDS = 300; // 5 minutes

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const startTime = Date.now();
		const requestId = crypto.randomUUID();
		const url = new URL(request.url);

		try {
			// Force HTTPS redirects as per security requirements (skip in local dev)
			if (url.protocol === 'http:' && !url.hostname.includes('localhost')) {
				const httpsUrl = new URL(request.url);
				httpsUrl.protocol = 'https:';
				return Response.redirect(httpsUrl.toString(), 301);
			}

			// Route: POST /auth/request-link for magic-link account creation (AQ-1.1)
			if (url.pathname === '/auth/request-link' && request.method === 'POST') {
				const response = await handleMagicLinkRequest(request, requestId, env);
				
				// Log request
				logRequest('magic_link_requested', startTime, response.status, requestId);
				
				return response;
			}

			// Route: GET /auth/callback for magic-link authentication (AQ-1.2)
			if (url.pathname === '/auth/callback' && request.method === 'GET') {
				const response = await handleMagicLinkCallback(url, requestId, env);
				
				// Log request
				logRequest('magic_link_callback', startTime, response.status, requestId);
				
				return response;
			}

			// Route: GET /dashboard for authenticated users
			if (url.pathname === '/dashboard' && request.method === 'GET') {
				const response = await handleDashboard(request, requestId, env);
				
				// Log request
				logRequest('dashboard_accessed', startTime, response.status, requestId);
				
				return response;
			}

			// Route: /og endpoint for Open Graph image generation (GET only)
			if (url.pathname === '/og') {
				if (request.method !== 'GET') {
					return new Response(
						JSON.stringify({
							error: 'Method not allowed. Only GET requests are supported.',
							request_id: requestId,
						}),
						{
							status: 405,
							headers: {
								'Content-Type': 'application/json',
								'Allow': 'GET',
							},
						}
					);
				}

				const response = await handleOGImageGeneration(url, requestId, ctx, request, env);
				
				// Log successful request
				logRequest('og_image_generated', startTime, response.status, requestId, {
					width: 1200,
					height: 630,
				});

				return response;
			}

			// Default route - serve homepage (GET only)
			if (url.pathname === '/' && request.method === 'GET') {
				const baseUrl = `${url.protocol}//${url.host}`;
				const homepage = getHomePage(baseUrl);
				
				return new Response(homepage, {
					headers: {
						'Content-Type': 'text/html; charset=utf-8',
						'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
					},
				});
			}

			// Health check endpoint
			if (url.pathname === '/health') {
				return new Response(JSON.stringify({
					service: 'edge-og',
					version: '1.0.0',
					status: 'healthy',
					request_id: requestId,
					timestamp: new Date().toISOString(),
				}), {
					headers: {
						'Content-Type': 'application/json',
					},
				});
			}

			// 404 for all other routes
			throw new WorkerError('Not found', 404, requestId);

		} catch (error) {
			// Log error
			log({
				event: 'request_error',
				duration_ms: Date.now() - startTime,
				status: error instanceof WorkerError ? error.statusCode : 500,
				request_id: requestId,
				error: error instanceof Error ? error.message : String(error),
			});

			// Return error response
			if (error instanceof WorkerError) {
				return error.toResponse();
			}

			return new Response(
				JSON.stringify({
					error: 'Internal Server Error',
					request_id: requestId,
				}),
				{
					status: 500,
					headers: {
						'Content-Type': 'application/json',
					},
				}
			);
		}
	},
} satisfies ExportedHandler<Env>;

/**
 * Handle Open Graph image generation
 * Implements CG-1: Generate PNG 1200×630 images <150ms
 * Implements EC-1: Cache optimization with hit ratio monitoring
 * Implements EC-2: Cache invalidation when hash changes
 */
async function handleOGImageGeneration(
	url: URL,
	requestId: string,
	ctx: ExecutionContext,
	request: Request,
	env?: Env
): Promise<Response> {
	const startRender = performance.now();

	// EC-1: Get cache status for monitoring
	const cacheStatus = getCacheStatus(request);

	// Validate and extract query parameters
	const params = validateOGParams(url.searchParams);
	
	// EC-1: Normalize parameters for consistent caching
	const normalizedParams = normalizeParams(url.searchParams);

	// EC-2: Extract and validate cache version for invalidation support
	const rawCacheVersion = extractCacheVersion(url.searchParams, env);
	const cacheVersion = validateCacheVersion(rawCacheVersion);
	
	// EC-2: Check if cache should be invalidated
	const shouldInvalidate = shouldInvalidateCache(cacheVersion, cacheStatus.status === 'HIT' ? 'existing' : undefined);
	let wasInvalidated = false;
	
	if (shouldInvalidate && cacheVersion) {
		// Log cache invalidation for monitoring
		const invalidationMetrics = createCacheInvalidationMetrics(
			requestId,
			'existing',
			cacheVersion,
			'version_mismatch'
		);
		log(invalidationMetrics as any);
		wasInvalidated = true;
	}

	// Generate the image with error handling for WASM issues
	let result;
	try {
		result = await renderOpenGraphImage(params);
	} catch (error) {
		// Check if this is a WASM compilation error that should be handled gracefully
		if (error instanceof Error && (
			error.message.includes('CompileError') ||
			error.message.includes('Wasm code generation disallowed') ||
			error.message.includes('PNG conversion is not available in local development') ||
			error.message.includes('WASM')
		)) {
			console.warn('WASM error occurred, attempting SVG fallback:', error.message);
			
			// Try to generate SVG instead
			try {
				result = await renderOpenGraphImage({ ...params, format: 'svg' });
			} catch (svgError) {
				console.error('SVG fallback also failed:', svgError);
				throw new WorkerError('Image generation failed', 500, requestId);
			}
		} else {
			// Re-throw other errors
			throw error;
		}
	}

	// Measure render time for performance monitoring
	const renderDuration = Math.round(performance.now() - startRender);

	// Determine if result is SVG or PNG
	const resultIsSvg = typeof result === 'string';
	const requestedPng = params.format !== 'svg';
	const fallbackOccurred = requestedPng && resultIsSvg;

	// EC-2: Generate versioned ETag for cache invalidation support
	const etag = cacheVersion 
		? await generateVersionedETag(normalizedParams, cacheVersion)
		: await generateETag(normalizedParams);

	// Enhanced logging with cache performance metrics
	log({
		event: 'image_rendered',
		duration_ms: renderDuration,
		request_id: requestId,
		template: params.template || 'default',
		theme: params.theme || 'light',
		font: params.font || 'inter',
		fontUrl: params.fontUrl ? 'custom' : undefined, // CG-4: Log custom font usage without exposing URL
		format: params.format || 'png',
		actual_format: resultIsSvg ? 'svg' : 'png',
		fallback_occurred: fallbackOccurred,
		// EC-2: Log cache version information
		cache_version: cacheVersion || 'none',
		cache_invalidated: wasInvalidated,
	});

	// EC-1: Log cache performance metrics
	const cacheMetrics = createCacheMetrics(
		cacheStatus,
		renderDuration,
		requestId,
		params.template || 'default'
	);
	log(cacheMetrics as any); // Type assertion for compatibility with LogData

	// Determine content type and response body
	const contentType = resultIsSvg ? 'image/svg+xml' : 'image/png';
	const responseBody = resultIsSvg ? result as string : result as ArrayBuffer;

	// EC-2: Generate versioned cache headers with invalidation support
	const headers = getVersionedCacheHeaders(
		contentType,
		etag,
		requestId,
		renderDuration,
		cacheStatus.status,
		cacheVersion,
		wasInvalidated
	);

	// Add fallback notification header for debugging
	if (fallbackOccurred) {
		headers['X-Fallback-To-SVG'] = 'true';
		headers['X-Fallback-Reason'] = 'PNG conversion not available in development environment';
	}

	// Return with EC-1 compliant caching headers and EC-2 invalidation support
	return new Response(responseBody, {
		status: 200,
		headers,
	});
}

/**
 * Validate and sanitize Open Graph parameters
 * As per security requirements: validate all query params, max 200 chars decoded UTF-8
 * Implements CG-2: Theme and font parameters with fallback values
 */
function validateOGParams(searchParams: URLSearchParams): {
	title?: string;
	description?: string;
	theme?: 'light' | 'dark' | 'blue' | 'green' | 'purple';
	font?: 'inter' | 'roboto' | 'playfair' | 'opensans';
	fontUrl?: string; // CG-4: Custom font URL support
	template?: TemplateType;
	format?: 'png' | 'svg';
	emoji?: string; // CG-5: Emoji support
	// Template-specific parameters
	author?: string;
	price?: string;
	date?: string;
	location?: string;
	quote?: string;
	role?: string;
	subtitle?: string;
	category?: string;
	version?: string;
	status?: string;
	episode?: string;
	duration?: string;
	name?: string;
	instructor?: string;
	level?: string;
} {
	const title = searchParams.get('title');
	const description = searchParams.get('description');
	const theme = searchParams.get('theme');
	const font = searchParams.get('font');
	const fontUrl = searchParams.get('fontUrl'); // CG-4: Custom font URL
	const template = searchParams.get('template');
	const format = searchParams.get('format');
	const emoji = searchParams.get('emoji'); // CG-5: Emoji support
	
	// Extract template-specific parameters
	const author = searchParams.get('author');
	const price = searchParams.get('price');
	const date = searchParams.get('date');
	const location = searchParams.get('location');
	const quote = searchParams.get('quote');
	const role = searchParams.get('role');
	const subtitle = searchParams.get('subtitle');
	const category = searchParams.get('category');
	const version = searchParams.get('version');
	const status = searchParams.get('status');
	const episode = searchParams.get('episode');
	const duration = searchParams.get('duration');
	const name = searchParams.get('name');
	const instructor = searchParams.get('instructor');
	const level = searchParams.get('level');

	// Validate text length (max 200 chars as per security requirements)
	if (title && title.length > 200) {
		throw new WorkerError('Title parameter too long (max 200 characters)', 400);
	}

	if (description && description.length > 200) {
		throw new WorkerError('Description parameter too long (max 200 characters)', 400);
	}

	// Validate theme parameter - extended color themes with fallback to 'light'
	const validThemes = ['light', 'dark', 'blue', 'green', 'purple'];
	if (theme && !validThemes.includes(theme)) {
		throw new WorkerError('Invalid theme parameter. Must be one of: light, dark, blue, green, purple', 400);
	}

	// Validate font parameter - supported fonts with fallback to 'inter'
	const validFonts = ['inter', 'roboto', 'playfair', 'opensans'];
	if (font && !validFonts.includes(font)) {
		throw new WorkerError('Invalid font parameter. Must be one of: inter, roboto, playfair, opensans', 400);
	}

	// CG-4: Validate fontUrl parameter - must be valid HTTPS URL to TTF/OTF
	if (fontUrl) {
		try {
			const url = new URL(fontUrl);
			// Security: Only allow HTTPS URLs
			if (url.protocol !== 'https:') {
				throw new WorkerError('Custom font URL must use HTTPS', 400);
			}
			// Basic validation for font file extensions
			const pathname = url.pathname.toLowerCase();
			if (!pathname.endsWith('.ttf') && !pathname.endsWith('.otf') && !pathname.endsWith('.woff') && !pathname.endsWith('.woff2')) {
				throw new WorkerError('Custom font URL must point to a TTF, OTF, WOFF, or WOFF2 file', 400);
			}
		} catch (error) {
			if (error instanceof WorkerError) throw error;
			throw new WorkerError('Invalid fontUrl parameter. Must be a valid HTTPS URL', 400);
		}
	}

	// Validate format parameter (development use)
	const validFormats = ['png', 'svg'];
	if (format && !validFormats.includes(format)) {
		throw new WorkerError('Invalid format parameter. Must be "png" or "svg"', 400);
	}

	// CG-3: Validate template parameter - support all 10 templates
	const validTemplates = ['default', 'blog', 'product', 'event', 'quote', 'minimal', 'news', 'tech', 'podcast', 'portfolio', 'course'];
	if (template && !validTemplates.includes(template)) {
		throw new WorkerError(`Invalid template parameter. Must be one of: ${validTemplates.join(', ')}`, 400);
	}

	return {
		title: title || undefined,
		description: description || undefined,
		theme: (theme as 'light' | 'dark' | 'blue' | 'green' | 'purple') || undefined,
		font: (font as 'inter' | 'roboto' | 'playfair' | 'opensans') || undefined,
		fontUrl: fontUrl || undefined, // CG-4: Custom font URL
		template: (template as TemplateType) || undefined,
		format: (format as 'png' | 'svg') || undefined,
		emoji: emoji || undefined, // CG-5: Emoji support
		// Template-specific parameters
		author: author || undefined,
		price: price || undefined,
		date: date || undefined,
		location: location || undefined,
		quote: quote || undefined,
		role: role || undefined,
		subtitle: subtitle || undefined,
		category: category || undefined,
		version: version || undefined,
		status: status || undefined,
		episode: episode || undefined,
		duration: duration || undefined,
		name: name || undefined,
		instructor: instructor || undefined,
		level: level || undefined,
	};
}

/**
 * Handle magic-link account creation request
 * Implements AQ-1.1: En tant que visiteur, je crée un compte via magic-link e-mail
 * 
 * Acceptance criteria:
 * • POST `/auth/request-link` avec `email`
 * • Mail envoyé (MailChannels)  
 * • Objet KV `account:{UUID}` créé
 */
async function handleMagicLinkRequest(
	request: Request,
	requestId: string,
	env: Env
): Promise<Response> {
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
 * 
 * Acceptance criteria:
 * • GET `/auth/callback?token=` pose cookie `edge_og_session` (JWT 24 h)
 * • Redirection `/dashboard`
 */
async function handleMagicLinkCallback(
	url: URL,
	requestId: string,
	env: Env
): Promise<Response> {
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
 * Handle dashboard access for authenticated users
 * Verifies session token and serves dashboard HTML
 */
async function handleDashboard(
	request: Request,
	requestId: string,
	env: Env
): Promise<Response> {
	try {
		// Validate environment configuration
		validateAuthEnvironment(env);

		// Check for session cookie
		const cookieHeader = request.headers.get('Cookie');
		let sessionToken = '';
		
		if (cookieHeader) {
			// Parse cookies to find edge_og_session
			const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
				const [key, value] = cookie.trim().split('=');
				acc[key] = value;
				return acc;
			}, {} as Record<string, string>);
			
			sessionToken = cookies['edge_og_session'] || '';
		}

		if (!sessionToken) {
			log({
				event: 'dashboard_access_no_session',
				request_id: requestId,
			});

			// Redirect to homepage for unauthenticated users
			const baseUrl = env.BASE_URL || `${new URL(request.url).protocol}//${new URL(request.url).host}`;
			return Response.redirect(`${baseUrl}/`, 302);
		}

		// Verify session token
		const payload = await verifyJWTToken<SessionPayload>(sessionToken, env.JWT_SECRET as string);
		if (!payload) {
			log({
				event: 'dashboard_access_invalid_session',
				request_id: requestId,
			});

			// Clear invalid session cookie and redirect
			const baseUrl = env.BASE_URL || `${new URL(request.url).protocol}//${new URL(request.url).host}`;
			const headers = new Headers();
			headers.set('Location', `${baseUrl}/`);
			headers.set('Set-Cookie', 'edge_og_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'); // Clear cookie
			
			return new Response(null, {
				status: 302,
				headers,
			});
		}

		// Verify account still exists
		const key = `account:${payload.account_id}`;
		const accountDataRaw = await env.ACCOUNTS.get(key);
		
		if (!accountDataRaw) {
			log({
				event: 'dashboard_access_account_not_found',
				account_id: payload.account_id,
				request_id: requestId,
			});

			// Clear session and redirect if account doesn't exist
			const baseUrl = env.BASE_URL || `${new URL(request.url).protocol}//${new URL(request.url).host}`;
			const headers = new Headers();
			headers.set('Location', `${baseUrl}/`);
			headers.set('Set-Cookie', 'edge_og_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'); // Clear cookie
			
			return new Response(null, {
				status: 302,
				headers,
			});
		}

		const accountData = JSON.parse(accountDataRaw) as { email_hash: string; created: string; plan: string };

		// Log successful dashboard access
		log({
			event: 'dashboard_access_success',
			account_id: payload.account_id,
			plan: accountData.plan,
			request_id: requestId,
		});

		// Serve dashboard HTML
		const dashboardHtml = getDashboardHTML(payload.account_id, accountData.plan);
		
		return new Response(dashboardHtml, {
			status: 200,
			headers: {
				'Content-Type': 'text/html; charset=utf-8',
				'Cache-Control': 'private, no-cache, no-store, must-revalidate',
			},
		});

	} catch (error) {
		log({
			event: 'dashboard_access_failed',
			error: error instanceof Error ? error.message : 'Unknown error',
			request_id: requestId,
		});

		// Return error response
		return new Response(
			JSON.stringify({
				error: 'Failed to access dashboard. Please try again.',
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
 * Generate dashboard HTML for authenticated users
 */
function getDashboardHTML(accountId: string, plan: string): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Dashboard - Edge-OG</title>
	<style>
		* {
			margin: 0;
			padding: 0;
			box-sizing: border-box;
		}
		
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
			line-height: 1.6;
			color: #333;
			background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
			min-height: 100vh;
		}
		
		.container {
			max-width: 1200px;
			margin: 0 auto;
			padding: 40px 20px;
		}
		
		.header {
			text-align: center;
			margin-bottom: 50px;
		}
		
		.header h1 {
			color: white;
			font-size: 3rem;
			margin-bottom: 10px;
			font-weight: 700;
		}
		
		.header p {
			color: rgba(255, 255, 255, 0.8);
			font-size: 1.2rem;
		}
		
		.dashboard-card {
			background: white;
			border-radius: 12px;
			box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
			padding: 40px;
			margin-bottom: 30px;
		}
		
		.account-info {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: 30px;
			padding-bottom: 20px;
			border-bottom: 2px solid #f0f0f0;
		}
		
		.account-info h2 {
			color: #333;
			font-size: 1.5rem;
		}
		
		.plan-badge {
			background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
			color: white;
			padding: 8px 16px;
			border-radius: 20px;
			font-size: 0.9rem;
			font-weight: 600;
			text-transform: uppercase;
		}
		
		.api-section {
			margin: 30px 0;
		}
		
		.api-section h3 {
			color: #333;
			margin-bottom: 15px;
			font-size: 1.3rem;
		}
		
		.api-example {
			background: #f8f9fa;
			border: 1px solid #e9ecef;
			border-radius: 8px;
			padding: 20px;
			font-family: 'Monaco', 'Menlo', monospace;
			font-size: 0.9rem;
			color: #495057;
			overflow-x: auto;
			margin: 10px 0;
		}
		
		.btn {
			display: inline-block;
			padding: 12px 24px;
			background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
			color: white;
			text-decoration: none;
			border-radius: 6px;
			font-weight: 600;
			transition: transform 0.2s;
		}
		
		.btn:hover {
			transform: translateY(-2px);
		}
		
		.feature-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
			gap: 30px;
			margin: 30px 0;
		}
		
		.feature-card {
			background: #f8f9fa;
			padding: 20px;
			border-radius: 8px;
			border-left: 4px solid #667eea;
		}
		
		.feature-card h4 {
			color: #333;
			margin-bottom: 10px;
		}
		
		@media (max-width: 768px) {
			.header h1 {
				font-size: 2rem;
			}
			
			.account-info {
				flex-direction: column;
				gap: 15px;
				text-align: center;
			}
			
			.dashboard-card {
				padding: 20px;
			}
		}
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<h1>🎨 Edge-OG Dashboard</h1>
			<p>Generate beautiful Open Graph images at the edge</p>
		</div>
		
		<div class="dashboard-card">
			<div class="account-info">
				<h2>Welcome back!</h2>
				<div class="plan-badge">${plan} Plan</div>
			</div>
			
			<div class="api-section">
				<h3>🚀 Quick Start</h3>
				<p>Generate Open Graph images by making GET requests to the <code>/og</code> endpoint:</p>
				
				<div class="api-example">
GET /og?title=Hello%20World&description=My%20awesome%20content&theme=dark&template=blog
				</div>
				
				<div class="feature-grid">
					<div class="feature-card">
						<h4>🎨 Themes</h4>
						<p>Choose from light, dark, blue, green, or purple themes</p>
					</div>
					<div class="feature-card">
						<h4>📝 Templates</h4>
						<p>11 specialized templates: blog, product, event, quote, minimal, news, tech, podcast, portfolio, course, and default</p>
					</div>
					<div class="feature-card">
						<h4>⚡ Fast</h4>
						<p>Edge-optimized with sub-150ms response times</p>
					</div>
					<div class="feature-card">
						<h4>🎯 Cached</h4>
						<p>Images cached for 1 year for optimal performance</p>
					</div>
				</div>
			</div>
			
			<div class="api-section">
				<h3>📖 API Examples</h3>
				
				<h4>Blog Post</h4>
				<div class="api-example">
/og?title=Building%20Modern%20APIs&description=Learn%20best%20practices%20for%20API%20development&template=blog&author=John%20Doe&theme=blue
				</div>
				
				<h4>Product Launch</h4>
				<div class="api-example">
/og?title=New%20Product%20Launch&description=Revolutionary%20software%20tool&template=product&price=$99&theme=green
				</div>
				
				<h4>Event</h4>
				<div class="api-example">
/og?title=Tech%20Conference%202025&description=Join%20industry%20leaders&template=event&date=March%2015&location=San%20Francisco&theme=purple
				</div>
			</div>
			
			<div style="text-align: center; margin-top: 40px;">
				<a href="/og?title=My%20First%20Image&description=Generated%20from%20dashboard&theme=dark" class="btn" target="_blank">
					Try Sample Image
				</a>
			</div>
		</div>
	</div>
</body>
</html>`;
}
