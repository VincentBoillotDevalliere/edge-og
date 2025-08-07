/**
 * Dashboard Controller
 * Handles dashboard access and rendering for authenticated users
 */

import { 
	validateAuthEnvironment,
	verifyJWTToken,
	SessionPayload
} from '../utils/auth';
import { log } from '../utils/logger';
import type { RouteContext } from '../routes';

export class DashboardController {
	/**
	 * Handle dashboard access for authenticated users
	 * Verifies session token and serves dashboard HTML
	 */
	async serveDashboard(context: RouteContext): Promise<Response> {
		const { request, requestId, env } = context;

		try {
			// Validate environment configuration
			validateAuthEnvironment(env);

			// Check for session cookie
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
				const baseUrl = env.BASE_URL || `${new URL(request.url).protocol}//${new URL(request.url).host}`;
				const headers = new Headers();
				headers.set('Location', `${baseUrl}/`);
				headers.set('Set-Cookie', 'edge_og_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'); // Clear cookie
				
				return new Response(null, {
					status: 302,
					headers,
				});
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
				const baseUrl = env.BASE_URL || `${new URL(request.url).protocol}//${new URL(request.url).host}`;
				const headers = new Headers();
				headers.set('Location', `${baseUrl}/`);
				headers.set('Set-Cookie', 'edge_og_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'); // Clear cookie
				
				return new Response(null, {
					status: 302,
					headers,
				});
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
			const dashboardHtml = this.getDashboardHTML(payload.account_id, accountData.plan);
			
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
	 * Generate dashboard HTML for authenticated users
	 */
	private getDashboardHTML(accountId: string, plan: string): string {
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
		
		.account-header {
			display: flex;
			align-items: center;
			gap: 15px;
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
		
		.logout-btn {
			background: #dc3545;
			color: white;
			border: none;
			padding: 8px 16px;
			border-radius: 6px;
			font-size: 0.9rem;
			font-weight: 600;
			cursor: pointer;
			transition: background-color 0.2s;
		}
		
		.logout-btn:hover {
			background: #c82333;
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
			
			.account-header {
				flex-direction: column;
				gap: 10px;
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
				<div class="account-header">
					<div class="plan-badge">${plan} Plan</div>
					<button class="logout-btn" onclick="logout()">Logout</button>
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
				<h3>📖 API Examples</h3>
				
				<h4>Blog Post</h4>
				<div class="api-example">
/og?title=Building%20Modern%20APIs&description=Learn%20best%20practices%20for%20API%20development&template=blog&author=John%20Doe&theme=blue
				</div>
				
				<h4>Product Launch</h4>
				<div class="api-example">
/og?title=New%20Product%20Launch&description=Revolutionary%20software%20tool&template=product&price=$99&theme=green
				</div>
				
				<h4>Event</h4>
				<div class="api-example">
/og?title=Tech%20Conference%202025&description=Join%20industry%20leaders&template=event&date=March%2015&location=San%20Francisco&theme=purple
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
		async function logout() {
			try {
				const response = await fetch('/auth/session', {
					method: 'DELETE',
					headers: {
						'Content-Type': 'application/json',
					},
				});
				
				if (response.ok) {
					// Redirect to homepage after successful logout
					window.location.href = '/';
				} else {
					// Handle error
					const errorData = await response.json();
					alert('Logout failed: ' + (errorData.error || 'Unknown error'));
				}
			} catch (error) {
				alert('Logout failed: ' + error.message);
			}
		}
	</script>
</body>
</html>`;
	}
}
