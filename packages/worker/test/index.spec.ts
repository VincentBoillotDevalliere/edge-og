import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeAll, vi } from 'vitest';

// Mock render dependencies before any imports
vi.hoisted(() => {
	// Mock the render function to avoid Satori dependency issues
	const mockRenderOpenGraphImage = vi.fn().mockImplementation(async (params) => {
		// Return a fake PNG buffer for testing
		const fakeImage = new ArrayBuffer(1000);
		const view = new Uint8Array(fakeImage);
		// Add PNG signature
		view[0] = 137; view[1] = 80; view[2] = 78; view[3] = 71;
		view[4] = 13; view[5] = 10; view[6] = 26; view[7] = 10;
		return fakeImage;
	});

	// Mock modules that cause CommonJS issues
	vi.doMock('../src/render', () => ({
		renderOpenGraphImage: mockRenderOpenGraphImage,
	}));

	vi.doMock('satori', () => ({ default: vi.fn() }));
	vi.doMock('@resvg/resvg-wasm', () => ({ Resvg: vi.fn(), initWasm: vi.fn() }));
	vi.doMock('css-color-keywords', () => ({}));
	vi.doMock('css-to-react-native', () => ({ default: vi.fn() }));
});

import worker from '../src/index';

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe('Edge-OG Worker', () => {
	beforeAll(async () => {
		// Initialize WASM modules that might be needed
		// This ensures @resvg/resvg-wasm is properly loaded
	});

	describe('Health check', () => {
		it('serves API info JSON at root', async () => {
			const request = new IncomingRequest('https://example.com/', {
				headers: {
					'Accept': 'application/json'
				}
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			
			expect(response.status).toBe(200);
			expect(response.headers.get('Content-Type')).toBe('application/json');
			
			const data = await response.json() as any;
			expect(data.service).toBe('Edge-OG API');
			expect(data.version).toBe('1.0.0');
			expect(data.endpoints).toHaveProperty('generate');
			expect(data.endpoints).toHaveProperty('health');
			expect(data.endpoints).toHaveProperty('dashboard');
			expect(data.features).toContain('11 professional templates');
		});

		it('provides health check endpoint', async () => {
			const request = new IncomingRequest('https://example.com/health');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			
			expect(response.status).toBe(200);
			expect(response.headers.get('Content-Type')).toBe('application/json');
			
			const data = await response.json() as any;
			expect(data).toMatchObject({
				service: 'edge-og',
				version: '1.0.0',
				status: 'healthy',
			});
			expect(data.request_id).toBeDefined();
		});

		it('forces HTTPS redirect', async () => {
			const request = new IncomingRequest('http://example.com/');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			
			expect(response.status).toBe(301);
			expect(response.headers.get('Location')).toBe('https://example.com/');
		});
	});

	describe('CG-1: Open Graph Image Generation', () => {
		it('generates PNG image at /og endpoint', async () => {
			const request = new IncomingRequest('https://example.com/og');
			const ctx = createExecutionContext();
			
			const startTime = performance.now();
			const response = await worker.fetch(request, env, ctx);
			const duration = performance.now() - startTime;
			
			await waitOnExecutionContext(ctx);
			
			// Verify response criteria for CG-1
			expect(response.status).toBe(200);
			expect(response.headers.get('Content-Type')).toBe('image/png');
			
			// Verify TTFB ≤ 150ms requirement (allowing some overhead for test environment)
			expect(duration).toBeLessThan(200); // 200ms to account for test overhead
			
			// Verify EC-1 caching headers requirements
			expect(response.headers.get('Cache-Control')).toBe('public, immutable, max-age=31536000');
			expect(response.headers.get('ETag')).toMatch(/^"[a-f0-9]+"/); // ETag format validation
			expect(response.headers.get('Last-Modified')).toBeDefined();
			expect(response.headers.get('Vary')).toBe('Accept-Encoding');
			expect(response.headers.get('X-Cache-TTL')).toBe('31536000'); // 1 year
			
			// Verify response contains image data
			const arrayBuffer = await response.arrayBuffer();
			expect(arrayBuffer.byteLength).toBeGreaterThan(0);
			
			// Verify PNG signature (first 8 bytes)
			const pngHeader = new Uint8Array(arrayBuffer.slice(0, 8));
			const expectedPngHeader = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
			expect(Array.from(pngHeader)).toEqual(Array.from(expectedPngHeader));
		});

		it('accepts query parameters', async () => {
			const searchParams = new URLSearchParams({
				title: 'Test Title',
				description: 'Test Description',
				theme: 'dark',
			});
			
			const request = new IncomingRequest(`https://example.com/og?${searchParams}`);
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			
			expect(response.status).toBe(200);
			expect(response.headers.get('Content-Type')).toBe('image/png');
		});

		it('validates parameter lengths (security requirement)', async () => {
			const longTitle = 'x'.repeat(201); // Exceeds 200 char limit
			const searchParams = new URLSearchParams({ title: longTitle });
			
			const request = new IncomingRequest(`https://example.com/og?${searchParams}`);
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			
			expect(response.status).toBe(400);
			const data = await response.json() as any;
			expect(data.error).toContain('Title parameter too long');
		});

		it('validates theme parameter', async () => {
			const searchParams = new URLSearchParams({ theme: 'invalid' });
			
			const request = new IncomingRequest(`https://example.com/og?${searchParams}`);
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			
			expect(response.status).toBe(400);
			const data = await response.json() as any;
			expect(data.error).toContain('Invalid theme parameter');
		});

		it('only allows GET method', async () => {
			const request = new IncomingRequest('https://example.com/og', { method: 'POST' });
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			
			expect(response.status).toBe(405);
		});
	});

	describe('CG-2: Theme and Font Parameters with Fallbacks', () => {
		it('accepts extended theme parameters', async () => {
			const themes = ['light', 'dark', 'blue', 'green', 'purple'];
			
			for (const theme of themes) {
				const searchParams = new URLSearchParams({
					title: 'Test Title',
					description: 'Test Description',
					theme: theme,
				});
				
				const request = new IncomingRequest(`https://example.com/og?${searchParams}`);
				const ctx = createExecutionContext();
				const response = await worker.fetch(request, env, ctx);
				await waitOnExecutionContext(ctx);
				
				expect(response.status).toBe(200);
				expect(response.headers.get('Content-Type')).toBe('image/png');
			}
		});

		it('accepts font parameters', async () => {
			const fonts = ['inter', 'roboto', 'playfair', 'opensans'];
			
			for (const font of fonts) {
				const searchParams = new URLSearchParams({
					title: 'Test Title',
					description: 'Test Description',
					font: font,
				});
				
				const request = new IncomingRequest(`https://example.com/og?${searchParams}`);
				const ctx = createExecutionContext();
				const response = await worker.fetch(request, env, ctx);
				await waitOnExecutionContext(ctx);
				
				expect(response.status).toBe(200);
				expect(response.headers.get('Content-Type')).toBe('image/png');
			}
		});

		it('validates font parameter', async () => {
			const searchParams = new URLSearchParams({ font: 'invalid' });
			
			const request = new IncomingRequest(`https://example.com/og?${searchParams}`);
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			
			expect(response.status).toBe(400);
			const data = await response.json() as any;
			expect(data.error).toContain('Invalid font parameter');
		});

		it('combines theme and font parameters', async () => {
			const searchParams = new URLSearchParams({
				title: 'Test with Custom Theme and Font',
				description: 'Testing CG-2 implementation',
				theme: 'purple',
				font: 'playfair',
			});
			
			const request = new IncomingRequest(`https://example.com/og?${searchParams}`);
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			
			expect(response.status).toBe(200);
			expect(response.headers.get('Content-Type')).toBe('image/png');
			
			// Verify response contains image data
			const arrayBuffer = await response.arrayBuffer();
			expect(arrayBuffer.byteLength).toBeGreaterThan(0);
		});

		it('validates extended theme parameter values', async () => {
			const searchParams = new URLSearchParams({ theme: 'rainbow' }); // invalid
			
			const request = new IncomingRequest(`https://example.com/og?${searchParams}`);
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			
			expect(response.status).toBe(400);
			const data = await response.json() as any;
			expect(data.error).toContain('Invalid theme parameter. Must be one of: light, dark, blue, green, purple');
		});
	});

	describe('CG-3: Template Support', () => {
		it('accepts all template types', async () => {
			const templates = [
				'default', 'blog', 'product', 'event', 'quote', 
				'minimal', 'news', 'tech', 'podcast', 'portfolio', 'course'
			];
			
			for (const template of templates) {
				const searchParams = new URLSearchParams({
					title: `Test ${template} Template`,
					description: 'Testing template functionality',
					template: template,
				});
				
				const request = new IncomingRequest(`https://example.com/og?${searchParams}`);
				const ctx = createExecutionContext();
				const response = await worker.fetch(request, env, ctx);
				await waitOnExecutionContext(ctx);
				
				expect(response.status).toBe(200);
				expect(response.headers.get('Content-Type')).toBe('image/png');
			}
		});

		it('validates template parameter', async () => {
			const searchParams = new URLSearchParams({ template: 'invalid' });
			
			const request = new IncomingRequest(`https://example.com/og?${searchParams}`);
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			
			expect(response.status).toBe(400);
			const data = await response.json() as any;
			expect(data.error).toContain('Invalid template parameter');
		});

		it('accepts template-specific parameters', async () => {
			// Test blog template with author
			const blogParams = new URLSearchParams({
				title: 'My Blog Post',
				description: 'An amazing article',
				template: 'blog',
				author: 'John Doe',
			});
			
			const blogRequest = new IncomingRequest(`https://example.com/og?${blogParams}`);
			const blogCtx = createExecutionContext();
			const blogResponse = await worker.fetch(blogRequest, env, blogCtx);
			await waitOnExecutionContext(blogCtx);
			
			expect(blogResponse.status).toBe(200);

			// Test product template with price
			const productParams = new URLSearchParams({
				title: 'Amazing Product',
				description: 'The best product ever',
				template: 'product',
				price: '$99.99',
			});
			
			const productRequest = new IncomingRequest(`https://example.com/og?${productParams}`);
			const productCtx = createExecutionContext();
			const productResponse = await worker.fetch(productRequest, env, productCtx);
			await waitOnExecutionContext(productCtx);
			
			expect(productResponse.status).toBe(200);
		});

		it('falls back to default template when not specified', async () => {
			const searchParams = new URLSearchParams({
				title: 'Test Title',
				description: 'Test Description',
				// No template specified - should use default
			});
			
			const request = new IncomingRequest(`https://example.com/og?${searchParams}`);
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			
			expect(response.status).toBe(200);
			expect(response.headers.get('Content-Type')).toBe('image/png');
		});
	});

	describe('CG-4: Custom Font URL Support', () => {
		it('validates fontUrl parameter - requires HTTPS', async () => {
			const searchParams = new URLSearchParams({
				title: 'Test Custom Font',
				fontUrl: 'http://fonts.example.com/CustomFont.ttf', // HTTP not allowed
			});
			
			const request = new IncomingRequest(`https://example.com/og?${searchParams}`);
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			
			expect(response.status).toBe(400);
			const data = await response.json() as any;
			expect(data.error).toContain('Custom font URL must use HTTPS');
		});

		it('validates fontUrl parameter - requires valid font extension', async () => {
			const searchParams = new URLSearchParams({
				title: 'Test Custom Font',
				fontUrl: 'https://fonts.example.com/NotAFont.pdf', // Invalid extension
			});
			
			const request = new IncomingRequest(`https://example.com/og?${searchParams}`);
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			
			expect(response.status).toBe(400);
			const data = await response.json() as any;
			expect(data.error).toContain('Custom font URL must point to a TTF, OTF, WOFF, or WOFF2 file');
		});

		it('validates fontUrl parameter - requires valid URL format', async () => {
			const searchParams = new URLSearchParams({
				title: 'Test Custom Font',
				fontUrl: 'not-a-valid-url', // Invalid URL
			});
			
			const request = new IncomingRequest(`https://example.com/og?${searchParams}`);
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			
			expect(response.status).toBe(400);
			const data = await response.json() as any;
			expect(data.error).toContain('Invalid fontUrl parameter. Must be a valid HTTPS URL');
		});

		it('accepts valid fontUrl with TTF extension', async () => {
			const searchParams = new URLSearchParams({
				title: 'Test Custom Font',
				fontUrl: 'https://fonts.example.com/CustomFont.ttf', // Valid TTF URL - will fail to load but pass validation
			});
			
			const request = new IncomingRequest(`https://example.com/og?${searchParams}`);
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			
			// Should succeed with fallback font since the custom font URL will fail to load
			expect(response.status).toBe(200);
			expect(response.headers.get('Content-Type')).toBe('image/png');
		});

		it('accepts valid fontUrl with different extensions', async () => {
			const validExtensions = ['ttf', 'otf', 'woff', 'woff2'];
			
			for (const ext of validExtensions) {
				const searchParams = new URLSearchParams({
					title: 'Test Custom Font',
					fontUrl: `https://fonts.example.com/CustomFont.${ext}`,
				});
				
				const request = new IncomingRequest(`https://example.com/og?${searchParams}`);
				const ctx = createExecutionContext();
				const response = await worker.fetch(request, env, ctx);
				await waitOnExecutionContext(ctx);
				
				// Should pass validation (actual font loading will fail and fallback)
				expect(response.status).toBe(200);
			}
		});

		it('combines fontUrl with other parameters', async () => {
			const searchParams = new URLSearchParams({
				title: 'Test Custom Font with Theme',
				description: 'Testing CG-4 implementation',
				theme: 'dark',
				fontUrl: 'https://fonts.example.com/CustomFont.ttf',
			});
			
			const request = new IncomingRequest(`https://example.com/og?${searchParams}`);
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			
			expect(response.status).toBe(200);
			expect(response.headers.get('Content-Type')).toBe('image/png');
		});

		it('falls back gracefully when custom font loading fails', async () => {
			const searchParams = new URLSearchParams({
				title: 'Test Font Fallback',
				description: 'Should fallback to Inter when custom font fails',
				fontUrl: 'https://nonexistent.example.com/NonExistentFont.ttf',
			});
			
			const request = new IncomingRequest(`https://example.com/og?${searchParams}`);
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			
			// Should still generate image with fallback font
			expect(response.status).toBe(200);
			expect(response.headers.get('Content-Type')).toBe('image/png');
		});
	});

	describe('EC-1: Edge Caching & Performance', () => {
		it('returns proper cache headers for 1-year caching', async () => {
			const request = new IncomingRequest('https://example.com/og?template=blog&title=Cache%20Test');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			
			expect(response.status).toBe(200);
			
			// EC-1 requirement: 1 year cache with immutable directive
			expect(response.headers.get('Cache-Control')).toBe('public, immutable, max-age=31536000');
			
			// Cache validation headers
			expect(response.headers.get('ETag')).toMatch(/^"[a-f0-9]+"/);
			expect(response.headers.get('Last-Modified')).toBeDefined();
			expect(response.headers.get('Vary')).toBe('Accept-Encoding');
			
			// Performance monitoring headers
			expect(response.headers.get('X-Cache-TTL')).toBe('31536000');
			expect(response.headers.get('X-Cache-Status')).toBeDefined();
			expect(response.headers.get('X-Render-Time')).toMatch(/^\d+ms$/);
		});

		it('generates consistent ETags for same parameters', async () => {
			const params = 'template=default&title=Test&theme=light';
			
			const request1 = new IncomingRequest(`https://example.com/og?${params}`);
			const request2 = new IncomingRequest(`https://example.com/og?${params}`);
			
			const ctx1 = createExecutionContext();
			const ctx2 = createExecutionContext();
			
			const response1 = await worker.fetch(request1, env, ctx1);
			const response2 = await worker.fetch(request2, env, ctx2);
			
			await waitOnExecutionContext(ctx1);
			await waitOnExecutionContext(ctx2);
			
			const etag1 = response1.headers.get('ETag');
			const etag2 = response2.headers.get('ETag');
			
			expect(etag1).toBe(etag2); // Same parameters = same ETag
			expect(etag1).toMatch(/^"[a-f0-9]+"/);
		});

		it('generates different ETags for different parameters', async () => {
			const request1 = new IncomingRequest('https://example.com/og?template=blog&title=Test1');
			const request2 = new IncomingRequest('https://example.com/og?template=blog&title=Test2');
			
			const ctx1 = createExecutionContext();
			const ctx2 = createExecutionContext();
			
			const response1 = await worker.fetch(request1, env, ctx1);
			const response2 = await worker.fetch(request2, env, ctx2);
			
			await waitOnExecutionContext(ctx1);
			await waitOnExecutionContext(ctx2);
			
			const etag1 = response1.headers.get('ETag');
			const etag2 = response2.headers.get('ETag');
			
			expect(etag1).not.toBe(etag2); // Different parameters = different ETags
		});

		it('maintains TTFB performance with caching headers', async () => {
			const request = new IncomingRequest('https://example.com/og?template=product&title=Performance%20Test');
			const ctx = createExecutionContext();
			
			const startTime = performance.now();
			const response = await worker.fetch(request, env, ctx);
			const duration = performance.now() - startTime;
			
			await waitOnExecutionContext(ctx);
			
			// Performance requirements maintained
			expect(duration).toBeLessThan(200); // TTFB ≤ 150ms + test overhead
			expect(response.status).toBe(200);
			
			// Cache headers don't impact performance
			expect(response.headers.get('Cache-Control')).toBeDefined();
			expect(response.headers.get('ETag')).toBeDefined();
		});

		it('includes cache performance monitoring headers', async () => {
			const request = new IncomingRequest('https://example.com/og?template=minimal&title=Monitor');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			
			// Monitoring headers for cache analytics
			expect(response.headers.get('X-Request-ID')).toBeDefined();
			expect(response.headers.get('X-Render-Time')).toMatch(/^\d+ms$/);
			expect(response.headers.get('X-Cache-Status')).toBeDefined();
			expect(response.headers.get('X-Cache-TTL')).toBe('31536000');
		});

		it('handles template variations with proper caching', async () => {
			const templates = ['default', 'blog', 'product', 'event'];
			
			for (const template of templates) {
				const request = new IncomingRequest(`https://example.com/og?template=${template}&title=Cache%20Test`);
				const ctx = createExecutionContext();
				const response = await worker.fetch(request, env, ctx);
				await waitOnExecutionContext(ctx);
				
				expect(response.status).toBe(200);
				expect(response.headers.get('Cache-Control')).toBe('public, immutable, max-age=31536000');
				expect(response.headers.get('ETag')).toMatch(/^"[a-f0-9]+"/);
			}
		});
	});

	describe('Error handling', () => {
		it('returns 404 for unknown routes', async () => {
			const request = new IncomingRequest('https://example.com/unknown');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			
			expect(response.status).toBe(404);
			const data = await response.json() as any;
			expect(data.error).toBe('Not found');
			expect(data.request_id).toBeDefined();
		});
	});

	describe('EC-2: Cache Invalidation Integration', () => {

		it('supports cache invalidation via URL parameter v=', async () => {
			const searchParams = new URLSearchParams({
				template: 'blog',
				title: 'Cache Invalidation Test',
				v: 'deployment-2024-01-15'
			});
			
			const request = new IncomingRequest(`https://example.com/og?${searchParams}`);
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			
			expect(response.status).toBe(200);
			expect(response.headers.get('Content-Type')).toBe('image/png');
			
			// EC-2: Check cache version header
			expect(response.headers.get('X-Cache-Version')).toBe('deployment-2024-01-15');
			
			// ETag should include version information
			const etag = response.headers.get('ETag');
			expect(etag).toBeDefined();
			expect(etag).toMatch(/^"[a-f0-9]+"/);
		});

		it('supports cache invalidation via version parameter', async () => {
			const searchParams = new URLSearchParams({
				template: 'minimal',
				title: 'Version Test',
				version: 'v2.1.0'
			});
			
			const request = new IncomingRequest(`https://example.com/og?${searchParams}`);
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			
			expect(response.status).toBe(200);
			expect(response.headers.get('X-Cache-Version')).toBe('v2.1.0');
		});

		it('supports cache invalidation via cache_version parameter', async () => {
			const searchParams = new URLSearchParams({
				template: 'product',
				title: 'Cache Version Test',
				cache_version: 'build-456'
			});
			
			const request = new IncomingRequest(`https://example.com/og?${searchParams}`);
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			
			expect(response.status).toBe(200);
			expect(response.headers.get('X-Cache-Version')).toBe('build-456');
		});

		it('ignores invalid cache version formats', async () => {
			const searchParams = new URLSearchParams({
				template: 'blog',
				title: 'Invalid Version Test',
				v: 'invalid version with spaces!' // Invalid format
			});
			
			const request = new IncomingRequest(`https://example.com/og?${searchParams}`);
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			
			expect(response.status).toBe(200);
			// Invalid version should be ignored
			expect(response.headers.get('X-Cache-Version')).toBeNull();
		});

		it('generates different ETags for different cache versions', async () => {
			const baseParams = new URLSearchParams({
				template: 'event',
				title: 'ETag Version Test'
			});
			
			// Same parameters, different cache versions
			const params1 = new URLSearchParams(baseParams);
			params1.set('v', 'v1.0.0');
			
			const params2 = new URLSearchParams(baseParams);
			params2.set('v', 'v1.0.1');
			
			const request1 = new IncomingRequest(`https://example.com/og?${params1}`);
			const request2 = new IncomingRequest(`https://example.com/og?${params2}`);
			
			const ctx1 = createExecutionContext();
			const ctx2 = createExecutionContext();
			
			const response1 = await worker.fetch(request1, env, ctx1);
			const response2 = await worker.fetch(request2, env, ctx2);
			
			await waitOnExecutionContext(ctx1);
			await waitOnExecutionContext(ctx2);
			
			const etag1 = response1.headers.get('ETag');
			const etag2 = response2.headers.get('ETag');
			
			// Different versions should produce different ETags
			expect(etag1).not.toBe(etag2);
			expect(response1.headers.get('X-Cache-Version')).toBe('v1.0.0');
			expect(response2.headers.get('X-Cache-Version')).toBe('v1.0.1');
		});

		it('maintains consistent ETags for same cache version', async () => {
			const params = new URLSearchParams({
				template: 'tech',
				title: 'Consistent ETag Test',
				v: 'stable-version'
			});
			
			const request1 = new IncomingRequest(`https://example.com/og?${params}`);
			const request2 = new IncomingRequest(`https://example.com/og?${params}`);
			
			const ctx1 = createExecutionContext();
			const ctx2 = createExecutionContext();
			
			const response1 = await worker.fetch(request1, env, ctx1);
			const response2 = await worker.fetch(request2, env, ctx2);
			
			await waitOnExecutionContext(ctx1);
			await waitOnExecutionContext(ctx2);
			
			const etag1 = response1.headers.get('ETag');
			const etag2 = response2.headers.get('ETag');
			
			// Same parameters and version should produce same ETag
			expect(etag1).toBe(etag2);
		});

		it('maintains EC-1 compliance with versioned caching', async () => {
			const searchParams = new URLSearchParams({
				template: 'portfolio',
				title: 'EC-1 Compliance Test',
				v: 'compliance-test'
			});
			
			const request = new IncomingRequest(`https://example.com/og?${searchParams}`);
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			
			expect(response.status).toBe(200);
			
			// EC-1: Maintain 1-year cache headers
			expect(response.headers.get('Cache-Control')).toBe('public, immutable, max-age=31536000');
			expect(response.headers.get('X-Cache-TTL')).toBe('31536000');
			
			// EC-2: Include version information
			expect(response.headers.get('X-Cache-Version')).toBe('compliance-test');
			
			// Standard cache headers maintained
			expect(response.headers.get('ETag')).toBeDefined();
			expect(response.headers.get('Last-Modified')).toBeDefined();
			expect(response.headers.get('Vary')).toBe('Accept-Encoding');
		});

	});

	describe('Enhanced AQ-1: Account Management Endpoints', () => {
		describe('POST /accounts/register', () => {
			it('creates new account successfully', async () => {
				const requestBody = {
					email: 'newuser@example.com'
				};

				const request = new IncomingRequest('https://example.com/accounts/register', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(requestBody)
				});

				const ctx = createExecutionContext();
				const response = await worker.fetch(request, env, ctx);
				await waitOnExecutionContext(ctx);

				expect(response.status).toBe(201);
				const data = await response.json() as any;
				expect(data.success).toBe(true);
				expect(data.data.email).toBe('newuser@example.com');
				expect(data.data.accountId).toBeDefined();
				expect(data.data.verificationToken).toBeDefined();
			});

			it('rejects invalid email formats', async () => {
				const requestBody = {
					email: 'invalid-email'
				};

				const request = new IncomingRequest('https://example.com/accounts/register', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(requestBody)
				});

				const ctx = createExecutionContext();
				const response = await worker.fetch(request, env, ctx);
				await waitOnExecutionContext(ctx);

				expect(response.status).toBe(400);
				const data = await response.json() as any;
				expect(data.error).toContain('Invalid email format');
			});

			it('prevents duplicate account creation', async () => {
				const email = 'duplicate@example.com';
				
				// Create first account
				const firstRequest = new IncomingRequest('https://example.com/accounts/register', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ email })
				});

				const firstCtx = createExecutionContext();
				await worker.fetch(firstRequest, env, firstCtx);
				await waitOnExecutionContext(firstCtx);

				// Try to create duplicate
				const duplicateRequest = new IncomingRequest('https://example.com/accounts/register', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ email })
				});

				const duplicateCtx = createExecutionContext();
				const response = await worker.fetch(duplicateRequest, env, duplicateCtx);
				await waitOnExecutionContext(duplicateCtx);

				expect(response.status).toBe(400);
				const data = await response.json() as any;
				expect(data.error).toContain('already exists');
			});
		});

		describe('POST /accounts/verify', () => {
			it('verifies email with valid token', async () => {
				// First create account
				const createRequest = new IncomingRequest('https://example.com/accounts/register', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ email: 'verify@example.com' })
				});

				const createCtx = createExecutionContext();
				const createResponse = await worker.fetch(createRequest, env, createCtx);
				await waitOnExecutionContext(createCtx);

				const createData = await createResponse.json() as any;
				const verificationToken = createData.data.verificationToken;

				// Now verify
				const verifyRequest = new IncomingRequest('https://example.com/accounts/verify', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ token: verificationToken })
				});

				const verifyCtx = createExecutionContext();
				const response = await worker.fetch(verifyRequest, env, verifyCtx);
				await waitOnExecutionContext(verifyCtx);

				expect(response.status).toBe(200);
				const data = await response.json() as any;
				expect(data.success).toBe(true);
				expect(data.data.emailVerified).toBe(true);
			});

			it('rejects invalid tokens', async () => {
				const request = new IncomingRequest('https://example.com/accounts/verify', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ token: 'invalid-token' })
				});

				const ctx = createExecutionContext();
				const response = await worker.fetch(request, env, ctx);
				await waitOnExecutionContext(ctx);

				expect(response.status).toBe(400);
				const data = await response.json() as any;
				expect(data.error).toContain('Invalid or expired');
			});
		});

		describe('GET /accounts/:accountId', () => {
			it('returns account information', async () => {
				// Create account first
				const createRequest = new IncomingRequest('https://example.com/accounts/register', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ email: 'getaccount@example.com' })
				});

				const createCtx = createExecutionContext();
				const createResponse = await worker.fetch(createRequest, env, createCtx);
				await waitOnExecutionContext(createCtx);

				const createData = await createResponse.json() as any;
				const accountId = createData.data.accountId;

				// Get account
				const getRequest = new IncomingRequest(`https://example.com/accounts/${accountId}`);
				const getCtx = createExecutionContext();
				const response = await worker.fetch(getRequest, env, getCtx);
				await waitOnExecutionContext(getCtx);

				expect(response.status).toBe(200);
				const data = await response.json() as any;
				expect(data.success).toBe(true);
				expect(data.data.id).toBe(accountId);
				expect(data.data.email).toBe('getaccount@example.com');
				expect(data.data).not.toHaveProperty('settings'); // Sensitive data excluded
			});

			it('returns 404 for non-existent accounts', async () => {
				const request = new IncomingRequest('https://example.com/accounts/non-existent-id');
				const ctx = createExecutionContext();
				const response = await worker.fetch(request, env, ctx);
				await waitOnExecutionContext(ctx);

				expect(response.status).toBe(404);
				const data = await response.json() as any;
				expect(data.error).toContain('not found');
			});
		});
	});

	describe('AQ-1: Dashboard API Endpoints', () => {
		describe('POST /dashboard/api-keys', () => {
			it('creates new API key successfully', async () => {
				const requestBody = {
					userId: 'test-user-123',
					name: 'Test API Key',
					quotaLimit: 2000
				};

				const request = new IncomingRequest('https://example.com/dashboard/api-keys', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(requestBody)
				});

				const ctx = createExecutionContext();
				const response = await worker.fetch(request, env, ctx);
				await waitOnExecutionContext(ctx);

				expect(response.status).toBe(201);
				expect(response.headers.get('Content-Type')).toBe('application/json');

				const data = await response.json() as any;
				expect(data.success).toBe(true);
				expect(data.data.userId).toBe('test-user-123');
				expect(data.data.name).toBe('Test API Key');
				expect(data.data.quotaLimit).toBe(2000);
				expect(data.data.key).toMatch(/^edgeog_[a-z0-9]{32}$/);
				expect(data.data.id).toBeDefined();
				expect(data.data.active).toBe(true);
				expect(data.data.quotaUsed).toBe(0);
			});

			it('validates required fields', async () => {
				const requestBody = {
					userId: 'test-user-123'
					// Missing name field
				};

				const request = new IncomingRequest('https://example.com/dashboard/api-keys', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(requestBody)
				});

				const ctx = createExecutionContext();
				const response = await worker.fetch(request, env, ctx);
				await waitOnExecutionContext(ctx);

				expect(response.status).toBe(400);
				const data = await response.json() as any;
				expect(data.error).toContain('Missing required fields');
			});

			it('applies free tier default quota', async () => {
				const requestBody = {
					userId: 'test-user-456',
					name: 'Free Tier Key'
					// No quotaLimit specified
				};

				const request = new IncomingRequest('https://example.com/dashboard/api-keys', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(requestBody)
				});

				const ctx = createExecutionContext();
				const response = await worker.fetch(request, env, ctx);
				await waitOnExecutionContext(ctx);

				expect(response.status).toBe(201);
				const data = await response.json() as any;
				expect(data.data.quotaLimit).toBe(1000); // AQ-2: Free tier default
			});
		});

		describe('GET /dashboard/api-keys', () => {
			it('lists API keys for user', async () => {
				// First create an API key
				const createRequest = new IncomingRequest('https://example.com/dashboard/api-keys', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						userId: 'test-user-list',
						name: 'List Test Key'
					})
				});

				const createCtx = createExecutionContext();
				await worker.fetch(createRequest, env, createCtx);
				await waitOnExecutionContext(createCtx);

				// Then list keys
				const listRequest = new IncomingRequest('https://example.com/dashboard/api-keys?userId=test-user-list');
				const listCtx = createExecutionContext();
				const response = await worker.fetch(listRequest, env, listCtx);
				await waitOnExecutionContext(listCtx);

				expect(response.status).toBe(200);
				const data = await response.json() as any;
				expect(data.success).toBe(true);
				expect(data.data).toBeInstanceOf(Array);
				expect(data.data.length).toBeGreaterThan(0);
				expect(data.data[0].name).toBe('List Test Key');
				expect(data.data[0]).not.toHaveProperty('keyHash'); // Security: no hash in response
			});

			it('requires userId parameter', async () => {
				const request = new IncomingRequest('https://example.com/dashboard/api-keys');
				const ctx = createExecutionContext();
				const response = await worker.fetch(request, env, ctx);
				await waitOnExecutionContext(ctx);

				expect(response.status).toBe(400);
				const data = await response.json() as any;
				expect(data.error).toContain('Missing accountId or userId parameter');
			});
		});

		describe('GET /dashboard/user/:userId', () => {
			it('returns user quota information', async () => {
				// Create API key first
				const createRequest = new IncomingRequest('https://example.com/dashboard/api-keys', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						userId: 'quota-test-user',
						name: 'Quota Test Key',
						quotaLimit: 500
					})
				});

				const createCtx = createExecutionContext();
				await worker.fetch(createRequest, env, createCtx);
				await waitOnExecutionContext(createCtx);

				// Get user info
				const userRequest = new IncomingRequest('https://example.com/dashboard/user/quota-test-user');
				const userCtx = createExecutionContext();
				const response = await worker.fetch(userRequest, env, userCtx);
				await waitOnExecutionContext(userCtx);

				expect(response.status).toBe(200);
				const data = await response.json() as any;
				expect(data.success).toBe(true);
				expect(data.data.userId).toBe('quota-test-user');
				expect(data.data.activeKeys).toBe(1);
				expect(data.data.totalQuotaLimit).toBe(500);
				expect(data.data.totalQuotaUsed).toBe(0);
				expect(data.data.quotaPercentage).toBe(0);
			});
		});

		describe('CORS handling', () => {
			it('handles preflight requests', async () => {
				const request = new IncomingRequest('https://example.com/dashboard/api-keys', {
					method: 'OPTIONS'
				});

				const ctx = createExecutionContext();
				const response = await worker.fetch(request, env, ctx);
				await waitOnExecutionContext(ctx);

				expect(response.status).toBe(204);
				expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
				expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
				expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type');
			});
		});
	});

});
