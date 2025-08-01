export {};

/**
 * Account Management Utilities for Enhanced AQ-1 Implementation
 * Provides secure account creation, verification, and management
 */

import { log } from './logger';

/**
 * User account structure
 */
export interface UserAccount {
	/** Unique account identifier */
	id: string;
	/** Primary email identifier */
	email: string;
	/** Email verification status */
	emailVerified: boolean;
	/** Account subscription tier */
	subscriptionTier: 'free' | 'starter' | 'pro';
	/** Account creation timestamp */
	createdAt: string;
	/** Last activity timestamp */
	lastActiveAt?: string;
	/** Monthly quota reset date */
	quotaResetDate: string;
	/** Current month total usage across all API keys */
	totalQuotaUsed: number;
	/** Number of API keys created */
	apiKeyCount: number;
	/** Account settings */
	settings: {
		notifications: boolean;
		timezone?: string;
	};
}

/**
 * Email verification token structure
 */
export interface VerificationToken {
	email: string;
	accountId: string;
	expiresAt: string;
	token: string;
}

/**
 * Account creation response (includes verification token)
 */
export interface AccountCreationResponse {
	account: UserAccount;
	verificationToken: string;
	message: string;
}

/**
 * Generate a secure verification token
 * Format: verify_[32 random chars]
 */
export function generateVerificationToken(): string {
	const randomBytes = crypto.getRandomValues(new Uint8Array(24));
	const randomString = Array.from(randomBytes, byte => 
		byte.toString(36).padStart(2, '0')
	).join('').substring(0, 32);
	
	return `verify_${randomString}`;
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return emailRegex.test(email) && email.length <= 254;
}

/**
 * Calculate next month's quota reset date
 */
export function getNextQuotaResetDate(): string {
	const nextMonth = new Date();
	nextMonth.setMonth(nextMonth.getMonth() + 1);
	nextMonth.setDate(1);
	nextMonth.setHours(0, 0, 0, 0);
	return nextMonth.toISOString();
}

/**
 * Create a new user account
 */
export async function createAccount(
	email: string,
	env?: { API_KEYS?: KVNamespace }
): Promise<AccountCreationResponse> {
	if (!isValidEmail(email)) {
		throw new Error('Invalid email format');
	}

	if (!env?.API_KEYS) {
		throw new Error('API_KEYS KV namespace not available');
	}

	// Check if email already exists
	const existingAccountId = await env.API_KEYS.get(`email:${email.toLowerCase()}`);
	if (existingAccountId) {
		throw new Error('Account with this email already exists');
	}

	const accountId = crypto.randomUUID();
	const verificationToken = generateVerificationToken();
	const now = new Date().toISOString();

	// Create account
	const account: UserAccount = {
		id: accountId,
		email: email.toLowerCase(),
		emailVerified: false,
		subscriptionTier: 'free',
		createdAt: now,
		quotaResetDate: getNextQuotaResetDate(),
		totalQuotaUsed: 0,
		apiKeyCount: 0,
		settings: {
			notifications: true,
		}
	};

	// Create verification token with 24h expiration
	const tokenExpiry = new Date();
	tokenExpiry.setHours(tokenExpiry.getHours() + 24);

	const verification: VerificationToken = {
		email: email.toLowerCase(),
		accountId,
		expiresAt: tokenExpiry.toISOString(),
		token: verificationToken
	};

	try {
		// Store account
		await env.API_KEYS.put(`account:${accountId}`, JSON.stringify(account));
		
		// Store email mapping
		await env.API_KEYS.put(`email:${email.toLowerCase()}`, accountId);
		
		// Store verification token (with TTL)
		const ttlSeconds = 24 * 60 * 60; // 24 hours
		await env.API_KEYS.put(
			`verification:${verificationToken}`, 
			JSON.stringify(verification),
			{ expirationTtl: ttlSeconds }
		);

		log({
			event: 'account_created',
			account_id: accountId,
			email: email.toLowerCase(),
		});

		return {
			account,
			verificationToken,
			message: 'Account created successfully. Please verify your email.'
		};

	} catch (error) {
		// Cleanup on failure
		await env.API_KEYS.delete(`account:${accountId}`);
		await env.API_KEYS.delete(`email:${email.toLowerCase()}`);
		
		log({
			event: 'account_creation_error',
			email: email.toLowerCase(),
			error: error instanceof Error ? error.message : String(error),
		});
		
		throw new Error('Failed to create account');
	}
}

/**
 * Verify email with token
 */
export async function verifyEmail(
	token: string,
	env?: { API_KEYS?: KVNamespace }
): Promise<UserAccount> {
	if (!env?.API_KEYS) {
		throw new Error('API_KEYS KV namespace not available');
	}

	// Get verification data
	const verificationData = await env.API_KEYS.get(`verification:${token}`);
	if (!verificationData) {
		throw new Error('Invalid or expired verification token');
	}

	const verification: VerificationToken = JSON.parse(verificationData);

	// Check expiration
	if (new Date() > new Date(verification.expiresAt)) {
		await env.API_KEYS.delete(`verification:${token}`);
		throw new Error('Verification token has expired');
	}

	// Get and update account
	const accountData = await env.API_KEYS.get(`account:${verification.accountId}`);
	if (!accountData) {
		throw new Error('Account not found');
	}

	const account: UserAccount = JSON.parse(accountData);
	account.emailVerified = true;
	account.lastActiveAt = new Date().toISOString();

	// Save updated account
	await env.API_KEYS.put(`account:${verification.accountId}`, JSON.stringify(account));
	
	// Clean up verification token
	await env.API_KEYS.delete(`verification:${token}`);

	log({
		event: 'email_verified',
		account_id: account.id,
		email: account.email,
	});

	return account;
}

/**
 * Get account by ID
 */
export async function getAccount(
	accountId: string,
	env?: { API_KEYS?: KVNamespace }
): Promise<UserAccount | null> {
	if (!env?.API_KEYS) {
		return null;
	}

	try {
		const accountData = await env.API_KEYS.get(`account:${accountId}`);
		if (!accountData) return null;

		return JSON.parse(accountData) as UserAccount;
	} catch (error) {
		log({
			event: 'account_get_error',
			account_id: accountId,
			error: error instanceof Error ? error.message : String(error),
		});
		return null;
	}
}

/**
 * Get account by email
 */
export async function getAccountByEmail(
	email: string,
	env?: { API_KEYS?: KVNamespace }
): Promise<UserAccount | null> {
	if (!env?.API_KEYS) {
		return null;
	}

	try {
		const accountId = await env.API_KEYS.get(`email:${email.toLowerCase()}`);
		if (!accountId) return null;

		return await getAccount(accountId, env);
	} catch (error) {
		log({
			event: 'account_get_by_email_error',
			email: email.toLowerCase(),
			error: error instanceof Error ? error.message : String(error),
		});
		return null;
	}
}

/**
 * Update account's last active timestamp
 */
export async function updateLastActive(
	accountId: string,
	env?: { API_KEYS?: KVNamespace }
): Promise<void> {
	if (!env?.API_KEYS) return;

	try {
		const account = await getAccount(accountId, env);
		if (!account) return;

		account.lastActiveAt = new Date().toISOString();
		await env.API_KEYS.put(`account:${accountId}`, JSON.stringify(account));
	} catch (error) {
		log({
			event: 'account_update_last_active_error',
			account_id: accountId,
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

/**
 * Update account quota usage
 */
export async function updateAccountQuota(
	accountId: string,
	usageIncrement: number,
	env?: { API_KEYS?: KVNamespace }
): Promise<boolean> {
	if (!env?.API_KEYS) return false;

	try {
		const account = await getAccount(accountId, env);
		if (!account) return false;

		// Check if quota reset is needed
		const now = new Date();
		const resetDate = new Date(account.quotaResetDate);

		if (now >= resetDate) {
			// Reset quota for new month
			account.totalQuotaUsed = 0;
			account.quotaResetDate = getNextQuotaResetDate();
			
			log({
				event: 'account_quota_reset',
				account_id: accountId,
				next_reset: account.quotaResetDate,
			});
		}

		// Update usage
		account.totalQuotaUsed += usageIncrement;
		await env.API_KEYS.put(`account:${accountId}`, JSON.stringify(account));

		return true;
	} catch (error) {
		log({
			event: 'account_quota_update_error',
			account_id: accountId,
			error: error instanceof Error ? error.message : String(error),
		});
		return false;
	}
}

/**
 * Get account quota limit based on subscription tier
 */
export function getAccountQuotaLimit(tier: UserAccount['subscriptionTier']): number {
	switch (tier) {
		case 'free':
			return 1000; // AQ-2: Free tier 1,000 images/month
		case 'starter':
			return 50000; // BI-1: Starter plan higher quota
		case 'pro':
			return 200000; // Future: Pro plan quota
		default:
			return 1000;
	}
}

/**
 * Check if account has exceeded quota
 */
export async function hasAccountExceededQuota(
	accountId: string,
	env?: { API_KEYS?: KVNamespace }
): Promise<boolean> {
	const account = await getAccount(accountId, env);
	if (!account) return true; // Fail safe

	const quotaLimit = getAccountQuotaLimit(account.subscriptionTier);
	return account.totalQuotaUsed >= quotaLimit;
}
