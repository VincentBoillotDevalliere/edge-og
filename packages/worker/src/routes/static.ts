/**
 * Static routes (homepage, health check)
 */

import { StaticController } from '../controllers/static';
import type { Route } from './index';

const staticController = new StaticController();

export const staticRoutes: Route[] = [
	{
		method: 'GET',
		path: '/',
		handler: staticController.serveHomepage.bind(staticController),
	},
	{
		method: 'GET',
		path: '/health',
		handler: staticController.healthCheck.bind(staticController),
	},
];
