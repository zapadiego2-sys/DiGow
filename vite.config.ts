import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  // Ruta donde se publica la app, por ejemplo "/nombre-repo/" en GitHub Pages.
  const env = { ...loadEnv(mode, process.cwd()), ...process.env };
  const base = env.VITE_BASE_PATH || '/';

  return {
    base,
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    // exceljs ocupa más de 900 kB, pero es un chunk diferido que solo se carga al importar.
    build: { chunkSizeWarningLimit: 1000 },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['icons/*.png', 'seed/*.png', 'brand/*'],
        manifest: {
          name: 'Cotizador',
          short_name: 'Cotizador',
          description: 'Crea, costea y presenta cotizaciones de productos fabricados a medida.',
          lang: 'es-CO',
          start_url: base,
          scope: base,
          display: 'standalone',
          // Valores de DESIGN.md: colors.primary y colors.background.
          theme_color: '#1F3864',
          background_color: '#F5F7FA',
          icons: [
            {
              src: `${base}icons/icon-192.png`,
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: `${base}icons/icon-512.png`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: `${base}icons/icon-maskable-512.png`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          // Incluye el chunk diferido de exceljs: la importación debe funcionar sin conexión.
          globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        },
      }),
    ],
  };
});
