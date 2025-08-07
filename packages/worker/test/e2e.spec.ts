import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

// Mock render dependencies before any imports
vi.hoisted(() => {
	// Mock the render function to avoid Satori dependency issues in E2E tests
	const mockRenderOpenGraphImage = vi.fn().mockImplementation(async (params) => {
		// Return different mock data based on format
		if (params.format === 'svg') {
			return '<svg width="1200" height="630"><rect width="1200" height="630" fill="#ffffff"/><text x="600" y="315" text-anchor="middle" font-size="48">Test Image</text></svg>';
		}
		
		// Return a fake PNG buffer for testing
		const fakeImage = new ArrayBuffer(2048);
		const view = new Uint8Array(fakeImage);
		// Add PNG signature
		view[0] = 137; view[1] = 80; view[2] = 78; view[3] = 71;
		view[4] = 13; view[5] = 10; view[6] = 26; view[7] = 10;
		// Add some fake IHDR chunk data
		for (let i = 8; i < 33; i++) {
			view[i] = Math.floor(Math.random() * 256);
		}
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

describe('Edge-OG E2E Tests', () => {
	let mockFetch: any;
	
	beforeAll(async () => {
		// Mock fetch for external API calls
		mockFetch = vi.fn().mockImplementation(async (url: string, options?: any) => {
			// Mock MailChannels API
			if (url.includes('mailchannels.net')) {
				return new Response(JSON.stringify({ message: 'Email sent successfully' }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				});
			}
			
			// Mock font loading for custom fonts
			if (url.includes('fonts.') && url.includes('.ttf')) {
				// Return mock font data
				const mockFontBuffer = new ArrayBuffer(1024);
				return new Response(mockFontBuffer, {
					status: 200,
					headers: { 'Content-Type': 'font/ttf' }
				});
			}
			
			// Default mock for other fetch calls
			return new Response('Not Found', { status: 404 });
		});
		
		vi.stubGlobal('fetch', mockFetch);
	});

	afterAll(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('End-to-End User Flows', () => {
		
		describe('E2E-1: Complete Image Generation Flow', () => {
			it('generates image through complete pipeline with all parameters', async () => {
				const searchParams = new URLSearchParams({
					title: 'Complete E2E Test',
					description: 'Testing the entire image generation pipeline',
					template: 'blog',
					theme: 'dark',
					font: 'playfair',
					author: 'E2E Tester',
					emoji: '🚀'
				});
				
				const request = new IncomingRequest(`https://edge-og.example.com/og?${searchParams}`);
				const ctx = createExecutionContext();
				
				const startTime = performance.now();
				const response = await worker.fetch(request, env, ctx);
				const duration = performance.now() - startTime;
				
				await waitOnExecutionContext(ctx);
				
				// Verify complete success response
				expect(response.status).toBe(200);
				expect(response.headers.get('Content-Type')).toBe('image/png');
				
				// Verify performance requirement
				expect(duration).toBeLessThan(200);
				
				// Verify caching headers
				expect(response.headers.get('Cache-Control')).toBe('public, immutable, max-age=31536000');
				expect(response.headers.get('ETag')).toBeDefined();
				expect(response.headers.get('X-Render-Time')).toBeDefined();
				
				// Verify image data integrity
				const arrayBuffer = await response.arrayBuffer();
				expect(arrayBuffer.byteLength).toBeGreaterThan(0);
				
				// Verify PNG signature
				const pngHeader = new Uint8Array(arrayBuffer.slice(0, 8));
				const expectedPngHeader = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
				expect(Array.from(pngHeader)).toEqual(Array.from(expectedPngHeader));
			});
			
			it('handles SVG fallback gracefully in development', async () => {
				const searchParams = new URLSearchParams({
					title: 'SVG Fallback Test',
					description: 'Testing SVG fallback functionality',
					format: 'svg'
				});
				
				const request = new IncomingRequest(`https://edge-og.example.com/og?${searchParams}`);
				const ctx = createExecutionContext();
				const response = await worker.fetch(request, env, ctx);
				await waitOnExecutionContext(ctx);
				
				expect(response.status).toBe(200);
				expect(response.headers.get('Content-Type')).toBe('image/svg+xml');
				
				const svgContent = await response.text();
				expect(svgContent).toContain('<svg');
				expect(svgContent).toContain('</svg>');
			});
			
			it('processes all template types with template-specific parameters', async () => {
				const templateConfigs = [
					{ template: 'blog', extraParams: { author: 'John Doe' } },
					{ template: 'product', extraParams: { price: '$99.99' } },
					{ template: 'event', extraParams: { date: 'March 15', location: 'San Francisco' } },
					{ template: 'quote', extraParams: { author: 'Einstein' } },
					{ template: 'minimal', extraParams: {} },
					{ template: 'news', extraParams: { category: 'Technology' } },
					{ template: 'tech', extraParams: { version: '2.0' } },
					{ template: 'podcast', extraParams: { episode: '42', duration: '1h 30min' } },
					{ template: 'portfolio', extraParams: { role: 'Designer' } },
					{ template: 'course', extraParams: { instructor: 'Jane Smith', level: 'Beginner' } }
				];
				
				for (const config of templateConfigs) {
					const baseParams: Record<string, string> = {
						title: `${config.template} Template Test`,
						description: `Testing ${config.template} template`,
						template: config.template,
						theme: 'light',
					};
					
					// Add extra parameters, filtering out undefined values
					Object.entries(config.extraParams).forEach(([key, value]) => {
						if (value !== undefined) {
							baseParams[key] = value;
						}
					});
					
					const searchParams = new URLSearchParams(baseParams);
					
					const request = new IncomingRequest(`https://edge-og.example.com/og?${searchParams}`);
					const ctx = createExecutionContext();
					const response = await worker.fetch(request, env, ctx);
					await waitOnExecutionContext(ctx);
					
					expect(response.status, `Template ${config.template} should work`).toBe(200);
					expect(response.headers.get('Content-Type')).toBe('image/png');
					
					const arrayBuffer = await response.arrayBuffer();
					expect(arrayBuffer.byteLength).toBeGreaterThan(0);
				}
			});
		});

		describe('E2E-2: Authentication Flow Integration', () => {
			// Create a dynamic account store for the test
			const accountStore = new Map<string, string>();
			
			const testEnv = {
				...env, // Base environment first
				// Override specific properties for testing
				JWT_SECRET: 'shared-e2e-jwt-secret-at-least-32-characters-long-for-security',
				EMAIL_PEPPER: 'e2e-test-email-pepper-16-chars',
				RESEND_API_KEY: 'resend_test_key_placeholder', // Force development mode
				MAILCHANNELS_API_TOKEN: 'e2e-test-mailchannels-token',
				BASE_URL: 'https://e2e-test.edge-og.com',
				ACCOUNTS: {
					get: vi.fn().mockImplementation(async (key) => {
						return accountStore.get(key) || null;
					}),
					put: vi.fn().mockImplementation(async (key, value) => {
						accountStore.set(key, value);
					}),
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

			it('completes full authentication flow: request → callback → dashboard', async () => {
				// Step 1: Request magic link
				const requestLinkRequest = new IncomingRequest('https://e2e-test.edge-og.com/auth/request-link', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'CF-Connecting-IP': '192.168.1.100',
					},
					body: JSON.stringify({
						email: 'e2e-test@example.com'
					}),
				});

				const requestCtx = createExecutionContext();
				const requestResponse = await worker.fetch(requestLinkRequest, testEnv, requestCtx);
				await waitOnExecutionContext(requestCtx);

				expect(requestResponse.status).toBe(200);
				const requestData = await requestResponse.json() as any;
				expect(requestData.success).toBe(true);
				expect(requestData.message).toContain('Magic link sent successfully');

				// Step 2: Extract the actual account ID and email hash from the KV store
				// The account was created during the magic link request, we need to find it
				const { hashEmailWithPepper } = await import('../src/utils/auth');
				const emailHash = await hashEmailWithPepper('e2e-test@example.com', testEnv.EMAIL_PEPPER);
				
				// Find the account by iterating through the KV store
				let actualAccountId: string | null = null;
				for (const [key, value] of accountStore.entries()) {
					if (key.startsWith('account:')) {
						const accountData = JSON.parse(value);
						if (accountData.email_hash === emailHash) {
							actualAccountId = key.replace('account:', '');
							break;
						}
					}
				}
				
				expect(actualAccountId).toBeDefined();
				expect(actualAccountId).not.toBeNull();

				// Step 3: Use magic link callback with the actual account ID
				const { generateMagicLinkToken } = await import('../src/utils/auth');
				const callbackToken = await generateMagicLinkToken(actualAccountId!, emailHash, testEnv.JWT_SECRET);

				const callbackRequest = new IncomingRequest(`https://e2e-test.edge-og.com/auth/callback?token=${callbackToken}`, {
					method: 'GET',
				});

				const callbackCtx = createExecutionContext();
				const callbackResponse = await worker.fetch(callbackRequest, testEnv, callbackCtx);
				await waitOnExecutionContext(callbackCtx);

				expect(callbackResponse.status).toBe(302);
				expect(callbackResponse.headers.get('Location')).toBe('https://e2e-test.edge-og.com/dashboard');
				
				const setCookieHeader = callbackResponse.headers.get('Set-Cookie');
				expect(setCookieHeader).toBeDefined();
				expect(setCookieHeader).toContain('edge_og_session=');
				
				// Step 4: Access dashboard with session cookie  
				const sessionToken = setCookieHeader?.match(/edge_og_session=([^;]+)/)?.[1] || '';
				expect(sessionToken).toBeTruthy();

				const dashboardRequest = new IncomingRequest('https://e2e-test.edge-og.com/dashboard', {
					method: 'GET',
					headers: {
						'Cookie': `edge_og_session=${sessionToken}`,
					},
				});

				const dashboardCtx = createExecutionContext();
				const dashboardResponse = await worker.fetch(dashboardRequest, testEnv, dashboardCtx);
				await waitOnExecutionContext(dashboardCtx);

				// Dashboard should return HTML content, not redirect 
				expect(dashboardResponse.status).toBe(200);
				expect(dashboardResponse.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
				
				const dashboardHtml = await dashboardResponse.text();
				expect(dashboardHtml).toContain('Edge-OG Dashboard');
				expect(dashboardHtml).toContain('Welcome back!');
				expect(dashboardHtml).toContain('free Plan');
			});

			it('redirects unauthenticated dashboard access to homepage', async () => {
				const dashboardRequest = new IncomingRequest('https://e2e-test.edge-og.com/dashboard', {
					method: 'GET',
					// No cookie header
				});

				const ctx = createExecutionContext();
				const response = await worker.fetch(dashboardRequest, testEnv, ctx);
				await waitOnExecutionContext(ctx);

				expect(response.status).toBe(302);
				expect(response.headers.get('Location')).toBe('https://e2e-test.edge-og.com/');
			});

			it('clears invalid session and redirects to homepage', async () => {
				const dashboardRequest = new IncomingRequest('https://e2e-test.edge-og.com/dashboard', {
					method: 'GET',
					headers: {
						'Cookie': 'edge_og_session=invalid.token.here',
					},
				});

				const ctx = createExecutionContext();
				const response = await worker.fetch(dashboardRequest, testEnv, ctx);
				await waitOnExecutionContext(ctx);

				expect(response.status).toBe(302);
				expect(response.headers.get('Location')).toBe('https://e2e-test.edge-og.com/');
				
				const clearCookieHeader = response.headers.get('Set-Cookie');
				expect(clearCookieHeader).toContain('edge_og_session=;');
				expect(clearCookieHeader).toContain('Max-Age=0');
			});
		});

		describe('E2E-3: Cache and Performance Integration', () => {
			it('maintains consistent caching behavior across multiple requests', async () => {
				const params = 'template=tech&title=Cache%20Test&theme=blue&version=v1.0.0';
				const url = `https://edge-og.example.com/og?${params}`;
				
				// Make 3 identical requests
				const requests = Array.from({ length: 3 }, () => 
					new IncomingRequest(url)
				);
				
				const responses = await Promise.all(
					requests.map(async (request, index) => {
						const ctx = createExecutionContext();
						const response = await worker.fetch(request, env, ctx);
						await waitOnExecutionContext(ctx);
						return response;
					})
				);
				
				// All responses should be successful
				responses.forEach((response, index) => {
					expect(response.status, `Request ${index + 1} should succeed`).toBe(200);
					expect(response.headers.get('Content-Type')).toBe('image/png');
				});
				
				// All responses should have identical cache headers
				const etags = responses.map(r => r.headers.get('ETag'));
				const cacheControls = responses.map(r => r.headers.get('Cache-Control'));
				const cacheVersions = responses.map(r => r.headers.get('X-Cache-Version'));
				
				// All ETags should be identical
				expect(etags[0]).toBe(etags[1]);
				expect(etags[1]).toBe(etags[2]);
				
				// All cache control headers should be identical
				expect(cacheControls[0]).toBe('public, immutable, max-age=31536000');
				expect(cacheControls[1]).toBe(cacheControls[0]);
				expect(cacheControls[2]).toBe(cacheControls[0]);
				
				// All cache versions should be identical
				expect(cacheVersions[0]).toBe('v1.0.0');
				expect(cacheVersions[1]).toBe(cacheVersions[0]);
				expect(cacheVersions[2]).toBe(cacheVersions[0]);
			});
			
			it('generates different ETags for different parameter combinations', async () => {
				const paramCombinations = [
					'template=blog&title=Test1&theme=light',
					'template=blog&title=Test1&theme=dark',
					'template=blog&title=Test2&theme=light',
					'template=product&title=Test1&theme=light',
					'template=blog&title=Test1&theme=light&v=1.0',
					'template=blog&title=Test1&theme=light&v=1.1',
				];
				
				const responses = await Promise.all(
					paramCombinations.map(async (params) => {
						const request = new IncomingRequest(`https://edge-og.example.com/og?${params}`);
						const ctx = createExecutionContext();
						const response = await worker.fetch(request, env, ctx);
						await waitOnExecutionContext(ctx);
						return { params, etag: response.headers.get('ETag') };
					})
				);
				
				// All ETags should be unique
				const etags = responses.map(r => r.etag);
				const uniqueEtags = new Set(etags);
				expect(uniqueEtags.size).toBe(etags.length);
				
				// All ETags should follow proper format
				etags.forEach((etag, index) => {
					expect(etag, `ETag ${index + 1} should be properly formatted`).toMatch(/^"[a-f0-9]+"/);
				});
			});
			
			it('measures and reports performance metrics consistently', async () => {
				// Mock performance.now() specifically for this test to return predictable timing
				const originalPerformanceNow = performance.now;
				let callCount = 0;
				
				vi.spyOn(performance, 'now').mockImplementation(() => {
					// Return 0 for start calls, 15 for end calls within each render operation
					const result = callCount % 2 === 0 ? 0 : 15;
					callCount++;
					return result;
				});
				
				const request = new IncomingRequest('https://edge-og.example.com/og?template=minimal&title=Performance%20Test');
				const ctx = createExecutionContext();
				
				const startTime = originalPerformanceNow.call(performance);
				const response = await worker.fetch(request, env, ctx);
				const totalDuration = originalPerformanceNow.call(performance) - startTime;
				
				await waitOnExecutionContext(ctx);
				
				expect(response.status).toBe(200);
				
				// Verify performance headers are present
				const renderTimeHeader = response.headers.get('X-Render-Time');
				expect(renderTimeHeader).toBeDefined();
				expect(renderTimeHeader).toMatch(/^\d+ms$/);
				
				// Extract render time from header
				const renderTime = parseInt(renderTimeHeader!.replace('ms', ''));
				expect(renderTime).toBeGreaterThan(0);
				expect(renderTime).toBeLessThan(totalDuration + 50); // Allow some overhead
				
				// Verify other performance headers
				expect(response.headers.get('X-Request-ID')).toBeDefined();
				expect(response.headers.get('X-Cache-Status')).toBeDefined();
				
				// Total response time should meet performance requirements
				expect(totalDuration).toBeLessThan(200); // 150ms + test overhead
				
				// Restore original performance.now implementation
				vi.restoreAllMocks();
			});
		});

		describe('E2E-4: Error Handling and Recovery', () => {
			it('handles invalid parameters gracefully across all endpoints', async () => {
				const invalidRequests = [
					// OG endpoint with invalid parameters
					{
						url: 'https://edge-og.example.com/og?title=' + 'x'.repeat(300),
						expectedStatus: 400,
						expectedError: 'Title parameter too long'
					},
					{
						url: 'https://edge-og.example.com/og?theme=rainbow',
						expectedStatus: 400,
						expectedError: 'Invalid theme parameter'
					},
					{
						url: 'https://edge-og.example.com/og?template=nonexistent',
						expectedStatus: 400,
						expectedError: 'Invalid template parameter'
					},
					{
						url: 'https://edge-og.example.com/og?fontUrl=http://insecure.com/font.ttf',
						expectedStatus: 400,
						expectedError: 'Custom font URL must use HTTPS'
					},
					// Auth endpoints with invalid data
					{
						url: 'https://edge-og.example.com/auth/request-link',
						method: 'POST',
						body: JSON.stringify({ email: 'invalid-email' }),
						headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.168.1.1' },
						expectedStatus: 400,
						expectedError: 'Invalid email address format'
					},
					{
						url: 'https://edge-og.example.com/auth/callback?token=invalid',
						expectedStatus: 401,
						expectedError: 'Invalid or expired authentication token'
					}
				];
				
				for (const invalidRequest of invalidRequests) {
					const request = new IncomingRequest(invalidRequest.url, {
						method: invalidRequest.method || 'GET',
						headers: invalidRequest.headers || {},
						body: invalidRequest.body || undefined,
					});
					
					const ctx = createExecutionContext();
					const response = await worker.fetch(request, env, ctx);
					await waitOnExecutionContext(ctx);
					
					expect(response.status, `Request to ${invalidRequest.url} should return ${invalidRequest.expectedStatus}`).toBe(invalidRequest.expectedStatus);
					
					if (response.status !== 302) { // Skip redirect responses
						const data = await response.json() as any;
						expect(data.error, `Error message should contain expected text`).toContain(invalidRequest.expectedError);
						expect(data.request_id, `Request ID should be present`).toBeDefined();
					}
				}
			});
			
			it('provides consistent error responses with proper headers', async () => {
				const request = new IncomingRequest('https://edge-og.example.com/nonexistent-endpoint');
				const ctx = createExecutionContext();
				const response = await worker.fetch(request, env, ctx);
				await waitOnExecutionContext(ctx);
				
				expect(response.status).toBe(404);
				expect(response.headers.get('Content-Type')).toBe('application/json');
				
				const data = await response.json() as any;
				expect(data.error).toBe('Not found');
				expect(data.request_id).toBeDefined();
				expect(data.request_id).toMatch(/^[0-9a-f-]{36}$/); // UUID format
			});
			
			it('handles method not allowed errors consistently', async () => {
				const methodTests = [
					{ url: 'https://edge-og.example.com/og', method: 'POST', allowedMethods: 'GET' },
					{ url: 'https://edge-og.example.com/', method: 'POST', allowedMethods: 'GET' },
					{ url: 'https://edge-og.example.com/auth/callback', method: 'POST', allowedMethods: 'GET' },
				];
				
				for (const test of methodTests) {
					const request = new IncomingRequest(test.url, { method: test.method });
					const ctx = createExecutionContext();
					const response = await worker.fetch(request, env, ctx);
					await waitOnExecutionContext(ctx);
					
					expect(response.status).toBe(405);
					expect(response.headers.get('Allow')).toBe(test.allowedMethods);
					const data = await response.json() as any;
					expect(data.error).toContain('Method not allowed');
				}
			});
		});

		describe('E2E-5: Security and Rate Limiting', () => {
			it('enforces HTTPS redirects consistently', async () => {
				const httpUrls = [
					'http://edge-og.example.com/',
					'http://edge-og.example.com/og',
					'http://edge-og.example.com/health',
				];
				
				for (const httpUrl of httpUrls) {
					const request = new IncomingRequest(httpUrl);
					const ctx = createExecutionContext();
					const response = await worker.fetch(request, env, ctx);
					await waitOnExecutionContext(ctx);
					
					expect(response.status, `${httpUrl} should redirect to HTTPS`).toBe(301);
					
					const location = response.headers.get('Location');
					expect(location).toBeDefined();
					expect(location).toContain('https://');
					expect(location).toBe(httpUrl.replace('http://', 'https://'));
				}
			});
			
			it('validates input length limits consistently', async () => {
				const longInputTests = [
					{
						param: 'title',
						value: 'x'.repeat(201), // 201 chars, limit is 200
						expectedError: 'Title parameter too long'
					},
					{
						param: 'description',
						value: 'y'.repeat(201), // 201 chars, limit is 200
						expectedError: 'Description parameter too long'
					}
				];
				
				for (const test of longInputTests) {
					const searchParams = new URLSearchParams({
						[test.param]: test.value
					});
					
					const request = new IncomingRequest(`https://edge-og.example.com/og?${searchParams}`);
					const ctx = createExecutionContext();
					const response = await worker.fetch(request, env, ctx);
					await waitOnExecutionContext(ctx);
					
					expect(response.status).toBe(400);
					const data = await response.json() as any;
					expect(data.error).toContain(test.expectedError);
				}
			});
			
			it('provides proper security headers', async () => {
				const request = new IncomingRequest('https://edge-og.example.com/og?title=Security%20Test');
				const ctx = createExecutionContext();
				const response = await worker.fetch(request, env, ctx);
				await waitOnExecutionContext(ctx);
				
				expect(response.status).toBe(200);
				
				// Check for proper content type (prevents XSS)
				expect(response.headers.get('Content-Type')).toBe('image/png');
				
				// Check for cache headers (proper caching security)
				expect(response.headers.get('Cache-Control')).toBe('public, immutable, max-age=31536000');
				
				// Should not expose internal information in headers
				const headers = Array.from(response.headers.keys());
				expect(headers.some(h => h.toLowerCase().includes('server'))).toBe(false);
				expect(headers.some(h => h.toLowerCase().includes('x-powered-by'))).toBe(false);
			});
			
			it('handles rate limiting integration points', async () => {
				const testEnv = {
					...env,
					JWT_SECRET: 'rate-limit-test-secret-at-least-32-characters',
					EMAIL_PEPPER: 'rate-limit-pepper16',
					MAILCHANNELS_API_TOKEN: 'test-token',
					ACCOUNTS: {
						get: vi.fn().mockResolvedValue(null),
						put: vi.fn().mockResolvedValue(undefined),
						delete: vi.fn().mockResolvedValue(undefined),
						list: vi.fn().mockResolvedValue({ keys: [] }),
						getWithMetadata: vi.fn().mockResolvedValue({ value: null, metadata: null }),
					},
					USAGE: {
						get: vi.fn().mockImplementation(async (key, type) => {
							// Simulate rate limit exceeded
							if (key.includes('192.168.1.200')) {
								const now = Date.now();
								const recentRequests = [
									now - 60000,  // 1 minute ago
									now - 120000, // 2 minutes ago
									now - 180000, // 3 minutes ago
									now - 240000, // 4 minutes ago
									now - 290000  // 4.83 minutes ago (within 5-minute window)
								];
								
								const data = {
									requests: recentRequests,
									count: recentRequests.length
								};
								
								// Return parsed JSON object when type is 'json', string otherwise
								return type === 'json' ? data : JSON.stringify(data);
							}
							return null;
						}),
						put: vi.fn().mockResolvedValue(undefined),
						delete: vi.fn().mockResolvedValue(undefined),
						list: vi.fn().mockResolvedValue({ keys: [] }),
						getWithMetadata: vi.fn().mockResolvedValue({ value: null, metadata: null }),
					},
				} as any;

				const request = new IncomingRequest('https://edge-og.example.com/auth/request-link', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'CF-Connecting-IP': '192.168.1.200', // IP that exceeds rate limit
					},
					body: JSON.stringify({
						email: 'ratelimit@example.com'
					}),
				});

				const ctx = createExecutionContext();
				const response = await worker.fetch(request, testEnv, ctx);
				await waitOnExecutionContext(ctx);

				expect(response.status).toBe(429);
				expect(response.headers.get('Retry-After')).toBe('300');
				
				const data = await response.json() as any;
				expect(data.error).toContain('Too many requests');
				expect(data.retry_after).toBe(300);
				expect(data.request_id).toBeDefined();
			});
		});

		describe('E2E-6: Health and Monitoring Integration', () => {
			it('provides comprehensive health check information', async () => {
				const request = new IncomingRequest('https://edge-og.example.com/health');
				const ctx = createExecutionContext();
				const response = await worker.fetch(request, env, ctx);
				await waitOnExecutionContext(ctx);
				
				expect(response.status).toBe(200);
				expect(response.headers.get('Content-Type')).toBe('application/json');
				
				const health = await response.json() as any;
				expect(health).toMatchObject({
					service: 'edge-og',
					version: '1.0.0',
					status: 'healthy'
				});
				
				expect(health.request_id).toBeDefined();
				expect(health.timestamp).toBeDefined();
				
				// Verify timestamp is recent (within last minute)
				const timestamp = new Date(health.timestamp);
				const now = new Date();
				const timeDiff = now.getTime() - timestamp.getTime();
				expect(timeDiff).toBeLessThan(60000); // Less than 1 minute
			});
			
			it('provides proper homepage with monitoring information', async () => {
				const request = new IncomingRequest('https://edge-og.example.com/');
				const ctx = createExecutionContext();
				const response = await worker.fetch(request, env, ctx);
				await waitOnExecutionContext(ctx);
				
				expect(response.status).toBe(200);
				expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
				expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600');
				
				const html = await response.text();
				expect(html).toContain('Edge-OG');
				expect(html).toContain('Open Graph Image Generator');
				expect(html).toContain('/og?');
				
				// Should contain examples and documentation
				expect(html).toContain('template=');
				expect(html).toContain('theme=');
				expect(html).toContain('font=');
				
				// Should be valid HTML
				expect(html).toMatch(/^<!DOCTYPE html>/i);
				expect(html).toContain('<html');
				expect(html).toContain('</html>');
			});
			
			it('maintains consistent logging and monitoring across all endpoints', async () => {
				const endpointTests = [
					{ url: '/', expectedStatus: 200 },
					{ url: '/health', expectedStatus: 200 },
					{ url: '/og', expectedStatus: 200 },
					{ url: '/og?title=Monitor%20Test', expectedStatus: 200 },
					{ url: '/nonexistent', expectedStatus: 404 }
				];
				
				for (const test of endpointTests) {
					const request = new IncomingRequest(`https://edge-og.example.com${test.url}`);
					const ctx = createExecutionContext();
					const response = await worker.fetch(request, env, ctx);
					await waitOnExecutionContext(ctx);
					
					expect(response.status, `${test.url} should return ${test.expectedStatus}`).toBe(test.expectedStatus);
					
					// All responses should include request ID for tracking
					if (response.headers.get('Content-Type')?.includes('application/json')) {
						const data = await response.json() as any;
						expect(data.request_id, `${test.url} should include request_id`).toBeDefined();
						expect(data.request_id).toMatch(/^[0-9a-f-]{36}$/); // UUID format
					} else if (test.url === '/og' && response.status === 200) {
						// Image responses should include monitoring headers
						expect(response.headers.get('X-Request-ID')).toBeDefined();
						expect(response.headers.get('X-Render-Time')).toBeDefined();
						expect(response.headers.get('X-Cache-Status')).toBeDefined();
					}
				}
			});
		});

		describe('E2E-7: Cross-Feature Integration', () => {
			it('combines authentication, caching, and image generation', async () => {
				// This test simulates a complete user journey:
				// 1. User accesses homepage
				// 2. User creates account
				// 3. User accesses dashboard
				// 4. User generates images with different parameters
				// 5. Verify caching works across authenticated sessions
				
				// Create a dynamic account store for the test
				const accountStore = new Map<string, string>();
				
				const testEnv = {
					...env,
					RESEND_API_KEY: 'resend_test_key_placeholder', // Force development mode
					JWT_SECRET: 'shared-e2e-jwt-secret-at-least-32-characters-long-for-security',
					EMAIL_PEPPER: 'integration-pepper16',
					MAILCHANNELS_API_TOKEN: 'integration-token',
					BASE_URL: 'https://integration-test.edge-og.com',
					ACCOUNTS: {
						get: vi.fn().mockImplementation(async (key) => {
							return accountStore.get(key) || null;
						}),
						put: vi.fn().mockImplementation(async (key, value) => {
							accountStore.set(key, value);
						}),
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

				// Step 1: Access homepage
				const homepageRequest = new IncomingRequest('https://integration-test.edge-og.com/');
				const homepageCtx = createExecutionContext();
				const homepageResponse = await worker.fetch(homepageRequest, testEnv, homepageCtx);
				await waitOnExecutionContext(homepageCtx);
				
				expect(homepageResponse.status).toBe(200);
				expect(homepageResponse.headers.get('Content-Type')).toBe('text/html; charset=utf-8');

				// Step 2: Create account
				const createAccountRequest = new IncomingRequest('https://integration-test.edge-og.com/auth/request-link', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'CF-Connecting-IP': '192.168.1.150',
					},
					body: JSON.stringify({
						email: 'integration@example.com'
					}),
				});

				const accountCtx = createExecutionContext();
				const accountResponse = await worker.fetch(createAccountRequest, testEnv, accountCtx);
				await waitOnExecutionContext(accountCtx);
				
				expect(accountResponse.status).toBe(200);

				// Step 3: Complete authentication flow with actual account data
				const { generateMagicLinkToken, hashEmailWithPepper } = await import('../src/utils/auth');
				const emailHash = await hashEmailWithPepper('integration@example.com', testEnv.EMAIL_PEPPER);
				
				// Find the actual account ID from the KV store
				let actualAccountId: string | null = null;
				for (const [key, value] of accountStore.entries()) {
					if (key.startsWith('account:')) {
						const accountData = JSON.parse(value);
						if (accountData.email_hash === emailHash) {
							actualAccountId = key.replace('account:', '');
							break;
						}
					}
				}
				
				expect(actualAccountId).toBeDefined();
				expect(actualAccountId).not.toBeNull();
				
				const authToken = await generateMagicLinkToken(actualAccountId!, emailHash, testEnv.JWT_SECRET);

				const callbackRequest = new IncomingRequest(`https://integration-test.edge-og.com/auth/callback?token=${authToken}`);
				const callbackCtx = createExecutionContext();
				const callbackResponse = await worker.fetch(callbackRequest, testEnv, callbackCtx);
				await waitOnExecutionContext(callbackCtx);
				
				expect(callbackResponse.status).toBe(302);
				const sessionCookie = callbackResponse.headers.get('Set-Cookie');
				expect(sessionCookie).toBeDefined();
				
				const sessionToken = sessionCookie?.match(/edge_og_session=([^;]+)/)?.[1];
				expect(sessionToken).toBeDefined();

				// Step 4: Access dashboard
				const dashboardRequest = new IncomingRequest('https://integration-test.edge-og.com/dashboard', {
					headers: { 'Cookie': `edge_og_session=${sessionToken}` },
				});
				const dashboardCtx = createExecutionContext();
				const dashboardResponse = await worker.fetch(dashboardRequest, testEnv, dashboardCtx);
				await waitOnExecutionContext(dashboardCtx);
				
				// Dashboard should return HTML content successfully
				expect(dashboardResponse.status).toBe(200);
				const dashboardHtml = await dashboardResponse.text();
				expect(dashboardHtml).toContain('Dashboard');

				// Step 5: Generate images and verify caching
				const imageConfigs = [
					'template=blog&title=Integration%20Test%201&theme=light',
					'template=product&title=Integration%20Test%202&theme=dark',
					'template=blog&title=Integration%20Test%201&theme=light', // Repeat to test caching
				];
				
				const imageResponses = [];
				for (const config of imageConfigs) {
					const imageRequest = new IncomingRequest(`https://integration-test.edge-og.com/og?${config}`);
					const imageCtx = createExecutionContext();
					const imageResponse = await worker.fetch(imageRequest, testEnv, imageCtx);
					await waitOnExecutionContext(imageCtx);
					
					expect(imageResponse.status).toBe(200);
					expect(imageResponse.headers.get('Content-Type')).toBe('image/png');
					
					imageResponses.push({
						config,
						etag: imageResponse.headers.get('ETag'),
						cacheControl: imageResponse.headers.get('Cache-Control'),
						renderTime: imageResponse.headers.get('X-Render-Time')
					});
				}
				
				// Verify caching consistency
				expect(imageResponses[0].etag).toBe(imageResponses[2].etag); // Same config = same ETag
				expect(imageResponses[0].etag).not.toBe(imageResponses[1].etag); // Different config = different ETag
				
				// Verify all responses have proper cache headers
				imageResponses.forEach((response, index) => {
					expect(response.cacheControl, `Response ${index + 1} should have proper cache control`).toBe('public, immutable, max-age=31536000');
					expect(response.etag, `Response ${index + 1} should have ETag`).toMatch(/^"[a-f0-9]+"/);
					expect(response.renderTime, `Response ${index + 1} should have render time`).toMatch(/^\d+ms$/);
				});
			});
			
			it('maintains performance under load simulation', async () => {
				// Simulate multiple concurrent requests with different parameters
				const concurrentRequests = Array.from({ length: 10 }, (_, index) => ({
					url: `https://edge-og.example.com/og?template=${index % 2 === 0 ? 'blog' : 'product'}&title=Load%20Test%20${index}&theme=${index % 3 === 0 ? 'light' : index % 3 === 1 ? 'dark' : 'blue'}`,
					index
				}));
				
				const startTime = performance.now();
				
				const responses = await Promise.all(
					concurrentRequests.map(async ({ url, index }) => {
						const request = new IncomingRequest(url);
						const ctx = createExecutionContext();
						const requestStart = performance.now();
						const response = await worker.fetch(request, env, ctx);
						const requestDuration = performance.now() - requestStart;
						await waitOnExecutionContext(ctx);
						
						return {
							index,
							status: response.status,
							contentType: response.headers.get('Content-Type'),
							etag: response.headers.get('ETag'),
							renderTime: response.headers.get('X-Render-Time'),
							requestDuration,
							success: response.status === 200
						};
					})
				);
				
				const totalDuration = performance.now() - startTime;
				
				// All requests should succeed
				const successfulRequests = responses.filter(r => r.success);
				expect(successfulRequests.length).toBe(concurrentRequests.length);
				
				// All responses should be proper images
				responses.forEach((response) => {
					expect(response.contentType).toBe('image/png');
					expect(response.etag).toMatch(/^"[a-f0-9]+"/);
					expect(response.renderTime).toMatch(/^\d+ms$/);
				});
				
				// Performance should remain reasonable under load
				const averageRequestDuration = responses.reduce((sum, r) => sum + r.requestDuration, 0) / responses.length;
				expect(averageRequestDuration).toBeLessThan(300); // Allow higher threshold for concurrent load
				
				// ETags should be consistent for identical requests
				const requestsByConfig = responses.reduce((groups, response) => {
					const config = concurrentRequests.find(req => req.index === response.index)?.url.split('?')[1];
					if (!groups[config!]) groups[config!] = [];
					if (response.etag) {
						groups[config!].push(response.etag);
					}
					return groups;
				}, {} as Record<string, string[]>);
				
				// Within each config group, ETags should be identical
				Object.entries(requestsByConfig).forEach(([config, etags]) => {
					const uniqueEtags = new Set(etags);
					expect(uniqueEtags.size, `Config ${config} should have consistent ETags`).toBe(1);
				});
			});
		});
	});
});
