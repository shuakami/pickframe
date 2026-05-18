import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pre-rendered HTML/JS/CSS deployed to a CDN — Vercel serves these from
  // the edge with near-zero TTFB on a hit. Static export also rules out
  // accidental server work hiding on the critical path.
  output: "export",

  // Required by `output: "export"` (next/image has no runtime to optimize
  // against). The app already manages thumbnails locally via OffscreenCanvas
  // into IndexedDB, so we don't need the next/image pipeline anyway.
  images: { unoptimized: true },

  // Stable URLs help with edge caching and avoid double-fetches when
  // sharing links.
  trailingSlash: true,

  // Strip console.* (other than warn/error) from production bundles —
  // shaves a small amount off the bundle and avoids leaking noisy logs.
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? { exclude: ["warn", "error"] }
        : false,
  },

  // Make sure browser source maps don't ship to production. (Default is
  // already false; pinning it explicitly so a future Next upgrade doesn't
  // quietly turn it on.)
  productionBrowserSourceMaps: false,

  // Powered-by header is useless and counts towards header weight on every
  // response. Off.
  poweredByHeader: false,

  // Per-package import-rewrites that turn `import { X } from "pkg"` into
  // `import X from "pkg/dist/X"`. This is the single largest first-load
  // win for this app: lucide-react ships hundreds of icon files and the
  // bare import would otherwise pull the whole barrel into the client
  // bundle. Radix/cmdk/framer-motion benefit from the same trick.
  //
  // Safe — Next.js maintains the alias map for these packages.
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "framer-motion",
      "cmdk",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-context-menu",
      "@radix-ui/react-tooltip",
      "@radix-ui/react-slot",
    ],
  },
};

export default nextConfig;
