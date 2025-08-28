const nextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true,
  },
  experimental: {
    // Remove if not using Server Components
    serverComponentsExternalPackages: ['mongodb'],
  },
  webpack(config, { dev }) {
    // Use Next.js defaults for file watching in dev to avoid HMR/asset 404 issues
    // Remove custom watchOptions that were too aggressive and could evict entries.
    return config;
  },
  // Increase thresholds to prevent on-demand entry disposal causing 404s for dev assets
  onDemandEntries: {
    maxInactiveAge: 120000, // 2 minutes (default ~60s). Higher to be safe.
    pagesBufferLength: 10,  // keep more pages/chunks in memory
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "ALLOWALL" },
          { key: "Content-Security-Policy", value: "frame-ancestors *;" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "*" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
