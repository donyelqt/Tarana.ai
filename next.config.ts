import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['lucide-react'], // Add lucide-react for proper module handling
  /* other config options here */
};

export default nextConfig;