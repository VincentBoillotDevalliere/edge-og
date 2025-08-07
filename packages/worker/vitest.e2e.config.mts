import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
	test: {
		// E2E specific configuration
		testTimeout: 30000, // 30 seconds for E2E tests
		hookTimeout: 10000, // 10 seconds for setup/teardown
		include: ['**/e2e.spec.ts'],
		poolOptions: {
			workers: {
				wrangler: { configPath: './wrangler.jsonc' },
				miniflare: {
					compatibilityFlags: ['nodejs_compat'],
				},
			},
		},
	},
	esbuild: {
		target: 'es2020',
	},
	optimizeDeps: {
		include: [
			'satori',
			'@resvg/resvg-wasm',
		],
		exclude: [
			'css-color-keywords',
			'css-to-react-native',
		],
	},
	define: {
		'process.env.NODE_ENV': '"test"',
	},
});
