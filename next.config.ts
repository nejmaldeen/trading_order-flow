import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel's Next adapter expects .next; isolate local Next/Vinext type output.
  distDir: process.env.VERCEL ? ".next" : ".next-production",
  webpack(config) {
    config.externals = [...(Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean)), { "cloudflare:workers": "commonjs cloudflare:workers" }];
    return config;
  },
  serverExternalPackages: ["cloudflare:workers"],
};

export default nextConfig;
