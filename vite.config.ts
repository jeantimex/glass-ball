import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        shadertoy: 'shadertoy.html',
        marble: 'marble.html',
      },
    },
  },
});
