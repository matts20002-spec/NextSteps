import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Local dev: proxy /api requests to the backend so the React app and the
// Express API can be developed on different ports without CORS headaches.
// In production the built static files are uploaded to S3 and CloudFront
// routes /api/* to the ALB instead (see root README).
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'static',
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
