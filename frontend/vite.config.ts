import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      vue(),
      tailwindcss(),
      vueDevTools(),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      // The app calls /api/...; Vite forwards it to the backend without the /api
      // prefix. Browser and API share one origin, so CORS never comes into play.
      proxy: {
        '/api': {
          target: env.API_PROXY_TARGET || 'http://localhost:8888',
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  }
})
