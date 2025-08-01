export {};

/**
 * API Key Management Utilities for AQ-1 Implementation
 * Provides secure API key generation, encryption, and validation
 */

import { log } from './logger';

/**
 * API Key metadata structure
 */
export interface ApiKeyData {
	/** Unique API key identifier */
	id: string;
	/** User identifier (email or user ID) */
	userId: string;
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
	/** Current quota usage */
	quotaUsed: number;
	/** Monthly quota limit */
	quotaLimit: number;
	/** Quota reset date */
	quotaResetAt: string;
}

/**
 * API Key with plain text value (only returned during creation)
 */
export interface ApiKeyWithSecret extends Omit<ApiKeyData, 'keyHash'> {
	/** Plain text API key (only available during creation) */
	key: string;
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
 * Create a new API key for a user
 */
export async function createApiKey(
	userId: string,
	name: string,
	quotaLimit: number = 1000,
	env?: { API_KEYS?: KVNamespace }
): Promise<ApiKeyWithSecret> {
	const apiKey = generateApiKey();
	const keyHash = await hashApiKey(apiKey);
	const keyId = crypto.randomUUID();
	const now = new Date().toISOString();
	
	// Calculate next month's reset date
	const nextMonth = new Date();
	nextMonth.setMonth(nextMonth.getMonth() + 1);
	nextMonth.setDate(1);
	nextMonth.setHours(0, 0, 0, 0);
	
	const apiKeyData: ApiKeyData = {
		id: keyId,
		userId,
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
		
		// Update user mapping - get existing keys and append new one
		const existingUserData = await env.API_KEYS.get(`user:${userId}`);
		const existingKeys = existingUserData ? JSON.parse(existingUserData) : [];
		existingKeys.push(keyId);
		await env.API_KEYS.put(`user:${userId}`, JSON.stringify(existingKeys));
	}
	
	log({
		event: 'api_key_created',
		user_id: userId,
		key_id: keyId,
		quota_limit: quotaLimit,
	});
	
	return {
		...apiKeyData,
		key: apiKey,
	};
}

/**
 * Validate an API key and return associated data
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
 * List API keys for a user
 */
export async function listApiKeys(
	userId: string,
	env?: { API_KEYS?: KVNamespace }
): Promise<Omit<ApiKeyData, 'keyHash'>[]> {
	if (!env?.API_KEYS) {
		return [];
	}
	
	try {
		const userKeysData = await env.API_KEYS.get(`user:${userId}`);
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
			user_id: userId,
			error: error instanceof Error ? error.message : String(error),
		});
		return [];
	}
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(
	keyId: string,
	userId: string,
	env?: { API_KEYS?: KVNamespace }
): Promise<boolean> {
	if (!env?.API_KEYS) {
		return false;
	}
	
	try {
		const keyData = await env.API_KEYS.get(`key:${keyId}`);
		if (!keyData) return false;
		
		const apiKeyData: ApiKeyData = JSON.parse(keyData);
		
		// Verify the key belongs to the user
		if (apiKeyData.userId !== userId) {
			log({
				event: 'api_key_revoke_unauthorized',
				key_id: keyId,
				user_id: userId,
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
			user_id: userId,
		});
		
		return true;
	} catch (error) {
		log({
			event: 'api_key_revoke_error',
			key_id: keyId,
			user_id: userId,
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
