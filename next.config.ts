import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  transpilePackages: ['lucide-react'],
  
  // Explicitly set distDir to ensure consistent paths across platforms
  distDir: '.next',
  
  // Webpack configuration to fix Windows HMR issues
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      // Disable webpack cache to prevent chunk manifest corruption on Windows
      config.cache = false;
      
      // Use polling instead of native file watching (more reliable on Windows)
      config.watchOptions = {
        poll: 1000, // Check for changes every second
        aggregateTimeout: 300, // Delay before rebuilding after changes
        // Use string glob patterns, not RegExp
        ignored: [
          '**/node_modules/**',
          '**/.next/**',
          '**/public/**',
        ],
      };
    }
    
    return config;
  },
  
  // Production build optimization
  productionBrowserSourceMaps: false,
  
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'openweathermap.org',
        pathname: '/img/wn/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.deliveryhero.io',
        pathname: '/image/fd-ph/**',
      },
      {
        protocol: 'https',
        hostname: 'www.facebook.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'example.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.fbcdn.net',
        pathname: '/**',
      },
    ],
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;