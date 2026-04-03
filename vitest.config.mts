import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
	test: {
		watch: false,
		poolOptions: {
			workers: {
				wrangler: { configPath: './wrangler.jsonc' },
				miniflare: {
					bindings: {
						API_KEY: 'api_key_here',
						HTTP_REQUEST_TIMEOUT: 5,
						TOTAL_RETRIES_BEFORE_DQL: 3,
						TOTAL_MESSAGES_PULL_PER_TIME: 4,
						ENABLE_CONTROL_CONCURRENCY: false,
						LIMIT_CONSUMER_PROCESS: 15,
					},
				},
			},
		},
	},
});

// import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
// import { defineConfig } from 'vitest/config';

// export default defineConfig({
// 	plugins: [
// 		cloudflareTest({
// 			wrangler: { configPath: './wrangler.jsonc' },
// 			miniflare: {
// 				// Define a KV namespace that only exists in tests
// 				kvNamespaces: ['TEST_KV'],
// 				// Rewrite or add environment variables (vars)
// 				bindings: {
// 					API_URL: 'https://example.com',
// 					FEATURE_FLAG: true,
// 				},
// 			},
// 		}),
// 	],
// });
