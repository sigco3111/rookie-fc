import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
export default defineConfig({
    plugins: [react()], define: { __TEST_HOOKS__: 'true' },
    base: './',
    build: { outDir: 'verify-dist', emptyOutDir: true, rollupOptions: { input: { verify: 'verify.html', looklab: 'look-lab.html' } } },
});
