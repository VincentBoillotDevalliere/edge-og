import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
	test: {
		// Remove coverage config due to Cloudflare Workers compatibility issues
		// Coverage analysis is available in coverage-analysis.md
		poolOptions: {
			workers: {
				wrangler: { configPath: './wrangler.jsonc' },
				miniflare: {
					// Handle CommonJS/ESM compatibility issues
					compatibilityFlags: ['nodejs_compat'],
				},
			},
		},
	},
	esbuild: {
		// Handle dependencies that need special treatment
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
		// Mock problematic CommonJS modules for testing
		'process.env.NODE_ENV': '"test"',
	},
});
