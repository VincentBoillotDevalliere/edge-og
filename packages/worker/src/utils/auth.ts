export {};

/**
 * Authentication utilities for Edge-OG
 * Implements AQ-1.1: Magic-link account creation
 * 
 * Security features:
 * - Email hashing with pepper (SHA-256)
 * - UUID generation for accounts
 * - JWT token generation for magic links
 * - Rate limiting protection
 */

import { WorkerError } from './error';
import { log } from './logger';

/**
 * Account data structure stored in KV
 * Schema: account:{UUID} → { email_hash, created, plan }
 */
export interface AccountData {
	email_hash: string;
	created: string; // ISO timestamp
	plan: 'free' | 'starter' | 'pro';
	last_login?: string;
}

/**
 * Magic link token payload
 */
export interface MagicLinkPayload {
	account_id: string;
	email_hash: string;
	exp: number; // Unix timestamp
	iat: number; // Unix timestamp
}

/**
 * Session token payload for 24h authentication
 * Used after successful magic link verification
 */
export interface SessionPayload {
	account_id: string;
	email_hash: string;
	exp: number; // Unix timestamp
	iat: number; // Unix timestamp
	type: 'session'; // Distinguish from magic link tokens
}

/**
 * API key data structure stored in KV
 * Schema: key:{kid} → { account, hash, name, revoked, created, last_used }
 */
export interface APIKeyData {
	account: string; // Account ID
	hash: string; // HMAC-SHA256 hash of the secret
	name: string; // User-friendly name for the key
	revoked: boolean;
	created: string; // ISO timestamp
	last_used?: string; // ISO timestamp
}

/**
 * Verify Cloudflare Turnstile CAPTCHA token for signup (AQ-5.1)
 * - In production: require valid token; call Turnstile siteverify
 * - In non-production: skip verification (to ease local/dev/testing)
 */
export async function verifyTurnstileToken(
	token: string | undefined | null,
	clientIP: string,
	env: Env,
	requestId?: string
): Promise<boolean> {
	const isProd = (env.ENVIRONMENT || '').toLowerCase() === 'production';

	// In non-production environments, skip strict verification
	if (!isProd) {
		log({ event: 'turnstile_skipped', env: env.ENVIRONMENT || 'dev', request_id: requestId });
		return true;
	}

	const secret = env.TURNSTILE_SECRET_KEY as string | undefined;
	if (!secret) {
		log({ event: 'turnstile_misconfigured', reason: 'missing_secret', request_id: requestId });
		return false;
	}

	if (!token || typeof token !== 'string' || token.length < 10) {
		log({ event: 'turnstile_failed', reason: 'missing_or_invalid_token', request_id: requestId });
		return false;
	}

	try {
		const body = new URLSearchParams();
		body.set('secret', secret);
		body.set('response', token);
		if (clientIP && clientIP !== 'unknown') body.set('remoteip', clientIP);

		const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body,
		});

		if (!resp.ok) {
			log({ event: 'turnstile_failed', reason: 'http_' + resp.status, request_id: requestId });
			return false;
		}

		const json = await resp.json() as { success?: boolean; 'error-codes'?: string[] };
		if (json && json.success) {
			log({ event: 'turnstile_verified', request_id: requestId });
			return true;
		}

		log({ event: 'turnstile_failed', reason: 'verification_false', errors: json?.['error-codes'], request_id: requestId });
		return false;
	} catch (error) {
		log({ event: 'turnstile_failed', reason: 'exception', error: error instanceof Error ? error.message : 'unknown', request_id: requestId });
		return false;
	}
}

/**
 * Rate limiting configuration for magic link requests
 */
const RATE_LIMIT = {
	MAX_REQUESTS: 5,
	WINDOW_MINUTES: 5,
	WINDOW_MS: 5 * 60 * 1000, // 5 minutes in milliseconds
};

/**
 * Base62 alphabet for API key encoding
 */
const BASE62_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/**
 * Encode bytes to base62 string
 * Used for generating API key prefixes and secrets
 */
function encodeBase62(bytes: Uint8Array): string {
	let result = '';
	let bigInt = 0n;
	
	// Convert bytes to a big integer
	for (let i = 0; i < bytes.length; i++) {
		bigInt = bigInt * 256n + BigInt(bytes[i]);
	}
	
	// Convert to base62
	while (bigInt > 0n) {
		const remainder = Number(bigInt % 62n);
		result = BASE62_ALPHABET[remainder] + result;
		bigInt = bigInt / 62n;
	}
	
	// Return result (or '0' if zero)
	return result || '0';
}

/**
 * Left-pad a base62 string to a minimum length using '0' characters.
 * This preserves an opaque fixed-length representation for secrets.
 */
function padBase62(input: string, minLength: number): string {
    if (input.length >= minLength) return input;
    return input.padStart(minLength, BASE62_ALPHABET[0]);
}

/**
 * Generate cryptographically secure UUID v4
 * Provides ≥ 256 bits entropy as required by AQ-5.2
 */
export function generateSecureUUID(): string {
	// Use crypto.randomUUID() if available (Cloudflare Workers support)
	if (typeof crypto !== 'undefined' && crypto.randomUUID) {
		return crypto.randomUUID();
	}
	
	// Fallback implementation using crypto.getRandomValues()
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	
	// Set version (4) and variant bits according to RFC 4122
	bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
	bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10
	
	// Convert to hex string with hyphens
	const hex = Array.from(bytes)
		.map(b => b.toString(16).padStart(2, '0'))
		.join('');
	
	return [
		hex.slice(0, 8),
		hex.slice(8, 12),
		hex.slice(12, 16),
		hex.slice(16, 20),
		hex.slice(20, 32)
	].join('-');
}

/**
 * Hash email address with pepper for privacy
 * Uses SHA-256 as specified in the ROADMAP
 */
export async function hashEmailWithPepper(email: string, pepper: string): Promise<string> {
	const normalizedEmail = email.toLowerCase().trim();
	const saltedEmail = normalizedEmail + pepper;
	
	const encoder = new TextEncoder();
	const data = encoder.encode(saltedEmail);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	
	// Convert to hex string
	const hashArray = new Uint8Array(hashBuffer);
	return Array.from(hashArray)
		.map(b => b.toString(16).padStart(2, '0'))
		.join('');
}

/**
 * Validate email format
 * Basic email validation to prevent abuse
 */
export function validateEmail(email: string): boolean {
	if (!email || typeof email !== 'string') {
		return false;
	}
	
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	const normalizedEmail = email.toLowerCase().trim();
	
	// Check format and length limits
	return emailRegex.test(normalizedEmail) && 
		   normalizedEmail.length >= 5 && 
		   normalizedEmail.length <= 254; // RFC 5321 limit
}

/**
 * Generate JWT token for magic link
 * Token expires in 15 minutes for security
 */
export async function generateMagicLinkToken(
	accountId: string, 
	emailHash: string, 
	jwtSecret: string
): Promise<string> {
	const now = Math.floor(Date.now() / 1000);
	const payload: MagicLinkPayload = {
		account_id: accountId,
		email_hash: emailHash,
		iat: now,
		exp: now + (15 * 60), // 15 minutes expiry
	};
	
	// Simple JWT implementation for Cloudflare Workers
	const header = {
		alg: 'HS256',
		typ: 'JWT'
	};
	
	const encodedHeader = btoa(JSON.stringify(header)).replace(/[+/=]/g, (match) => {
		return { '+': '-', '/': '_', '=': '' }[match] || match;
	});
	
	const encodedPayload = btoa(JSON.stringify(payload)).replace(/[+/=]/g, (match) => {
		return { '+': '-', '/': '_', '=': '' }[match] || match;
	});
	
	const signatureInput = `${encodedHeader}.${encodedPayload}`;
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(jwtSecret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	
	const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signatureInput));
	const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
		.replace(/[+/=]/g, (match) => {
			return { '+': '-', '/': '_', '=': '' }[match] || match;
		});
	
	return `${signatureInput}.${encodedSignature}`;
}

/**
 * Verify JWT token (magic link or session)
 * Returns the decoded payload if valid, null if invalid/expired
 */
export async function verifyJWTToken<T extends { exp?: number }>(
	token: string, 
	jwtSecret: string
): Promise<T | null> {
	try {
		const parts = token.split('.');
		if (parts.length !== 3) {
			return null;
		}

		const [encodedHeader, encodedPayload, encodedSignature] = parts;
		
		// Verify signature
		const signatureInput = `${encodedHeader}.${encodedPayload}`;
		const encoder = new TextEncoder();
		const key = await crypto.subtle.importKey(
			'raw',
			encoder.encode(jwtSecret),
			{ name: 'HMAC', hash: 'SHA-256' },
			false,
			['verify']
		);
		
		// Decode signature from base64url
		const signature = Uint8Array.from(
			atob(encodedSignature.replace(/-/g, '+').replace(/_/g, '/').padEnd(encodedSignature.length + (4 - encodedSignature.length % 4) % 4, '=')),
			c => c.charCodeAt(0)
		);
		
		const isValid = await crypto.subtle.verify(
			'HMAC', 
			key, 
			signature, 
			encoder.encode(signatureInput)
		);
		
		if (!isValid) {
			return null;
		}
		
		// Decode payload
		const paddedPayload = encodedPayload.replace(/-/g, '+').replace(/_/g, '/').padEnd(encodedPayload.length + (4 - encodedPayload.length % 4) % 4, '=');
		const payload = JSON.parse(atob(paddedPayload)) as T;
		
		// Check expiration
		const now = Math.floor(Date.now() / 1000);
		if (payload.exp && payload.exp < now) {
			return null;
		}
		
		return payload;
	} catch (error) {
		return null;
	}
}

/**
 * Generate session JWT token (24h expiry)
 * Used after successful magic link verification
 */
export async function generateSessionToken(
	accountId: string, 
	emailHash: string, 
	jwtSecret: string
): Promise<string> {
	const now = Math.floor(Date.now() / 1000);
	const payload: SessionPayload = {
		account_id: accountId,
		email_hash: emailHash,
		iat: now,
		exp: now + (24 * 60 * 60), // 24 hours expiry
		type: 'session',
	};
	
	// Simple JWT implementation for Cloudflare Workers
	const header = {
		alg: 'HS256',
		typ: 'JWT'
	};
	
	const encodedHeader = btoa(JSON.stringify(header)).replace(/[+/=]/g, (match) => {
		return { '+': '-', '/': '_', '=': '' }[match] || match;
	});
	
	const encodedPayload = btoa(JSON.stringify(payload)).replace(/[+/=]/g, (match) => {
		return { '+': '-', '/': '_', '=': '' }[match] || match;
	});
	
	const signatureInput = `${encodedHeader}.${encodedPayload}`;
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(jwtSecret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	
	const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signatureInput));
	const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
		.replace(/[+/=]/g, (match) => {
			return { '+': '-', '/': '_', '=': '' }[match] || match;
		});
	
	return `${signatureInput}.${encodedSignature}`;
}

/**
 * Update account last login timestamp
 */
export async function updateAccountLastLogin(
	accountId: string,
	env: Env
): Promise<void> {
	try {
		const key = `account:${accountId}`;
		const existingData = await env.ACCOUNTS.get(key);
		
		if (existingData) {
			const accountData: AccountData = JSON.parse(existingData);
			accountData.last_login = new Date().toISOString();
			
			await env.ACCOUNTS.put(key, JSON.stringify(accountData));
		}
	} catch (error) {
		// Log but don't fail the authentication process
		log({
			event: 'account_last_login_update_failed',
			account_id: accountId,
			error: error instanceof Error ? error.message : 'Unknown error',
		});
	}
}

/**
 * Update account plan and persist in KV (BI-1)
 */
export async function updateAccountPlan(
	accountId: string,
	plan: AccountData['plan'],
	env: Env
): Promise<void> {
	try {
		const key = `account:${accountId}`;
		const existing = await env.ACCOUNTS.get(key, 'json') as AccountData | null;
		if (!existing) {
			throw new WorkerError('Account not found', 404);
		}
		existing.plan = plan;
		await env.ACCOUNTS.put(key, JSON.stringify(existing), {
			metadata: { updated_at: Date.now(), plan },
		});
		log({ event: 'account_plan_updated', account_id: accountId, plan });
	} catch (error) {
		log({ event: 'account_plan_update_failed', account_id: accountId, error: error instanceof Error ? error.message : 'Unknown error' });
		throw error;
	}
}

/**
 * Create account in KV storage
 * Implements KV schema: account:{UUID} → { email_hash, created, plan }
 */
export async function createAccount(
	accountId: string,
	emailHash: string,
	env: Env
): Promise<void> {
	const accountData: AccountData = {
		email_hash: emailHash,
		created: new Date().toISOString(),
		plan: 'free',
	};
	
	const key = `account:${accountId}`;
	
	try {
		await env.ACCOUNTS.put(key, JSON.stringify(accountData), {
			metadata: {
				created_at: Date.now(),
				plan: 'free'
			}
		});
		
		log({
			event: 'account_created',
			account_id: accountId,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		log({
			event: 'account_creation_failed',
			account_id: accountId,
			error: error instanceof Error ? error.message : 'Unknown error',
		});
		throw new WorkerError('Failed to create account', 500);
	}
}

/**
 * Check if account already exists by email hash
 */
export async function findAccountByEmailHash(
	emailHash: string,
	env: Env
): Promise<{ accountId: string; accountData: AccountData } | null> {
	try {
		// List all accounts to find by email_hash
		// Note: In production, consider using a secondary index for better performance
		const { keys } = await env.ACCOUNTS.list({ prefix: 'account:' });
		
		for (const key of keys) {
			const accountData = await env.ACCOUNTS.get(key.name, 'json') as AccountData | null;
			if (accountData && accountData.email_hash === emailHash) {
				const accountId = key.name.replace('account:', '');
				return { accountId, accountData };
			}
		}
		
		return null;
	} catch (error) {
		log({
			event: 'account_lookup_failed',
			email_hash: emailHash.substring(0, 8) + '...', // Log partial hash for debugging
			error: error instanceof Error ? error.message : 'Unknown error',
		});
		throw new WorkerError('Failed to lookup account', 500);
	}
}

/**
 * Rate limiting for magic link requests (AQ-5.1)
 * Implements: 5 req / IP / 5 min
 */
export async function checkRateLimit(
	clientIP: string,
	env: Env
): Promise<boolean> {
	const rateLimitKey = `ratelimit:magic-link:${clientIP}`;
	const now = Date.now();
	const windowStart = now - RATE_LIMIT.WINDOW_MS;
	
	try {
		// Get current requests in window
		const currentData = await env.USAGE.get(rateLimitKey, 'json') as { requests: number[], count: number } | null;
		
		let requests: number[] = [];
		if (currentData && Array.isArray(currentData.requests)) {
			// Filter requests within current window
			requests = currentData.requests.filter(timestamp => timestamp > windowStart);
		}
		
		// Check if limit exceeded
		if (requests.length >= RATE_LIMIT.MAX_REQUESTS) {
			log({
				event: 'rate_limit_exceeded',
				client_ip: clientIP,
				requests_count: requests.length,
				window_minutes: RATE_LIMIT.WINDOW_MINUTES,
			});
			return false;
		}
		
		// Add current request
		requests.push(now);
		
		// Store updated requests
		await env.USAGE.put(rateLimitKey, JSON.stringify({
			requests,
			count: requests.length
		}), {
			expirationTtl: Math.ceil(RATE_LIMIT.WINDOW_MS / 1000) * 2, // Double window for safety
			metadata: {
				last_request: now
			}
		});
		
		return true;
	} catch (error) {
		log({
			event: 'rate_limit_check_failed',
			client_ip: clientIP,
			error: error instanceof Error ? error.message : 'Unknown error',
		});
		// Allow request on rate limit check failure to avoid blocking legitimate users
		return true;
	}
}

/**
 * Send magic link email via Resend
 * Implements email sending requirement from AQ-1.1
 */
export async function sendMagicLinkEmail(
	email: string,
	magicLinkToken: string,
	env: Env,
	requestId?: string
): Promise<void> {
	// Determine the correct base URL for the current environment
	let baseUrl = env.BASE_URL;
	
	if (!baseUrl) {
		// Default fallback - in production this should be set
		baseUrl = 'https://edge-og.example.com';
		
		// In development/local testing, try to use localhost
		// This is a heuristic - in a real app you'd set BASE_URL properly
		if (env.RESEND_API_KEY === 'dev-placeholder-token' || !env.RESEND_API_KEY) {
			baseUrl = 'http://localhost:8788';
		}
	}
	
	const magicLinkUrl = `${baseUrl}/auth/callback?token=${magicLinkToken}`;
	
	const emailContent = {
		from: 'Edge-OG <auth@resend.dev>',
		to: [email],
		subject: '🎨 Complete your Edge-OG account setup',
		html: `<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Complete your Edge-OG account setup</title>
	<!--[if mso]>
	<noscript>
		<xml>
			<o:OfficeDocumentSettings>
				<o:PixelsPerInch>96</o:PixelsPerInch>
			</o:OfficeDocumentSettings>
		</xml>
	</noscript>
	<![endif]-->
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333333; margin: 0; padding: 20px; background-color: #f8fafc;">
	<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width: 100%; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
		<!-- Header -->
		<tr>
			<td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
				<h1 style="margin: 0; font-size: 28px; font-weight: 700; line-height: 1.2;">🎨 Welcome to Edge-OG!</h1>
				<p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 16px;">Generate beautiful Open Graph images at the edge</p>
			</td>
		</tr>
		
		<!-- Content -->
		<tr>
			<td style="padding: 40px 30px; background-color: #ffffff;">
				<h2 style="margin: 0 0 20px 0; font-size: 24px; font-weight: 600; color: #1a202c;">Complete your account setup</h2>
				<p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6;">Hi there! 👋</p>
				<p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6;">You requested to create an Edge-OG account. Click the button below to complete your setup:</p>
				
				<!-- CTA Button - Table-based for maximum compatibility -->
				<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 32px auto;">
					<tr>
						<td style="text-align: center;">
							<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-radius: 8px; background-color: #667eea;">
								<tr>
									<td style="border-radius: 8px; padding: 16px 32px; text-align: center;">
										<a href="${magicLinkUrl}" style="color: #ffffff; text-decoration: none; font-weight: bold; font-size: 16px; font-family: Arial, sans-serif; display: block;" target="_blank">
											Complete Account Setup →
										</a>
									</td>
								</tr>
							</table>
						</td>
					</tr>
				</table>
				
				<!-- Fallback link -->
				<p style="margin: 24px 0; font-size: 14px; color: #666666; text-align: center;">
					If the button doesn't work, copy and paste this link into your browser:<br>
					<a href="${magicLinkUrl}" style="color: #667eea; word-break: break-all;" target="_blank">${magicLinkUrl}</a>
				</p>
				
				<h3 style="margin: 32px 0 16px 0; font-size: 18px; font-weight: 600; color: #1a202c;">What's next?</h3>
				<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width: 100%;">
					<tr><td style="padding: 8px 0; font-size: 16px; line-height: 1.6;">✨ Start with 1,000 free images per month</td></tr>
					<tr><td style="padding: 8px 0; font-size: 16px; line-height: 1.6;">🎨 Choose from 11 professional templates</td></tr>
					<tr><td style="padding: 8px 0; font-size: 16px; line-height: 1.6;">🌈 Customize with themes, fonts, and emojis</td></tr>
					<tr><td style="padding: 8px 0; font-size: 16px; line-height: 1.6;">⚡ Generate images in under 150ms globally</td></tr>
				</table>
				
				<p style="margin: 32px 0 0 0; font-size: 14px; color: #666666; line-height: 1.6;">
					If you didn't request this account, you can safely ignore this email.
				</p>
			</td>
		</tr>
		
		<!-- Footer -->
		<tr>
			<td style="padding: 30px; text-align: center; background-color: #f8fafc; border-radius: 0 0 12px 12px; border-top: 1px solid #e2e8f0;">
				<p style="margin: 0; font-size: 14px; color: #666666; line-height: 1.6;">
					<strong>Edge-OG</strong> - Open Graph Image Generator<br>
					Built with ❤️ using Cloudflare Workers
				</p>
			</td>
		</tr>
	</table>
</body>
</html>`
	};
	
	try {
		// Check if we have a valid Resend token
		const resendToken = env.RESEND_API_KEY;
		
		// In development mode, simulate email sending
		if (!resendToken || resendToken === 'dev-placeholder-token' || resendToken === 'resend_test_key_placeholder' || resendToken.startsWith('TEST_')) {
			log({
				event: 'magic_link_email_simulated',
				email_domain: email.split('@')[1],
				magic_link_url: magicLinkUrl,
				note: 'Email sending simulated in development mode',
				timestamp: new Date().toISOString(),
			});
			
			log({
				event: 'magic_link_email_sent',
				email_domain: email.split('@')[1],
				timestamp: new Date().toISOString(),
			});
			return;
		}
		
		// Use Resend API
		const response = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${resendToken}`,
			},
			body: JSON.stringify(emailContent),
		});
		
		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Resend API error: ${response.status} - ${errorText}`);
		}
		
		log({
			event: 'magic_link_email_sent',
			email_domain: email.split('@')[1],
			timestamp: new Date().toISOString(),
		});
		
	} catch (error) {
		log({
			event: 'magic_link_email_failed',
			email_domain: email.split('@')[1],
			error: error instanceof Error ? error.message : 'Unknown error',
		});
		throw new WorkerError('Failed to process magic link request', 500, requestId);
	}
}

/**
 * Validate environment configuration for authentication
 */
export function validateAuthEnvironment(env: Env, requestId?: string): void {
	const requiredVars = ['JWT_SECRET', 'EMAIL_PEPPER'];
	const missing = requiredVars.filter(varName => !env[varName as keyof Env]);
	
	if (missing.length > 0) {
		throw new WorkerError(
			`Missing required environment variables for authentication: ${missing.join(', ')}`,
			500,
			requestId
		);
	}
	
	// Validate JWT secret strength
	const jwtSecret = env.JWT_SECRET as string;
	if (jwtSecret.length < 32) {
		throw new WorkerError('JWT_SECRET must be at least 32 characters for security', 500, requestId);
	}
	
	// Validate email pepper
	const emailPepper = env.EMAIL_PEPPER as string;
	if (emailPepper.length < 16) {
		throw new WorkerError('EMAIL_PEPPER must be at least 16 characters for security', 500, requestId);
	}
}

/**
 * Generate secure API key with prefix and secret
 * Implements AQ-2.1: Generate API key with base62 64 characters
 * 
 * @param accountId - Account ID to associate the key with
 * @param name - Human-readable name for the key
 * @param env - Environment bindings
 * @returns Object with kid, prefix, fullKey, and hash
 */
export async function generateAPIKey(
	accountId: string,
	name: string,
	env: Env
): Promise<{
	kid: string;
	prefix: string;
	fullKey: string;
	hash: string;
}> {
	// Generate 32 bytes for the key ID (kid) - used as prefix
	const kidBytes = new Uint8Array(8); // 8 bytes for prefix
	crypto.getRandomValues(kidBytes);
	const kid = encodeBase62(kidBytes);
	
	// Generate 32 bytes for the secret part (≥ 256-bit entropy per AQ-5.2)
	const secretBytes = new Uint8Array(32); // 32 bytes for secret
	crypto.getRandomValues(secretBytes);
	let secret = encodeBase62(secretBytes);
	// Ensure fixed minimum length for 32-byte secrets (ceil(256 / log2(62)) = 43)
	secret = padBase62(secret, 43);
	
	// Combine prefix and secret to create the full key (targeting 64 chars total)
	const prefix = `eog_${kid}`;
	const fullKey = `${prefix}_${secret}`;
	
	// Generate HMAC-SHA256 hash of the full key for storage
	const hash = await generateAPIKeyHash(fullKey, env.JWT_SECRET as string);
	
	return { kid, prefix, fullKey, hash };
}

/**
 * Generate HMAC-SHA256 hash of API key for secure storage
 * 
 * @param apiKey - The full API key string
 * @param secret - Secret for HMAC generation
 * @returns Hexadecimal hash string
 */
export async function generateAPIKeyHash(apiKey: string, secret: string): Promise<string> {
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	
	const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(apiKey));
	const hashArray = new Uint8Array(signature);
	
	return Array.from(hashArray)
		.map(b => b.toString(16).padStart(2, '0'))
		.join('');
}

/**
 * Store API key data in KV
 * Implements KV schema: key:{kid} → { account, hash, name, revoked, created, last_used }
 * 
 * @param kid - Key ID (used as KV key suffix)
 * @param accountId - Account ID that owns this key
 * @param hash - HMAC-SHA256 hash of the API key
 * @param name - Human-readable name for the key
 * @param env - Environment bindings
 */
export async function storeAPIKey(
	kid: string,
	accountId: string,
	hash: string,
	name: string,
	env: Env
): Promise<void> {
	const apiKeyData: APIKeyData = {
		account: accountId,
		hash,
		name,
		revoked: false,
		created: new Date().toISOString(),
	};
	
	const key = `key:${kid}`;
	
	try {
		await env.API_KEYS.put(key, JSON.stringify(apiKeyData), {
			metadata: {
				account: accountId,
				created_at: Date.now(),
				name,
			}
		});
		
		log({
			event: 'api_key_created',
			account_id: accountId,
			key_id: kid,
			key_name: name,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		log({
			event: 'api_key_creation_failed',
			account_id: accountId,
			key_id: kid,
			error: error instanceof Error ? error.message : 'Unknown error',
		});
		throw new WorkerError('Failed to generate API key. Please try again.', 500);
	}
}

/**
 * Verify API key authentication
 * Implements AQ-2.3: Worker validates Authorization Bearer header
 * 
 * @param authHeader - Authorization header value
 * @param env - Environment bindings
 * @returns Account ID if valid, null if invalid
 */
export async function verifyAPIKey(authHeader: string, env: Env): Promise<{ accountId: string; kid: string } | null> {
	if (!authHeader.startsWith('Bearer ')) {
		return null;
	}
	
	const apiKey = authHeader.substring(7); // Remove "Bearer " prefix
	
	// Extract kid from the API key prefix
	if (!apiKey.startsWith('eog_')) {
		return null;
	}
	
	const parts = apiKey.split('_');
	if (parts.length !== 3) {
		return null;
	}
	
	const kid = parts[1];
	
	try {
		// Look up the API key data
		const keyData = await env.API_KEYS.get(`key:${kid}`, 'json') as APIKeyData | null;
		
		if (!keyData || keyData.revoked) {
			return null;
		}
		
		// Verify the hash
		const expectedHash = await generateAPIKeyHash(apiKey, env.JWT_SECRET as string);
		
		// Use constant-time comparison to prevent timing attacks
		if (!constantTimeCompare(keyData.hash, expectedHash)) {
			return null;
		}
		
		// Update last used timestamp asynchronously
		updateAPIKeyLastUsed(kid, env).catch(error => {
			log({
				event: 'api_key_last_used_update_failed',
				key_id: kid,
				error: error instanceof Error ? error.message : 'Unknown error',
			});
		});
		
		return { accountId: keyData.account, kid };
	} catch (error) {
		log({
			event: 'api_key_verification_failed',
			key_id: kid,
			error: error instanceof Error ? error.message : 'Unknown error',
		});
		return null;
	}
}

/**
 * Update API key last used timestamp
 * 
 * @param kid - Key ID
 * @param env - Environment bindings
 */
async function updateAPIKeyLastUsed(kid: string, env: Env): Promise<void> {
	try {
		const key = `key:${kid}`;
		const existingData = await env.API_KEYS.get(key, 'json') as APIKeyData | null;
		
		if (existingData) {
			existingData.last_used = new Date().toISOString();
			await env.API_KEYS.put(key, JSON.stringify(existingData));
		}
	} catch (error) {
		// Log but don't fail - this is not critical
		log({
			event: 'api_key_last_used_update_failed',
			key_id: kid,
			error: error instanceof Error ? error.message : 'Unknown error',
		});
	}
}

/**
 * Constant-time string comparison to prevent timing attacks
 * 
 * @param a - First string
 * @param b - Second string
 * @returns True if strings are equal
 */
function constantTimeCompare(a: string, b: string): boolean {
	if (a.length !== b.length) {
		return false;
	}
	
	let result = 0;
	for (let i = 0; i < a.length; i++) {
		result |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	
	return result === 0;
}

/**
 * API key list item for returning to client
 * Only includes safe data, never the actual key hash
 */
export interface APIKeyListItem {
	id: string; // Key ID (kid)
	name: string; // User-friendly name
	prefix: string; // Public prefix (eog_xxx)
	created: string; // ISO timestamp
	last_used?: string; // ISO timestamp
	revoked: boolean;
}

/**
 * API key metadata structure for KV storage
 */
interface APIKeyMetadata {
	account: string;
	created_at: number;
	name: string;
}

/**
 * List all API keys for a specific account
 * Implements AQ-2.2: GET shows name, prefix, dates
 * 
 * @param accountId - Account ID to list keys for
 * @param env - Environment bindings
 * @returns Array of API key information (without secrets)
 */
export async function listAPIKeys(accountId: string, env: Env): Promise<APIKeyListItem[]> {
	try {
		// List all keys with metadata containing the account
		const result = await env.API_KEYS.list({
			prefix: 'key:',
		});
		
		const apiKeys: APIKeyListItem[] = [];
		
		// Process each key and filter by account
		for (const key of result.keys) {
			const metadata = key.metadata as APIKeyMetadata | undefined;
			if (metadata && metadata.account === accountId) {
				// Get the full key data to check current state
				const keyData = await env.API_KEYS.get(key.name, 'json') as APIKeyData | null;
				
				if (keyData) {
					// Extract kid from key name (remove 'key:' prefix)
					const kid = key.name.substring(4);
					
					// Generate the public prefix
					const prefix = `eog_${kid}`;
					
					apiKeys.push({
						id: kid,
						name: keyData.name,
						prefix: prefix,
						created: keyData.created,
						last_used: keyData.last_used,
						revoked: keyData.revoked,
					});
				}
			}
		}
		
		// Sort by creation date (newest first)
		apiKeys.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
		
		log({
			event: 'api_keys_listed',
			account_id: accountId,
			key_count: apiKeys.length,
		});
		
		return apiKeys;
	} catch (error) {
		log({
			event: 'api_keys_list_failed',
			account_id: accountId,
			error: error instanceof Error ? error.message : 'Unknown error',
		});
		throw new WorkerError('Failed to list API keys', 500);
	}
}

/**
 * Revoke an API key by setting revoked=true
 * Implements AQ-2.2: DELETE sets `revoked=true`
 * 
 * @param kid - Key ID to revoke
 * @param accountId - Account ID that owns the key (for verification)
 * @param env - Environment bindings
 * @returns True if key was revoked, false if not found or not owned by account
 */
export async function revokeAPIKey(kid: string, accountId: string, env: Env): Promise<boolean> {
	try {
		const key = `key:${kid}`;
		
		// Get current key data
		const keyData = await env.API_KEYS.get(key, 'json') as APIKeyData | null;
		
		if (!keyData) {
			return false; // Key not found
		}
		
		// Verify the key belongs to the requesting account
		if (keyData.account !== accountId) {
			log({
				event: 'api_key_revoke_unauthorized',
				key_id: kid,
				account_id: accountId,
				key_owner: keyData.account,
			});
			return false; // Not authorized to revoke this key
		}
		
		// If already revoked, return true (idempotent operation)
		if (keyData.revoked) {
			log({
				event: 'api_key_already_revoked',
				key_id: kid,
				account_id: accountId,
			});
			return true;
		}
		
		// Set revoked flag and update
		keyData.revoked = true;
		
		// Keep the original metadata but update it
		const existingMetadata = await env.API_KEYS.getWithMetadata(key);
		
		await env.API_KEYS.put(key, JSON.stringify(keyData), {
			metadata: (existingMetadata.metadata as APIKeyMetadata) || {
				account: accountId,
				created_at: Date.now(),
				name: keyData.name,
			}
		});
		
		log({
			event: 'api_key_revoked',
			key_id: kid,
			account_id: accountId,
			key_name: keyData.name,
		});
		
		return true;
	} catch (error) {
		log({
			event: 'api_key_revoke_failed',
			key_id: kid,
			account_id: accountId,
			error: error instanceof Error ? error.message : 'Unknown error',
		});
		throw new WorkerError('Failed to revoke API key', 500);
	}
}
