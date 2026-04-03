/** @type {import('next').NextConfig} */
const allowedOrigins = String(process.env.ALLOWED_ORIGINS || 'localhost:3000')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins
    }
  }
};

module.exports = nextConfig;
