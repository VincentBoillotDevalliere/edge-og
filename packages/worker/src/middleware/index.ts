import { RequestContext, Middleware } from '../types/request';
import { log, logRequest } from '../utils/logger';
import { WorkerError } from '../utils/error';

/**
 * HTTPS redirect middleware
 * Forces HTTPS redirects as per security requirements (skip in local dev)
 */
export const httpsRedirectMiddleware: Middleware = async (context, next) => {
	const { url } = context;
	
	if (url.protocol === 'http:' && !url.hostname.includes('localhost')) {
		const httpsUrl = new URL(context.request.url);
		httpsUrl.protocol = 'https:';
		return Response.redirect(httpsUrl.toString(), 301);
	}
	
	return next();
};

/**
 * Error handling middleware
 * Catches and formats errors consistently
 */
export const errorHandlerMiddleware: Middleware = async (context, next) => {
	const { requestId, startTime } = context;
	
	try {
		return await next();
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
};

/**
 * Logging middleware
 * Logs successful requests with timing information
 */
export const loggingMiddleware: Middleware = async (context, next) => {
	const { startTime, requestId, url } = context;
	
	const response = await next();
	
	// Extract route name from pathname for logging
	const routeName = getRouteNameFromPath(url.pathname);
	
	// Log successful request
	logRequest(routeName, startTime, response.status, requestId);
	
	return response;
};

/**
 * Helper function to extract route name from pathname for logging
 */
function getRouteNameFromPath(pathname: string): string {
	if (pathname === '/') return 'homepage';
	if (pathname === '/health') return 'health_check';
	if (pathname === '/og') return 'og_image_generated';
	if (pathname === '/dashboard') return 'dashboard_accessed';
	if (pathname === '/auth/request-link') return 'magic_link_requested';
	if (pathname === '/auth/callback') return 'magic_link_callback';
	if (pathname === '/dashboard/api-keys') return 'api_key_generated';
	
	return 'unknown_route';
}
