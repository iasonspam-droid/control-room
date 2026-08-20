import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Prisma ships native query-engine binaries and resolves them by path at
   * runtime. Bundling the client rewrites those paths, so the engine is missing
   * in the deployed function and `new PrismaClient()` throws the moment it is
   * constructed — which reads as an opaque 500 with no outgoing request.
   */
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
};

export default nextConfig;
