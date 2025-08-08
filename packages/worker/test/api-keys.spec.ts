import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
	createExecutionContext, 
	waitOnExecutionContext,
	env 
} from 'cloudflare:test';

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

// Ensure isolated modules
export {};

// Import the worker
import worker from '../src/index';

// Import auth utilities for testing
import { generateSessionToken, hashEmailWithPepper } from '../src/utils/auth';

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe('AQ-2.1: API Key Generation', () => {
	// Mock environment variables for testing
	const testEnv = {
		...env,
		JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long-for-security',
		EMAIL_PEPPER: 'test-email-pepper-16chars',
		BASE_URL: 'https://test.edge-og.com',
		// Mock KV namespaces
		ACCOUNTS: {
			get: vi.fn(),
			put: vi.fn().mockResolvedValue(undefined),
			delete: vi.fn().mockResolvedValue(undefined),
			list: vi.fn().mockResolvedValue({ keys: [] }),
			getWithMetadata: vi.fn().mockResolvedValue({ value: null, metadata: null }),
		},
		API_KEYS: {
			get: vi.fn().mockResolvedValue(null),
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

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('POST /dashboard/api-keys', () => {
		it('generates API key for authenticated user with valid session', async () => {
			const accountId = '12345678-1234-4567-8901-123456789012';
			const emailHash = await hashEmailWithPepper('test@example.com', testEnv.EMAIL_PEPPER);
			
			// Mock account existence
			testEnv.ACCOUNTS.get.mockResolvedValue(JSON.stringify({
				email_hash: emailHash,
				created: new Date().toISOString(),
				plan: 'free'
			}));

			// Generate valid session token
			const sessionToken = await generateSessionToken(accountId, emailHash, testEnv.JWT_SECRET);

			const request = new IncomingRequest('https://example.com/dashboard/api-keys', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Cookie': `edge_og_session=${sessionToken}`,
				},
				body: JSON.stringify({
					name: 'Test API Key'
				}),
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, testEnv, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(201);
			
			const data = await response.json() as any;
			expect(data.success).toBe(true);
			expect(data.api_key).toBeDefined();
			expect(data.api_key.name).toBe('Test API Key');
			expect(data.api_key.key).toMatch(/^eog_[A-Za-z0-9]+_[A-Za-z0-9]+$/); // Base62 format
			expect(data.api_key.prefix).toMatch(/^eog_[A-Za-z0-9]+$/);
			expect(data.api_key.created).toBeDefined();
			expect(data.warning).toContain('Store this API key securely');

			// Verify API key was stored in KV
			expect(testEnv.API_KEYS.put).toHaveBeenCalledWith(
				expect.stringMatching(/^key:[A-Za-z0-9]+$/),
				expect.stringContaining('"account":"' + accountId + '"'),
				expect.objectContaining({
					metadata: expect.objectContaining({
						account: accountId,
						name: 'Test API Key'
					})
				})
			);
		});

		it('rejects request without authentication', async () => {
			const request = new IncomingRequest('https://example.com/dashboard/api-keys', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					name: 'Test API Key'
				}),
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, testEnv, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(401);
			
			const data = await response.json() as any;
			expect(data.error).toBe('Authentication required. Please log in first.');
		});

		it('rejects request with invalid session token', async () => {
			const request = new IncomingRequest('https://example.com/dashboard/api-keys', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Cookie': 'edge_og_session=invalid-token',
				},
				body: JSON.stringify({
					name: 'Test API Key'
				}),
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, testEnv, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(401);
			
			const data = await response.json() as any;
			expect(data.error).toBe('Invalid or expired session. Please log in again.');
		});

		it('rejects request for non-existent account', async () => {
			const accountId = '12345678-1234-4567-8901-123456789012';
			const emailHash = await hashEmailWithPepper('test@example.com', testEnv.EMAIL_PEPPER);
			
			// Mock account not found
			testEnv.ACCOUNTS.get.mockResolvedValue(null);

			// Generate valid session token
			const sessionToken = await generateSessionToken(accountId, emailHash, testEnv.JWT_SECRET);

			const request = new IncomingRequest('https://example.com/dashboard/api-keys', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Cookie': `edge_og_session=${sessionToken}`,
				},
				body: JSON.stringify({
					name: 'Test API Key'
				}),
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, testEnv, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(404);
			
			const data = await response.json() as any;
			expect(data.error).toBe('Account not found.');
		});

		it('rejects request without key name', async () => {
			const accountId = '12345678-1234-4567-8901-123456789012';
			const emailHash = await hashEmailWithPepper('test@example.com', testEnv.EMAIL_PEPPER);
			
			// Mock account existence
			testEnv.ACCOUNTS.get.mockResolvedValue(JSON.stringify({
				email_hash: emailHash,
				created: new Date().toISOString(),
				plan: 'free'
			}));

			// Generate valid session token
			const sessionToken = await generateSessionToken(accountId, emailHash, testEnv.JWT_SECRET);

			const request = new IncomingRequest('https://example.com/dashboard/api-keys', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Cookie': `edge_og_session=${sessionToken}`,
				},
				body: JSON.stringify({
					name: ''
				}),
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, testEnv, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(400);
			
			const data = await response.json() as any;
			expect(data.error).toBe('API key name is required');
		});

		it('rejects request with key name too long', async () => {
			const accountId = '12345678-1234-4567-8901-123456789012';
			const emailHash = await hashEmailWithPepper('test@example.com', testEnv.EMAIL_PEPPER);
			
			// Mock account existence
			testEnv.ACCOUNTS.get.mockResolvedValue(JSON.stringify({
				email_hash: emailHash,
				created: new Date().toISOString(),
				plan: 'free'
			}));

			// Generate valid session token
			const sessionToken = await generateSessionToken(accountId, emailHash, testEnv.JWT_SECRET);

			const longName = 'a'.repeat(101); // 101 characters, exceeds limit

			const request = new IncomingRequest('https://example.com/dashboard/api-keys', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Cookie': `edge_og_session=${sessionToken}`,
				},
				body: JSON.stringify({
					name: longName
				}),
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, testEnv, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(400);
			
			const data = await response.json() as any;
			expect(data.error).toBe('API key name must be 100 characters or less');
		});

		it('handles form data content type', async () => {
			const accountId = '12345678-1234-4567-8901-123456789012';
			const emailHash = await hashEmailWithPepper('test@example.com', testEnv.EMAIL_PEPPER);
			
			// Mock account existence
			testEnv.ACCOUNTS.get.mockResolvedValue(JSON.stringify({
				email_hash: emailHash,
				created: new Date().toISOString(),
				plan: 'free'
			}));

			// Generate valid session token
			const sessionToken = await generateSessionToken(accountId, emailHash, testEnv.JWT_SECRET);

			const formData = new FormData();
			formData.append('name', 'Form Test Key');

			const request = new IncomingRequest('https://example.com/dashboard/api-keys', {
				method: 'POST',
				headers: {
					'Cookie': `edge_og_session=${sessionToken}`,
				},
				body: formData,
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, testEnv, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(201);
			
			const data = await response.json() as any;
			expect(data.success).toBe(true);
			expect(data.api_key.name).toBe('Form Test Key');
		});

		it('rejects unsupported content type', async () => {
			const accountId = '12345678-1234-4567-8901-123456789012';
			const emailHash = await hashEmailWithPepper('test@example.com', testEnv.EMAIL_PEPPER);
			
			// Mock account existence
			testEnv.ACCOUNTS.get.mockResolvedValue(JSON.stringify({
				email_hash: emailHash,
				created: new Date().toISOString(),
				plan: 'free'
			}));

			// Generate valid session token
			const sessionToken = await generateSessionToken(accountId, emailHash, testEnv.JWT_SECRET);

			const request = new IncomingRequest('https://example.com/dashboard/api-keys', {
				method: 'POST',
				headers: {
					'Content-Type': 'text/plain',
					'Cookie': `edge_og_session=${sessionToken}`,
				},
				body: 'plain text body',
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, testEnv, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(400);
			
			const data = await response.json() as any;
			expect(data.error).toBe('Content-Type must be application/json or application/x-www-form-urlencoded');
		});

		it('handles KV storage errors gracefully', async () => {
			const accountId = '12345678-1234-4567-8901-123456789012';
			const emailHash = await hashEmailWithPepper('test@example.com', testEnv.EMAIL_PEPPER);
			
			// Mock account existence
			testEnv.ACCOUNTS.get.mockResolvedValue(JSON.stringify({
				email_hash: emailHash,
				created: new Date().toISOString(),
				plan: 'free'
			}));

			// Mock API_KEYS.put to fail
			testEnv.API_KEYS.put.mockRejectedValue(new Error('KV storage error'));

			// Generate valid session token
			const sessionToken = await generateSessionToken(accountId, emailHash, testEnv.JWT_SECRET);

			const request = new IncomingRequest('https://example.com/dashboard/api-keys', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Cookie': `edge_og_session=${sessionToken}`,
				},
				body: JSON.stringify({
					name: 'Test API Key'
				}),
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, testEnv, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(500);
			
			const data = await response.json() as any;
			expect(data.error).toBe('Failed to generate API key. Please try again.');
		});
	});

	describe('API Key Format Validation', () => {
		it('generates keys with correct format and length', async () => {
			const accountId = '12345678-1234-4567-8901-123456789012';
			const emailHash = await hashEmailWithPepper('test@example.com', testEnv.EMAIL_PEPPER);
			
			// Mock account existence
			const formatTestEnv = {
				...testEnv,
				API_KEYS: {
					get: vi.fn().mockResolvedValue(null),
					put: vi.fn().mockResolvedValue(undefined), // Don't mock error for this test
					delete: vi.fn().mockResolvedValue(undefined),
					list: vi.fn().mockResolvedValue({ keys: [] }),
					getWithMetadata: vi.fn().mockResolvedValue({ value: null, metadata: null }),
				},
			} as any;

			formatTestEnv.ACCOUNTS.get.mockResolvedValue(JSON.stringify({
				email_hash: emailHash,
				created: new Date().toISOString(),
				plan: 'free'
			}));

			// Generate valid session token
			const sessionToken = await generateSessionToken(accountId, emailHash, testEnv.JWT_SECRET);

			const request = new IncomingRequest('https://example.com/dashboard/api-keys', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Cookie': `edge_og_session=${sessionToken}`,
				},
				body: JSON.stringify({
					name: 'Format Test Key'
				}),
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, formatTestEnv, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(201);
			
			const data = await response.json() as any;
			const apiKey = data.api_key.key;
			
			// Validate format: eog_{prefix}_{secret}
			expect(apiKey).toMatch(/^eog_[A-Za-z0-9]+_[A-Za-z0-9]+$/);
			
			// Validate parts
			const parts = apiKey.split('_');
			expect(parts).toHaveLength(3);
			expect(parts[0]).toBe('eog');
			expect(parts[1]).toMatch(/^[A-Za-z0-9]+$/); // prefix (kid)
			expect(parts[2]).toMatch(/^[A-Za-z0-9]+$/); // secret
			
			// Validate total length is reasonable (should be close to 64 chars as per roadmap)
			expect(apiKey.length).toBeGreaterThan(20);
			expect(apiKey.length).toBeLessThan(100);
		});

		it('generates unique keys for multiple requests', async () => {
			const accountId = '12345678-1234-4567-8901-123456789012';
			const emailHash = await hashEmailWithPepper('test@example.com', testEnv.EMAIL_PEPPER);
			
			// Mock account existence with fresh mocks for each request
			const uniqueTestEnv = {
				...testEnv,
				ACCOUNTS: {
					get: vi.fn().mockResolvedValue(JSON.stringify({
						email_hash: emailHash,
						created: new Date().toISOString(),
						plan: 'free'
					})),
					put: vi.fn().mockResolvedValue(undefined),
					delete: vi.fn().mockResolvedValue(undefined),
					list: vi.fn().mockResolvedValue({ keys: [] }),
					getWithMetadata: vi.fn().mockResolvedValue({ value: null, metadata: null }),
				},
				API_KEYS: {
					get: vi.fn().mockResolvedValue(null),
					put: vi.fn().mockResolvedValue(undefined), // Success
					delete: vi.fn().mockResolvedValue(undefined),
					list: vi.fn().mockResolvedValue({ keys: [] }),
					getWithMetadata: vi.fn().mockResolvedValue({ value: null, metadata: null }),
				},
			} as any;

			// Generate valid session token
			const sessionToken = await generateSessionToken(accountId, emailHash, testEnv.JWT_SECRET);

			const keys: string[] = [];

			// Generate multiple API keys
			for (let i = 0; i < 3; i++) {
				const request = new IncomingRequest('https://example.com/dashboard/api-keys', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Cookie': `edge_og_session=${sessionToken}`,
					},
					body: JSON.stringify({
						name: `Test Key ${i + 1}`
					}),
				});

				const ctx = createExecutionContext();
				const response = await worker.fetch(request, uniqueTestEnv, ctx);
				await waitOnExecutionContext(ctx);

				expect(response.status).toBe(201);
				
				const data = await response.json() as any;
				keys.push(data.api_key.key);
			}

			// Verify all keys are unique
			const uniqueKeys = new Set(keys);
			expect(uniqueKeys.size).toBe(keys.length);
		});
	});

	describe('GET /dashboard/api-keys (listing)', () => {
		it('lists API keys for authenticated user', async () => {
			const accountId = '12345678-1234-4567-8901-123456789012';
			const emailHash = await hashEmailWithPepper('test@example.com', testEnv.EMAIL_PEPPER);
			
			// Mock account existence
			testEnv.ACCOUNTS.get.mockResolvedValue(JSON.stringify({
				email_hash: emailHash,
				created: new Date().toISOString(),
				plan: 'free'
			}));

			// Mock KV list response with one key
			const mockKid = 'abc123def456';
			testEnv.API_KEYS.list.mockResolvedValue({
				keys: [
					{
						name: `key:${mockKid}`,
						metadata: {
							account: accountId,
							created_at: Date.now(),
							name: 'Test Key',
						}
					}
				]
			});

			// Mock key data retrieval
			testEnv.API_KEYS.get.mockImplementation((key: string, type?: string) => {
				if (key === `key:${mockKid}`) {
					const rawData = JSON.stringify({
						account: accountId,
						hash: 'mocked-hash',
						name: 'Test Key',
						revoked: false,
						created: '2024-01-01T00:00:00.000Z',
						last_used: '2024-01-02T00:00:00.000Z'
					});
					
					if (type === 'json') {
						return Promise.resolve(JSON.parse(rawData));
					} else {
						return Promise.resolve(rawData);
					}
				}
				return Promise.resolve(null);
			});

			// Generate valid session token
			const sessionToken = await generateSessionToken(accountId, emailHash, testEnv.JWT_SECRET);

			const request = new IncomingRequest('https://example.com/dashboard/api-keys', {
				method: 'GET',
				headers: {
					'Cookie': `edge_og_session=${sessionToken}`,
				},
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, testEnv, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(200);
			
			const data = await response.json() as any;
			expect(data.success).toBe(true);
			expect(data.api_keys).toHaveLength(1);
			expect(data.api_keys[0]).toEqual({
				id: mockKid,
				name: 'Test Key',
				prefix: `eog_${mockKid}`,
				created: '2024-01-01T00:00:00.000Z',
				last_used: '2024-01-02T00:00:00.000Z',
				revoked: false,
			});
		});

		it('returns empty list when user has no API keys', async () => {
			const accountId = '12345678-1234-4567-8901-123456789012';
			const emailHash = await hashEmailWithPepper('test@example.com', testEnv.EMAIL_PEPPER);
			
			// Mock account existence
			testEnv.ACCOUNTS.get.mockResolvedValue(JSON.stringify({
				email_hash: emailHash,
				created: new Date().toISOString(),
				plan: 'free'
			}));

			// Mock empty KV list response
			testEnv.API_KEYS.list.mockResolvedValue({
				keys: []
			});

			// Generate valid session token
			const sessionToken = await generateSessionToken(accountId, emailHash, testEnv.JWT_SECRET);

			const request = new IncomingRequest('https://example.com/dashboard/api-keys', {
				method: 'GET',
				headers: {
					'Cookie': `edge_og_session=${sessionToken}`,
				},
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, testEnv, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(200);
			
			const data = await response.json() as any;
			expect(data.success).toBe(true);
			expect(data.api_keys).toHaveLength(0);
		});

		it('filters out keys from other accounts', async () => {
			const accountId = '12345678-1234-4567-8901-123456789012';
			const otherAccountId = '98765432-1234-4567-8901-123456789012';
			const emailHash = await hashEmailWithPepper('test@example.com', testEnv.EMAIL_PEPPER);
			
			// Mock account existence
			testEnv.ACCOUNTS.get.mockResolvedValue(JSON.stringify({
				email_hash: emailHash,
				created: new Date().toISOString(),
				plan: 'free'
			}));

			// Mock KV list response with keys from different accounts
			testEnv.API_KEYS.list.mockResolvedValue({
				keys: [
					{
						name: 'key:mykey123',
						metadata: {
							account: accountId,
							created_at: Date.now(),
							name: 'My Key',
						}
					},
					{
						name: 'key:otherkey456',
						metadata: {
							account: otherAccountId,
							created_at: Date.now(),
							name: 'Other Key',
						}
					}
				]
			});

			// Mock key data retrieval for my key only
			testEnv.API_KEYS.get.mockImplementation((key: string, type?: string) => {
				if (key === 'key:mykey123') {
					const rawData = JSON.stringify({
						account: accountId,
						hash: 'my-hash',
						name: 'My Key',
						revoked: false,
						created: '2024-01-01T00:00:00.000Z',
					});
					
					if (type === 'json') {
						return Promise.resolve(JSON.parse(rawData));
					} else {
						return Promise.resolve(rawData);
					}
				}
				return Promise.resolve(null);
			});

			// Generate valid session token
			const sessionToken = await generateSessionToken(accountId, emailHash, testEnv.JWT_SECRET);

			const request = new IncomingRequest('https://example.com/dashboard/api-keys', {
				method: 'GET',
				headers: {
					'Cookie': `edge_og_session=${sessionToken}`,
				},
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, testEnv, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(200);
			
			const data = await response.json() as any;
			expect(data.success).toBe(true);
			expect(data.api_keys).toHaveLength(1);
			expect(data.api_keys[0].id).toBe('mykey123');
			expect(data.api_keys[0].name).toBe('My Key');
		});

		it('rejects request without authentication', async () => {
			const request = new IncomingRequest('https://example.com/dashboard/api-keys', {
				method: 'GET',
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, testEnv, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(401);
			
			const data = await response.json() as any;
			expect(data.error).toBe('Authentication required. Please log in first.');
		});

		it('rejects request with invalid session token', async () => {
			const request = new IncomingRequest('https://example.com/dashboard/api-keys', {
				method: 'GET',
				headers: {
					'Cookie': 'edge_og_session=invalid-token',
				},
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, testEnv, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(401);
			
			const data = await response.json() as any;
			expect(data.error).toBe('Invalid or expired session. Please log in again.');
		});
	});

	describe('DELETE /dashboard/api-keys/{keyId} (revocation)', () => {
		it('revokes API key for authenticated user', async () => {
			const accountId = '12345678-1234-4567-8901-123456789012';
			const emailHash = await hashEmailWithPepper('test@example.com', testEnv.EMAIL_PEPPER);
			const keyId = 'abc123def456';
			
			// Mock account existence
			testEnv.ACCOUNTS.get.mockResolvedValue(JSON.stringify({
				email_hash: emailHash,
				created: new Date().toISOString(),
				plan: 'free'
			}));

			// Mock key data retrieval
			testEnv.API_KEYS.get.mockImplementation((key: string, type?: string) => {
				if (key === `key:${keyId}`) {
					const keyData = {
						account: accountId,
						hash: 'mocked-hash',
						name: 'Test Key',
						revoked: false,
						created: '2024-01-01T00:00:00.000Z'
					};
					if (type === 'json') {
						return Promise.resolve(keyData);
					}
					return Promise.resolve(JSON.stringify(keyData));
				}
				return Promise.resolve(null);
			});

			// Mock getWithMetadata for preserving metadata
			testEnv.API_KEYS.getWithMetadata.mockResolvedValue({
				value: null,
				metadata: {
					account: accountId,
					created_at: Date.now(),
					name: 'Test Key',
				}
			});

			// Mock KV put for storing revoked key data
			testEnv.API_KEYS.put.mockResolvedValue();

			// Generate valid session token
			const sessionToken = await generateSessionToken(accountId, emailHash, testEnv.JWT_SECRET);

			const request = new IncomingRequest(`https://example.com/dashboard/api-keys/${keyId}`, {
				method: 'DELETE',
				headers: {
					'Cookie': `edge_og_session=${sessionToken}`,
				},
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, testEnv, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(200);
			
			const data = await response.json() as any;
			expect(data.success).toBe(true);
			expect(data.message).toBe('API key revoked successfully.');
			expect(data.key_id).toBe(keyId);

			// Verify the key was updated with revoked=true
			expect(testEnv.API_KEYS.put).toHaveBeenCalledWith(
				`key:${keyId}`,
				expect.stringContaining('"revoked":true'),
				expect.any(Object)
			);
		});

		it('returns 404 for non-existent API key', async () => {
			const accountId = '12345678-1234-4567-8901-123456789012';
			const emailHash = await hashEmailWithPepper('test@example.com', testEnv.EMAIL_PEPPER);
			const keyId = 'nonexistent123';
			
			// Mock account existence
			testEnv.ACCOUNTS.get.mockResolvedValue(JSON.stringify({
				email_hash: emailHash,
				created: new Date().toISOString(),
				plan: 'free'
			}));

			// Mock key not found
			testEnv.API_KEYS.get.mockResolvedValue(null);

			// Generate valid session token
			const sessionToken = await generateSessionToken(accountId, emailHash, testEnv.JWT_SECRET);

			const request = new IncomingRequest(`https://example.com/dashboard/api-keys/${keyId}`, {
				method: 'DELETE',
				headers: {
					'Cookie': `edge_og_session=${sessionToken}`,
				},
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, testEnv, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(404);
			
			const data = await response.json() as any;
			expect(data.error).toBe('API key not found or not authorized to revoke.');
		});

		it('returns 404 when trying to revoke key owned by different account', async () => {
			const accountId = '12345678-1234-4567-8901-123456789012';
			const otherAccountId = '98765432-1234-4567-8901-123456789012';
			const emailHash = await hashEmailWithPepper('test@example.com', testEnv.EMAIL_PEPPER);
			const keyId = 'abc123def456';
			
			// Mock account existence
			testEnv.ACCOUNTS.get.mockResolvedValue(JSON.stringify({
				email_hash: emailHash,
				created: new Date().toISOString(),
				plan: 'free'
			}));

			// Mock key owned by different account
			testEnv.API_KEYS.get.mockResolvedValue(JSON.stringify({
				account: otherAccountId, // Different account
				hash: 'mocked-hash',
				name: 'Other Account Key',
				revoked: false,
				created: '2024-01-01T00:00:00.000Z'
			}));

			// Generate valid session token
			const sessionToken = await generateSessionToken(accountId, emailHash, testEnv.JWT_SECRET);

			const request = new IncomingRequest(`https://example.com/dashboard/api-keys/${keyId}`, {
				method: 'DELETE',
				headers: {
					'Cookie': `edge_og_session=${sessionToken}`,
				},
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, testEnv, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(404);
			
			const data = await response.json() as any;
			expect(data.error).toBe('API key not found or not authorized to revoke.');
		});

		it('is idempotent - returns success when revoking already revoked key', async () => {
			const accountId = '12345678-1234-4567-8901-123456789012';
			const emailHash = await hashEmailWithPepper('test@example.com', testEnv.EMAIL_PEPPER);
			const keyId = 'abc123def456';
			
			// Mock account existence
			testEnv.ACCOUNTS.get.mockResolvedValue(JSON.stringify({
				email_hash: emailHash,
				created: new Date().toISOString(),
				plan: 'free'
			}));

			// Mock already revoked key
			testEnv.API_KEYS.get.mockImplementation((key: string, type?: string) => {
				if (key === `key:${keyId}`) {
					const keyData = {
						account: accountId,
						hash: 'mocked-hash',
						name: 'Test Key',
						revoked: true, // Already revoked
						created: '2024-01-01T00:00:00.000Z'
					};
					if (type === 'json') {
						return Promise.resolve(keyData);
					}
					return Promise.resolve(JSON.stringify(keyData));
				}
				return Promise.resolve(null);
			});

			// Generate valid session token
			const sessionToken = await generateSessionToken(accountId, emailHash, testEnv.JWT_SECRET);

			const request = new IncomingRequest(`https://example.com/dashboard/api-keys/${keyId}`, {
				method: 'DELETE',
				headers: {
					'Cookie': `edge_og_session=${sessionToken}`,
				},
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, testEnv, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(200);
			
			const data = await response.json() as any;
			expect(data.success).toBe(true);
			expect(data.message).toBe('API key revoked successfully.');
		});

		it('returns 400 when key ID is missing from URL', async () => {
			const accountId = '12345678-1234-4567-8901-123456789012';
			const emailHash = await hashEmailWithPepper('test@example.com', testEnv.EMAIL_PEPPER);
			
			// Mock account existence
			testEnv.ACCOUNTS.get.mockResolvedValue(JSON.stringify({
				email_hash: emailHash,
				created: new Date().toISOString(),
				plan: 'free'
			}));

			// Generate valid session token
			const sessionToken = await generateSessionToken(accountId, emailHash, testEnv.JWT_SECRET);

			const request = new IncomingRequest('https://example.com/dashboard/api-keys/api-keys', {
				method: 'DELETE',
				headers: {
					'Cookie': `edge_og_session=${sessionToken}`,
				},
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, testEnv, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(400);
			
			const data = await response.json() as any;
			expect(data.error).toBe('API key ID is required.');
		});

		it('rejects request without authentication', async () => {
			const request = new IncomingRequest('https://example.com/dashboard/api-keys/some-key-id', {
				method: 'DELETE',
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, testEnv, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(401);
			
			const data = await response.json() as any;
			expect(data.error).toBe('Authentication required. Please log in first.');
		});

		it('rejects request with invalid session token', async () => {
			const request = new IncomingRequest('https://example.com/dashboard/api-keys/some-key-id', {
				method: 'DELETE',
				headers: {
					'Cookie': 'edge_og_session=invalid-token',
				},
			});

			const ctx = createExecutionContext();
			const response = await worker.fetch(request, testEnv, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(401);
			
			const data = await response.json() as any;
			expect(data.error).toBe('Invalid or expired session. Please log in again.');
		});
	});
});
