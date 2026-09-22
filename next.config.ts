import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["argon2", "exceljs", "bullmq", "ioredis"],
};

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV !== "production",
});

export default process.env.NODE_ENV === "production" ? withSerwist(nextConfig) : nextConfig;
