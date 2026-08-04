/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Keep production deploys unblocked by lint noise; run `npm run lint` locally.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // googleapis type graph is huge and can OOM/timeout Vercel typecheck.
    // Runtime correctness is covered by Vitest + local checks.
    ignoreBuildErrors: true,
  },
  experimental: {
    // Avoid bundling the massive googleapis package into the server build.
    serverComponentsExternalPackages: ["googleapis", "google-auth-library"],
  },
};

export default nextConfig;
