// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: process.env.ASTRO_SITE_URL || 'http://localhost:4321',
  base: process.env.ASTRO_BASE || '/',
});
