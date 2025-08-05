import { describe, it, expect, vi } from 'vitest';

// Ensure isolated modules
export {};

// Mock crypto for testing
let uuidCounter = 0;
const mockCrypto = {
	randomUUID: () => {
		// Generate different UUIDs each time for testing
		const counter = uuidCounter++;
		return `1234567${counter.toString().padStart(1, '0')}-1234-4567-8901-123456789012`;
	},
	getRandomValues: (array: Uint8Array) => {
		for (let i = 0; i < array.length; i++) {
			array[i] = Math.floor(Math.random() * 256);
		}
		return array;
	},
	subtle: {
		digest: async (algorithm: string, data: ArrayBuffer) => {
			// Mock SHA-256 hash - return different hashes based on input
			const mockHash = new ArrayBuffer(32);
			const view = new Uint8Array(mockHash);
			const inputView = new Uint8Array(data);
			
			// Create a simple hash based on input data
			let seed = 0;
			for (let i = 0; i < inputView.length; i++) {
				seed = (seed + inputView[i]) % 256;
			}
			
			// Fill with pattern based on input
			for (let i = 0; i < 32; i++) {
				view[i] = (seed + i) % 256;
			}
			return mockHash;
		},
	}
};

// Set up crypto mock
Object.defineProperty(globalThis, 'crypto', {
	value: mockCrypto,
	configurable: true
});

// Import auth utilities directly - must be done at module level
import { validateEmail, generateSecureUUID, hashEmailWithPepper, validateAuthEnvironment } from '../src/utils/auth';

// Simple pure function tests that don't require satori dependencies
describe('Auth Utilities - Pure Functions', () => {
	describe('Email Validation', () => {
		it('validates correct email formats', () => {
			const validEmails = [
				'test@example.com',
				'user.name@domain.co.uk',
				'user+tag@example.org',
				'firstname.lastname@company.com',
				'a@b.co',
				'123@example.com'
			];

			validEmails.forEach(email => {
				expect(validateEmail(email)).toBe(true);
			});
		});

		it('rejects invalid email formats', () => {
			const invalidEmails = [
				'',
				'invalid',
				'@domain.com',
				'user@',
				'user.domain.com',
				'user@domain',
				'user name@domain.com',
				'user@domain .com',
				'x'.repeat(250) + '@domain.com', // Too long
				'a@b', // No TLD
			];

			invalidEmails.forEach(email => {
				expect(validateEmail(email), `Expected "${email}" to be invalid`).toBe(false);
			});
			
			// Test null and undefined separately
			expect(validateEmail(null as any)).toBe(false);
			expect(validateEmail(undefined as any)).toBe(false);
		});

		it('normalizes email case and whitespace', () => {
			expect(validateEmail('  Test@EXAMPLE.COM  ')).toBe(true);
			expect(validateEmail('TEST@example.com')).toBe(true);
		});
	});

	describe('UUID Generation', () => {
		it('generates valid UUID v4 format', () => {
			const uuid = generateSecureUUID();
			
			// UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
			const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
			expect(uuid).toMatch(uuidRegex);
		});

		it('generates unique UUIDs', () => {
			const uuid1 = generateSecureUUID();
			const uuid2 = generateSecureUUID();
			
			expect(uuid1).not.toBe(uuid2);
		});
	});

	describe('Email Hashing', () => {
		it('generates consistent hash for same email', async () => {
			const email = 'test@example.com';
			const pepper = 'test-pepper';
			
			const hash1 = await hashEmailWithPepper(email, pepper);
			const hash2 = await hashEmailWithPepper(email, pepper);
			
			expect(hash1).toBe(hash2);
			expect(hash1).toHaveLength(64); // SHA-256 hex string length
		});

		it('generates different hashes for different emails', async () => {
			const pepper = 'test-pepper';
			
			const hash1 = await hashEmailWithPepper('test1@example.com', pepper);
			const hash2 = await hashEmailWithPepper('test2@example.com', pepper);
			
			expect(hash1).not.toBe(hash2);
		});

		it('normalizes email before hashing', async () => {
			const pepper = 'test-pepper';
			
			const hash1 = await hashEmailWithPepper('test@EXAMPLE.com', pepper);
			const hash2 = await hashEmailWithPepper('  TEST@example.COM  ', pepper);
			
			expect(hash1).toBe(hash2);
		});
	});

	describe('Environment Validation', () => {
		const testEnv = {
			JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long-for-security',
			EMAIL_PEPPER: 'test-email-pepper-at-least-16-chars',
			MAILCHANNELS_API_TOKEN: 'test-mailchannels-token',
			BASE_URL: 'https://test.edge-og.com',
			TEMPLATES: {} as any,
			USAGE: {} as any,
			ACCOUNTS: {} as any,
		};

		it('validates complete environment', () => {
			expect(() => validateAuthEnvironment(testEnv)).not.toThrow();
		});

		it('throws error for missing JWT_SECRET', () => {
			const incompleteEnv = { ...testEnv };
			delete (incompleteEnv as any).JWT_SECRET;
			
			expect(() => validateAuthEnvironment(incompleteEnv)).toThrow(
				'Missing required environment variables for authentication: JWT_SECRET'
			);
		});

		it('throws error for missing EMAIL_PEPPER', () => {
			const incompleteEnv = { ...testEnv };
			delete (incompleteEnv as any).EMAIL_PEPPER;
			
			expect(() => validateAuthEnvironment(incompleteEnv)).toThrow(
				'Missing required environment variables for authentication: EMAIL_PEPPER'
			);
		});

		it('throws error for weak JWT_SECRET', () => {
			const weakEnv = { ...testEnv, JWT_SECRET: 'short' };
			
			expect(() => validateAuthEnvironment(weakEnv)).toThrow(
				'JWT_SECRET must be at least 32 characters for security'
			);
		});

		it('throws error for weak EMAIL_PEPPER', () => {
			const weakEnv = { ...testEnv, EMAIL_PEPPER: 'short' };
			
			expect(() => validateAuthEnvironment(weakEnv)).toThrow(
				'EMAIL_PEPPER must be at least 16 characters for security'
			);
		});

		it('throws error for multiple missing variables', () => {
			const incompleteEnv = { ...testEnv };
			delete (incompleteEnv as any).JWT_SECRET;
			delete (incompleteEnv as any).EMAIL_PEPPER;
			
			expect(() => validateAuthEnvironment(incompleteEnv)).toThrow(
				'Missing required environment variables for authentication: JWT_SECRET, EMAIL_PEPPER'
			);
		});
	});
});
