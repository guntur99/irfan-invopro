import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  // CSRF dicek sendiri di src/lib/auth.ts (Origin vs Host), karena di belakang proxy URL internal beda dari origin publik.
  security: { checkOrigin: false },
});
