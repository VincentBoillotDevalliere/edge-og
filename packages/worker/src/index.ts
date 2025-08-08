/**
 * Edge-OG Worker - Open Graph Image Generator at the Edge
 * 
 * Implements user story CG-1: En tant que crawler je reçois une image PNG 1200×630 <150 ms
 * Implements user story EC-1: Les images sont cachées 1 an pour réduire latence & coût
 * Criteria: Content-Type: image/png, TTFB ≤ 150 ms, Cache hit ratio ≥ 90%
 */

import { RequestContext } from './types/request';
import { createRouter } from './routes/router';
import { 
	httpsRedirectMiddleware,
	errorHandlerMiddleware,
	loggingMiddleware 
} from './middleware';

/**
 * Main entry point for the Cloudflare Worker
 */
export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const startTime = Date.now();
		const requestId = crypto.randomUUID();
		const url = new URL(request.url);

		// Create request context
		const context: RequestContext = {
			request,
			env,
			ctx,
			requestId,
			startTime,
			url,
		};

		// Create router
		const router = createRouter();

		// Create middleware chain
		const middlewareChain = [
			httpsRedirectMiddleware,
			errorHandlerMiddleware,
			loggingMiddleware,
		];

		// Execute middleware chain and route handling
		return executeMiddlewareChain(middlewareChain, context, () => router.handle(context));
	},
} satisfies ExportedHandler<Env>;

/**
 * Execute middleware chain with the final handler
 */
async function executeMiddlewareChain(
	middlewares: Array<(context: RequestContext, next: () => Promise<Response>) => Promise<Response>>,
	context: RequestContext,
	finalHandler: () => Promise<Response>
): Promise<Response> {
	let index = 0;

	async function next(): Promise<Response> {
		if (index >= middlewares.length) {
			return finalHandler();
		}

		const middleware = middlewares[index++];
		return middleware(context, next);
	}

	return next();
}
