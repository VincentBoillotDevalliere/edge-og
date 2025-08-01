import { describe, it, expect, beforeEach } from 'vitest';
import { 
	generateApiKey, 
	hashApiKey, 
	verifyApiKey, 
	createApiKey, 
	validateApiKey, 
	listApiKeys, 
	revokeApiKey, 
	incrementQuotaUsage, 
	hasExceededQuota 
} from '../src/utils/apikey';

// Mock KV namespace for testing
class MockKVNamespace {
	private store = new Map<string, string>();

	async get(key: string): Promise<string | null> {
		return this.store.get(key) || null;
	}

	async put(key: string, value: string): Promise<void> {
		this.store.set(key, value);
	}

	async delete(key: string): Promise<void> {
		this.store.delete(key);
	}

	async list(options?: { prefix?: string }): Promise<{ keys: Array<{ name: string }> }> {
		const keys = Array.from(this.store.keys());
		const filteredKeys = options?.prefix 
			? keys.filter(key => key.startsWith(options.prefix!))
			: keys;
		
		return {
			keys: filteredKeys.map(name => ({ name }))
		};
	}

	clear(): void {
		this.store.clear();
	}
}

describe('AQ-1: API Key Management', () => {
	let mockKV: MockKVNamespace;
	let mockEnv: { API_KEYS: any };

	beforeEach(() => {
		mockKV = new MockKVNamespace();
		// Use type assertion to bypass strict typing for testing
		mockEnv = { API_KEYS: mockKV as any };
	});

	describe('generateApiKey', () => {
		it('should generate API key with correct format', () => {
			const apiKey = generateApiKey();
			
			expect(apiKey).toMatch(/^edgeog_[a-z0-9]{32}$/);
			expect(apiKey.length).toBe(39); // 'edgeog_' (7) + 32 chars
		});

		it('should generate unique API keys', () => {
			const key1 = generateApiKey();
			const key2 = generateApiKey();
			
			expect(key1).not.toBe(key2);
		});
	});

	describe('hashApiKey', () => {
		it('should hash API key with salt', async () => {
			const apiKey = 'edgeog_test123';
			const hash = await hashApiKey(apiKey);
			
			expect(hash).toContain(':');
			
			const [salt, hashValue] = hash.split(':');
			expect(salt).toBeDefined();
			expect(hashValue).toBeDefined();
			expect(hashValue.length).toBe(64); // SHA-256 hex length
		});

		it('should produce different hashes for same key with different salts', async () => {
			const apiKey = 'edgeog_test123';
			const hash1 = await hashApiKey(apiKey);
			const hash2 = await hashApiKey(apiKey);
			
			expect(hash1).not.toBe(hash2);
		});

		it('should produce same hash when salt is provided', async () => {
			const apiKey = 'edgeog_test123';
			const salt = 'test-salt';
			const hash1 = await hashApiKey(apiKey, salt);
			const hash2 = await hashApiKey(apiKey, salt);
			
			expect(hash1).toBe(hash2);
		});
	});

	describe('verifyApiKey', () => {
		it('should verify correct API key', async () => {
			const apiKey = 'edgeog_test123';
			const hash = await hashApiKey(apiKey);
			
			const isValid = await verifyApiKey(apiKey, hash);
			expect(isValid).toBe(true);
		});

		it('should reject incorrect API key', async () => {
			const apiKey = 'edgeog_test123';
			const wrongKey = 'edgeog_wrong123';
			const hash = await hashApiKey(apiKey);
			
			const isValid = await verifyApiKey(wrongKey, hash);
			expect(isValid).toBe(false);
		});

		it('should handle malformed hash gracefully', async () => {
			const apiKey = 'edgeog_test123';
			const malformedHash = 'invalid-hash';
			
			const isValid = await verifyApiKey(apiKey, malformedHash);
			expect(isValid).toBe(false);
		});
	});

	describe('createApiKey', () => {
		it('should create API key with correct data structure', async () => {
			const userId = 'user123';
			const name = 'Test Key';
			const quotaLimit = 1000;
			
			const result = await createApiKey(userId, name, quotaLimit, mockEnv);
			
			expect(result).toMatchObject({
				userId,
				name,
				quotaLimit,
				quotaUsed: 0,
				active: true,
			});
			expect(result.key).toMatch(/^edgeog_[a-z0-9]{32}$/);
			expect(result.id).toBeDefined();
			expect(result.createdAt).toBeDefined();
			expect(result.quotaResetAt).toBeDefined();
		});

		it('should store API key data in KV', async () => {
			const userId = 'user123';
			const name = 'Test Key';
			
			const result = await createApiKey(userId, name, 1000, mockEnv);
			
			// Check if key data is stored
			const storedKeyData = await mockKV.get(`key:${result.id}`);
			expect(storedKeyData).toBeDefined();
			
			const parsedKeyData = JSON.parse(storedKeyData!);
			expect(parsedKeyData.userId).toBe(userId);
			expect(parsedKeyData.name).toBe(name);
			expect(parsedKeyData.keyHash).toBeDefined();
			
			// Check if user mapping is stored
			const userMapping = await mockKV.get(`user:${userId}`);
			expect(userMapping).toBeDefined();
			expect(JSON.parse(userMapping!)).toContain(result.id);
		});

		it('should use default quota limit for free tier', async () => {
			const result = await createApiKey('user123', 'Test Key', undefined, mockEnv);
			
			expect(result.quotaLimit).toBe(1000); // AQ-2: Free tier default
		});
	});

	describe('validateApiKey', () => {
		it('should validate correct API key and return data', async () => {
			// Create an API key first
			const createdKey = await createApiKey('user123', 'Test Key', 1000, mockEnv);
			
			// Validate it
			const result = await validateApiKey(createdKey.key, mockEnv);
			
			expect(result).toBeDefined();
			expect(result!.userId).toBe('user123');
			expect(result!.name).toBe('Test Key');
			expect(result!.active).toBe(true);
		});

		it('should return null for invalid API key', async () => {
			const invalidKey = 'edgeog_invalid123';
			
			const result = await validateApiKey(invalidKey, mockEnv);
			
			expect(result).toBeNull();
		});

		it('should return null for non-edgeog API key', async () => {
			const invalidKey = 'invalid_format';
			
			const result = await validateApiKey(invalidKey, mockEnv);
			
			expect(result).toBeNull();
		});

		it('should update lastUsedAt timestamp', async () => {
			const createdKey = await createApiKey('user123', 'Test Key', 1000, mockEnv);
			
			// First validation should set lastUsedAt
			await validateApiKey(createdKey.key, mockEnv);
			
			// Check that lastUsedAt was set
			const keyData = await mockKV.get(`key:${createdKey.id}`);
			const parsedData = JSON.parse(keyData!);
			expect(parsedData.lastUsedAt).toBeDefined();
		});
	});

	describe('listApiKeys', () => {
		it('should list API keys for user', async () => {
			const userId = 'user123';
			
			// Create multiple keys
			await createApiKey(userId, 'Key 1', 1000, mockEnv);
			await createApiKey(userId, 'Key 2', 2000, mockEnv);
			
			const keys = await listApiKeys(userId, mockEnv);
			
			expect(keys).toHaveLength(2);
			expect(keys[0].name).toBe('Key 1');
			expect(keys[1].name).toBe('Key 2');
			// Should not include keyHash in response
			expect(keys[0]).not.toHaveProperty('keyHash');
		});

		it('should return empty array for user with no keys', async () => {
			const keys = await listApiKeys('nonexistent', mockEnv);
			
			expect(keys).toHaveLength(0);
		});

		it('should only return active keys', async () => {
			const userId = 'user123';
			
			// Create and revoke a key
			const createdKey = await createApiKey(userId, 'Test Key', 1000, mockEnv);
			await revokeApiKey(createdKey.id, userId, mockEnv);
			
			const keys = await listApiKeys(userId, mockEnv);
			
			expect(keys).toHaveLength(0);
		});
	});

	describe('revokeApiKey', () => {
		it('should revoke API key successfully', async () => {
			const userId = 'user123';
			const createdKey = await createApiKey(userId, 'Test Key', 1000, mockEnv);
			
			const success = await revokeApiKey(createdKey.id, userId, mockEnv);
			
			expect(success).toBe(true);
			
			// Verify key is marked as inactive
			const keyData = await mockKV.get(`key:${createdKey.id}`);
			const parsedData = JSON.parse(keyData!);
			expect(parsedData.active).toBe(false);
		});

		it('should fail to revoke key belonging to different user', async () => {
			const createdKey = await createApiKey('user123', 'Test Key', 1000, mockEnv);
			
			const success = await revokeApiKey(createdKey.id, 'different-user', mockEnv);
			
			expect(success).toBe(false);
			
			// Verify key is still active
			const keyData = await mockKV.get(`key:${createdKey.id}`);
			const parsedData = JSON.parse(keyData!);
			expect(parsedData.active).toBe(true);
		});

		it('should return false for non-existent key', async () => {
			const success = await revokeApiKey('non-existent', 'user123', mockEnv);
			
			expect(success).toBe(false);
		});
	});

	describe('incrementQuotaUsage', () => {
		it('should increment quota usage', async () => {
			const createdKey = await createApiKey('user123', 'Test Key', 1000, mockEnv);
			
			const success = await incrementQuotaUsage(createdKey.id, 1, mockEnv);
			
			expect(success).toBe(true);
			
			// Verify quota was incremented
			const keyData = await mockKV.get(`key:${createdKey.id}`);
			const parsedData = JSON.parse(keyData!);
			expect(parsedData.quotaUsed).toBe(1);
		});

		it('should increment by custom amount', async () => {
			const createdKey = await createApiKey('user123', 'Test Key', 1000, mockEnv);
			
			await incrementQuotaUsage(createdKey.id, 5, mockEnv);
			
			const keyData = await mockKV.get(`key:${createdKey.id}`);
			const parsedData = JSON.parse(keyData!);
			expect(parsedData.quotaUsed).toBe(5);
		});

		it('should reset quota when reset date is passed', async () => {
			const createdKey = await createApiKey('user123', 'Test Key', 1000, mockEnv);
			
			// Manually set quota usage and past reset date
			const keyData = await mockKV.get(`key:${createdKey.id}`);
			const parsedData = JSON.parse(keyData!);
			parsedData.quotaUsed = 500;
			parsedData.quotaResetAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // Yesterday
			await mockKV.put(`key:${createdKey.id}`, JSON.stringify(parsedData));
			
			// Increment usage
			await incrementQuotaUsage(createdKey.id, 1, mockEnv);
			
			// Check that quota was reset and then incremented
			const updatedData = await mockKV.get(`key:${createdKey.id}`);
			const updatedParsed = JSON.parse(updatedData!);
			expect(updatedParsed.quotaUsed).toBe(1); // Reset to 0, then incremented by 1
		});
	});

	describe('hasExceededQuota', () => {
		it('should return false when under quota', async () => {
			const createdKey = await createApiKey('user123', 'Test Key', 1000, mockEnv);
			
			const exceeded = await hasExceededQuota(createdKey.id, mockEnv);
			
			expect(exceeded).toBe(false);
		});

		it('should return true when quota exceeded', async () => {
			const createdKey = await createApiKey('user123', 'Test Key', 10, mockEnv);
			
			// Use up all quota
			await incrementQuotaUsage(createdKey.id, 10, mockEnv);
			
			const exceeded = await hasExceededQuota(createdKey.id, mockEnv);
			
			expect(exceeded).toBe(true);
		});

		it('should return true for non-existent key (fail safe)', async () => {
			const exceeded = await hasExceededQuota('non-existent', mockEnv);
			
			expect(exceeded).toBe(true);
		});
	});
});
