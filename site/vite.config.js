import { defineConfig } from 'vite';
import { ripple } from 'vite-plugin-ripple';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [ripple(), tailwindcss()],
	server: {
		port: 3000,
	},
	build: {
		target: 'esnext',
	},
	resolve: {
		// for local development
		alias: {
			// '@zag-js/toast': '/Users/anubra266/Developer/oss/chakra-ui/zag/packages/machines/toast',

			// 'ripple/internal/client':
			// 	'/Users/anubra266/Developer/oss/ripple/ripple/packages/ripple/src/runtime/internal/client/index.js',
			// 'ripple/internal/server':
			// 	'/Users/anubra266/Developer/oss/ripple/ripple/packages/ripple/src/runtime/internal/server/index.js',
			// ripple: '/Users/anubra266/Developer/oss/ripple/ripple/packages/ripple',
		},
	},
});
