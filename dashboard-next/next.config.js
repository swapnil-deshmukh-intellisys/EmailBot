/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000']
    }
  },
  webpack(config, { dev }) {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@/lib': path.resolve(__dirname, 'lib'),
      '@/models': path.resolve(__dirname, 'models')
    };
    if (dev) {
      config.cache = false;
    }
    return config;
  }
};

module.exports = nextConfig;
