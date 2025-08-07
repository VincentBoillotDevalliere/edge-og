import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

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
		// Mock fetch for MailChannels API calls
		vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string, options?: any) => {
			// Mock MailChannels API
			if (url.includes('mailchannels.net')) {
				return new Response(JSON.stringify({ message: 'Email sent successfully' }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				});
			}
			
			// Default mock for other fetch calls
			return new Response('Not Found', { status: 404 });
		}));
		
		// Initialize WASM modules that might be needed
		// This ensures @resvg/resvg-wasm is properly loaded
	});

	afterAll(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	describe('Health check', () => {
		it('serves homepage HTML at root', async () => {
			const request = new IncomingRequest('https://example.com/');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			
			expect(response.status).toBe(200);
			expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
			
			const html = await response.text();
			expect(html).toContain('Edge-OG');
			expect(html).toContain('Open Graph Image Generator');
			expect(html).toContain('/og?template=');
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

	describe('AQ-1.1: Magic-link Account Creation', () => {
		// Mock environment variables for testing
		const testEnv = {
			...env,
			JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long',
			EMAIL_PEPPER: 'test-email-pepper-16chars',
			RESEND_API_KEY: 'resend_test_key_placeholder', // Force development mode
			MAILCHANNELS_API_TOKEN: 'test-mailchannels-token',
			BASE_URL: 'https://test.edge-og.com',
			// Add mock KV namespaces to avoid undefined errors
			ACCOUNTS: {
				get: vi.fn().mockImplementation(async (key) => {
					// Mock different responses based on key
					if (key.includes('existing@example.com')) {
						return JSON.stringify({
							email_hash: 'existing-hash',
							created: new Date().toISOString(),
							plan: 'free'
						});
					}
					return null;
				}),
				put: vi.fn().mockResolvedValue(undefined),
				list: vi.fn().mockResolvedValue({ keys: [] }),
				delete: vi.fn().mockResolvedValue(undefined),
				getWithMetadata: vi.fn().mockResolvedValue({ value: null, metadata: null }),
			},
			USAGE: {
				get: vi.fn().mockResolvedValue(null),
				put: vi.fn().mockResolvedValue(undefined),
				delete: vi.fn().mockResolvedValue(undefined),
				list: vi.fn().mockResolvedValue({ keys: [] }),
				getWithMetadata: vi.fn().mockResolvedValue({ value: null, metadata: null }),
			},
		} as any;

		it('creates account with valid email (JSON body)', async () => {
			const request = new IncomingRequest('https://example.com/auth/request-link', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'CF-Connecting-IP': '192.168.1.1',
				},
				body: JSON.stringify({
					email: 'test@example.com'
				}),
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, testEnv, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(200);
			expect(response.headers.get('Content-Type')).toBe('application/json');

			const data = await response.json() as any;
			expect(data.success).toBe(true);
			expect(data.message).toContain('Magic link sent successfully');
			expect(data.request_id).toBeDefined();
		});

		it('creates account with valid email (form data)', async () => {
			const formData = new FormData();
			formData.append('email', 'test2@example.com');

			const request = new IncomingRequest('https://example.com/auth/request-link', {
				method: 'POST',
				headers: {
					'CF-Connecting-IP': '192.168.1.2',
				},
				body: formData,
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, testEnv, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(200);
			const data = await response.json() as any;
			expect(data.success).toBe(true);
		});

		it('validates email format', async () => {
			const request = new IncomingRequest('https://example.com/auth/request-link', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'CF-Connecting-IP': '192.168.1.3',
				},
				body: JSON.stringify({
					email: 'invalid-email'
				}),
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, testEnv, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(400);
			const data = await response.json() as any;
			expect(data.error).toContain('Invalid email address format');
			expect(data.request_id).toBeDefined();
		});

		it('requires email parameter', async () => {
			const request = new IncomingRequest('https://example.com/auth/request-link', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'CF-Connecting-IP': '192.168.1.4',
				},
				body: JSON.stringify({}),
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, testEnv, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(400);
			const data = await response.json() as any;
			expect(data.error).toContain('Invalid email address format');
		});

		it('validates Content-Type header', async () => {
			const request = new IncomingRequest('https://example.com/auth/request-link', {
				method: 'POST',
				headers: {
					'Content-Type': 'text/plain',
					'CF-Connecting-IP': '192.168.1.5',
				},
				body: 'test@example.com',
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, testEnv, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(400);
			const data = await response.json() as any;
			expect(data.error).toContain('Content-Type must be application/json or application/x-www-form-urlencoded');
		});

		it('enforces rate limiting (AQ-5.1)', async () => {
			const clientIP = '192.168.1.100';
			const now = Date.now();
			
			// Mock rate limiting behavior - return 5 requests within the 5-minute window
			const rateLimitTestEnv = {
				...testEnv,
				USAGE: {
					get: vi.fn().mockImplementation(async (key, type) => {
						if (key.includes('192.168.1.100')) {
							const existingRequests = [
								now - 60000,  // 1 minute ago
								now - 120000, // 2 minutes ago
								now - 180000, // 3 minutes ago
								now - 240000, // 4 minutes ago
								now - 290000  // 4.83 minutes ago (still within 5-minute window)
							];
							
							// Return parsed object when type is 'json'
							if (type === 'json') {
								return {
									requests: existingRequests,
									count: existingRequests.length
								};
							} else {
								return JSON.stringify({
									requests: existingRequests,
									count: existingRequests.length
								});
							}
						}
						return null;
					}),
					put: vi.fn().mockResolvedValue(undefined),
					delete: vi.fn().mockResolvedValue(undefined),
					list: vi.fn().mockResolvedValue({ keys: [] }),
					getWithMetadata: vi.fn().mockResolvedValue({ value: null, metadata: null }),
				},
			} as any;
			
			// This request should be rate limited
			const request = new IncomingRequest('https://example.com/auth/request-link', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'CF-Connecting-IP': clientIP,
				},
				body: JSON.stringify({
					email: 'test6@example.com'
				}),
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, rateLimitTestEnv, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(429);
			expect(response.headers.get('Retry-After')).toBe('300');
			
			const data = await response.json() as any;
			expect(data.error).toContain('Too many requests');
			expect(data.retry_after).toBe(300);
		});

		it('only accepts POST method', async () => {
			const request = new IncomingRequest('https://example.com/auth/request-link', {
				method: 'GET',
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, testEnv, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(404); // Falls through to 404 handler
		});

		it('handles missing environment variables', async () => {
			const incompleteEnv = {
				...env,
				// Missing JWT_SECRET and EMAIL_PEPPER
			};

			const request = new IncomingRequest('https://example.com/auth/request-link', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'CF-Connecting-IP': '192.168.1.6',
				},
				body: JSON.stringify({
					email: 'test@example.com'
				}),
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, incompleteEnv, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(500);
			const data = await response.json() as any;
			expect(data.error).toContain('Failed to process magic link request');
			expect(data.request_id).toBeDefined();
		});

		it('handles existing account email hash lookup', async () => {
			const email = 'existing@example.com';
			
			// First request should create account (will work due to mocking)
			const request1 = new IncomingRequest('https://example.com/auth/request-link', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'CF-Connecting-IP': '192.168.1.7',
				},
				body: JSON.stringify({ email }),
			});

			const ctx1 = createExecutionContext();
			const response1 = await worker.fetch(request1, testEnv, ctx1);
			await waitOnExecutionContext(ctx1);
			
			// We expect this to work due to the mocked KV store
			expect(response1.status).toBe(200);
		});
	});

	// AQ-1.2: Magic Link Callback Tests
	describe('Magic Link Callback (/auth/callback)', () => {
		beforeEach(() => {
			// Reset mocks
			vi.clearAllMocks();
		});

		const testEnv = {
			...env,
			JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long-for-security',
			EMAIL_PEPPER: 'test-email-pepper-at-least-16-chars',
			MAILCHANNELS_API_TOKEN: 'test-mailchannels-token',
			BASE_URL: 'https://edge-og.example.com',
			ACCOUNTS: {
				get: vi.fn().mockResolvedValue(JSON.stringify({
					email_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
					created: '2024-01-01T00:00:00.000Z',
					plan: 'free'
				})),
				put: vi.fn().mockResolvedValue(undefined),
				delete: vi.fn().mockResolvedValue(undefined),
				list: vi.fn().mockResolvedValue({ keys: [] }),
				getWithMetadata: vi.fn().mockResolvedValue({ value: null, metadata: null }),
			},
			USAGE: {
				get: vi.fn().mockResolvedValue(null),
				put: vi.fn().mockResolvedValue(undefined),
				delete: vi.fn().mockResolvedValue(undefined),
				list: vi.fn().mockResolvedValue({ keys: [] }),
				getWithMetadata: vi.fn().mockResolvedValue({ value: null, metadata: null }),
			},
		} as any;

		it('successfully authenticates with valid token', async () => {
			// Import auth functions to generate a valid token
			const { generateMagicLinkToken } = await import('../src/utils/auth');
			
			const accountId = '12345678-1234-4567-8901-123456789012';
			const emailHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
			const validToken = await generateMagicLinkToken(accountId, emailHash, testEnv.JWT_SECRET);

			const request = new IncomingRequest(`https://example.com/auth/callback?token=${validToken}`, {
				method: 'GET',
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, testEnv, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(302);
			expect(response.headers.get('Location')).toBe('https://edge-og.example.com/dashboard');
			
			const setCookieHeader = response.headers.get('Set-Cookie');
			expect(setCookieHeader).toBeDefined();
			expect(setCookieHeader).toContain('edge_og_session=');
			expect(setCookieHeader).toContain('HttpOnly');
			expect(setCookieHeader).toContain('Secure');
			expect(setCookieHeader).toContain('Max-Age=86400'); // 24 hours
		});

		it('rejects request with missing token', async () => {
			const request = new IncomingRequest('https://example.com/auth/callback', {
				method: 'GET',
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, testEnv, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(400);
			const data = await response.json() as any;
			expect(data.error).toBe('Missing authentication token');
		});

		it('rejects request with invalid token', async () => {
			const request = new IncomingRequest('https://example.com/auth/callback?token=invalid.token.here', {
				method: 'GET',
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, testEnv, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(401);
			const data = await response.json() as any;
			expect(data.error).toBe('Invalid or expired authentication token');
		});

		it('rejects request with expired token', async () => {
			// Create an expired token manually
			const accountId = '12345678-1234-4567-8901-123456789012';
			const emailHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
			const pastTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
			
			const expiredPayload = {
				account_id: accountId,
				email_hash: emailHash,
				iat: pastTime - 900,
				exp: pastTime, // Already expired
			};
			
			// Create minimal expired token (won't verify, but will parse)
			const header = { alg: 'HS256', typ: 'JWT' };
			const encodedHeader = btoa(JSON.stringify(header)).replace(/[+/=]/g, (match) => {
				return { '+': '-', '/': '_', '=': '' }[match] || match;
			});
			const encodedPayload = btoa(JSON.stringify(expiredPayload)).replace(/[+/=]/g, (match) => {
				return { '+': '-', '/': '_', '=': '' }[match] || match;
			});
			const fakeSignature = 'fake-signature-here';
			const expiredToken = `${encodedHeader}.${encodedPayload}.${fakeSignature}`;

			const request = new IncomingRequest(`https://example.com/auth/callback?token=${expiredToken}`, {
				method: 'GET',
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, testEnv, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(401);
			const data = await response.json() as any;
			expect(data.error).toBe('Invalid or expired authentication token');
		});

		it('rejects request when account not found', async () => {
			// Import auth functions to generate a valid token
			const { generateMagicLinkToken } = await import('../src/utils/auth');
			
			const accountId = '12345678-1234-4567-8901-123456789012';
			const emailHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
			const validToken = await generateMagicLinkToken(accountId, emailHash, testEnv.JWT_SECRET);

			// Mock account not found
			const envWithoutAccount = {
				...testEnv,
				ACCOUNTS: {
					...testEnv.ACCOUNTS,
					get: vi.fn().mockResolvedValue(null),
				}
			};

			const request = new IncomingRequest(`https://example.com/auth/callback?token=${validToken}`, {
				method: 'GET',
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, envWithoutAccount, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(404);
			const data = await response.json() as any;
			expect(data.error).toBe('Account not found');
		});

		it('rejects request with email hash mismatch', async () => {
			// Import auth functions to generate a valid token
			const { generateMagicLinkToken } = await import('../src/utils/auth');
			
			const accountId = '12345678-1234-4567-8901-123456789012';
			const emailHash = 'different-hash';
			const validToken = await generateMagicLinkToken(accountId, emailHash, testEnv.JWT_SECRET);

			const request = new IncomingRequest(`https://example.com/auth/callback?token=${validToken}`, {
				method: 'GET',
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, testEnv, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(401);
			const data = await response.json() as any;
			expect(data.error).toBe('Authentication failed');
		});

		it('handles errors gracefully', async () => {
			// Import auth functions to generate a valid token
			const { generateMagicLinkToken } = await import('../src/utils/auth');
			
			const accountId = '12345678-1234-4567-8901-123456789012';
			const emailHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
			const validToken = await generateMagicLinkToken(accountId, emailHash, testEnv.JWT_SECRET);

			// Mock KV error
			const envWithError = {
				...testEnv,
				ACCOUNTS: {
					...testEnv.ACCOUNTS,
					get: vi.fn().mockRejectedValue(new Error('KV store error')),
				}
			};

			const request = new IncomingRequest(`https://example.com/auth/callback?token=${validToken}`, {
				method: 'GET',
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, envWithError, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(500);
			const data = await response.json() as any;
			expect(data.error).toBe('Failed to process authentication. Please try again.');
		});
	});
});
