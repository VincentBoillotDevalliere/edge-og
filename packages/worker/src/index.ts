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

	log({
		event: 'image_rendered',
		duration_ms: renderDuration,
		request_id: requestId,
		template: params.template || 'default',
		theme: params.theme || 'light',
		format: params.format || 'png',
	});

	// Determine content type and response
	const issvg = params.format === 'svg';
	const contentType = issvg ? 'image/svg+xml' : 'image/png';
	const responseBody = issvg ? result as string : result as ArrayBuffer;

	// Return with proper caching headers
	// As per requirements: Cache-Control: public, immutable, max-age=31536000
	return new Response(responseBody, {
		status: 200,
		headers: {
			'Content-Type': contentType,
			'Cache-Control': 'public, immutable, max-age=31536000',
			'X-Request-ID': requestId,
			'X-Render-Time': `${renderDuration}ms`,
		},
	});
}

/**
 * Validate and sanitize Open Graph parameters
 * As per security requirements: validate all query params, max 200 chars decoded UTF-8
 */
function validateOGParams(searchParams: URLSearchParams): {
	title?: string;
	description?: string;
	theme?: 'light' | 'dark';
	template?: string;
	format?: 'png' | 'svg';
} {
	const title = searchParams.get('title');
	const description = searchParams.get('description');
	const theme = searchParams.get('theme');
	const template = searchParams.get('template');
	const format = searchParams.get('format');

	// Validate text length (max 200 chars as per security requirements)
	if (title && title.length > 200) {
		throw new WorkerError('Title parameter too long (max 200 characters)', 400);
	}

	if (description && description.length > 200) {
		throw new WorkerError('Description parameter too long (max 200 characters)', 400);
	}

	// Validate theme parameter
	const validThemes = ['light', 'dark'];
	if (theme && !validThemes.includes(theme)) {
		throw new WorkerError('Invalid theme parameter. Must be "light" or "dark"', 400);
	}

	// Validate format parameter (development use)
	const validFormats = ['png', 'svg'];
	if (format && !validFormats.includes(format)) {
		throw new WorkerError('Invalid format parameter. Must be "png" or "svg"', 400);
	}

	// For CG-1, only default template is supported
	if (template && template !== 'default') {
		throw new WorkerError('Only "default" template is supported in this version', 400);
	}

	return {
		title: title || undefined,
		description: description || undefined,
		theme: (theme as 'light' | 'dark') || undefined,
		template: template || undefined,
		format: (format as 'png' | 'svg') || undefined,
	};
}
