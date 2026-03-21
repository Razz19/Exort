import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  main: {
    envPrefix: ['MAIN_VITE_', 'VITE_'],
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    envPrefix: ['RENDERER_VITE_', 'VITE_'],
    plugins: [svelte()]
  }
});
