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
		it('responds with service info at root', async () => {
			const request = new IncomingRequest('https://example.com/');
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
			
			// Verify caching headers as per EC-1 requirements
			expect(response.headers.get('Cache-Control')).toBe('public, immutable, max-age=31536000');
			
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
});
