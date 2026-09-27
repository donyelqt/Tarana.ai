import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  transpilePackages: ['lucide-react'],
  // No version fingerprint on responses.
  poweredByHeader: false,
  // Middleware matcher skips static/image paths, so these headers would
  // otherwise ship without HSTS/nosniff/DENY. Apply at the config layer.
  async headers() {
    return [
      { source: '/_next/static/:path*', headers: [
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      ] },
      { source: '/images/:path*', headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      ] },
    ];
  },
  
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
      {
        protocol: 'https',
        hostname: 'maps.googleapis.com',
        pathname: '/maps/api/place/photo/**',
      },
      {
        protocol: 'https',
        hostname: 'upload.wikimedia.org',
        pathname: '/**',
      },
      {
        // Wikimedia moved page-image thumbnails from upload.wikimedia.org to
        // thumb.wikimedia.org (Phabricator T427465). Both hosts are allowed
        // while the migration is in flight.
        protocol: 'https',
        hostname: 'thumb.wikimedia.org',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'api.tomtom.com',
        pathname: '/map/1/staticimage/**',
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