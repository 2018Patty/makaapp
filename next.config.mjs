/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    if (isServer) {
      // face-api.js uses canvas which is browser-only; exclude from server bundle
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        { canvas: 'canvas' },
      ]
    }
    return config
  },
};

export default nextConfig;
