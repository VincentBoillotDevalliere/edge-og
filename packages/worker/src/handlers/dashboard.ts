import { RequestContext } from '../types/request';
import { log } from '../utils/logger';
import {
	validateAuthEnvironment,
	verifyJWTToken,
	SessionPayload,
} from '../utils/auth';
import { getPlanLimit, getCurrentYYYYMM } from '../utils/quota';

/**
 * Handle dashboard access for authenticated users
 * Verifies session token and serves dashboard HTML
 */
export async function handleDashboard(context: RequestContext): Promise<Response> {
	const { request, env, requestId } = context;
	
	try {
		// Validate environment configuration
		validateAuthEnvironment(env, requestId);

		// Check for session cookie
		const sessionToken = extractSessionTokenFromCookies(request);

		if (!sessionToken) {
			log({
				event: 'dashboard_access_no_session',
				request_id: requestId,
			});

			// Redirect to homepage for unauthenticated users
			const baseUrl = env.BASE_URL || `${new URL(request.url).protocol}//${new URL(request.url).host}`;
			return Response.redirect(`${baseUrl}/`, 302);
		}

		// Verify session token
		const payload = await verifyJWTToken<SessionPayload>(sessionToken, env.JWT_SECRET as string);
		if (!payload) {
			log({
				event: 'dashboard_access_invalid_session',
				request_id: requestId,
			});

			// Clear invalid session cookie and redirect
			return redirectWithClearedSession(request, env);
		}

		// Verify account still exists
		const key = `account:${payload.account_id}`;
		const accountDataRaw = await env.ACCOUNTS.get(key);
		
		if (!accountDataRaw) {
			log({
				event: 'dashboard_access_account_not_found',
				account_id: payload.account_id,
				request_id: requestId,
			});

			// Clear session and redirect if account doesn't exist
			return redirectWithClearedSession(request, env);
		}

		const accountData = JSON.parse(accountDataRaw) as { email_hash: string; created: string; plan: string };

		// Log successful dashboard access
		log({
			event: 'dashboard_access_success',
			account_id: payload.account_id,
			plan: accountData.plan,
			request_id: requestId,
		});

		// Serve dashboard HTML
		const baseUrl = env.BASE_URL || `${new URL(request.url).protocol}//${new URL(request.url).host}`;
		const dashboardHtml = getDashboardHTML(payload.account_id, accountData.plan, baseUrl);
		
		return new Response(dashboardHtml, {
			status: 200,
			headers: {
				'Content-Type': 'text/html; charset=utf-8',
				'Cache-Control': 'private, no-cache, no-store, must-revalidate',
			},
		});

	} catch (error) {
		log({
			event: 'dashboard_access_failed',
			error: error instanceof Error ? error.message : 'Unknown error',
			request_id: requestId,
		});

		// Return error response
		return new Response(
			JSON.stringify({
				error: 'Failed to access dashboard. Please try again.',
				request_id: requestId,
			}),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' },
			}
		);
	}
}

/**
 * Handle usage retrieval for authenticated users (DB-1.1)
 * GET /dashboard/usage -> { used, limit, resetAt }
 * - Reads monthly usage aggregated across all API keys for the account
 * - Returns 401 if not authenticated
 */
export async function handleDashboardUsage(context: RequestContext): Promise<Response> {
	const { request, env, requestId } = context;
	try {
		// Ensure auth env
		validateAuthEnvironment(env, requestId);

		// Require authentication by default, but allow explicit dev stub when enabled
		const sessionToken = extractSessionTokenFromCookies(request);
		const payload = sessionToken ? await verifyJWTToken<SessionPayload>(sessionToken, env.JWT_SECRET as string) : null;
		if (!payload) {
			const devFlag = (env as any).DEV_ALLOW_DASHBOARD_USAGE as string | undefined;
			const allowDevStub = devFlag === 'true' || devFlag === '1';
			if (allowDevStub) {
				// Compute resetAt = first day of next month UTC 00:00:00.000
				const now = new Date();
				const resetAtDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
				const resetAt = resetAtDate.toISOString();

				const origin = request.headers.get('Origin') || '';
				const corsHeaders: Record<string, string> = {};
				if (origin.startsWith('http://localhost:3000')) {
					corsHeaders['Access-Control-Allow-Origin'] = origin;
					corsHeaders['Vary'] = 'Origin';
					corsHeaders['Access-Control-Allow-Credentials'] = 'true';
				}

				log({ event: 'dashboard_usage_dev_stub', request_id: requestId });
				return new Response(JSON.stringify({ used: 0, limit: 1000, resetAt }), {
					status: 200,
					headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-cache, no-store, must-revalidate', ...corsHeaders }
				});
			}
			return new Response(JSON.stringify({ error: 'Unauthorized', request_id: requestId }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const accountId = payload!.account_id;

		// Load account to determine plan
		const accountKey = `account:${accountId}`;
		const accountDataRaw = await env.ACCOUNTS.get(accountKey);
		if (!accountDataRaw) {
			// Treat missing account as unauthorized to avoid leaking existence
			return new Response(JSON.stringify({ error: 'Unauthorized', request_id: requestId }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		let plan: string = 'free';
		try {
			const acc = JSON.parse(accountDataRaw) as { plan?: string };
			plan = acc.plan || 'free';
		} catch {}

		const limit = getPlanLimit(plan);

		// Aggregate monthly usage across all kids for this account
		const yyyymm = getCurrentYYYYMM();
		let used = 0;

		try {
			// List keys and filter by account via metadata
			const listResult = await (env as any).API_KEYS.list({ prefix: 'key:' });
			const keysForAccount = listResult.keys.filter((k: any) => {
				const md = k.metadata as { account?: string } | undefined;
				return md && md.account === accountId;
			});

			// For each key, read usage:{kid}:{YYYYMM}
			for (const key of keysForAccount) {
				const kid = key.name.substring(4); // strip 'key:'
				const usageKey = `usage:${kid}:${yyyymm}`;
				const raw = await env.USAGE.get(usageKey, 'json') as { count?: number } | number | null;
				if (raw == null) continue;
				if (typeof raw === 'number') {
					used += raw;
				} else if (typeof raw.count === 'number') {
					used += raw.count;
				}
			}
		} catch (e) {
			// If listing fails, log and continue with used=0 to avoid breaking dashboard
			log({ event: 'dashboard_usage_list_failed', error: e instanceof Error ? e.message : String(e), account_id: accountId, request_id: requestId });
		}

		// Compute resetAt = first day of next month UTC 00:00:00.000
		const now = new Date();
		const resetAtDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
		const resetAt = resetAtDate.toISOString();

		// Log success
		log({ event: 'dashboard_usage_success', account_id: accountId, used, limit, reset_at: resetAt, request_id: requestId });

		return new Response(JSON.stringify({ used, limit, resetAt }), {
			status: 200,
			headers: {
				'Content-Type': 'application/json',
				'Cache-Control': 'private, no-cache, no-store, must-revalidate'
			}
		});
	} catch (error) {
		log({ event: 'dashboard_usage_error', status: 500, request_id: requestId, error: error instanceof Error ? error.message : 'Unknown error' });
		return new Response(JSON.stringify({ error: 'Failed to fetch usage', request_id: requestId }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}

/**
 * Extract session token from cookies
 */
function extractSessionTokenFromCookies(request: Request): string {
	const cookieHeader = request.headers.get('Cookie');
	let sessionToken = '';
	
	if (cookieHeader) {
		// Parse cookies to find edge_og_session
		const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
			const trimmed = cookie.trim();
			const equalIndex = trimmed.indexOf('=');
			if (equalIndex > 0) {
				const key = trimmed.substring(0, equalIndex);
				const value = trimmed.substring(equalIndex + 1);
				acc[key] = value;
			}
			return acc;
		}, {} as Record<string, string>);
		
		sessionToken = cookies['edge_og_session'] || '';
	}
	
	return sessionToken;
}

/**
 * Redirect to homepage with cleared session cookie
 */
function redirectWithClearedSession(request: Request, env: Env): Response {
	const baseUrl = env.BASE_URL || `${new URL(request.url).protocol}//${new URL(request.url).host}`;
	const headers = new Headers();
	headers.set('Location', `${baseUrl}/`);
	headers.set('Set-Cookie', 'edge_og_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'); // Clear cookie
	
	return new Response(null, {
		status: 302,
		headers,
	});
}

/**
 * Generate dashboard HTML for authenticated users
 */
function getDashboardHTML(accountId: string, plan: string, baseUrl: string): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Dashboard - Edge-OG</title>
	<style>
		* {
			margin: 0;
			padding: 0;
			box-sizing: border-box;
		}
		
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
			line-height: 1.6;
			color: #333;
			background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
			min-height: 100vh;
		}
		
		.container {
			max-width: 1200px;
			margin: 0 auto;
			padding: 40px 20px;
		}
		
		.header {
			text-align: center;
			margin-bottom: 50px;
		}
		
		.header h1 {
			color: white;
			font-size: 3rem;
			margin-bottom: 10px;
			font-weight: 700;
		}
		
		.header p {
			color: rgba(255, 255, 255, 0.8);
			font-size: 1.2rem;
		}
		
		.dashboard-card {
			background: white;
			border-radius: 12px;
			box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
			padding: 40px;
			margin-bottom: 30px;
		}
		
		.account-info {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: 30px;
			padding-bottom: 20px;
			border-bottom: 2px solid #f0f0f0;
		}
		
		.account-info h2 {
			color: #333;
			font-size: 1.5rem;
		}
		
		.plan-badge {
			background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
			color: white;
			padding: 8px 16px;
			border-radius: 20px;
			font-size: 0.9rem;
			font-weight: 600;
			text-transform: uppercase;
		}
		
		.api-section {
			margin: 30px 0;
		}
		
		.api-section h3 {
			color: #333;
			margin-bottom: 15px;
			font-size: 1.3rem;
		}
		
		.api-example {
			background: #f8f9fa;
			border: 1px solid #e9ecef;
			border-radius: 8px;
			padding: 20px;
			font-family: 'Monaco', 'Menlo', monospace;
			font-size: 0.9rem;
			color: #495057;
			overflow-x: auto;
			margin: 10px 0;
		}
		
		.btn {
			display: inline-block;
			padding: 12px 24px;
			background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
			color: white;
			text-decoration: none;
			border-radius: 6px;
			font-weight: 600;
			transition: transform 0.2s;
		}
		
		.btn:hover {
			transform: translateY(-2px);
		}
		
		.feature-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
			gap: 30px;
			margin: 30px 0;
		}
		
		.feature-card {
			background: #f8f9fa;
			padding: 20px;
			border-radius: 8px;
			border-left: 4px solid #667eea;
		}
		
		.feature-card h4 {
			color: #333;
			margin-bottom: 10px;
		}
		
		@media (max-width: 768px) {
			.header h1 {
				font-size: 2rem;
			}
			
			.account-info {
				flex-direction: column;
				gap: 15px;
				text-align: center;
			}
			
			.dashboard-card {
				padding: 20px;
			}
		}
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<h1>🎨 Edge-OG Dashboard</h1>
			<p>Generate beautiful Open Graph images at the edge</p>
		</div>
		
		<div class="dashboard-card">
			<div class="account-info">
				<h2>Welcome back!</h2>
				<div class="plan-badge">${plan} Plan</div>
			</div>

			<div class="api-section" id="templatesSection">
				<h3>📝 Templates</h3>
				<p>Preview any of your saved templates directly. Click Preview to open <code>/og?templateId=...</code> in a new tab.</p>
				<div id="templatesContainer" style="margin-top: 16px;">
					<div class="feature-card">Loading templates…</div>
				</div>
			</div>
			
			<div class="api-section">
				<h3>🚀 Quick Start</h3>
				<p>Generate Open Graph images by making GET requests to the <code>/og</code> endpoint:</p>
				
				<div class="api-example">
GET /og?title=Hello%20World&description=My%20awesome%20content&theme=dark&template=blog
				</div>
				
				<div class="feature-grid">
					<div class="feature-card">
						<h4>🎨 Themes</h4>
						<p>Choose from light, dark, blue, green, or purple themes</p>
					</div>
					<div class="feature-card">
						<h4>📝 Templates</h4>
						<p>11 specialized templates: blog, product, event, quote, minimal, news, tech, podcast, portfolio, course, and default</p>
					</div>
					<div class="feature-card">
						<h4>⚡ Fast</h4>
						<p>Edge-optimized with sub-150ms response times</p>
					</div>
					<div class="feature-card">
						<h4>🎯 Cached</h4>
						<p>Images cached for 1 year for optimal performance</p>
					</div>
				</div>
			</div>
			
			<div class="api-section">
				<h3>🔑 API Keys</h3>
				<p>Generate and manage API keys for programmatic access to Edge-OG:</p>
				
				<div class="api-key-form">
					<h4>Generate New API Key</h4>
					<form id="apiKeyForm" style="margin: 20px 0;">
						<div style="margin-bottom: 15px;">
							<label for="keyName" style="display: block; margin-bottom: 5px; font-weight: 600;">Key Name:</label>
							<input 
								type="text" 
								id="keyName" 
								name="name" 
								placeholder="e.g., Production App, Development, CI/CD"
								required
								maxlength="100"
								style="width: 100%; max-width: 400px; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;"
							>
						</div>
						<button 
							type="submit" 
							class="btn"
							style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-weight: 600;"
						>
							Generate API Key
						</button>
					</form>
					
					<div id="apiKeyResult" style="display: none; margin-top: 20px; padding: 20px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #28a745;">
						<h4 style="color: #155724; margin-top: 0;">✅ API Key Generated Successfully</h4>
						<p style="color: #155724; font-weight: 600;">⚠️ Store this key securely. It will not be shown again.</p>
						<div style="background: white; padding: 15px; border-radius: 4px; font-family: monospace; word-break: break-all; font-size: 14px; margin: 10px 0;">
							<span id="generatedKey"></span>
						</div>
						<button 
							onclick="copyToClipboard()" 
							style="background: #28a745; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-right: 10px;"
						>
							Copy Key
						</button>
						<button 
							onclick="document.getElementById('apiKeyResult').style.display='none';" 
							style="background: #6c757d; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;"
						>
							Hide
						</button>
					</div>
				</div>
			</div>
			
			<div class="api-section">
				<h3>📖 API Examples</h3>
				
				<h4>Using Your API Key</h4>
				<div class="api-example">
curl -H "Authorization: Bearer YOUR_API_KEY" 
  "${baseUrl}/og?title=Hello%20World&theme=dark"
				</div>
				
				<h4>JavaScript (Node.js/Browser)</h4>
				<div class="api-example">
const response = await fetch('${baseUrl}/og?title=Hello%20World&theme=dark', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY'
  }
});
const imageBlob = await response.blob();
				</div>
				
				<h4>Python</h4>
				<div class="api-example">
import requests

headers = {'Authorization': 'Bearer YOUR_API_KEY'}
response = requests.get('${baseUrl}/og?title=Hello%20World&theme=dark', 
                       headers=headers)
with open('og-image.png', 'wb') as f:
    f.write(response.content)
				</div>
				
				<hr style="margin: 30px 0; border: 1px solid #e0e0e0;">
				
				<h4>Template Examples</h4>
				
				<h4>Blog Post</h4>
				<div class="api-example">
${baseUrl}/og?title=Building%20Modern%20APIs&description=Learn%20best%20practices&template=blog&author=John%20Doe&theme=blue
				</div>
				
				<h4>Product Launch</h4>
				<div class="api-example">
${baseUrl}/og?title=New%20Product%20Launch&description=Revolutionary%20software&template=product&price=$99&theme=green
				</div>
				
				<h4>Event</h4>
				<div class="api-example">
${baseUrl}/og?title=Tech%20Conference%202025&description=Join%20industry%20leaders&template=event&date=March%2015&location=San%20Francisco&theme=purple
				</div>
			</div>
			
			<div style="text-align: center; margin-top: 40px;">
				<a href="/og?title=My%20First%20Image&description=Generated%20from%20dashboard&theme=dark" class="btn" target="_blank">
					Try Sample Image
				</a>
			</div>
		</div>
	</div>
	
	<script>
		let generatedApiKey = '';

		// Load and render templates list with Preview links (DB-2.3 UI wiring)
		async function loadTemplates() {
			const container = document.getElementById('templatesContainer');
			if (!container) return;
			try {
				const res = await fetch('/templates', { credentials: 'include' });
				if (!res.ok) {
					container.innerHTML = '<div class="feature-card">Failed to load templates.</div>';
					return;
				}
				const data = await res.json();
				const items = (data && Array.isArray(data.templates)) ? data.templates : [];
				if (items.length === 0) {
					container.innerHTML = '<div class="feature-card">No templates yet. Use the API to create one, then preview it here.</div>';
					return;
				}

				const rows = items.map(t => {
					var updated = t.updatedAt ? new Date(t.updatedAt).toLocaleString() : '-';
					var previewUrl = '/og?templateId=' + encodeURIComponent(t.id) + '&title=' + encodeURIComponent(t.name || 'Preview');
					return (
						'<tr>' +
						'\t<td style="padding: 8px 12px;">' + (t.name || '-') + '</td>' +
						'\t<td style="padding: 8px 12px; color: #555;">' + (t.slug || '-') + '</td>' +
						'\t<td style="padding: 8px 12px; color: #777;">' + updated + '</td>' +
						'\t<td style="padding: 8px 12px; text-align: right;">' +
						'\t\t<a class="btn" href="' + previewUrl + '" target="_blank" rel="noopener noreferrer">Preview</a>' +
						'\t</td>' +
						'</tr>'
					);
				}).join('');

				container.innerHTML =
					'<div style="overflow-x: auto; background: #f8f9fa; border-radius: 8px; border: 1px solid #e9ecef;">' +
					'\t<table style="width: 100%; border-collapse: collapse; min-width: 560px;">' +
					'\t\t<thead>' +
					'\t\t\t<tr style="background: #fff;">' +
					'\t\t\t\t<th style="text-align: left; padding: 10px 12px; border-bottom: 1px solid #e9ecef;">Name</th>' +
					'\t\t\t\t<th style="text-align: left; padding: 10px 12px; border-bottom: 1px solid #e9ecef;">Slug</th>' +
					'\t\t\t\t<th style="text-align: left; padding: 10px 12px; border-bottom: 1px solid #e9ecef;">Updated</th>' +
					'\t\t\t\t<th style="text-align: right; padding: 10px 12px; border-bottom: 1px solid #e9ecef;">Actions</th>' +
					'\t\t\t</tr>' +
					'\t\t</thead>' +
					'\t\t<tbody>' +
					'\t\t\t' + rows +
					'\t\t</tbody>' +
					'\t</table>' +
					'</div>';


			} catch (e) {
				container.innerHTML = '<div class="feature-card">Failed to load templates.</div>';
			}
		}

		// Kick off templates loading after DOM is ready
		if (document.readyState === 'loading') {
			document.addEventListener('DOMContentLoaded', loadTemplates);
		} else {
			loadTemplates();
		}
		
		document.getElementById('apiKeyForm').addEventListener('submit', async function(e) {
			e.preventDefault();
			
			const keyName = document.getElementById('keyName').value.trim();
			const submitButton = e.target.querySelector('button[type="submit"]');
			const originalText = submitButton.textContent;
			
			if (!keyName) {
				alert('Please enter a name for your API key');
				return;
			}
			
			// Show loading state
			submitButton.textContent = 'Generating...';
			submitButton.disabled = true;
			
			try {
				const response = await fetch('/dashboard/api-keys', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ name: keyName })
				});
				
				const data = await response.json();
				
				if (response.ok) {
					// Show the generated API key
					generatedApiKey = data.api_key.key;
					document.getElementById('generatedKey').textContent = generatedApiKey;
					document.getElementById('apiKeyResult').style.display = 'block';
					
					// Clear the form
					document.getElementById('keyName').value = '';
					
					// Scroll to result
					document.getElementById('apiKeyResult').scrollIntoView({ behavior: 'smooth' });
				} else {
					alert('Error: ' + (data.error || 'Failed to generate API key'));
				}
			} catch (error) {
				// Client-side console is acceptable; keep minimal
				alert('Failed to generate API key. Please try again.');
			} finally {
				// Reset button state
				submitButton.textContent = originalText;
				submitButton.disabled = false;
			}
		});
		
		function copyToClipboard() {
			if (generatedApiKey) {
				navigator.clipboard.writeText(generatedApiKey).then(function() {
					const button = event.target;
					const originalText = button.textContent;
					button.textContent = 'Copied!';
					button.style.background = '#28a745';
					
					setTimeout(function() {
						button.textContent = originalText;
						button.style.background = '#28a745';
					}, 2000);
				}).catch(function(err) {
					// Fallback - select the text
					const keyElement = document.getElementById('generatedKey');
					const range = document.createRange();
					range.selectNode(keyElement);
					window.getSelection().removeAllRanges();
					window.getSelection().addRange(range);
					alert('API key selected. Press Ctrl+C (or Cmd+C on Mac) to copy.');
				});
			}
		}
	</script>
</body>
</html>`;
}
