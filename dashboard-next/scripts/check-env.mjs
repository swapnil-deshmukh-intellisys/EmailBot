import fs from 'fs';
import path from 'path';
import { validateEnvironment } from '../core-lib/env-config/EnvironmentSafety.js';

function loadEnvFromFile() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) continue;
    const key = line.slice(0, separatorIndex).trim();
    if (!key) continue;
    let value = line.slice(separatorIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFromFile();

const result = validateEnvironment({ nodeEnv: process.env.NODE_ENV || 'production' });

console.log(JSON.stringify({
  ok: result.ok,
  errors: result.errors,
  warnings: result.warnings,
  checkedAt: result.checkedAt,
  masked: result.masked,
  worker: result.worker,
  recommendedWorkerEnv: result.recommendedWorkerEnv
}, null, 2));

if (!result.ok) {
  process.exit(1);
}
