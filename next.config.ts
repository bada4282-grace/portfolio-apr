import type { NextConfig } from "next";

// apify-client·franc 등은 동적 require를 사용해 Turbopack 번들 시 "expression is too dynamic" 오류가 남 → 서버에서 node_modules 그대로 로드
const nextConfig: NextConfig = {
  serverExternalPackages: ["apify-client", "franc"],
};

export default nextConfig;
