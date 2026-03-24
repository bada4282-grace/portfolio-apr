import type { NextConfig } from "next";

// apify-client·franc 등은 동적 require를 사용해 Turbopack 번들 시 "expression is too dynamic" 오류가 남 → 서버에서 node_modules 그대로 로드
const nextConfig: NextConfig = {
  // apify-client가 동적 require("proxy-agent") — API 라우트 번들에 포함되지 않게 외부 패키지로 둠
  // proxy-agent는 클라이언트(apify.ts 공유 import)에 끌리면 dns/fs 등으로 빌드 실패하므로 여기만 외부화
  serverExternalPackages: ["apify-client", "franc", "proxy-agent"],
};

export default nextConfig;
