// Packs the Hive page into a single HTML file (a heylogram.com code site wants one file): app + engine + PixiJS + identicon inside.
// Run: node derle.mjs  ->  dist/index.html
import { build } from 'file:///C:/nim-isim/web/node_modules/esbuild/lib/main.js';
import { readFileSync, writeFileSync, mkdirSync, cpSync } from 'node:fs';

const kok = new URL('.', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const takma = { '/motor.js': kok + 'motor.js', '/pixi.mjs': kok + 'vendor/pixi.mjs', '/identicons.js': 'C:/nim-isim/server/node_modules/@nimiq/identicons/dist/identicons.bundle.min.js', '/qrcode.js': 'C:/nim-isim/web/node_modules/qrcode-generator/qrcode.js' };
const r = await build({
  entryPoints: [kok + 'uygulama.js'], bundle: true, format: 'esm', minify: true, write: false, target: 'es2022', legalComments: 'none',
  plugins: [{ name: 'takma', setup(b) { b.onResolve({ filter: /^\/(motor\.js|pixi\.mjs|identicons\.js|qrcode\.js)$/ }, (a) => ({ path: takma[a.path] })); } }],
});
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
let html = readFileSync(kok + 'index.html', 'utf8').replace('<script type="module" src="/uygulama.js"></script>', () => '<script type="module">' + js + '</script>');
mkdirSync(kok + 'dist', { recursive: true }); writeFileSync(kok + 'dist/index.html', html);
cpSync(kok + 'public', kok + 'dist', { recursive: true });   // icons + manifest
console.log('dist/index.html', Math.round(html.length / 1024), 'KB');
