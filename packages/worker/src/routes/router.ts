import { RequestContext, Route, RouteHandler } from '../types/request';
import { WorkerError } from '../utils/error';

// Import all handlers from the handlers index
import {
	handleMagicLinkRequest,
	handleMagicLinkCallback,
	handleDashboard,
	handleAPIKeyGeneration,
	handleOGImageGeneration,
	handleOGMethodNotAllowed,
	handleHomepage,
	handleHealthCheck
} from '../handlers';

/**
 * Router class for handling route matching and dispatching
 */
export class Router {
	private routes: Route[] = [];

	/**
	 * Add a route to the router
	 */
	addRoute(method: string, path: string, handler: RouteHandler): void {
		this.routes.push({ method, path, handler });
	}

	/**
	 * Find and execute the matching route handler
	 */
	async handle(context: RequestContext): Promise<Response> {
		const { request, url } = context;
		const method = request.method;
		const pathname = url.pathname;

		// Find matching route
		const route = this.routes.find(r => 
			r.method === method && r.path === pathname
		);

		if (route) {
			return route.handler(context);
		}

		// Handle special case for OG endpoint - method not allowed
		if (pathname === '/og' && method !== 'GET') {
			return handleOGMethodNotAllowed(context);
		}

		// 404 for all other routes
		throw new WorkerError('Not found', 404, context.requestId);
	}
}

/**
 * Create and configure the application router
 */
export function createRouter(): Router {
	const router = new Router();

	// Authentication routes
	router.addRoute('POST', '/auth/request-link', handleMagicLinkRequest);
	router.addRoute('GET', '/auth/callback', handleMagicLinkCallback);

	// Dashboard routes
	router.addRoute('GET', '/dashboard', handleDashboard);
	router.addRoute('POST', '/dashboard/api-keys', handleAPIKeyGeneration);

	// OG image generation route
	router.addRoute('GET', '/og', handleOGImageGeneration);

	// Static routes
	router.addRoute('GET', '/', handleHomepage);
	router.addRoute('GET', '/health', handleHealthCheck);

	return router;
}
