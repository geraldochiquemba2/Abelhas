import { defineConfig } from 'vite';

export default defineConfig({
    preview: {
        allowedHosts: true,
    },
    server: {
        allowedHosts: true,
        proxy: {
            '/api': 'http://localhost:3001',
        },
    },
});
