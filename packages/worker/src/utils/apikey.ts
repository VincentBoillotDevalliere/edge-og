export {};

/**
 * API Key Management Utilities for AQ-1 Implementation
 * Provides secure API key generation, encryption, and validation
 */

import { log } from './logger';

/**
 * API Key metadata structure - Enhanced for account-based system
 */
export interface ApiKeyData {
	/** Unique API key identifier */
	id: string;
	/** Account ID this key belongs to */
	accountId: string;
	/** Management token for this key */
	managementToken: string;
	/** Legacy user ID field - deprecated, use accountId */
	userId?: string;
	/** Encrypted API key hash for validation */
	keyHash: string;
	/** Human-readable name for the key */
	name: string;
	/** Creation timestamp */
	createdAt: string;
	/** Last used timestamp */
	lastUsedAt?: string;
	/** Whether the key is active */
	active: boolean;
	/** Current quota usage - now tracked at account level */
	quotaUsed: number;
	/** Monthly quota limit - now determined by account tier */
	quotaLimit: number;
	/** Quota reset date - now managed at account level */
	quotaResetAt: string;
}

/**
 * API Key with plain text value and management token (only returned during creation)
 */
export interface ApiKeyWithSecret extends Omit<ApiKeyData, 'keyHash'> {
	/** Plain text API key (only available during creation) */
	key: string;
	/** Management token for this key (only shown during creation) */
	managementToken: string;
}

/**
 * Generate a cryptographically secure API key
 * Format: edgeog_[32 random chars]
 */
export function generateApiKey(): string {
	const randomBytes = crypto.getRandomValues(new Uint8Array(24));
	const randomString = Array.from(randomBytes, byte => 
		byte.toString(36).padStart(2, '0')
	).join('').substring(0, 32);
	
	return `edgeog_${randomString}`;
}

/**
 * Generate a management token for API key management
 * Format: mgmt_[32 random chars]
 */
export function generateManagementToken(): string {
	const randomBytes = crypto.getRandomValues(new Uint8Array(24));
	const randomString = Array.from(randomBytes, byte => 
		byte.toString(36).padStart(2, '0')
	).join('').substring(0, 32);
	
	return `mgmt_${randomString}`;
}

/**
 * Hash an API key for secure storage
 * Uses SHA-256 with salt for security
 */
export async function hashApiKey(apiKey: string, salt?: string): Promise<string> {
	const actualSalt = salt || crypto.randomUUID();
	const encoder = new TextEncoder();
	const data = encoder.encode(apiKey + actualSalt);
	
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
	
	return `${actualSalt}:${hashHex}`;
}

/**
 * Verify an API key against a hash
 */
export async function verifyApiKey(apiKey: string, storedHash: string): Promise<boolean> {
	try {
		const [salt, expectedHash] = storedHash.split(':');
		if (!salt || !expectedHash) return false;
		
		const computedHash = await hashApiKey(apiKey, salt);
		const [, computedHashValue] = computedHash.split(':');
		
		// Use timing-safe comparison
		return crypto.subtle.timingSafeEqual(
			new TextEncoder().encode(expectedHash),
			new TextEncoder().encode(computedHashValue)
		);
	} catch (error) {
		log({
			event: 'api_key_verification_error',
			error: error instanceof Error ? error.message : String(error),
		});
		return false;
	}
}

/**
 * Create a new API key for an account
 */
export async function createApiKey(
	accountIdOrUserId: string,
	name: string,
	quotaLimit: number = 1000,
	env?: { API_KEYS?: KVNamespace }
): Promise<ApiKeyWithSecret> {
	const apiKey = generateApiKey();
	const keyHash = await hashApiKey(apiKey);
	const keyId = crypto.randomUUID();
	const managementToken = generateManagementToken();
	const now = new Date().toISOString();
	
	// Calculate next month's reset date
	const nextMonth = new Date();
	nextMonth.setMonth(nextMonth.getMonth() + 1);
	nextMonth.setDate(1);
	nextMonth.setHours(0, 0, 0, 0);
	
	const apiKeyData: ApiKeyData = {
		id: keyId,
		accountId: accountIdOrUserId, // This could be accountId or legacy userId
		managementToken,
		userId: accountIdOrUserId, // Keep for backward compatibility
		keyHash,
		name,
		createdAt: now,
		active: true,
		quotaUsed: 0,
		quotaLimit,
		quotaResetAt: nextMonth.toISOString(),
	};
	
	// Store in KV
	if (env?.API_KEYS) {
		await env.API_KEYS.put(`key:${keyId}`, JSON.stringify(apiKeyData));
		
		// Update account/user mapping - handle both legacy userId and new accountId
		const mappingKey = `account:${accountIdOrUserId}:keys`;
		const existingUserData = await env.API_KEYS.get(mappingKey);
		const existingKeys = existingUserData ? JSON.parse(existingUserData) : [];
		existingKeys.push(keyId);
		await env.API_KEYS.put(mappingKey, JSON.stringify(existingKeys));

		// Also maintain legacy user mapping for backward compatibility
		const legacyMappingKey = `user:${accountIdOrUserId}`;
		const legacyUserData = await env.API_KEYS.get(legacyMappingKey);
		const legacyKeys = legacyUserData ? JSON.parse(legacyUserData) : [];
		if (!legacyKeys.includes(keyId)) {
			legacyKeys.push(keyId);
			await env.API_KEYS.put(legacyMappingKey, JSON.stringify(legacyKeys));
		}
	}
	
	log({
		event: 'api_key_created',
		account_id: accountIdOrUserId,
		key_id: keyId,
		quota_limit: quotaLimit,
	});
	
	return {
		...apiKeyData,
		key: apiKey,
	};
}

/**
 * Validate an API key and return associated data with account integration
 */
export async function validateApiKey(
	apiKey: string,
	env?: { API_KEYS?: KVNamespace }
): Promise<ApiKeyData | null> {
	if (!apiKey.startsWith('edgeog_')) {
		return null;
	}
	
	if (!env?.API_KEYS) {
		log({
			event: 'api_key_validation_error',
			error: 'API_KEYS KV namespace not available',
		});
		return null;
	}
	
	try {
		// In a production system, we'd need an index for efficient lookup
		// For now, we'll need to implement a simple approach
		// This is a simplified implementation - in production, consider using a hash-based lookup
		
		// Extract key ID from the API key for efficient lookup (this is a simplified approach)
		// In practice, you might want to store a mapping or use a different strategy
		const list = await env.API_KEYS.list({ prefix: 'key:' });
		
		for (const keyItem of list.keys) {
			const keyData = await env.API_KEYS.get(keyItem.name);
			if (!keyData) continue;
			
			const apiKeyData: ApiKeyData = JSON.parse(keyData);
			
			if (!apiKeyData.active) continue;
			
			const isValid = await verifyApiKey(apiKey, apiKeyData.keyHash);
			if (isValid) {
				// Update last used timestamp
				apiKeyData.lastUsedAt = new Date().toISOString();
				await env.API_KEYS.put(keyItem.name, JSON.stringify(apiKeyData));
				
				// Update account's last active timestamp if we have account integration
				if (apiKeyData.accountId) {
					const { updateLastActive } = await import('./account');
					await updateLastActive(apiKeyData.accountId, env);
				}
				
				return apiKeyData;
			}
		}
		
		return null;
	} catch (error) {
		log({
			event: 'api_key_validation_error',
			error: error instanceof Error ? error.message : String(error),
		});
		return null;
	}
}

/**
 * List API keys for an account (with backward compatibility for userId)
 */
export async function listApiKeys(
	accountIdOrUserId: string,
	env?: { API_KEYS?: KVNamespace }
): Promise<Omit<ApiKeyData, 'keyHash'>[]> {
	if (!env?.API_KEYS) {
		return [];
	}
	
	try {
		// Try new account-based mapping first
		let userKeysData = await env.API_KEYS.get(`account:${accountIdOrUserId}:keys`);
		
		// Fall back to legacy user mapping if account mapping doesn't exist
		if (!userKeysData) {
			userKeysData = await env.API_KEYS.get(`user:${accountIdOrUserId}`);
		}
		
		if (!userKeysData) return [];
		
		const keyIds: string[] = JSON.parse(userKeysData);
		const keys: Omit<ApiKeyData, 'keyHash'>[] = [];
		
		for (const keyId of keyIds) {
			const keyData = await env.API_KEYS.get(`key:${keyId}`);
			if (keyData) {
				const { keyHash, ...safeKeyData } = JSON.parse(keyData) as ApiKeyData;
				keys.push(safeKeyData);
			}
		}
		
		return keys.filter(key => key.active);
	} catch (error) {
		log({
			event: 'api_keys_list_error',
			account_id: accountIdOrUserId,
			error: error instanceof Error ? error.message : String(error),
		});
		return [];
	}
}

/**
 * Revoke an API key (with account and backward compatibility)
 */
export async function revokeApiKey(
	keyId: string,
	accountIdOrUserId: string,
	env?: { API_KEYS?: KVNamespace }
): Promise<boolean> {
	if (!env?.API_KEYS) {
		return false;
	}
	
	try {
		const keyData = await env.API_KEYS.get(`key:${keyId}`);
		if (!keyData) return false;
		
		const apiKeyData: ApiKeyData = JSON.parse(keyData);
		
		// Verify the key belongs to the account/user (check both accountId and legacy userId)
		const belongsToAccount = apiKeyData.accountId === accountIdOrUserId;
		const belongsToUser = apiKeyData.userId === accountIdOrUserId;
		
		if (!belongsToAccount && !belongsToUser) {
			log({
				event: 'api_key_revoke_unauthorized',
				key_id: keyId,
				provided_id: accountIdOrUserId,
				actual_account_id: apiKeyData.accountId,
				actual_user_id: apiKeyData.userId,
			});
			return false;
		}
		
		// Mark as inactive
		apiKeyData.active = false;
		await env.API_KEYS.put(`key:${keyId}`, JSON.stringify(apiKeyData));
		
		log({
			event: 'api_key_revoked',
			key_id: keyId,
			account_id: accountIdOrUserId,
		});
		
		return true;
	} catch (error) {
		log({
			event: 'api_key_revoke_error',
			key_id: keyId,
			account_id: accountIdOrUserId,
			error: error instanceof Error ? error.message : String(error),
		});
		return false;
	}
}

/**
 * Increment quota usage for an API key
 */
export async function incrementQuotaUsage(
	keyId: string,
	usage: number = 1,
	env?: { API_KEYS?: KVNamespace }
): Promise<boolean> {
	if (!env?.API_KEYS) {
		return false;
	}
	
	try {
		const keyData = await env.API_KEYS.get(`key:${keyId}`);
		if (!keyData) return false;
		
		const apiKeyData: ApiKeyData = JSON.parse(keyData);
		
		// Check if quota reset is needed
		const now = new Date();
		const resetDate = new Date(apiKeyData.quotaResetAt);
		
		if (now >= resetDate) {
			// Reset quota
			apiKeyData.quotaUsed = 0;
			
			// Set next month's reset date
			const nextMonth = new Date(resetDate);
			nextMonth.setMonth(nextMonth.getMonth() + 1);
			apiKeyData.quotaResetAt = nextMonth.toISOString();
			
			log({
				event: 'quota_reset',
				key_id: keyId,
				user_id: apiKeyData.userId,
				next_reset: apiKeyData.quotaResetAt,
			});
		}
		
		// Increment usage
		apiKeyData.quotaUsed += usage;
		await env.API_KEYS.put(`key:${keyId}`, JSON.stringify(apiKeyData));
		
		return true;
	} catch (error) {
		log({
			event: 'quota_increment_error',
			key_id: keyId,
			error: error instanceof Error ? error.message : String(error),
		});
		return false;
	}
}

/**
 * Check if API key has exceeded quota
 */
export async function hasExceededQuota(
	keyId: string,
	env?: { API_KEYS?: KVNamespace }
): Promise<boolean> {
	if (!env?.API_KEYS) {
		return true; // Fail safe
	}
	
	try {
		const keyData = await env.API_KEYS.get(`key:${keyId}`);
		if (!keyData) return true;
		
		const apiKeyData: ApiKeyData = JSON.parse(keyData);
		return apiKeyData.quotaUsed >= apiKeyData.quotaLimit;
	} catch (error) {
		log({
			event: 'quota_check_error',
			key_id: keyId,
			error: error instanceof Error ? error.message : String(error),
		});
		return true; // Fail safe
	}
}
