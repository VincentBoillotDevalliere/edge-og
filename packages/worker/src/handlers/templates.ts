import { RequestContext } from '../types/request';
import { log } from '../utils/logger';
import { validateAuthEnvironment, verifyJWTToken, SessionPayload } from '../utils/auth';
import { WorkerError } from '../utils/error';
import { listTemplatesForAccount } from '../kv/templates';

/**
 * DB-2.1: List templates in the UI
 * GET /templates -> [ { id, name, slug, updatedAt, published } ]
 * - Requires authenticated session (edge_og_session cookie)
 * - 401 if unauthenticated or invalid session
 */
export async function handleTemplatesList(context: RequestContext): Promise<Response> {
  const { request, env, requestId } = context;
  try {
    validateAuthEnvironment(env, requestId);

    const sessionToken = extractSessionTokenFromCookies(request);
    if (!sessionToken) {
      return new Response(JSON.stringify({ error: 'Unauthorized', request_id: requestId }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const payload = await verifyJWTToken<SessionPayload>(sessionToken, env.JWT_SECRET as string);
    if (!payload) {
      return new Response(JSON.stringify({ error: 'Unauthorized', request_id: requestId }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const accountId = payload.account_id;
    const items = await listTemplatesForAccount(env, accountId);

    log({ event: 'templates_list_success', account_id: accountId, count: items.length, request_id: requestId });

    // Allow dev CORS from Next.js dashboard on localhost:3000
    const origin = request.headers.get('Origin') || '';
    const corsHeaders: Record<string, string> = {};
    if (origin.startsWith('http://localhost:3000')) {
      corsHeaders['Access-Control-Allow-Origin'] = origin;
      corsHeaders['Vary'] = 'Origin';
      corsHeaders['Access-Control-Allow-Credentials'] = 'true';
    }

    return new Response(JSON.stringify(items), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        ...corsHeaders,
      },
    });
  } catch (error) {
    log({ event: 'templates_list_error', error: error instanceof Error ? error.message : 'Unknown error', request_id: requestId });
    if (error instanceof WorkerError) return error.toResponse();
    const origin = request.headers.get('Origin') || '';
    const corsHeaders: Record<string, string> = {};
    if (origin.startsWith('http://localhost:3000')) {
      corsHeaders['Access-Control-Allow-Origin'] = origin;
      corsHeaders['Vary'] = 'Origin';
      corsHeaders['Access-Control-Allow-Credentials'] = 'true';
    }
    return new Response(JSON.stringify({ error: 'Failed to list templates', request_id: requestId }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}

function extractSessionTokenFromCookies(request: Request): string {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return '';
  const cookies = cookieHeader.split(';');
  for (const c of cookies) {
    const [k, ...rest] = c.trim().split('=');
    if (k === 'edge_og_session') return rest.join('=');
  }
  return '';
}
