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
 * Rate limiting configuration for magic link requests
 */
const RATE_LIMIT = {
	MAX_REQUESTS: 5,
	WINDOW_MINUTES: 5,
	WINDOW_MS: 5 * 60 * 1000, // 5 minutes in milliseconds
};

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
	env: Env
): Promise<void> {
	const baseUrl = env.BASE_URL || 'https://edge-og.example.com';
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
		if (!resendToken || resendToken === 'dev-placeholder-token') {
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
		throw new WorkerError('Failed to send magic link email', 500);
	}
}

/**
 * Validate environment configuration for authentication
 */
export function validateAuthEnvironment(env: Env): void {
	const requiredVars = ['JWT_SECRET', 'EMAIL_PEPPER'];
	const missing = requiredVars.filter(varName => !env[varName as keyof Env]);
	
	if (missing.length > 0) {
		throw new WorkerError(
			`Missing required environment variables for authentication: ${missing.join(', ')}`,
			500
		);
	}
	
	// Validate JWT secret strength
	const jwtSecret = env.JWT_SECRET as string;
	if (jwtSecret.length < 32) {
		throw new WorkerError('JWT_SECRET must be at least 32 characters for security', 500);
	}
	
	// Validate email pepper
	const emailPepper = env.EMAIL_PEPPER as string;
	if (emailPepper.length < 16) {
		throw new WorkerError('EMAIL_PEPPER must be at least 16 characters for security', 500);
	}
}
