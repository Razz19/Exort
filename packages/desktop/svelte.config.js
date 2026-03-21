export default {
  compilerOptions: {
    runes: true
  },
  vitePlugin: {
    dynamicCompileOptions: ({ filename }) => {
      if (/[\\/]node_modules[\\/]lucide-svelte[\\/]/.test(filename)) {
        return { runes: false };
      }
      return { runes: true };
    }
  }
};
