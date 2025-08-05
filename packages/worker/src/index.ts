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
	validateAuthEnvironment
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
