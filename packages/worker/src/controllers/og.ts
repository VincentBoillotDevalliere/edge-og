/**
 * Open Graph Image Generation Controller
 * Handles OG image generation business logic
 */

import { renderOpenGraphImage } from '../render';
import { WorkerError } from '../utils/error';
import { log } from '../utils/logger';
import { TemplateType } from '../templates';
import { 
	getCacheStatus, 
	generateETag, 
	normalizeParams, 
	createCacheMetrics,
	generateVersionedETag,
	extractCacheVersion,
	validateCacheVersion,
	shouldInvalidateCache,
	getVersionedCacheHeaders,
	createCacheInvalidationMetrics
} from '../utils/cache';
import type { RouteContext } from '../routes';

export class OGController {
	/**
	 * Handle Open Graph image generation
	 * Implements CG-1: Generate PNG 1200×630 images <150ms
	 * Implements EC-1: Cache optimization with hit ratio monitoring
	 * Implements EC-2: Cache invalidation when hash changes
	 */
	async generateImage(context: RouteContext): Promise<Response> {
		const { url, request, requestId, ctx, env } = context;

		// Force HTTPS redirect in production (but not in development)
		// Check for development environment indicators
		const isDevelopment = 
			url.hostname === 'localhost' || 
			url.hostname === '127.0.0.1' || 
			url.hostname.includes('local') ||
			env.RESEND_API_KEY === 'dev-placeholder-token' || 
			!env.RESEND_API_KEY;
			
		if (url.protocol === 'http:' && !isDevelopment) {
			const httpsUrl = url.toString().replace('http:', 'https:');
			return new Response(null, {
				status: 301,
				headers: {
					'Location': httpsUrl,
				},
			});
		}

		const startRender = performance.now();

		// EC-1: Get cache status for monitoring
		const cacheStatus = getCacheStatus(request);

		// Validate and extract query parameters
		const params = this.validateOGParams(url.searchParams, requestId);
		
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
	private validateOGParams(searchParams: URLSearchParams, requestId: string): {
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
			throw new WorkerError('Title parameter too long (max 200 characters)', 400, requestId);
		}

		if (description && description.length > 200) {
			throw new WorkerError('Description parameter too long (max 200 characters)', 400, requestId);
		}

		// Validate theme parameter - extended color themes with fallback to 'light'
		const validThemes = ['light', 'dark', 'blue', 'green', 'purple'];
		if (theme && !validThemes.includes(theme)) {
			throw new WorkerError('Invalid theme parameter. Must be one of: light, dark, blue, green, purple', 400, requestId);
		}

		// Validate font parameter - supported fonts with fallback to 'inter'
		const validFonts = ['inter', 'roboto', 'playfair', 'opensans'];
		if (font && !validFonts.includes(font)) {
			throw new WorkerError('Invalid font parameter. Must be one of: inter, roboto, playfair, opensans', 400, requestId);
		}

		// CG-4: Validate fontUrl parameter - must be valid HTTPS URL to TTF/OTF
		if (fontUrl) {
			try {
				const url = new URL(fontUrl);
				// Security: Only allow HTTPS URLs
				if (url.protocol !== 'https:') {
					throw new WorkerError('Custom font URL must use HTTPS', 400, requestId);
				}
				// Basic validation for font file extensions
				const pathname = url.pathname.toLowerCase();
				if (!pathname.endsWith('.ttf') && !pathname.endsWith('.otf') && !pathname.endsWith('.woff') && !pathname.endsWith('.woff2')) {
					throw new WorkerError('Custom font URL must point to a TTF, OTF, WOFF, or WOFF2 file', 400, requestId);
				}
			} catch (error) {
				if (error instanceof WorkerError) throw error;
				throw new WorkerError('Invalid fontUrl parameter. Must be a valid HTTPS URL', 400, requestId);
			}
		}

		// Validate format parameter (development use)
		const validFormats = ['png', 'svg'];
		if (format && !validFormats.includes(format)) {
			throw new WorkerError('Invalid format parameter. Must be "png" or "svg"', 400, requestId);
		}

		// CG-3: Validate template parameter - support all 10 templates
		const validTemplates = ['default', 'blog', 'product', 'event', 'quote', 'minimal', 'news', 'tech', 'podcast', 'portfolio', 'course'];
		if (template && !validTemplates.includes(template)) {
			throw new WorkerError(`Invalid template parameter. Must be one of: ${validTemplates.join(', ')}`, 400, requestId);
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
}
