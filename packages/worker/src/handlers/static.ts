import { RequestContext } from '../types/request';
import { getHomePage } from '../utils/homepage';

/**
 * Handle homepage requests
 * Serves the static homepage with API documentation
 */
export async function handleHomepage(context: RequestContext): Promise<Response> {
	const { url } = context;
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
 * Handle health check requests
 * Returns service status and basic information
 */
export async function handleHealthCheck(context: RequestContext): Promise<Response> {
	const { requestId } = context;
	
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
