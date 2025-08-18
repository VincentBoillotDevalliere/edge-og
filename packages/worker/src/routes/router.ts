import { RequestContext, Route, RouteHandler } from '../types/request';
import { WorkerError } from '../utils/error';

// Import all handlers from the handlers index
import {
	handleMagicLinkRequest,
	handleMagicLinkCallback,
		handleLogout,
	handleDashboard,
	handleDashboardUsage,
	handleTemplatesList,
	handleTemplatesCreate,
	handleTemplateUpdate,
	handleAPIKeyGeneration,
	handleAPIKeyListing,
	handleAPIKeyRevocation,
	handleOGImageGeneration,
	handleOGMethodNotAllowed,
	handleHomepage,
	handleHealthCheck,
	handleAdminUsageReset,
	handleCreateCheckoutSession,
	handleCreatePortalSession,
	handleStripeWebhook,
	handleAdminReportDailyOverage
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

		// Handle special cases
		
		// Templates update with dynamic ID: PUT /templates/{id}
		if (method === 'PUT' && pathname.startsWith('/templates/')) {
			return handleTemplateUpdate(context);
		}

		// API key revocation with dynamic ID: DELETE /dashboard/api-keys/{keyId}
		// Also forward malformed paths (e.g., missing keyId) to the handler so it can return 400 as per tests
		if (method === 'DELETE' && pathname.startsWith('/dashboard/api-keys/')) {
			return handleAPIKeyRevocation(context);
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
	router.addRoute('GET', '/auth/logout', handleLogout);

	// Dashboard routes
	router.addRoute('GET', '/dashboard', handleDashboard);
	router.addRoute('GET', '/dashboard/usage', handleDashboardUsage);

	router.addRoute('GET', '/templates', handleTemplatesList);
	router.addRoute('POST', '/templates', handleTemplatesCreate);
	// Dynamic route for PUT /templates/{id} handled in special cases above
	
	router.addRoute('GET', '/dashboard/api-keys', handleAPIKeyListing);
	router.addRoute('POST', '/dashboard/api-keys', handleAPIKeyGeneration);

	// OG image generation route
	router.addRoute('GET', '/og', handleOGImageGeneration);

	// Static routes
	router.addRoute('GET', '/', handleHomepage);
	router.addRoute('GET', '/health', handleHealthCheck);

	// Billing routes
	router.addRoute('POST', '/billing/checkout', handleCreateCheckoutSession);
	router.addRoute('POST', '/billing/portal', handleCreatePortalSession);
	router.addRoute('POST', '/webhooks/stripe', handleStripeWebhook);

	// Admin routes
	router.addRoute('POST', '/admin/usage/reset', handleAdminUsageReset);
	router.addRoute('POST', '/admin/billing/report-daily', handleAdminReportDailyOverage);

	return router;
}
