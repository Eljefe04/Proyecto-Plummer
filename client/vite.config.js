import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Config pensada para correr en red local del colegio:
// el cliente Vite corre en un puerto, y proxya /api y /socket.io
// hacia el servidor Express+Socket.IO en el puerto 3001.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // accesible desde otras PCs de la red
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
    },
  },
});
