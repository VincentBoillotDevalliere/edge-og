/**
 * OG Image generation routes
 */

import { OGController } from '../controllers/og';
import type { Route } from './index';

const ogController = new OGController();

export const ogRoutes: Route[] = [
	{
		method: 'GET',
		path: '/og',
		handler: ogController.generateImage.bind(ogController),
	},
];
