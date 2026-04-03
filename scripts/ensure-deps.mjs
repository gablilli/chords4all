import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const requiredPaths = [
  'node_modules/.bin/vite',
  'node_modules/@sveltejs/kit/package.json',
  'node_modules/svelte/package.json'
];

function hasCompatibleKitVersion() {
  const kitPackagePath = 'node_modules/@sveltejs/kit/package.json';
  if (!existsSync(kitPackagePath)) {
    return false;
  }

  try {
    const raw = readFileSync(kitPackagePath, 'utf8');
    const parsed = JSON.parse(raw);
    const version = String(parsed?.version ?? '0.0.0');
    const major = Number(version.split('.')[0]);

    return Number.isFinite(major) && major >= 2;
  } catch {
    return false;
  }
}

const hasDependencies = requiredPaths.every((path) => existsSync(path));
const hasCompatibleDependencies = hasDependencies && hasCompatibleKitVersion();

if (hasCompatibleDependencies) {
  process.exit(0);
}

console.log('[chords4all] Dipendenze mancanti o incompatibili: eseguo npm install...');

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const install = spawnSync(npmCommand, ['install'], {
  stdio: 'inherit'
});

if (install.error) {
  console.error('[chords4all] Errore durante npm install:', install.error.message);
  process.exit(1);
}

process.exit(install.status ?? 1);
