import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  transpilePackages: ['lucide-react'],
  
  poweredByHeader: false,
  
  
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
  
  
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      
      config.cache = false;
      
      
      config.watchOptions = {
        poll: 1000, 
        aggregateTimeout: 300, 
        
        ignored: [
          '**/node_modules/**',
          '**/.next/**',
          '**/public/**',
        ],
      };
    }
    
    return config;
  },
  
  
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
    
    
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;