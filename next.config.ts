import type { NextConfig } from "next";

import { resolveTurbopackRoot } from "./src/lib/workspace/turbopack-root";

const nextConfig: NextConfig = {
  turbopack: {
    root: resolveTurbopackRoot(__dirname),
  },
};

export default nextConfig;
