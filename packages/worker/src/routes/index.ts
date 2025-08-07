/**
 * Route definitions and router for Edge-OG Worker
 * Implements clean REST API patterns with separated concerns
 */

import { WorkerError } from '../utils/error';
import { authRoutes } from "./auth";
import { dashboardRoutes } from "./dashboard";
import { ogRoutes } from "./og";
import { staticRoutes } from "./static";


export interface RouteContext {
	request: Request;
	url: URL;
	requestId: string;
	startTime: number;
	env: Env;
	ctx: ExecutionContext;
}

export interface RouteHandler {
	(context: RouteContext): Promise<Response>;
}

export interface Route {
	method: string;
	path: string;
	handler: RouteHandler;
}

/**
 * Main router that matches requests to handlers
 */
export class Router {
	private routes: Route[] = [];

	constructor() {
		this.registerRoutes();
	}

	/**
	 * Register all application routes
	 */
	private registerRoutes(): void {
		// Authentication routes
		this.routes.push(...authRoutes);
		
		// Open Graph image generation routes  
		this.routes.push(...ogRoutes);
		
		// Dashboard routes
		this.routes.push(...dashboardRoutes);
		
		// Static routes (homepage, health)
		this.routes.push(...staticRoutes);
	}

	/**
	 * Handle incoming request
	 */
	async handleRequest(context: RouteContext): Promise<Response> {
		try {
			const { url, request } = context;
			const path = url.pathname;
			const method = request.method;

			// Find exact route match
			const route = this.findRoute(path, method);
			
			if (route) {
				return await route.handler(context);
			}

			// Check if path exists with different method (405 Method Not Allowed)
			const { exists, allowedMethods } = this.pathExistsWithDifferentMethod(path, method);
			if (exists) {
				return new Response(
					JSON.stringify({
						error: 'Method not allowed',
						request_id: context.requestId
					}),
					{
						status: 405,
						headers: {
							'Content-Type': 'application/json',
							'Allow': allowedMethods.join(', ')
						}
					}
				);
			}

			// No route found (404 Not Found)
			return new Response(
				JSON.stringify({
					error: 'Not found',
					request_id: context.requestId
				}),
				{
					status: 404,
					headers: {
						'Content-Type': 'application/json'
					}
				}
			);

		} catch (error) {
			console.error('Router error:', error);
			
			// Handle WorkerError instances with specific status codes
			if (error instanceof WorkerError) {
				return new Response(
					JSON.stringify({
						error: error.message,
						request_id: error.requestId || context.requestId
					}),
					{
						status: error.statusCode,
						headers: {
							'Content-Type': 'application/json'
						}
					}
				);
			}
			
			// Handle other errors as 500 Internal Server Error
			return new Response(
				JSON.stringify({
					error: 'Internal server error',
					request_id: context.requestId
				}),
				{
					status: 500,
					headers: {
						'Content-Type': 'application/json'
					}
				}
			);
		}
	}	/**
	 * Find route that matches path and method
	 */
	private findRoute(path: string, method: string): Route | null {
		return this.routes.find(route => 
			route.path === path && route.method === method
		) || null;
	}

	/**
	 * Check if path exists with different method (for 405 responses)
	 */
	private pathExistsWithDifferentMethod(path: string, method: string): { exists: boolean; allowedMethods: string[] } {
		const pathRoutes = this.routes.filter(route => route.path === path);
		if (pathRoutes.length === 0) {
			return { exists: false, allowedMethods: [] };
		}
		
		const allowedMethods = pathRoutes.map(route => route.method);
		return { 
			exists: !allowedMethods.includes(method), 
			allowedMethods 
		};
	}

	/**
	 * Get appropriate event name for logging based on route
	 */
	private getEventNameForRoute(route: Route): string {
		const eventMap: Record<string, string> = {
			'POST /auth/request-link': 'magic_link_requested',
			'GET /auth/callback': 'magic_link_callback',
			'DELETE /auth/session': 'user_logout',
			'GET /dashboard': 'dashboard_accessed',
			'GET /og': 'og_image_generated',
			'GET /': 'homepage_served',
			'GET /health': 'health_check',
		};

		const routeKey = `${route.method} ${route.path}`;
		return eventMap[routeKey] || 'request_handled';
	}
}
