import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const destination = path.join(root, 'dist');
await rm(destination, { recursive: true, force: true });
const common = ['index.html', 'app.js', 'engine.js', 'styles.css', 'scenery.js', 'assets.js', 'assets'];
for (const game of ['game-thirteen', 'game']) {
  const target = path.join(destination, game);
  await mkdir(target, { recursive: true });
  const entries = game === 'game-thirteen' ? [...common, 'art-loader.js'] : common;
  for (const entry of entries) await cp(path.join(root, game, entry), path.join(target, entry), { recursive: true });
}
await writeFile(path.join(destination, '.nojekyll'), '');
await writeFile(path.join(destination, 'index.html'), `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>百妖牌馆 · 十三张</title><meta http-equiv="refresh" content="0;url=./game-thirteen/">
<style>body{background:#201526;color:#eed4a7;font:20px/1.8 system-ui;text-align:center;padding:20vh 20px}a{color:#edc88d}</style></head>
<body><h1>百妖牌馆</h1><p><a href="./game-thirteen/">进入十三张牌馆</a> · <a href="./game/">比鸡早期版</a></p></body></html>`);
console.log('Built dist/: both games and their runtime assets; no local logs, saves or server files.');
