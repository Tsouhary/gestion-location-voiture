import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // L'API Express tourne sur 5000 : le proxy évite les soucis de CORS en développement.
    proxy: { '/api': 'http://localhost:5000' },
  },
});
