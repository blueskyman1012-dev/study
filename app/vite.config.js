import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

function bgListPlugin() {
  const exts = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg'];

  function generateList(dir, urlPrefix) {
    if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); }
    const files = fs.readdirSync(dir)
      .filter(f => exts.includes(path.extname(f).toLowerCase()))
      .map(f => urlPrefix + f);
    fs.writeFileSync(path.resolve(dir, 'list.json'), JSON.stringify(files, null, 2));
  }

  function generateAll() {
    const bgDir = path.resolve(__dirname, 'public/background');
    generateList(bgDir, '/background/');
  }

  return {
    name: 'bg-list-generator',
    buildStart() { generateAll(); },
    configureServer() {
      generateAll();
      const bgDir = path.resolve(__dirname, 'public/background');
      try { fs.watch(bgDir, () => generateAll()); } catch {}
    }
  };
}

export default defineConfig({
  root: './',
  base: './',
  publicDir: 'public',
  plugins: [bgListPlugin()],
  server: {
    port: 9333,
    host: '0.0.0.0',
    open: true,
    https: false,  // HTTP 사용
    allowedHosts: ['.ngrok-free.dev', '.ngrok.io', '.ngrok-free.app']
  },
  esbuild: {
    drop: ['console', 'debugger']
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false
  }
});
