import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  root: './',
  base: './',
  publicDir: 'public',
  server: {
    port: 9333,
    host: '0.0.0.0',
    open: true,
    https: false,  // HTTP 사용
    allowedHosts: ['.ngrok-free.dev', '.ngrok.io', '.ngrok-free.app']
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
});
