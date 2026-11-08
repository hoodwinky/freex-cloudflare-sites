// Copyright (c) 2026 FreeX. MIT License.
import { mkdir, readFile, writeFile, cp } from 'node:fs/promises';
await mkdir('dist/server', { recursive: true });
const modules = await Promise.all(['src/inventory.mjs', 'src/ui.mjs', 'worker/index.mjs'].map(file => readFile(file, 'utf8')));
const bundled = modules.slice(0, 2).map(source => source.replace(/^export /gm, '')).join('\n') + '\n' + modules[2].replace(/^import .*;\n/gm, '');
await writeFile('dist/server/index.js', bundled);
try { await mkdir('dist/.openai', { recursive: true }); await cp('.openai/hosting.json', 'dist/.openai/hosting.json'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
await writeFile('dist/server/package.json', '{"type":"module"}\n');
console.log('Built Cloudflare gallery Worker in dist/server/index.js');
