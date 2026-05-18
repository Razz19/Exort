import adapter from '@sveltejs/adapter-vercel';
import { mdsvex } from 'mdsvex';
import rehypeSlug from 'rehype-slug';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const config = {
  extensions: ['.svelte', '.md', '.svx'],
  preprocess: [
    vitePreprocess(),
    mdsvex({
      extensions: ['.md', '.svx'],
      rehypePlugins: [rehypeSlug]
    })
  ],
  vitePlugin: {
    inspector: {
      toggleKeyCombo: 'meta-shift',
      showToggleButton: 'always'
    }
  },
  kit: {
    adapter: adapter()
  }
};

export default config;
