export {};

/**
 * Edge-OG Worker - Open Graph Image Generator at the Edge
 * 
 * Implements user story CG-1: En tant que crawler je reçois une image PNG 1200×630 <150 ms
 * Criteria: Content-Type: image/png, TTFB ≤ 150 ms
 */

import { renderOpenGraphImage } from './render';
import { WorkerError } from './utils/error';
import { log, logRequest } from './utils/logger';
import { TemplateType } from './templates';

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

			// Only handle GET requests
			if (request.method !== 'GET') {
				throw new WorkerError('Method not allowed', 405, requestId);
			}

			// Route: /og endpoint for Open Graph image generation
			if (url.pathname === '/og') {
				const response = await handleOGImageGeneration(url, requestId, ctx);
				
				// Log successful request
				logRequest('og_image_generated', startTime, response.status, requestId, {
					width: 1200,
					height: 630,
				});

				return response;
			}

			// Default route - basic health check
			if (url.pathname === '/') {
				return new Response(JSON.stringify({
					service: 'edge-og',
					version: '1.0.0',
					status: 'healthy',
					request_id: requestId,
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
 */
async function handleOGImageGeneration(
	url: URL,
	requestId: string,
	ctx: ExecutionContext
): Promise<Response> {
	const startRender = performance.now();

	// Validate and extract query parameters
	const params = validateOGParams(url.searchParams);

	// Generate the image
	const result = await renderOpenGraphImage(params);

	// Measure render time for performance monitoring
	const renderDuration = Math.round(performance.now() - startRender);

	// Determine if result is SVG or PNG
	const resultIsSvg = typeof result === 'string';
	const requestedPng = params.format !== 'svg';
	const fallbackOccurred = requestedPng && resultIsSvg;

	log({
		event: 'image_rendered',
		duration_ms: renderDuration,
		request_id: requestId,
		template: params.template || 'default',
		theme: params.theme || 'light',
		font: params.font || 'inter',
		format: params.format || 'png',
		actual_format: resultIsSvg ? 'svg' : 'png',
		fallback_occurred: fallbackOccurred,
	});

	// Determine content type and response body
	const contentType = resultIsSvg ? 'image/svg+xml' : 'image/png';
	const responseBody = resultIsSvg ? result as string : result as ArrayBuffer;

	// Prepare response headers
	const headers: Record<string, string> = {
		'Content-Type': contentType,
		'Cache-Control': 'public, immutable, max-age=31536000',
		'X-Request-ID': requestId,
		'X-Render-Time': `${renderDuration}ms`,
	};

	// Add fallback notification header for debugging
	if (fallbackOccurred) {
		headers['X-Fallback-To-SVG'] = 'true';
		headers['X-Fallback-Reason'] = 'PNG conversion not available in development environment';
	}

	// Return with proper caching headers
	// As per requirements: Cache-Control: public, immutable, max-age=31536000
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
	template?: TemplateType;
	format?: 'png' | 'svg';
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
	const template = searchParams.get('template');
	const format = searchParams.get('format');
	
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
		template: (template as TemplateType) || undefined,
		format: (format as 'png' | 'svg') || undefined,
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
