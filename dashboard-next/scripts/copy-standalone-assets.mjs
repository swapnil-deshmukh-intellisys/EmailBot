import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const standaloneRoot = path.join(root, '.next', 'standalone');

function copyDirectory(source, destination) {
  if (!fs.existsSync(source)) {
    return;
  }

  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, { recursive: true });
  console.log(`Copied ${path.relative(root, source)} -> ${path.relative(root, destination)}`);
}

if (!fs.existsSync(standaloneRoot)) {
  throw new Error('Missing .next/standalone. Run next build with output: standalone first.');
}

copyDirectory(path.join(root, '.next', 'static'), path.join(standaloneRoot, '.next', 'static'));
copyDirectory(path.join(root, 'public'), path.join(standaloneRoot, 'public'));
