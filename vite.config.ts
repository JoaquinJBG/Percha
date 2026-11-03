import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import type { Plugin } from 'vite'
import { configDefaults, defineConfig } from 'vitest/config'

const colorTema = '#5b6b35'
const colorFondo = '#f8f6ef'

// Aislamiento entre orígenes: sin él, el recorte en WASM va con un solo hilo. En producción lo pone
// `public/_headers`.
const cabecerasAislamiento = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless',
}

// Transformers.js baja el runtime WASM de ONNX de jsDelivr (y lo guarda en caché). La copia que Vite
// empaqueta no se usa, pesa 27 MB y no cabe en un alojamiento gratis (Cloudflare Pages: 25 MiB por fichero).
function sinRuntimeOnnxEmpaquetado(): Plugin {
  return {
    name: 'percha:sin-runtime-onnx',
    generateBundle(_opciones, bundle) {
      for (const nombre of Object.keys(bundle)) {
        if (/ort-wasm.*\.wasm$/.test(nombre)) Reflect.deleteProperty(bundle, nombre)
      }
    },
  }
}

export default defineConfig({
  server: { headers: cabecerasAislamiento },
  preview: { headers: cabecerasAislamiento },
  worker: { format: 'es', plugins: () => [sinRuntimeOnnxEmpaquetado()] },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icono.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        id: '/',
        name: 'Percha',
        short_name: 'Percha',
        description: 'Tu armario en el móvil y outfits propuestos por IA.',
        lang: 'es',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: colorTema,
        background_color: colorFondo,
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    exclude: [...configDefaults.exclude, 'spikes/**'],
  },
})
