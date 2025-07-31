export {};

/**
 * Cache utilities for Edge-OG - EC-1 Implementation
 * Provides cache key normalization, ETag generation, and performance tracking
 */

/**
 * Generate a deterministic cache key from URL search parameters
 * Ensures consistent caching by normalizing parameter order and values
 */
export function normalizeCacheKey(searchParams: URLSearchParams): string {
	// Convert to array, sort alphabetically, and reconstruct
	const params = Array.from(searchParams.entries())
		.sort(([a], [b]) => a.localeCompare(b)) // Alphabetical sorting for consistency
		.map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
		.join('&');
	
	return params;
}

/**
 * Generate ETag for cache validation based on normalized parameters
 * Uses SHA-256 hash of sorted parameters for consistent ETags
 */
export async function generateETag(params: Record<string, unknown>): Promise<string> {
	// Create sorted JSON string for consistent hashing
	const sortedKeys = Object.keys(params).sort();
	const normalizedParams: Record<string, unknown> = {};
	
	for (const key of sortedKeys) {
		normalizedParams[key] = params[key];
	}
	
	const content = JSON.stringify(normalizedParams);
	const encoder = new TextEncoder();
	const data = encoder.encode(content);
	
	// Generate SHA-256 hash
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
	
	// Return first 16 characters as ETag (sufficient for uniqueness)
	return `"${hashHex.substring(0, 16)}"`;
}

/**
 * Detect cache status from Cloudflare request context
 * Returns structured cache information for logging and monitoring
 */
export function getCacheStatus(request: Request): {
	status: string;
	isHit: boolean;
	isMiss: boolean;
	isExpired: boolean;
	region: string;
} {
	// Extract cache status from Cloudflare context
	const cf = (request as any).cf;
	const cacheStatus = cf?.cacheStatus || 'UNKNOWN';
	const region = cf?.colo || 'unknown';
	
	return {
		status: cacheStatus,
		isHit: cacheStatus === 'HIT',
		isMiss: cacheStatus === 'MISS',
		isExpired: cacheStatus === 'EXPIRED',
		region,
	};
}

/**
 * Calculate cache hit ratio from metrics
 * Used for performance monitoring and SLA compliance
 */
export function calculateHitRatio(hits: number, total: number): number {
	if (total === 0) return 0;
	return Math.round((hits / total) * 10000) / 10000; // 4 decimal precision
}

/**
 * Generate cache-optimized response headers for EC-1 compliance
 * Includes all necessary headers for 1-year caching and performance monitoring
 */
export function getCacheHeaders(
	contentType: string,
	etag: string,
	requestId: string,
	renderTime: number,
	cacheStatus: string
): Record<string, string> {
	return {
		'Content-Type': contentType,
		'Cache-Control': 'public, immutable, max-age=31536000', // 1 year as per EC-1
		'ETag': etag,
		'Last-Modified': new Date().toUTCString(),
		'Vary': 'Accept-Encoding',
		'X-Request-ID': requestId,
		'X-Render-Time': `${renderTime}ms`,
		'X-Cache-Status': cacheStatus,
		'X-Cache-TTL': '31536000', // 1 year in seconds
	};
}

/**
 * Normalize URL parameters for consistent caching
 * Handles default values and parameter standardization
 */
export function normalizeParams(searchParams: URLSearchParams): Record<string, string> {
	const normalized: Record<string, string> = {};
	
	// Define default values for consistent caching
	const defaults = {
		template: 'default',
		theme: 'light',
		font: 'inter',
		format: 'png',
	};
	
	// Add all provided parameters
	for (const [key, value] of searchParams.entries()) {
		// Normalize boolean-like values
		if (value.toLowerCase() === 'true' || value.toLowerCase() === 'false') {
			normalized[key] = value.toLowerCase();
		} else {
			normalized[key] = value.trim().toLowerCase();
		}
	}
	
	// Apply defaults for missing parameters
	for (const [key, defaultValue] of Object.entries(defaults)) {
		if (!normalized[key]) {
			normalized[key] = defaultValue;
		}
	}
	
	return normalized;
}

/**
 * Cache performance metrics structure for monitoring
 */
export interface CacheMetrics {
	total_requests: number;
	cache_hits: number;
	cache_misses: number;
	hit_ratio: number;
	avg_ttfb_hit: number;
	avg_ttfb_miss: number;
	region: string;
	timestamp: string;
}

/**
 * Generate cache invalidation hash for EC-2 support
 * Creates a version hash that changes when content should be invalidated
 */
export function generateCacheVersion(baseParams: Record<string, unknown>, env?: any): string {
	const versionContent = {
		...baseParams,
		// Add deployment version or timestamp for invalidation control  
		version: env?.CACHE_VERSION || Date.now(),
	};
	
	const encoder = new TextEncoder();
	const data = encoder.encode(JSON.stringify(versionContent));
	
	// Use a simple hash for version control
	let hash = 0;
	for (let i = 0; i < data.length; i++) {
		const char = data[i];
		hash = ((hash << 5) - hash) + char;
		hash = hash & hash; // Convert to 32-bit integer
	}
	
	return Math.abs(hash).toString(16);
}

/**
 * Create cache performance log entry
 * Structured logging for cache analytics and monitoring
 */
export function createCacheMetrics(
	cacheStatus: ReturnType<typeof getCacheStatus>,
	duration: number,
	requestId: string,
	template: string
): Record<string, unknown> {
	return {
		event: 'cache_performance',
		request_id: requestId,
		cache_status: cacheStatus.status,
		is_hit: cacheStatus.isHit,
		is_miss: cacheStatus.isMiss,
		is_expired: cacheStatus.isExpired,
		duration_ms: duration,
		template,
		region: cacheStatus.region,
		timestamp: new Date().toISOString(),
	};
}
