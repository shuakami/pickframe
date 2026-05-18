// Next.js 16 ships a flat-config array as the default export — just spread it.
// Keeps `pnpm lint` aligned with what `next build` runs internally.
import nextConfig from "eslint-config-next";

const config = [...nextConfig];

export default config;
