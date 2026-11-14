// Builds the walk HUD as one ES module + one stylesheet that the app loads at runtime (see loadHud in ../src/main.js).
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwind()],
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    outDir: 'dist', emptyOutDir: true, sourcemap: true,
    lib: { entry: 'src/main.jsx', formats: ['es'], fileName: () => 'hud.js', cssFileName: 'hud' },
  },
});
