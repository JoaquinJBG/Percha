import basicSsl from '@vitejs/plugin-basic-ssl';
import { defineConfig } from 'vite';

// Web Share con ficheros solo funciona en contexto seguro: en el móvil hace falta HTTPS.
// `--mode http` sirve sin certificado, solo para probar en el propio PC (localhost ya es contexto seguro).
export default defineConfig(({ mode }) => ({
  plugins: mode === 'http' ? [] : [basicSsl()],
  server: { port: mode === 'http' ? 5184 : 5183 },
  preview: { port: 5183 },
}));
