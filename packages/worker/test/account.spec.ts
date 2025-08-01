import { describe, it, expect, beforeEach } from 'vitest';
import { 
	createAccount,
	verifyEmail,
	getAccount,
	getAccountByEmail,
	updateLastActive,
	updateAccountQuota,
	getAccountQuotaLimit,
	hasAccountExceededQuota,
	isValidEmail,
	generateVerificationToken
} from '../src/utils/account';

// Mock KV namespace for testing
class MockKVNamespace {
	private store = new Map<string, string>();

	async get(key: string): Promise<string | null> {
		return this.store.get(key) || null;
	}

	async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
		this.store.set(key, value);
		// In a real test, you might want to handle TTL expiration
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

describe('Enhanced AQ-1: Account Management System', () => {
	let mockKV: MockKVNamespace;
	let mockEnv: { API_KEYS: any };

	beforeEach(() => {
		mockKV = new MockKVNamespace();
		mockEnv = { API_KEYS: mockKV as any };
	});

	describe('Email validation', () => {
		it('should validate correct email formats', () => {
			expect(isValidEmail('user@example.com')).toBe(true);
			expect(isValidEmail('test.email+tag@domain.co.uk')).toBe(true);
			expect(isValidEmail('user123@sub.domain.org')).toBe(true);
		});

		it('should reject invalid email formats', () => {
			expect(isValidEmail('invalid-email')).toBe(false);
			expect(isValidEmail('@domain.com')).toBe(false);
			expect(isValidEmail('user@')).toBe(false);
			expect(isValidEmail('')).toBe(false);
		});
	});

	describe('Verification token generation', () => {
		it('should generate verification token with correct format', () => {
			const token = generateVerificationToken();
			
			expect(token).toMatch(/^verify_[a-z0-9]{32}$/);
			expect(token.length).toBe(39); // 'verify_' (7) + 32 chars
		});

		it('should generate unique tokens', () => {
			const token1 = generateVerificationToken();
			const token2 = generateVerificationToken();
			
			expect(token1).not.toBe(token2);
		});
	});

	describe('Account creation', () => {
		it('should create account with correct structure', async () => {
			const email = 'test@example.com';
			
			const result = await createAccount(email, mockEnv);
			
			expect(result.account).toMatchObject({
				email: email.toLowerCase(),
				emailVerified: false,
				subscriptionTier: 'free',
				totalQuotaUsed: 0,
				apiKeyCount: 0,
			});
			expect(result.account.id).toBeDefined();
			expect(result.account.createdAt).toBeDefined();
			expect(result.account.quotaResetDate).toBeDefined();
			expect(result.verificationToken).toMatch(/^verify_/);
			expect(result.message).toContain('verify');
		});

		it('should store account data in KV', async () => {
			const email = 'test@example.com';
			
			const result = await createAccount(email, mockEnv);
			
			// Check account storage
			const storedAccount = await mockKV.get(`account:${result.account.id}`);
			expect(storedAccount).toBeDefined();
			expect(JSON.parse(storedAccount!).email).toBe(email.toLowerCase());
			
			// Check email mapping
			const emailMapping = await mockKV.get(`email:${email.toLowerCase()}`);
			expect(emailMapping).toBe(result.account.id);
			
			// Check verification token storage
			const tokenData = await mockKV.get(`verification:${result.verificationToken}`);
			expect(tokenData).toBeDefined();
		});

		it('should prevent duplicate accounts', async () => {
			const email = 'test@example.com';
			
			// Create first account
			await createAccount(email, mockEnv);
			
			// Try to create duplicate
			await expect(createAccount(email, mockEnv)).rejects.toThrow('already exists');
		});

		it('should handle case insensitive emails', async () => {
			const email = 'Test@Example.COM';
			
			const result = await createAccount(email, mockEnv);
			
			expect(result.account.email).toBe('test@example.com');
		});

		it('should reject invalid email formats', async () => {
			await expect(createAccount('invalid-email', mockEnv)).rejects.toThrow('Invalid email format');
		});
	});

	describe('Email verification', () => {
		it('should verify email with valid token', async () => {
			const email = 'test@example.com';
			const accountResult = await createAccount(email, mockEnv);
			
			const verifiedAccount = await verifyEmail(accountResult.verificationToken, mockEnv);
			
			expect(verifiedAccount.emailVerified).toBe(true);
			expect(verifiedAccount.lastActiveAt).toBeDefined();
			expect(verifiedAccount.id).toBe(accountResult.account.id);
		});

		it('should remove verification token after successful verification', async () => {
			const email = 'test@example.com';
			const accountResult = await createAccount(email, mockEnv);
			
			await verifyEmail(accountResult.verificationToken, mockEnv);
			
			// Token should be deleted
			const tokenData = await mockKV.get(`verification:${accountResult.verificationToken}`);
			expect(tokenData).toBeNull();
		});

		it('should reject invalid tokens', async () => {
			await expect(verifyEmail('invalid-token', mockEnv)).rejects.toThrow('Invalid or expired');
		});

		it('should reject expired tokens', async () => {
			const email = 'test@example.com';
			const accountResult = await createAccount(email, mockEnv);
			
			// Manually set expired token
			const expiredTokenData = {
				email,
				accountId: accountResult.account.id,
				expiresAt: new Date(Date.now() - 1000).toISOString(), // 1 second ago
				token: accountResult.verificationToken
			};
			await mockKV.put(`verification:${accountResult.verificationToken}`, JSON.stringify(expiredTokenData));
			
			await expect(verifyEmail(accountResult.verificationToken, mockEnv)).rejects.toThrow('expired');
		});
	});

	describe('Account retrieval', () => {
		it('should get account by ID', async () => {
			const email = 'test@example.com';
			const accountResult = await createAccount(email, mockEnv);
			
			const account = await getAccount(accountResult.account.id, mockEnv);
			
			expect(account).toBeDefined();
			expect(account!.id).toBe(accountResult.account.id);
			expect(account!.email).toBe(email.toLowerCase());
		});

		it('should get account by email', async () => {
			const email = 'test@example.com';
			const accountResult = await createAccount(email, mockEnv);
			
			const account = await getAccountByEmail(email, mockEnv);
			
			expect(account).toBeDefined();
			expect(account!.id).toBe(accountResult.account.id);
			expect(account!.email).toBe(email.toLowerCase());
		});

		it('should return null for non-existent accounts', async () => {
			const account = await getAccount('non-existent-id', mockEnv);
			expect(account).toBeNull();
			
			const accountByEmail = await getAccountByEmail('non-existent@example.com', mockEnv);
			expect(accountByEmail).toBeNull();
		});
	});

	describe('Account updates', () => {
		it('should update last active timestamp', async () => {
			const email = 'test@example.com';
			const accountResult = await createAccount(email, mockEnv);
			
			await updateLastActive(accountResult.account.id, mockEnv);
			
			const updatedAccount = await getAccount(accountResult.account.id, mockEnv);
			expect(updatedAccount!.lastActiveAt).toBeDefined();
		});

		it('should update account quota', async () => {
			const email = 'test@example.com';
			const accountResult = await createAccount(email, mockEnv);
			
			const success = await updateAccountQuota(accountResult.account.id, 50, mockEnv);
			
			expect(success).toBe(true);
			
			const updatedAccount = await getAccount(accountResult.account.id, mockEnv);
			expect(updatedAccount!.totalQuotaUsed).toBe(50);
		});

		it('should reset quota when month changes', async () => {
			const email = 'test@example.com';
			const accountResult = await createAccount(email, mockEnv);
			
			// Manually set usage and past reset date
			const account = await getAccount(accountResult.account.id, mockEnv);
			account!.totalQuotaUsed = 500;
			account!.quotaResetDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // Yesterday
			await mockKV.put(`account:${account!.id}`, JSON.stringify(account));
			
			// Update quota - should trigger reset
			await updateAccountQuota(accountResult.account.id, 1, mockEnv);
			
			const updatedAccount = await getAccount(accountResult.account.id, mockEnv);
			expect(updatedAccount!.totalQuotaUsed).toBe(1); // Reset to 0, then incremented by 1
		});
	});

	describe('Quota management', () => {
		it('should return correct quota limits for tiers', () => {
			expect(getAccountQuotaLimit('free')).toBe(1000);
			expect(getAccountQuotaLimit('starter')).toBe(50000);
			expect(getAccountQuotaLimit('pro')).toBe(200000);
		});

		it('should detect quota exceeded', async () => {
			const email = 'test@example.com';
			const accountResult = await createAccount(email, mockEnv);
			
			// Set usage to exceed free tier limit
			await updateAccountQuota(accountResult.account.id, 1001, mockEnv);
			
			const exceeded = await hasAccountExceededQuota(accountResult.account.id, mockEnv);
			expect(exceeded).toBe(true);
		});

		it('should return false when under quota', async () => {
			const email = 'test@example.com';
			const accountResult = await createAccount(email, mockEnv);
			
			await updateAccountQuota(accountResult.account.id, 500, mockEnv);
			
			const exceeded = await hasAccountExceededQuota(accountResult.account.id, mockEnv);
			expect(exceeded).toBe(false);
		});

		it('should fail safe for non-existent accounts', async () => {
			const exceeded = await hasAccountExceededQuota('non-existent', mockEnv);
			expect(exceeded).toBe(true);
		});
	});

	describe('Error handling', () => {
		it('should handle missing KV namespace', async () => {
			const result = await getAccount('test-id', undefined);
			expect(result).toBeNull();
		});

		it('should handle KV errors gracefully', async () => {
			// Mock KV to throw error
			const errorEnv = {
				API_KEYS: {
					get: () => { throw new Error('KV Error'); }
				}
			};
			
			const result = await getAccount('test-id', errorEnv as any);
			expect(result).toBeNull();
		});
	});
});
