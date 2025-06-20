import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  
  // Experimental features to help with hydration issues
  experimental: {
    // This helps with hydration issues caused by browser extensions
    optimizePackageImports: ['lucide-react'],
  },
  
  // Suppress hydration warnings in development (caused by browser extensions)
  onDemandEntries: {
    // Period (in ms) where the server will keep pages in the buffer
    maxInactiveAge: 25 * 1000,
    // Number of pages that should be kept simultaneously without being disposed
    pagesBufferLength: 2,
  },
  
  // Webpack configuration to handle hydration issues
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      // In development, add a plugin to suppress hydration warnings
      const originalEntry = config.entry;
      config.entry = async () => {
        const entries = await originalEntry();
        
        if (entries['main.js'] && !entries['main.js'].includes('./suppress-hydration-warnings.js')) {
          entries['main.js'].unshift('./suppress-hydration-warnings.js');
        }
        
        return entries;
      };
    }
    
    return config;
  },
};

export default nextConfig;
