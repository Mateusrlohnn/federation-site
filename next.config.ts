import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Silence the "multiple lockfiles" workspace-root warning by pinning the root
  // to this project directory.
  turbopack: {
    root: __dirname,
  },
  // Allow quality=100 for the crisp Habbo avatar PNGs (Next 16 requires
  // whitelisting non-default qualities).
  images: {
    qualities: [75, 100],
  },
};

export default nextConfig;
