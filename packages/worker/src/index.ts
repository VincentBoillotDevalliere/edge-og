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
import { getHomePage } from './utils/homepage';

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

			// AQ-1: Dashboard API endpoints for API key management (allow POST/DELETE)
			if (url.pathname.startsWith('/dashboard')) {
				return await handleDashboardRequest(request, url, requestId, env);
			}

			// Only handle GET requests for non-dashboard routes
			if (request.method !== 'GET') {
				throw new WorkerError('Method not allowed', 405, requestId);
			}

			// Route: /og endpoint for Open Graph image generation
			if (url.pathname === '/og') {
				const response = await handleOGImageGeneration(url, requestId, ctx, request, env);
				
				// Log successful request
				logRequest('og_image_generated', startTime, response.status, requestId, {
					width: 1200,
					height: 630,
				});

				return response;
			}

			// Homepage with interactive API builder
			if (url.pathname === '/') {
				const baseUrl = `${url.protocol}//${url.host}`;
				return new Response(getHomePage(baseUrl), {
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
 * Implements AQ-1: API key authentication and quota management
 */
async function handleOGImageGeneration(
	url: URL,
	requestId: string,
	ctx: ExecutionContext,
	request: Request,
	env?: Env
): Promise<Response> {
	const startRender = performance.now();

	// AQ-1: API Key Authentication
	const { validateApiKey, incrementQuotaUsage, hasExceededQuota } = await import('./utils/apikey');
	
	// Extract API key from Authorization header or query parameter
	const authHeader = request.headers.get('Authorization');
	const apiKeyParam = url.searchParams.get('api_key');
	
	let apiKey: string | null = null;
	if (authHeader && authHeader.startsWith('Bearer ')) {
		apiKey = authHeader.substring(7);
	} else if (apiKeyParam) {
		apiKey = apiKeyParam;
	}

	// For now, allow requests without API key for free tier testing
	// In production, you might want to enforce API key requirement
	let apiKeyData = null;
	if (apiKey) {
		apiKeyData = await validateApiKey(apiKey, env);
		
		if (!apiKeyData) {
			throw new WorkerError('Invalid API key', 401, requestId);
		}

		// AQ-2: Check quota limits (soft blocking)
		const quotaExceeded = await hasExceededQuota(apiKeyData.id, env);
		if (quotaExceeded) {
			log({
				event: 'quota_exceeded',
				request_id: requestId,
				user_id: apiKeyData.userId,
				key_id: apiKeyData.id,
				quota_used: apiKeyData.quotaUsed,
				quota_limit: apiKeyData.quotaLimit,
			});

			// AQ-2: HTTP 429 after quota exceeded
			return new Response(JSON.stringify({
				error: 'Quota exceeded',
				message: `You have exceeded your quota of ${apiKeyData.quotaLimit} images per month. Current usage: ${apiKeyData.quotaUsed}`,
				quota_limit: apiKeyData.quotaLimit,
				quota_used: apiKeyData.quotaUsed,
				quota_reset_at: apiKeyData.quotaResetAt,
				request_id: requestId,
			}), {
				status: 429,
				headers: {
					'Content-Type': 'application/json',
					'X-RateLimit-Limit': apiKeyData.quotaLimit.toString(),
					'X-RateLimit-Remaining': Math.max(0, apiKeyData.quotaLimit - apiKeyData.quotaUsed).toString(),
					'X-RateLimit-Reset-At': apiKeyData.quotaResetAt,
				},
			});
		}
	}

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

	// AQ-1: Increment quota usage after successful image generation
	if (apiKeyData) {
		// Use execution context to increment quota asynchronously (don't block response)
		ctx.waitUntil(
			incrementQuotaUsage(apiKeyData.id, 1, env).then(success => {
				if (success) {
					log({
						event: 'quota_incremented',
						request_id: requestId,
						user_id: apiKeyData.userId,
						key_id: apiKeyData.id,
						quota_used: apiKeyData.quotaUsed + 1,
					});
				} else {
					log({
						event: 'quota_increment_failed',
						request_id: requestId,
						key_id: apiKeyData.id,
					});
				}
			})
		);

		// Add quota headers to response
		headers['X-RateLimit-Limit'] = apiKeyData.quotaLimit.toString();
		headers['X-RateLimit-Remaining'] = Math.max(0, apiKeyData.quotaLimit - apiKeyData.quotaUsed - 1).toString();
		headers['X-RateLimit-Reset-At'] = apiKeyData.quotaResetAt;
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
 * Handle dashboard API requests for API key management (AQ-1)
 * Endpoints:
 * - POST /dashboard/api-keys - Create new API key
 * - GET /dashboard/api-keys - List user's API keys  
 * - DELETE /dashboard/api-keys/:id - Revoke API key
 * - GET /dashboard/user/:userId - Get user info with quota
 */
async function handleDashboardRequest(
	request: Request,
	url: URL,
	requestId: string,
	env?: Env
): Promise<Response> {
	const { createApiKey, listApiKeys, revokeApiKey, validateApiKey } = await import('./utils/apikey');

	// CORS headers for dashboard requests
	const corsHeaders = {
		'Access-Control-Allow-Origin': '*', // In production, restrict this to your dashboard domain
		'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-ID',
	};

	// Handle preflight requests
	if (request.method === 'OPTIONS') {
		return new Response(null, {
			status: 204,
			headers: corsHeaders,
		});
	}

	const path = url.pathname;

	try {
		// POST /dashboard/api-keys - Create new API key (AQ-1: Main endpoint)
		if (path === '/dashboard/api-keys' && request.method === 'POST') {
			const body = await request.json() as {
				userId: string;
				name: string;
				quotaLimit?: number;
			};

			if (!body.userId || !body.name) {
				return new Response(JSON.stringify({
					error: 'Missing required fields: userId, name',
					request_id: requestId,
				}), {
					status: 400,
					headers: { 'Content-Type': 'application/json', ...corsHeaders },
				});
			}

			// Validate name length
			if (body.name.length > 50) {
				return new Response(JSON.stringify({
					error: 'API key name too long (max 50 characters)',
					request_id: requestId,
				}), {
					status: 400,
					headers: { 'Content-Type': 'application/json', ...corsHeaders },
				});
			}

			// AQ-2: Free tier default is 1000 images/month
			const quotaLimit = body.quotaLimit || 1000;

			const apiKeyWithSecret = await createApiKey(
				body.userId,
				body.name,
				quotaLimit,
				env
			);

			log({
				event: 'dashboard_api_key_created',
				request_id: requestId,
				user_id: body.userId,
				key_id: apiKeyWithSecret.id,
				quota_limit: quotaLimit,
			});

			return new Response(JSON.stringify({
				success: true,
				data: apiKeyWithSecret,
				request_id: requestId,
			}), {
				status: 201,
				headers: { 'Content-Type': 'application/json', ...corsHeaders },
			});
		}

		// GET /dashboard/api-keys?userId=... - List API keys for user
		if (path === '/dashboard/api-keys' && request.method === 'GET') {
			const userId = url.searchParams.get('userId');
			
			if (!userId) {
				return new Response(JSON.stringify({
					error: 'Missing userId parameter',
					request_id: requestId,
				}), {
					status: 400,
					headers: { 'Content-Type': 'application/json', ...corsHeaders },
				});
			}

			const apiKeys = await listApiKeys(userId, env);

			return new Response(JSON.stringify({
				success: true,
				data: apiKeys,
				request_id: requestId,
			}), {
				status: 200,
				headers: { 'Content-Type': 'application/json', ...corsHeaders },
			});
		}

		// DELETE /dashboard/api-keys/:keyId - Revoke API key
		const revokeMatch = path.match(/^\/dashboard\/api-keys\/([^/]+)$/);
		if (revokeMatch && request.method === 'DELETE') {
			const keyId = revokeMatch[1];
			const userId = request.headers.get('X-User-ID');

			if (!userId) {
				return new Response(JSON.stringify({
					error: 'Missing X-User-ID header',
					request_id: requestId,
				}), {
					status: 400,
					headers: { 'Content-Type': 'application/json', ...corsHeaders },
				});
			}

			const success = await revokeApiKey(keyId, userId, env);

			if (success) {
				log({
					event: 'dashboard_api_key_revoked',
					request_id: requestId,
					user_id: userId,
					key_id: keyId,
				});

				return new Response(JSON.stringify({
					success: true,
					message: 'API key revoked successfully',
					request_id: requestId,
				}), {
					status: 200,
					headers: { 'Content-Type': 'application/json', ...corsHeaders },
				});
			} else {
				return new Response(JSON.stringify({
					error: 'Failed to revoke API key or key not found',
					request_id: requestId,
				}), {
					status: 404,
					headers: { 'Content-Type': 'application/json', ...corsHeaders },
				});
			}
		}

		// GET /dashboard/user/:userId - Get user info with current quota usage
		const userMatch = path.match(/^\/dashboard\/user\/([^/]+)$/);
		if (userMatch && request.method === 'GET') {
			const userId = userMatch[1];
			const apiKeys = await listApiKeys(userId, env);

			// Calculate total quota usage across all active keys
			const totalQuotaUsed = apiKeys.reduce((sum, key) => sum + key.quotaUsed, 0);
			const totalQuotaLimit = apiKeys.reduce((sum, key) => sum + key.quotaLimit, 0);

			return new Response(JSON.stringify({
				success: true,
				data: {
					userId,
					activeKeys: apiKeys.length,
					totalQuotaUsed,
					totalQuotaLimit,
					quotaPercentage: totalQuotaLimit > 0 ? Math.round((totalQuotaUsed / totalQuotaLimit) * 100) : 0,
					keys: apiKeys,
				},
				request_id: requestId,
			}), {
				status: 200,
				headers: { 'Content-Type': 'application/json', ...corsHeaders },
			});
		}

		// 404 for unmatched dashboard routes
		return new Response(JSON.stringify({
			error: 'Dashboard endpoint not found',
			request_id: requestId,
		}), {
			status: 404,
			headers: { 'Content-Type': 'application/json', ...corsHeaders },
		});

	} catch (error) {
		log({
			event: 'dashboard_request_error',
			request_id: requestId,
			path,
			method: request.method,
			error: error instanceof Error ? error.message : String(error),
		});

		return new Response(JSON.stringify({
			error: 'Internal server error',
			request_id: requestId,
		}), {
			status: 500,
			headers: { 'Content-Type': 'application/json', ...corsHeaders },
		});
	}
}
