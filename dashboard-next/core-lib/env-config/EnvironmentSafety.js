const PLACEHOLDER_PATTERNS = [
  /your[_-]?client[_-]?secret/i,
  /your[_-]?secret/i,
  /client[_-]?secret[_-]?here/i,
  /example[_-]?secret/i,
  /^your-/i,
  /^YOUR_/,
  /^CHANGE_ME$/i,
  /^REPLACE_ME$/i
];

const REQUIRED_PRODUCTION_ENV = [
  'MONGODB_URI',
  'JWT_SECRET'
];

const GRAPH_ENV_GROUPS = [
  ['TEC_TENANT_ID', 'TEC_CLIENT_ID', 'TEC_CLIENT_SECRET', 'TEC_GRAPH_SENDER_EMAIL'],
  ['TUT_TENANT_ID', 'TUT_CLIENT_ID', 'TUT_CLIENT_SECRET', 'TUT_GRAPH_SENDER_EMAIL']
];

const SENSITIVE_ENV_NAMES = [
  'CLIENT_SECRET',
  'MS_CLIENT_SECRET',
  'MS_OAUTH_CLIENT_SECRET',
  'TEC_CLIENT_SECRET',
  'TUT_CLIENT_SECRET',
  'JWT_SECRET',
  'MONGODB_URI'
];

function hasPlaceholderValue(value = '') {
  const text = String(value || '').trim();
  if (!text) return false;
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(text));
}

function maskEnvValue(value = '') {
  const text = String(value || '');
  if (!text) return 'missing';
  if (text.length <= 8) return 'set';
  return `${text.slice(0, 4)}...${text.slice(-4)}`;
}

function validateGraphGroup(group = []) {
  const present = group.filter((key) => String(process.env[key] || '').trim());
  if (!present.length) return [];

  return group
    .filter((key) => !String(process.env[key] || '').trim())
    .map((key) => `${key} is required when ${present[0]} is configured.`);
}

export function validateEnvironment({ nodeEnv = process.env.NODE_ENV } = {}) {
  const errors = [];
  const warnings = [];
  const isProduction = String(nodeEnv || '').toLowerCase() === 'production';

  if (isProduction) {
    for (const key of REQUIRED_PRODUCTION_ENV) {
      if (!String(process.env[key] || '').trim()) {
        errors.push(`${key} is required in production.`);
      }
    }
  }

  for (const group of GRAPH_ENV_GROUPS) {
    errors.push(...validateGraphGroup(group));
  }

  for (const key of SENSITIVE_ENV_NAMES) {
    const value = String(process.env[key] || '').trim();
    if (value && hasPlaceholderValue(value)) {
      errors.push(`${key} contains a placeholder value.`);
    }
  }

  if (process.env.TEC_CLIENT_SECRET && process.env.CLIENT_SECRET && process.env.TEC_CLIENT_SECRET === process.env.CLIENT_SECRET) {
    warnings.push('TEC_CLIENT_SECRET is identical to default CLIENT_SECRET.');
  }
  if (process.env.TUT_CLIENT_SECRET && process.env.CLIENT_SECRET && process.env.TUT_CLIENT_SECRET === process.env.CLIENT_SECRET) {
    warnings.push('TUT_CLIENT_SECRET is identical to default CLIENT_SECRET.');
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    checkedAt: new Date().toISOString(),
    masked: {
      clientSecret: maskEnvValue(process.env.CLIENT_SECRET),
      tecClientSecret: maskEnvValue(process.env.TEC_CLIENT_SECRET),
      tutClientSecret: maskEnvValue(process.env.TUT_CLIENT_SECRET)
    }
  };
}

export function assertValidEnvironment(options = {}) {
  const result = validateEnvironment(options);
  if (!result.ok) {
    throw new Error(`Environment validation failed: ${result.errors.join(' ')}`);
  }
  return result;
}
