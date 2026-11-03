import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite'; // <--- Ajouter cette ligne

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // <--- Activer le compilateur Tailwind v4
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});