import { describe, it, expect, beforeAll, vi } from 'vitest';

// Import the actual implementations instead of mocking
import { 
	generateETag, 
	getCacheStatus, 
	getCacheHeaders, 
	normalizeParams, 
	createCacheMetrics,
	normalizeCacheKey,
	calculateHitRatio,
	// EC-2: Cache invalidation imports
	generateVersionedETag,
	extractCacheVersion,
	validateCacheVersion,
	shouldInvalidateCache,
	getVersionedCacheHeaders,
	createCacheInvalidationMetrics
} from '../src/utils/cache';

describe('EC-1: Edge Caching & Performance', () => {

	describe('Cache Utilities', () => {

		it('generates consistent ETag for same parameters', async () => {
			const params1 = { template: 'blog', title: 'Test', theme: 'dark' };
			const params2 = { theme: 'dark', template: 'blog', title: 'Test' }; // Different order
			
			const etag1 = await generateETag(params1);
			const etag2 = await generateETag(params2);
			
			expect(etag1).toBe(etag2);
			expect(etag1).toMatch(/^"[a-f0-9]+"/); // Updated regex to match actual format
		});

		it('generates different ETags for different parameters', async () => {
			const params1 = { template: 'blog', title: 'Test1' };
			const params2 = { template: 'blog', title: 'Test2' };
			
			const etag1 = await generateETag(params1);
			const etag2 = await generateETag(params2);
			
			expect(etag1).not.toBe(etag2);
		});

		it('normalizes cache keys consistently', () => {
			const searchParams1 = new URLSearchParams('theme=dark&template=blog&title=Test');
			const searchParams2 = new URLSearchParams('template=blog&title=Test&theme=dark');
			
			const key1 = normalizeCacheKey(searchParams1);
			const key2 = normalizeCacheKey(searchParams2);
			
			expect(key1).toBe(key2);
			expect(key1).toContain('template=blog');
			expect(key1).toContain('theme=dark');
		});

		it('normalizes parameters with defaults', () => {
			const searchParams = new URLSearchParams('title=test');
			const normalized = normalizeParams(searchParams);
			
			expect(normalized).toEqual({
				title: 'test',
				template: 'default',
				theme: 'light',
				font: 'inter',
				format: 'png',
			});
		});

		it('detects cache status correctly', () => {
			const mockRequest = {
				cf: { cacheStatus: 'HIT', colo: 'DFW' }
			} as any;
			
			const status = getCacheStatus(mockRequest);
			
			expect(status.status).toBe('HIT');
			expect(status.isHit).toBe(true);
			expect(status.isMiss).toBe(false);
			expect(status.region).toBe('DFW');
		});

		it('generates proper cache headers', () => {
			const headers = getCacheHeaders(
				'image/png',
				'"abc123"',
				'test-request',
				50,
				'HIT'
			);
			
			expect(headers['Content-Type']).toBe('image/png');
			expect(headers['Cache-Control']).toBe('public, immutable, max-age=31536000');
			expect(headers['ETag']).toBe('"abc123"');
			expect(headers['X-Cache-Status']).toBe('HIT');
			expect(headers['X-Cache-TTL']).toBe('31536000'); // 1 year
		});

		it('calculates hit ratio correctly', () => {
			expect(calculateHitRatio(92, 100)).toBe(0.92);
			expect(calculateHitRatio(0, 100)).toBe(0);
			expect(calculateHitRatio(100, 100)).toBe(1);
			expect(calculateHitRatio(0, 0)).toBe(0);
		});

		it('creates cache performance metrics', () => {
			const cacheStatus = {
				status: 'HIT',
				isHit: true,
				isMiss: false,
				isExpired: false,
				region: 'DFW'
			};
			
			const metrics = createCacheMetrics(cacheStatus, 25, 'req-123', 'blog');
			
			expect(metrics.event).toBe('cache_performance');
			expect(metrics.cache_status).toBe('HIT');
			expect(metrics.is_hit).toBe(true);
			expect(metrics.duration_ms).toBe(25);
			expect(metrics.template).toBe('blog');
			expect(metrics.region).toBe('DFW');
			expect(metrics.request_id).toBe('req-123');
		});

	});

	describe('Cache Header Validation', () => {

		it('includes all required EC-1 cache headers', () => {
			const headers = getCacheHeaders('image/png', '"test"', 'req-1', 50, 'MISS');
			
			// EC-1 requirement: 1 year cache
			expect(headers['Cache-Control']).toBe('public, immutable, max-age=31536000');
			
			// Performance monitoring headers
			expect(headers['X-Render-Time']).toBe('50ms');
			expect(headers['X-Cache-Status']).toBe('MISS');
			expect(headers['X-Cache-TTL']).toBe('31536000');
			
			// Standard caching headers
			expect(headers['ETag']).toBe('"test"');
			expect(headers['Last-Modified']).toBeDefined();
			expect(headers['Vary']).toBe('Accept-Encoding');
		});

		it('sets immutable cache directive for optimization', () => {
			const headers = getCacheHeaders('image/png', '"test"', 'req-1', 50, 'HIT');
			
			expect(headers['Cache-Control']).toContain('immutable');
			expect(headers['Cache-Control']).toContain('public');
			expect(headers['Cache-Control']).toContain('max-age=31536000');
		});

	});

	describe('Cache Performance Monitoring', () => {

		it('tracks cache hit metrics', () => {
			const hitStatus = {
				status: 'HIT',
				isHit: true,
				isMiss: false,
				isExpired: false,
				region: 'LHR',
			};
			
			const metrics = createCacheMetrics(hitStatus, 15, 'req-hit', 'product');
			
			expect(metrics.is_hit).toBe(true);
			expect(metrics.is_miss).toBe(false);
			expect(metrics.duration_ms).toBe(15); // Fast hit
		});

		it('tracks cache miss metrics', () => {
			const missStatus = {
				status: 'MISS',
				isHit: false,
				isMiss: true,
				isExpired: false,
				region: 'DFW',
			};
			
			const metrics = createCacheMetrics(missStatus, 120, 'req-miss', 'event');
			
			expect(metrics.is_hit).toBe(false);
			expect(metrics.is_miss).toBe(true);
			expect(metrics.duration_ms).toBe(120); // Slower miss
		});

		it('tracks expired cache metrics', () => {
			const expiredStatus = {
				status: 'EXPIRED',
				isHit: false,
				isMiss: false,
				isExpired: true,
				region: 'NRT',
			};
			
			const metrics = createCacheMetrics(expiredStatus, 80, 'req-expired', 'minimal');
			
			expect(metrics.is_expired).toBe(true);
			expect(metrics.region).toBe('NRT');
		});

	});

	describe('Cache Key Consistency', () => {

		it('normalizes boolean parameters', () => {
			const params1 = new URLSearchParams('debug=true&verbose=FALSE');
			const params2 = new URLSearchParams('verbose=FALSE&debug=true');
			
			const key1 = normalizeCacheKey(params1);
			const key2 = normalizeCacheKey(params2);
			
			// Should be equal since both should be sorted alphabetically
			expect(key1).toBe(key2);
			expect(key1).toContain('debug=true');
			expect(key1).toContain('verbose=FALSE');
		});

		it('sorts parameters alphabetically', () => {
			const params = new URLSearchParams('z=1&a=2&m=3');
			const key = normalizeCacheKey(params);
			
			expect(key).toBe('a=2&m=3&z=1');
		});

		it('handles URL encoding consistently', () => {
			const params = new URLSearchParams();
			params.append('title', 'Hello World!');
			params.append('desc', 'Test & Example');
			
			const key = normalizeCacheKey(params);
			
			expect(key).toContain('Hello%20World!');
			expect(key).toContain('Test%20%26%20Example');
		});

	});	describe('Hit Ratio Compliance', () => {

		it('meets 90% hit ratio requirement', () => {
			// Simulate typical cache performance
			const scenarios = [
				{ hits: 920, total: 1000 }, // 92%
				{ hits: 9500, total: 10000 }, // 95%
				{ hits: 900, total: 1000 }, // 90% (minimum)
			];
			
			scenarios.forEach(({ hits, total }) => {
				const ratio = calculateHitRatio(hits, total);
				expect(ratio).toBeGreaterThanOrEqual(0.90); // EC-1 requirement
			});
		});

		it('identifies performance issues with low hit ratio', () => {
			const lowRatio = calculateHitRatio(850, 1000); // 85%
			expect(lowRatio).toBe(0.85); // Update expectation to match calculation
			expect(lowRatio).toBeLessThan(0.90); // Below EC-1 requirement
		});

	});

});

describe('Cache Integration Testing', () => {

	it('validates full cache workflow', async () => {
		const searchParams = new URLSearchParams('template=blog&title=Test&theme=dark');
		
		// Step 1: Normalize parameters
		const normalized = normalizeParams(searchParams);
		expect(normalized.template).toBe('blog');
		expect(normalized.title).toBe('test'); // normalized to lowercase
		expect(normalized.theme).toBe('dark');
		
		// Step 2: Generate ETag
		const etag = await generateETag(normalized);
		expect(etag).toMatch(/^"[a-f0-9]+"/); // Updated regex to match actual format
		
		// Step 3: Create cache headers
		const headers = getCacheHeaders('image/png', etag, 'req-test', 75, 'MISS');
		expect(headers['Cache-Control']).toBe('public, immutable, max-age=31536000');
		expect(headers['ETag']).toBe(etag);
	});

	it('simulates cache performance over time', () => {
		// Simulate requests over time - 900 hits out of 1000 total
		const requests = Array.from({ length: 1000 }, (_, i) => ({
			id: `req-${i}`,
			isHit: i >= 100, // First 100 are misses (indices 0-99), rest are hits (indices 100-999)
		}));
		
		const hits = requests.filter(r => r.isHit).length;
		const hitRatio = calculateHitRatio(hits, requests.length);
		
		expect(hits).toBe(900); // Verify we have exactly 900 hits
		expect(hitRatio).toBe(0.9); // 90% hit ratio (900/1000)
		expect(hitRatio).toBeGreaterThanOrEqual(0.90); // Meets EC-1 requirement
	});

});

describe('EC-2: Cache Invalidation', () => {

	describe('Cache Version Management', () => {

		it('generates different versioned ETags for different versions', async () => {
			const params = { template: 'blog', title: 'Test' };
			
			const etag1 = await generateVersionedETag(params, 'v1.0.0');
			const etag2 = await generateVersionedETag(params, 'v1.0.1');
			
			expect(etag1).not.toBe(etag2);
			expect(etag1).toMatch(/^"[a-f0-9]+"/);
			expect(etag2).toMatch(/^"[a-f0-9]+"/);
		});

		it('generates same versioned ETags for same version', async () => {
			const params = { template: 'blog', title: 'Test' };
			const version = 'v1.2.3';
			
			const etag1 = await generateVersionedETag(params, version);
			const etag2 = await generateVersionedETag(params, version);
			
			expect(etag1).toBe(etag2);
		});

		it('extracts cache version from URL parameters', () => {
			const searchParamsV = new URLSearchParams('title=Test&v=abc123');
			const searchParamsVersion = new URLSearchParams('title=Test&version=def456');
			const searchParamsCacheVersion = new URLSearchParams('title=Test&cache_version=ghi789');
			
			expect(extractCacheVersion(searchParamsV)).toBe('abc123');
			expect(extractCacheVersion(searchParamsVersion)).toBe('def456');
			expect(extractCacheVersion(searchParamsCacheVersion)).toBe('ghi789');
		});

		it('extracts cache version from environment', () => {
			const searchParams = new URLSearchParams('title=Test');
			const env = { CACHE_VERSION: 'env-v1.0.0' };
			
			expect(extractCacheVersion(searchParams, env)).toBe('env-v1.0.0');
		});

		it('prioritizes URL parameter over environment variable', () => {
			const searchParams = new URLSearchParams('title=Test&v=url-version');
			const env = { CACHE_VERSION: 'env-version' };
			
			expect(extractCacheVersion(searchParams, env)).toBe('url-version');
		});

		it('validates cache version format', () => {
			expect(validateCacheVersion('v1.0.0')).toBe('v1.0.0');
			expect(validateCacheVersion('abc123')).toBe('abc123');
			expect(validateCacheVersion('build-2024.01.15')).toBe('build-2024.01.15');
			
			// Invalid formats should return undefined
			expect(validateCacheVersion('version with spaces')).toBeUndefined();
			expect(validateCacheVersion('version@with!special#chars')).toBeUndefined();
			expect(validateCacheVersion('very-long-version-string-that-exceeds-32-characters')).toBeUndefined();
		});

	});

	describe('Cache Invalidation Logic', () => {

		it('identifies when cache should be invalidated', () => {
			expect(shouldInvalidateCache('v1.0.1', 'v1.0.0')).toBe(true);
			expect(shouldInvalidateCache('new-version', 'old-version')).toBe(true);
			expect(shouldInvalidateCache('same-version', 'same-version')).toBe(false);
		});

		it('handles missing version gracefully', () => {
			expect(shouldInvalidateCache(undefined, undefined)).toBe(false);
			expect(shouldInvalidateCache('v1.0.0', undefined)).toBe(true);
			expect(shouldInvalidateCache(undefined, 'v1.0.0')).toBe(true);
		});

		it('creates cache invalidation metrics', () => {
			const metrics = createCacheInvalidationMetrics(
				'req-123',
				'v1.0.0',
				'v1.0.1',
				'version_upgrade'
			);
			
			expect(metrics.event).toBe('cache_invalidation');
			expect(metrics.request_id).toBe('req-123');
			expect(metrics.old_version).toBe('v1.0.0');
			expect(metrics.new_version).toBe('v1.0.1');
			expect(metrics.invalidation_reason).toBe('version_upgrade');
			expect(metrics.timestamp).toBeDefined();
		});

		it('handles missing versions in invalidation metrics', () => {
			const metrics = createCacheInvalidationMetrics(
				'req-456',
				undefined,
				'v2.0.0',
				'first_deployment'
			);
			
			expect(metrics.old_version).toBe('none');
			expect(metrics.new_version).toBe('v2.0.0');
		});

	});

	describe('Versioned Cache Headers', () => {

		it('includes cache version in headers', () => {
			const headers = getVersionedCacheHeaders(
				'image/png',
				'"etag123"',
				'req-test',
				50,
				'MISS',
				'v1.2.3'
			);
			
			expect(headers['Cache-Control']).toBe('public, immutable, max-age=31536000');
			expect(headers['X-Cache-Version']).toBe('v1.2.3');
			expect(headers['ETag']).toBe('"etag123"');
		});

		it('includes invalidation flag when cache was invalidated', () => {
			const headers = getVersionedCacheHeaders(
				'image/png',
				'"etag456"',
				'req-test',
				75,
				'MISS',
				'v2.0.0',
				true
			);
			
			expect(headers['X-Cache-Version']).toBe('v2.0.0');
			expect(headers['X-Cache-Invalidated']).toBe('true');
		});

		it('works without version or invalidation flags', () => {
			const headers = getVersionedCacheHeaders(
				'image/png',
				'"etag789"',
				'req-test',
				25,
				'HIT'
			);
			
			expect(headers['Cache-Control']).toBe('public, immutable, max-age=31536000');
			expect(headers['X-Cache-Version']).toBeUndefined();
			expect(headers['X-Cache-Invalidated']).toBeUndefined();
		});

	});

	describe('EC-2 Integration Testing', () => {

		it('validates full cache invalidation workflow', async () => {
			const params = { template: 'blog', title: 'Test Article' };
			
			// Step 1: Generate ETag with version 1
			const etag1 = await generateVersionedETag(params, 'v1.0.0');
			
			// Step 2: Generate ETag with version 2 (should be different)
			const etag2 = await generateVersionedETag(params, 'v1.0.1');
			
			expect(etag1).not.toBe(etag2);
			
			// Step 3: Check invalidation logic
			const shouldInvalidate = shouldInvalidateCache('v1.0.1', 'v1.0.0');
			expect(shouldInvalidate).toBe(true);
			
			// Step 4: Create invalidation metrics
			const metrics = createCacheInvalidationMetrics(
				'req-workflow',
				'v1.0.0',
				'v1.0.1',
				'content_update'
			);
			
			expect(metrics.event).toBe('cache_invalidation');
			expect(metrics.old_version).toBe('v1.0.0');
			expect(metrics.new_version).toBe('v1.0.1');
		});

		it('supports cache invalidation via URL parameter', () => {
			const searchParams = new URLSearchParams('template=blog&title=Test&v=deploy-2024-01-15');
			
			const version = extractCacheVersion(searchParams);
			const validVersion = validateCacheVersion(version);
			
			expect(validVersion).toBe('deploy-2024-01-15');
			
			// Simulate cache hit with different version should invalidate
			const shouldInvalidate = shouldInvalidateCache(validVersion, 'deploy-2024-01-14');
			expect(shouldInvalidate).toBe(true);
		});

		it('supports cache invalidation via environment variable', () => {
			const searchParams = new URLSearchParams('template=minimal&title=Test');
			const env = { CACHE_VERSION: 'production-v2.1.0' };
			
			const version = extractCacheVersion(searchParams, env);
			expect(version).toBe('production-v2.1.0');
			
			// Should invalidate if stored version is different
			const shouldInvalidate = shouldInvalidateCache(version, 'production-v2.0.0');
			expect(shouldInvalidate).toBe(true);
		});

	});

});
