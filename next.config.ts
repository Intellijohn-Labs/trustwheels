import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Quality gate screen is gone; send old bookmarks to Reconditioning.
  redirects() {
    return [{ source: "/quality-gate", destination: "/recon", permanent: false }];
  },
};

export default nextConfig;
