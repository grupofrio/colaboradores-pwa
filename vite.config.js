import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // ── Fixtures de DEMOSTRACIÓN: fail-closed ──────────────────────────────────
  // Antes cada alias preguntaba por `mode`. Eso resultó frágil: el build de
  // Vercel del 2026-08-02 metió `dayControl/fixtures.js` en el bundle y el
  // guardián `check_supervisor_day_control_leak` lo cazó (sentinel
  // "gf.salesops.supervisor.radar/1" dentro del chunk de M7). Reproducido:
  // `vite build --mode development` mete los fixtures; `vite build` no.
  //
  // Ahora la condición es el COMANDO, no el modo: los fixtures solo existen en
  // el servidor de desarrollo (`vite`) o en tests. CUALQUIER `vite build`, con
  // el modo que sea, resuelve a los stubs de producción. Un entorno de CI mal
  // configurado ya no puede filtrar datos sintéticos al bundle.
  const useDemoFixtures = command === 'serve' || mode === 'test'
  const demoFixtureLoader = fileURLToPath(new URL(
    useDemoFixtures
      ? './src/modules/ventas/m4/demoFixtureLoader.dev.js'
      : './src/modules/ventas/m4/demoFixtureLoader.prod.js',
    import.meta.url,
  ))
  // M7: mismo patrón que M4 — en build de producción el loader NO importa el
  // fixture, así el payload financiero agregado nunca entra al bundle productivo.
  const m7DemoFixtureLoader = fileURLToPath(new URL(
    useDemoFixtures
      ? './src/modules/rentabilidad-costos/m7/demoFixtureLoader.dev.js'
      : './src/modules/rentabilidad-costos/m7/demoFixtureLoader.prod.js',
    import.meta.url,
  ))
  // Supervisor day-control ("Hoy"): mismo patrón — en producción resuelve al stub
  // sin fixtures, así los datos sintéticos nunca entran al bundle productivo.
  const supervisorDayControlDemo = fileURLToPath(new URL(
    useDemoFixtures
      ? './src/modules/supervisor-ventas/dayControl/demoLoader.dev.js'
      : './src/modules/supervisor-ventas/dayControl/demoLoader.prod.js',
    import.meta.url,
  ))
  const supervisorV2Demo = fileURLToPath(new URL(
    useDemoFixtures
      ? './src/modules/supervisor-ventas/v2/demoLoader.dev.js'
      : './src/modules/supervisor-ventas/v2/demoLoader.prod.js',
    import.meta.url,
  ))

  return {
    resolve: {
      alias: {
        '#m3-demo-fixture': fileURLToPath(new URL(
          useDemoFixtures
            ? './src/modules/ejecucion/m3/fixtures/apiLatestFixture.js'
            : './src/modules/ejecucion/m3/fixtures/emptyDemoFixture.js',
          import.meta.url,
        )),
        'virtual:m4-demo-fixture': demoFixtureLoader,
        'virtual:m7-demo-fixture': m7DemoFixtureLoader,
        'virtual:supervisor-daycontrol-demo': supervisorDayControlDemo,
        'virtual:supervisor-v2-demo': supervisorV2Demo,
      },
    },
    plugins: [
      react(),
      tailwindcss(),

      // PWA — selfDestroying=true durante v1. Cambiar a false para activar SW offline
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        selfDestroying: true,
        manifest: {
          name: 'GF Colaboradores',
          short_name: 'GF Tropa',
          description: 'Portal interno Grupo Frío — Colaboradores',
          theme_color: '#15499B',
          background_color: '#030811',
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          runtimeCaching: [
            {
              // Las llamadas a n8n NUNCA se cachean — siempre en vivo
              urlPattern: /^https:\/\/n8n\.grupofrio\.mx\//,
              handler: 'NetworkOnly'
            }
          ]
        }
      })
    ],

    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version)
    },

    server: {
      port: 5173,
      proxy: {
        '/api-n8n': {
          target: env.VITE_N8N_WEBHOOK_URL || 'https://n8n.grupofrio.mx/webhook',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api-n8n/, '')
        },
        '/api-odoo': {
          target: env.VITE_ODOO_URL || 'https://grupofrio-gf.odoo.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api-odoo/, '/api')
        },
        '/odoo-api': {
          target: env.VITE_ODOO_URL || 'https://grupofrio-gf.odoo.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/odoo-api/, '')
        }
      }
    },

    build: {
      outDir: 'dist',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom']
          }
        }
      }
    }
  }
})
