/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Keep production deploys unblocked by lint noise; run `npm run lint` locally.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
