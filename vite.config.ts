import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { cloudflare } from '@cloudflare/vite-plugin'

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    cloudflare({ configPath: mode === 'test' ? './wrangler.test.jsonc' : './wrangler.jsonc' }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.jpg', 'icons.svg'],
      manifest: {
        name: '_jayawijaya by ark',
        short_name: '_jayawijaya',
        description: 'Medical education quiz app — Gastroenterology',
        theme_color: '#863bff',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'icon.jpg',
            sizes: '326x326',
            type: 'image/jpeg',
          },
          {
            src: 'favicon.svg',
            sizes: '48x46',
            type: 'image/svg+xml',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,yaml}'],
        runtimeCaching: [],
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  base: '/',
}))
