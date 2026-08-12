import { defineConfig } from 'vite';

export default defineConfig({
  // Relative, so a built copy runs from a subdirectory of a university web
  // server, from a GitHub Pages project path, or straight off a memory stick.
  base: './',
  build: {
    target: 'es2022',
  },
});
