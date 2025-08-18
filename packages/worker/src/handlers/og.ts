import { RequestContext } from '../types/request';
import { WorkerError } from '../utils/error';
import { log } from '../utils/logger';
import { TemplateType } from '../templates';
import { renderOpenGraphImage } from '../render';
import { verifyAPIKey, verifyJWTToken, SessionPayload } from '../utils/auth';
import { checkAndIncrementQuota } from '../utils/quota';
import { incrementDailyOverage } from '../kv/overage';
import { 
	getCacheStatus, 
	generateETag, 
	normalizeParams, 
	createCacheMetrics,
	// EC-2: Cache invalidation imports
	generateVersionedETag,
	extractCacheVersion,
	validateCacheVersion,
	shouldInvalidateCache,
	getVersionedCacheHeaders,
	createCacheInvalidationMetrics
} from '../utils/cache';

/**
 * Handle Open Graph image generation
 * Implements CG-1: Generate PNG 1200×630 images <150ms
 * Implements EC-1: Cache optimization with hit ratio monitoring
 * Implements EC-2: Cache invalidation when hash changes
 */
export async function handleOGImageGeneration(context: RequestContext): Promise<Response> {
	const { url, requestId, ctx, request, env } = context;

	// Extract client IP from standard CF headers when available
	const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('x-forwarded-for') || undefined;
	const startRender = performance.now();

	// EC-1: Get cache status for monitoring
	const cacheStatus = getCacheStatus(request);

	// Validate and extract query parameters (we need templateId early for session-based preview auth)
	const params = validateOGParams(url.searchParams, requestId);

	// Optional session-based authentication for preview-by-ID (DB-2.3 UI flow)
	let sessionAuth = false;
	let sessionAccountId: string | null = null;
	if (params.templateId) {
		const cookieHeader = request.headers.get('Cookie') || '';
		if (cookieHeader.includes('edge_og_session=')) {
			try {
				const cookies = cookieHeader.split(';').reduce((acc, part) => {
					const [k, ...rest] = part.trim().split('=');
					acc[k] = rest.join('=');
					return acc;
				}, {} as Record<string, string>);
				const token = cookies['edge_og_session'];
				if (token) {
					const payload = await verifyJWTToken<SessionPayload>(token, (env.JWT_SECRET as string) || '');
					if (payload && payload.account_id) {
						sessionAuth = true;
						sessionAccountId = payload.account_id;
					}
				}
			} catch {}
		}
	}

	// AQ-2.3: Require Authorization: Bearer API key unless we have a valid session preview
	// Production default: enforce; allow opt-out in development unless explicitly required
	const envName = (env as any).ENVIRONMENT as string | undefined;
	const shouldEnforceAuth = envName === 'production' || (env as any).REQUIRE_AUTH === 'true';
	const mustVerifyApiKey = shouldEnforceAuth && !sessionAuth;
	let auth: Awaited<ReturnType<typeof verifyAPIKey>> | null = null;
	if (mustVerifyApiKey) {
		const authHeader = request.headers.get('Authorization') || '';
		auth = await verifyAPIKey(authHeader, env);
		if (!auth) {
			// AQ-4.1: Log structured auth failure with {event, kid (if any), ip}
			let kid: string | undefined;
			try {
				if (authHeader.startsWith('Bearer eog_')) {
					const parts = authHeader.substring(7).split('_');
					if (parts.length >= 2) kid = parts[1];
				}
			} catch {}
			log({ event: 'auth_failed', kid, ip, status: 401, request_id: requestId });
			throw new WorkerError('Unauthorized', 401, requestId);
		}

		// AQ-3.1: Enforce free tier quota (1 image/month default)
		// Read plan from ACCOUNTS (optional optimization later). For now, assume 'free'.
		let plan: string | undefined = 'free';
		try {
			const accountKey = `account:${auth.accountId}`;
			const acc = await env.ACCOUNTS.get(accountKey, 'json') as { plan?: string } | null;
			plan = acc?.plan || 'free';
		} catch {}

		const quota = await checkAndIncrementQuota(auth.kid, env, requestId, plan, ip);
		if (!quota.allowed) {
			// BI-2: Paid plans switch to pay-as-you-go overage instead of hard block
			if (plan && plan !== 'free') {
				try {
					await incrementDailyOverage(env, auth.accountId);
					log({ event: 'overage_recorded', kid: auth.kid, account_id: auth.accountId, plan, current: quota.current, limit: quota.limit, request_id: requestId });
				} catch (e) {
					log({ event: 'overage_record_failed', kid: auth.kid, account_id: auth.accountId, error: e instanceof Error ? e.message : String(e), request_id: requestId });
				}
				// Continue processing the request (no 429)
			} else {
				log({ event: 'quota_refused', kid: auth.kid, ip, plan, current: quota.current, limit: quota.limit, request_id: requestId });
				return new Response(
					JSON.stringify({
						error: 'Monthly quota exceeded for current plan.',
						plan,
						limit: quota.limit,
						usage: quota.current,
						request_id: requestId,
					}),
					{
						status: 429,
						headers: { 'Content-Type': 'application/json', 'Retry-After': '2592000' },
					}
				);
			}
		}
	}

	// DB-2.3: Preview a template by ID (maps to built-in slug for now)
	// If templateId is provided, load the template record from KV and set the template slug accordingly.
	// Note: We don't enforce published=true for preview; DB-2.5 will handle publish behavior for general serving.
	let isPreviewById = false;
	if (params.templateId) {
		const kvKey = `template:${params.templateId}`;
		const rec = await env.TEMPLATES.get(kvKey, 'json') as (null | {
			id: string;
			account: string;
			name: string;
			slug: string;
			source: string;
			version: number;
			createdAt: string;
			updatedAt: string;
			published: boolean;
		});
		if (!rec) {
			throw new WorkerError('Template not found', 404, requestId);
		}
		// If using session-based auth, enforce ownership
		if (sessionAuth && sessionAccountId && rec.account !== sessionAccountId) {
			throw new WorkerError('Forbidden', 403, requestId);
		}
		// Map stored slug to built-in template type for rendering
		(params as any).template = rec.slug as TemplateType;
		isPreviewById = true;
	}
	
	// EC-1: Normalize parameters for consistent caching
	const normalizedParams = normalizeParams(url.searchParams);

	// EC-2: Extract and validate cache version for invalidation support
	const rawCacheVersion = extractCacheVersion(url.searchParams, env);
	const cacheVersion = validateCacheVersion(rawCacheVersion);
	
	// EC-2: Check if cache should be invalidated
	const shouldInvalidate = shouldInvalidateCache(cacheVersion, cacheStatus.status === 'HIT' ? 'existing' : undefined);
	let wasInvalidated = false;
	
	if (shouldInvalidate && cacheVersion) {
		// Log cache invalidation for monitoring
		const invalidationMetrics = createCacheInvalidationMetrics(
			requestId,
			'existing',
			cacheVersion,
			'version_mismatch'
		);
			log(invalidationMetrics as Record<string, unknown> & { event: string });
		wasInvalidated = true;
	}

	// Generate the image with error handling for WASM issues
	let result: string | Uint8Array;
	try {
		result = await renderOpenGraphImage({ ...params, preview: isPreviewById });
	} catch (error) {
		// Check if this is a WASM compilation error that should be handled gracefully
		if (error instanceof Error && (
			error.message.includes('CompileError') ||
			error.message.includes('Wasm code generation disallowed') ||
			error.message.includes('PNG conversion is not available in local development') ||
			error.message.includes('WASM')
		)) {
			log({ event: 'wasm_png_error', status: 200, request_id: requestId, message: error.message });
			
			// Try to generate SVG instead
			try {
				result = await renderOpenGraphImage({ ...params, format: 'svg', preview: isPreviewById });
			} catch (svgError) {
				log({ event: 'svg_fallback_failed', status: 500, request_id: requestId, message: svgError instanceof Error ? svgError.message : String(svgError) });
				throw new WorkerError('Image generation failed', 500, requestId);
			}
		} else {
			// Re-throw other errors
			throw error;
		}
	}

	// Measure render time for performance monitoring
	const renderDuration = Math.round(performance.now() - startRender);

	// Determine if result is SVG or PNG
	const resultIsSvg = typeof result === 'string';
	const requestedPng = params.format !== 'svg';
	const fallbackOccurred = requestedPng && resultIsSvg;

	// EC-2: Generate versioned ETag for cache invalidation support
	const etag = cacheVersion 
		? await generateVersionedETag(normalizedParams, cacheVersion)
		: await generateETag(normalizedParams);

	// Enhanced logging with cache performance metrics
	log({
		event: 'image_rendered',
		duration_ms: renderDuration,
		request_id: requestId,
		template: params.template || 'default',
		theme: params.theme || 'light',
		font: params.font || 'inter',
		fontUrl: params.fontUrl ? 'custom' : undefined, // CG-4: Log custom font usage without exposing URL
		format: params.format || 'png',
		actual_format: resultIsSvg ? 'svg' : 'png',
		fallback_occurred: fallbackOccurred,
		// EC-2: Log cache version information
		cache_version: cacheVersion || 'none',
		cache_invalidated: wasInvalidated,
	});

	// EC-1: Log cache performance metrics
	const cacheMetrics = createCacheMetrics(
		cacheStatus,
		renderDuration,
		requestId,
		params.template || 'default'
	);
	log(cacheMetrics as Record<string, unknown> & { event: string });

	// Determine content type and response body
	const contentType = resultIsSvg ? 'image/svg+xml' : 'image/png';
	const responseBody: BodyInit = resultIsSvg ? (result as string) : (result as Uint8Array);

	// EC-2: Generate versioned cache headers with invalidation support
	const headers = getVersionedCacheHeaders(
		contentType,
		etag,
		requestId,
		renderDuration,
		cacheStatus.status,
		cacheVersion,
		wasInvalidated
	);

	// Add fallback notification header for debugging
	if (fallbackOccurred) {
		headers['X-Fallback-To-SVG'] = 'true';
		headers['X-Fallback-Reason'] = 'PNG conversion not available in development environment';
	}

	// Return with EC-1 compliant caching headers and EC-2 invalidation support
	return new Response(responseBody, {
		status: 200,
		headers,
	});
}

/**
 * Handle method not allowed for OG endpoint
 */
export function handleOGMethodNotAllowed(context: RequestContext): Response {
	const { requestId } = context;
	
	return new Response(
		JSON.stringify({
			error: 'Method not allowed. Only GET requests are supported.',
			request_id: requestId,
		}),
		{
			status: 405,
			headers: {
				'Content-Type': 'application/json',
				'Allow': 'GET',
			},
		}
	);
}

/**
 * Validate and sanitize Open Graph parameters
 * As per security requirements: validate all query params, max 200 chars decoded UTF-8
 * Implements CG-2: Theme and font parameters with fallback values
 */
function validateOGParams(searchParams: URLSearchParams, requestId: string): {
	title?: string;
	description?: string;
	theme?: 'light' | 'dark' | 'blue' | 'green' | 'purple';
	font?: 'inter' | 'roboto' | 'playfair' | 'opensans';
	fontUrl?: string; // CG-4: Custom font URL support
	template?: TemplateType;
	format?: 'png' | 'svg';
	emoji?: string; // CG-5: Emoji support
	templateId?: string; // DB-2.3: Preview KV template by ID
	// Template-specific parameters
	author?: string;
	price?: string;
	date?: string;
	location?: string;
	quote?: string;
	role?: string;
	subtitle?: string;
	category?: string;
	version?: string;
	status?: string;
	episode?: string;
	duration?: string;
	name?: string;
	instructor?: string;
	level?: string;
} {
	const title = searchParams.get('title');
	const description = searchParams.get('description');
	const theme = searchParams.get('theme');
	const font = searchParams.get('font');
	const fontUrl = searchParams.get('fontUrl'); // CG-4: Custom font URL
	const template = searchParams.get('template');
	const templateId = searchParams.get('templateId');
	const format = searchParams.get('format');
	const emoji = searchParams.get('emoji'); // CG-5: Emoji support
	
	// Extract template-specific parameters
	const author = searchParams.get('author');
	const price = searchParams.get('price');
	const date = searchParams.get('date');
	const location = searchParams.get('location');
	const quote = searchParams.get('quote');
	const role = searchParams.get('role');
	const subtitle = searchParams.get('subtitle');
	const category = searchParams.get('category');
	const version = searchParams.get('version');
	const status = searchParams.get('status');
	const episode = searchParams.get('episode');
	const duration = searchParams.get('duration');
	const name = searchParams.get('name');
	const instructor = searchParams.get('instructor');
	const level = searchParams.get('level');

	// Validate text length (max 200 chars as per security requirements)
	if (title && title.length > 200) {
		throw new WorkerError('Title parameter too long (max 200 characters)', 400, requestId);
	}

	if (description && description.length > 200) {
		throw new WorkerError('Description parameter too long (max 200 characters)', 400, requestId);
	}

	// Validate theme parameter - extended color themes with fallback to 'light'
	const validThemes = ['light', 'dark', 'blue', 'green', 'purple'];
	if (theme && !validThemes.includes(theme)) {
		throw new WorkerError('Invalid theme parameter. Must be one of: light, dark, blue, green, purple', 400, requestId);
	}

	// Validate font parameter - supported fonts with fallback to 'inter'
	const validFonts = ['inter', 'roboto', 'playfair', 'opensans'];
	if (font && !validFonts.includes(font)) {
		throw new WorkerError('Invalid font parameter. Must be one of: inter, roboto, playfair, opensans', 400, requestId);
	}

	// CG-4: Validate fontUrl parameter - must be valid HTTPS URL to TTF/OTF
	if (fontUrl) {
		try {
			const url = new URL(fontUrl);
			// Security: Only allow HTTPS URLs
			if (url.protocol !== 'https:') {
				throw new WorkerError('Custom font URL must use HTTPS', 400, requestId);
			}
			// Basic validation for font file extensions
			const pathname = url.pathname.toLowerCase();
			if (!pathname.endsWith('.ttf') && !pathname.endsWith('.otf') && !pathname.endsWith('.woff') && !pathname.endsWith('.woff2')) {
				throw new WorkerError('Custom font URL must point to a TTF, OTF, WOFF, or WOFF2 file', 400, requestId);
			}
		} catch (error) {
			if (error instanceof WorkerError) throw error;
			throw new WorkerError('Invalid fontUrl parameter. Must be a valid HTTPS URL', 400, requestId);
		}
	}

	// Validate format parameter (development use)
	const validFormats = ['png', 'svg'];
	if (format && !validFormats.includes(format)) {
		throw new WorkerError('Invalid format parameter. Must be "png" or "svg"', 400, requestId);
	}

	// CG-3: Validate template parameter - support all 10 templates
	const validTemplates = ['default', 'blog', 'product', 'event', 'quote', 'minimal', 'news', 'tech', 'podcast', 'portfolio', 'course'];
	if (template && !validTemplates.includes(template)) {
		throw new WorkerError(`Invalid template parameter. Must be one of: ${validTemplates.join(', ')}`, 400, requestId);
	}

	// DB-2.3: Validate templateId format (UUID v4 or slug-like id) and length
	if (templateId) {
		if (templateId.length > 64) {
			throw new WorkerError('templateId too long (max 64 characters)', 400, requestId);
		}
		if (!/^[a-z0-9-]{10,64}$/.test(templateId)) {
			throw new WorkerError('Invalid templateId format', 400, requestId);
		}
	}

	return {
		title: title || undefined,
		description: description || undefined,
		theme: (theme as 'light' | 'dark' | 'blue' | 'green' | 'purple') || undefined,
		font: (font as 'inter' | 'roboto' | 'playfair' | 'opensans') || undefined,
		fontUrl: fontUrl || undefined, // CG-4: Custom font URL
		template: (template as TemplateType) || undefined,
		format: (format as 'png' | 'svg') || undefined,
		emoji: emoji || undefined, // CG-5: Emoji support
		// Template-specific parameters
		author: author || undefined,
		price: price || undefined,
		date: date || undefined,
		location: location || undefined,
		quote: quote || undefined,
		role: role || undefined,
		subtitle: subtitle || undefined,
		category: category || undefined,
		version: version || undefined,
		status: status || undefined,
		episode: episode || undefined,
		duration: duration || undefined,
		name: name || undefined,
		instructor: instructor || undefined,
		level: level || undefined,
	templateId: templateId || undefined,
	};
}
