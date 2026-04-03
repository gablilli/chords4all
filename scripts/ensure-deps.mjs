import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const requiredPaths = [
  'node_modules/.bin/vite',
  'node_modules/@sveltejs/kit/package.json',
  'node_modules/svelte/package.json'
];

const hasDependencies = requiredPaths.every((path) => existsSync(path));
if (hasDependencies) {
  process.exit(0);
}

console.log('[chords4all] Dipendenze mancanti: eseguo npm install...');

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const install = spawnSync(npmCommand, ['install'], {
  stdio: 'inherit'
});

if (install.error) {
  console.error('[chords4all] Errore durante npm install:', install.error.message);
  process.exit(1);
}

process.exit(install.status ?? 1);
