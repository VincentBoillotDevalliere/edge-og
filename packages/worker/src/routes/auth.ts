/**
 * Authentication routes
 * Handles magic link authentication flow and session management
 */

import { AuthController } from '../controllers/auth';
import type { Route } from './index';

const authController = new AuthController();

export const authRoutes: Route[] = [
	{
		method: 'POST',
		path: '/auth/request-link',
		handler: authController.requestMagicLink.bind(authController),
	},
	{
		method: 'GET',
		path: '/auth/callback',
		handler: authController.handleCallback.bind(authController),
	},
	{
		method: 'DELETE',
		path: '/auth/session',
		handler: authController.logout.bind(authController),
	},
];
