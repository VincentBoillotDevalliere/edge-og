/**
 * Request context passed between middleware and handlers
 */
export interface RequestContext {
	request: Request;
	env: Env;
	ctx: ExecutionContext;
	requestId: string;
	startTime: number;
	url: URL;
}

/**
 * Route handler function signature
 */
export type RouteHandler = (context: RequestContext) => Promise<Response>;

/**
 * Middleware function signature
 */
export type Middleware = (context: RequestContext, next: () => Promise<Response>) => Promise<Response>;

/**
 * Route definition
 */
export interface Route {
	method: string;
	path: string;
	handler: RouteHandler;
}
