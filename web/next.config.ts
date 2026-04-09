import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  // Point to the repo root so file tracing works correctly across both lockfiles
  outputFileTracingRoot: path.join(__dirname, '../'),
  experimental: {
    // Allow Next.js/webpack to transpile TypeScript files outside the web/ root
    // This is needed to import from ../src/ (the CLI source) via path aliases
    externalDir: true,
  },
};

export default nextConfig;
