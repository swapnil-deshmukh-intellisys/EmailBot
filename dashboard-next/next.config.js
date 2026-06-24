/** @type {import('next').NextConfig} */
const allowedOrigins = String(process.env.ALLOWED_ORIGINS || 'localhost:3000')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const deploymentVersion = String(process.env.DEPLOYMENT_VERSION || '').trim();

const nextConfig = {
  output: 'standalone',
  webpack: (config, { dev }) => {
    if (dev && String(process.env.DISABLE_NEXT_WEBPACK_CACHE || '').trim().toLowerCase() === 'true') {
      // Emergency escape hatch for stale Windows chunks. Keep caching enabled
      // normally; this dashboard is too large to recompile from scratch.
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
