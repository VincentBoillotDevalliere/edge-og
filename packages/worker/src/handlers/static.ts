import { RequestContext } from '../types/request';
import homeHtml from '../pages/home.html';
import { verifyJWTToken, SessionPayload } from '../utils/auth';

/**
 * Handle homepage requests
 * Serves the static homepage with API documentation
 */
export async function handleHomepage(context: RequestContext): Promise<Response> {
	const { url, request, env } = context;
	const baseUrl = `${url.protocol}//${url.host}`;

	// Check auth: verify session token if present
	const cookieHeader = request.headers.get('Cookie') || '';
	const sessionMatch = cookieHeader.match(/(?:^|;\s*)edge_og_session=([^;]+)/);
	const sessionToken = sessionMatch ? sessionMatch[1] : '';
	let isAuthed = false;
	if (sessionToken) {
		try {
			const payload = await verifyJWTToken<SessionPayload>(sessionToken, env.JWT_SECRET as string);
			isAuthed = !!payload;
		} catch {
			isAuthed = false;
		}
	}

	const html = homeHtml
		.replaceAll('%%BASE_URL%%', baseUrl)
		.replaceAll('%%IS_AUTH%%', isAuthed ? 'true' : 'false');

	return new Response(html, {
		headers: {
				'Content-Type': 'text/html; charset=utf-8',
				'Cache-Control': isAuthed
					? 'private, no-cache, no-store, must-revalidate'
					: 'public, max-age=3600',
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
