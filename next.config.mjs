/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  eslint: { ignoreDuringBuilds: true }, // TypeScript still enforced; skip lint-only failures
};

export default nextConfig;
