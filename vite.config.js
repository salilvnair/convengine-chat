import { resolve } from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.js'),
      name: 'ConvEngineChat',
      formats: ['es', 'umd'],
      fileName: (format) =>
        format === 'es' ? 'convengine-chat.es.js' : 'convengine-chat.umd.cjs',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react/jsx-runtime': 'jsxRuntime',
        },
        // Ensure CSS is extracted to a single file
        assetFileNames: (assetInfo) =>
          assetInfo.name === 'style.css' ? 'convengine-chat.css' : assetInfo.name,
      },
    },
    cssCodeSplit: false,
    sourcemap: true,
  },
});
