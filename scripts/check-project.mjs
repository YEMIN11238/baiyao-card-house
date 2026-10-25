import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ART_PATHS } from '../game-thirteen/assets.js';

const root = fileURLToPath(new URL('..', import.meta.url));
for (const file of ART_PATHS) {
  const details = await stat(path.resolve(root, 'game-thirteen', file));
  if (!details.isFile() || !details.size) throw new Error(`Missing or empty artwork: ${file}`);
}
const documents = ['README.md', 'docs/ART.md', 'docs/DEVELOPMENT.md'];
for (const document of documents) {
  const body = await readFile(path.join(root, document), 'utf8');
  if (/\/Users\/|plugin:\/\//.test(body)) throw new Error(`Local-only path in ${document}`);
  const links = [...body.matchAll(/!?\[[^\]]*\]\(([^\s)]+)(?:\s+"[^"]*")?\)|\bsrc="([^"]+)"/g)];
  for (const match of links) {
    const href = match[1] || match[2];
    if (/^(?:https?:|mailto:|#)/.test(href)) continue;
    const target = decodeURIComponent(href.split('#')[0].split('?')[0]);
    await stat(path.resolve(root, path.dirname(document), target));
  }
}
console.log(`Verified ${ART_PATHS.length} runtime artwork files and local documentation links.`);
