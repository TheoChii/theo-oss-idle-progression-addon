import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const input = 'progression-toolkit.addon.js';
const output = 'dist/progression-toolkit.addon.js';
const code = await readFile(input, 'utf8');
if (!code.includes('export function mount()') || !code.includes('export function unmount()')) {
  throw new Error('Missing oss!idle mount/unmount contract');
}
await mkdir('dist', { recursive: true });
await writeFile(output, code);
const checked = spawnSync(process.execPath, ['--check', output], { stdio: 'inherit' });
if (checked.status !== 0) throw new Error('Built bundle failed JavaScript syntax validation');
console.log('Built ' + output + ' (' + Buffer.byteLength(code) + ' bytes)');
