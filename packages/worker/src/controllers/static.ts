/**
 * Static Controller
 * Handles static content like homepage and health checks
 */

import { getHomePage } from '../utils/homepage';
import type { RouteContext } from '../routes';

export class StaticController {
	/**
	 * Serve the homepage
	 */
	async serveHomepage(context: RouteContext): Promise<Response> {
		const { url, env } = context;

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

		const baseUrl = `${url.protocol}//${url.host}`;
		const homepage = getHomePage(baseUrl);
		
		return new Response(homepage, {
			headers: {
				'Content-Type': 'text/html; charset=utf-8',
				'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
			},
		});
	}

	/**
	 * Health check endpoint
	 */
	async healthCheck(context: RouteContext): Promise<Response> {
		const { url, requestId, env } = context;

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
}
