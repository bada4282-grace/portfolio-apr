import type { NextConfig } from "next";

// apify-client·franc 등은 동적 require를 사용해 Turbopack 번들 시 "expression is too dynamic" 오류가 남 → 서버에서 node_modules 그대로 로드
const nextConfig: NextConfig = {
  // apify-client/proxy-agent 계열은 동적 require 체인이 있어 서버에서 node_modules를 그대로 참조하도록 외부화
  serverExternalPackages: [
    "apify-client",
    "franc",
    "proxy-agent",
    "proxy-from-env",
    "http-proxy-agent",
    "https-proxy-agent",
    "pac-proxy-agent",
    "socks-proxy-agent",
    "pac-resolver",
    "agent-base",
  ],
};

export default nextConfig;
