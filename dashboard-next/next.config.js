/** @type {import('next').NextConfig} */
const allowedOrigins = String(process.env.ALLOWED_ORIGINS || 'localhost:3000')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const deploymentVersion = String(process.env.DEPLOYMENT_VERSION || '').trim();

const nextConfig = {
  output: 'standalone',
  webpack: (config, { dev }) => {
    if (dev) {
      // Dev filesystem cache can keep stale server chunks after route edits on Windows.
      config.cache = false;
    }
    return config;
  },
  ...(deploymentVersion
    ? {
        // Keep build identity stable across all containers in the same rollout.
        deploymentId: deploymentVersion,
        generateBuildId: async () => deploymentVersion
      }
    : {}),
  experimental: {
    serverActions: {
      allowedOrigins
    }
  }
};

module.exports = nextConfig;
