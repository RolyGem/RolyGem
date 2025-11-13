import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 5173,
      host: '0.0.0.0',

      // Disable HMR to avoid automatic reloads inside the PWA shell
      hmr: false,
      watch: {
        // Skip file watching to keep the service worker steady during development
        ignored: ['**']
      },

      // Allow specific reverse-proxy hosts (Ngrok, Cloudflare, production domain)
      allowedHosts: [
        'neustic-fernando-untediously.ngrok-free.dev', // current Ngrok tunnel
        '*.ngrok-free.dev', // allow any Ngrok free host
        'widescreen-certificates-gather-sydney.trycloudflare.com', // current Cloudflare tunnel
        '*.trycloudflare.com', // allow any Cloudflare tunnel host
        'app.geminifutionchat.site', // production domain
      ],
    },
    plugins: [react(), wasm()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    build: {
      target: 'esnext',
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
          }
        }
      }
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
