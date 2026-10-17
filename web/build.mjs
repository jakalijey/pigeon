import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, cpSync } from 'node:fs';

const out = await build({ entryPoints: ['entry.js'], bundle: true, minify: true, format: 'iife', write: false, target: 'es2022', legalComments: 'none' });
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\/script');
const css = readFileSync('app.css', 'utf8');
const icon = 'data:image/svg+xml,' + encodeURIComponent(readFileSync('public/icon.svg', 'utf8'));
const html = readFileSync('index.html', 'utf8')
  .replace(/<link rel="icon"[^>]*>/, `<link rel="icon" href="${icon}" type="image/svg+xml">`)
  .replace(/<link rel="stylesheet"[^>]*>/, `<style>${css}</style>`)
  .replace(/<script type="module"[^>]*><\/script>/, () => `<script>${js}</script>`);
mkdirSync('dist', { recursive: true });
writeFileSync('dist/index.html', html);
cpSync('public', 'dist', { recursive: true });
console.log('dist/index.html', (html.length / 1024).toFixed(1), 'KB');
