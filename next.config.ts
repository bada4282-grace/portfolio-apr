import type { NextConfig } from "next";

// franc는 동적 require로 Turbopack 번들 시 오류가 날 수 있어 서버에서 node_modules 그대로 로드
const nextConfig: NextConfig = {
  serverExternalPackages: ["franc"],
};

export default nextConfig;
