/**
 * Dashboard routes
 */

import { DashboardController } from '../controllers/dashboard';
import type { Route } from './index';

const dashboardController = new DashboardController();

export const dashboardRoutes: Route[] = [
	{
		method: 'GET',
		path: '/dashboard',
		handler: dashboardController.serveDashboard.bind(dashboardController),
	},
];
