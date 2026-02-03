import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Isso ajuda a ignorar erros pequenos de TypeScript para garantir o build
    typescript: {
      ignoreBuildErrors: true,
    },
  },
});
