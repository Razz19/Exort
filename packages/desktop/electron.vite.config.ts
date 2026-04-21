import path from 'node:path';
import { cpSync, existsSync, rmSync } from 'node:fs';

import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import type { Plugin } from 'vite';

const openCodeConfigSourceDir = path.resolve(__dirname, 'src', 'main', 'agent', 'tools');
const openCodeConfigOutDir = path.resolve(__dirname, 'out', 'main', 'opencode-config');

function copyOpenCodeConfigAssets(): Plugin {
  return {
    name: 'copy-opencode-config-assets',
    apply: 'build',
    closeBundle() {
      if (!existsSync(openCodeConfigSourceDir)) {
        return;
      }

      rmSync(openCodeConfigOutDir, { recursive: true, force: true });
      cpSync(openCodeConfigSourceDir, path.join(openCodeConfigOutDir, 'tools'), {
        recursive: true,
        force: true
      });
    }
  };
}

export default defineConfig({
  main: {
    envPrefix: ['MAIN_VITE_', 'VITE_'],
    plugins: [externalizeDepsPlugin(), copyOpenCodeConfigAssets()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    envPrefix: ['RENDERER_VITE_', 'VITE_'],
    plugins: [svelte()]
  }
});
