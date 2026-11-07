import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// src/prepare.mjs reads the repo's notebooks at build time, so every number on the page is extracted, never typed.
export default defineConfig({
  base: '/Automated-PDF-Report-Generation-from-Jupyter-Notebook/',
  plugins: [react()],
});
