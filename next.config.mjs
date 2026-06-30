/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000", "gladedeck-zeta.vercel.app", "glade-zeta.vercel.app"],
    },
  },
};

export default nextConfig;
