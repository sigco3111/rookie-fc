import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ base: './', plugins: [react()], define: { __TEST_HOOKS__: 'false' }, build: { outDir: 'docs', emptyOutDir: true, assetsDir: '', assetsInlineLimit: 0 } });
