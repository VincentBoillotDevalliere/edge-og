export {};

import { RequestContext } from '../types/request';
import { WorkerError } from '../utils/error';
import { verifyJWTToken, SessionPayload } from '../utils/auth';

/**
 * Templates: List templates for the authenticated account
 * Notes:
 * - Check session cookie first (return 401 if missing) to avoid env validation 500s in tests
 */
export async function handleTemplatesList(context: RequestContext): Promise<Response> {
	const { request, env, requestId } = context;

	// Auth: session cookie required
	const sessionToken = extractSessionTokenFromCookies(request);
	if (!sessionToken) {
		return jsonError('Authentication required. Please log in first.', 401, requestId);
	}

	// Verify session (tests mock verifyJWTToken)
	const payload = await verifyJWTToken<SessionPayload>(sessionToken, (env.JWT_SECRET as string) || '');
	if (!payload) {
		return jsonError('Invalid or expired session. Please log in again.', 401, requestId);
	}

	// List templates for account
	const items = await listTemplatesForAccount(payload.account_id, env);
	return new Response(
		JSON.stringify({ templates: items, request_id: requestId }),
		{ status: 200, headers: { 'Content-Type': 'application/json' } }
	);
}

/**
 * Templates: Create a template for the authenticated account
 * Expected behaviours (per tests):
 * - 401 if no session cookie
 * - 415 if Content-Type is not application/json
 * - 400 on validation errors
 * - 201 with { template: { id, name, slug, version, createdAt, updatedAt, published } }
 */
export async function handleTemplatesCreate(context: RequestContext): Promise<Response> {
	const { request, env, requestId } = context;

	// 1) Auth gate first
	const sessionToken = extractSessionTokenFromCookies(request);
	if (!sessionToken) {
		return jsonError('Authentication required. Please log in first.', 401, requestId);
	}

	// 2) Content-Type check BEFORE any env validation (tests expect 415 even without env vars)
	const contentType = request.headers.get('Content-Type') || '';
	if (!contentType.toLowerCase().includes('application/json')) {
		throw new WorkerError('Unsupported Media Type', 415, requestId);
	}

	// 3) Verify session (tests stub verifyJWTToken)
	const payload = await verifyJWTToken<SessionPayload>(sessionToken, (env.JWT_SECRET as string) || '');
	if (!payload) {
		return jsonError('Invalid or expired session. Please log in again.', 401, requestId);
	}

	// 4) Parse and validate body
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw new WorkerError('Invalid JSON body', 400, requestId);
	}

	const { name, slug, source } = (body as any) || {};
	validateTemplateInput(name, slug, source, requestId);

	// 5) Persist
	const created = await createTemplateForAccount(payload.account_id, { name, slug, source }, env);

	// 6) Return without echoing source
	return new Response(
		JSON.stringify({ template: created, request_id: requestId }),
		{ status: 201, headers: { 'Content-Type': 'application/json' } }
	);
}

// ---------------------- helpers ----------------------

function extractSessionTokenFromCookies(request: Request): string {
	const cookieHeader = request.headers.get('Cookie');
	if (!cookieHeader) return '';
	const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
		const [k, ...rest] = cookie.trim().split('=');
		acc[k] = rest.join('=');
		return acc;
	}, {} as Record<string, string>);
	return cookies['edge_og_session'] || '';
}

function jsonError(message: string, status: number, requestId?: string): Response {
	return new Response(
		JSON.stringify({ error: message, request_id: requestId }),
		{ status, headers: { 'Content-Type': 'application/json' } }
	);
}

function validateTemplateInput(name: unknown, slug: unknown, source: unknown, requestId?: string): void {
	// name
	if (typeof name !== 'string' || name.trim().length === 0) {
		throw new WorkerError('Name is required', 400, requestId);
	}
	if (name.length > 100) {
		throw new WorkerError('Name must be 100 characters or less', 400, requestId);
	}

	// slug
	if (typeof slug !== 'string' || slug.trim().length === 0) {
		throw new WorkerError('Slug is required', 400, requestId);
	}
	const normalizedSlug = slug.toLowerCase();
	if (slug !== normalizedSlug) {
		throw new WorkerError('Slug must be lowercase a-z0-9- only', 400, requestId);
	}
	if (!/^[a-z0-9-]{1,100}$/.test(slug)) {
		throw new WorkerError('Slug must match ^[a-z0-9-]{1,100}$', 400, requestId);
	}

	// source
	if (typeof source !== 'string' || source.trim().length === 0) {
		throw new WorkerError('Source is required', 400, requestId);
	}
	if (source.length > 20000) {
		throw new WorkerError('Source must be <= 20000 characters', 400, requestId);
	}
	if (/<script/i.test(source)) {
		throw new WorkerError('Source contains forbidden content', 400, requestId);
	}
}

// lightweight types and KV helpers
interface KVTemplateRecord {
	id: string;
	account: string;
	name: string;
	slug: string;
	source: string; // stored but not returned
	version: number;
	createdAt: string;
	updatedAt: string;
	published: boolean;
}

interface PublicTemplate {
	id: string;
	name: string;
	slug: string;
	version: number;
	createdAt: string;
	updatedAt: string;
	published: boolean;
}

async function listTemplatesForAccount(accountId: string, env: Env): Promise<PublicTemplate[]> {
	const result = await env.TEMPLATES.list({ prefix: 'template:' });
	const templates: PublicTemplate[] = [];
	for (const key of result.keys) {
		// filter by metadata.account when available; fallback to value check
		const meta = (key as any).metadata as { account?: string; slug?: string } | undefined;
		if (meta && meta.account !== accountId) continue;

		const data = await env.TEMPLATES.get(key.name, 'json') as KVTemplateRecord | null;
		if (!data) continue;
		if (data.account !== accountId) continue;

		templates.push(toPublic(data));
	}
	// newest first
	templates.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
	return templates;
}

async function createTemplateForAccount(
	accountId: string,
	input: { name: string; slug: string; source: string },
	env: Env
): Promise<PublicTemplate> {
	const nowISO = new Date().toISOString();
	const id = crypto.randomUUID();
	const record: KVTemplateRecord = {
		id,
		account: accountId,
		name: input.name,
		slug: input.slug,
		source: input.source,
		version: 1,
		createdAt: nowISO,
		updatedAt: nowISO,
		published: false,
	};

	const key = `template:${id}`;
	await env.TEMPLATES.put(key, JSON.stringify(record), {
		metadata: { account: accountId, slug: input.slug, created_at: Date.now() },
	});

	return toPublic(record);
}

function toPublic(rec: KVTemplateRecord): PublicTemplate {
	const { id, name, slug, version, createdAt, updatedAt, published } = rec;
	return { id, name, slug, version, createdAt, updatedAt, published };
}

