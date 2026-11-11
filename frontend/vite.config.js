import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the dashboard runs on Vite (5173) and proxies the API and
// tracking redirects to the backend (3001). In production the backend serves
// the built files itself.
const backend = 'http://127.0.0.1:3001';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': backend,
      '/r': backend,
      '/health': backend,
    },
  },
});
