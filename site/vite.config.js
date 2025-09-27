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
});
