import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Production is hosted at the root of https://match.ecnumc.cn/.
  // Keep basePath / assetPrefix unset for the dedicated subdomain deployment.
  output: "export",
  trailingSlash: true,
};

export default nextConfig;
