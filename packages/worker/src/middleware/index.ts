import { RequestContext, Middleware } from '../types/request';
import { log, logRequest } from '../utils/logger';
import { WorkerError } from '../utils/error';

/**
 * HTTPS redirect middleware
 * Forces HTTPS redirects as per security requirements (skip in local dev)
 */
export const httpsRedirectMiddleware: Middleware = async (context, next) => {
	const { url } = context;
	
	// Allow local development without redirecting to https
	const isLocalHost = url.hostname.includes('localhost') || url.hostname === '127.0.0.1' || url.hostname === '0.0.0.0';
	if (url.protocol === 'http:' && !isLocalHost) {
		const httpsUrl = new URL(context.request.url);
		httpsUrl.protocol = 'https:';
		return Response.redirect(httpsUrl.toString(), 301);
	}
	
	return next();
};

/**
 * Security headers middleware
 * Adds HSTS (1 year) and other baseline security headers on HTTPS responses
 */
export const securityHeadersMiddleware: Middleware = async (context, next) => {
	const response = await next();

	// Only set HSTS on secure origins (browsers ignore it over HTTP anyway)
	const isHttps = context.url.protocol === 'https:';
	const newHeaders = new Headers(response.headers);

	if (isHttps) {
		// SC-1: HSTS for 1 year with subdomains and preload suggestion
		if (!newHeaders.has('Strict-Transport-Security')) {
			newHeaders.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
		}
	}

	// Conservative, broadly safe defaults (do not break image responses)
	if (!newHeaders.has('X-Content-Type-Options')) newHeaders.set('X-Content-Type-Options', 'nosniff');
	if (!newHeaders.has('Referrer-Policy')) newHeaders.set('Referrer-Policy', 'no-referrer');
	if (!newHeaders.has('X-Frame-Options')) newHeaders.set('X-Frame-Options', 'DENY');
	// Permissions-Policy with minimal surface
	if (!newHeaders.has('Permissions-Policy')) newHeaders.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

	return new Response(response.body, {
		status: response.status,
		headers: newHeaders,
	});
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
	if (pathname === '/dashboard/usage') return 'dashboard_usage';
	if (pathname === '/auth/request-link') return 'magic_link_requested';
	if (pathname === '/auth/callback') return 'magic_link_callback';
	if (pathname === '/dashboard/api-keys') return 'api_key_generated';
	if (pathname === '/admin/usage/reset') return 'admin_usage_reset';
	if (pathname === '/billing/checkout') return 'billing_checkout';
	if (pathname === '/webhooks/stripe') return 'stripe_webhook';
	
	return 'unknown_route';
}
