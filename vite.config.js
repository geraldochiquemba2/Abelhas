import { defineConfig } from 'vite';

export default defineConfig({
    server: {
        host: '0.0.0.0',
        port: 5173,
        allowedHosts: true,
        proxy: {
            '/api': {
                target: 'https://localhost:3001',
                secure: false,
            },
        },
    },
    preview: {
        allowedHosts: true,
    },
});
