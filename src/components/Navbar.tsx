"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield, BarChart3, FileText, LayoutDashboard } from "lucide-react";

const navItems = [
  { href: "/", label: "대시보드", icon: LayoutDashboard },
  { href: "/policy", label: "정책 알림", icon: Shield },
  { href: "/reviews", label: "리뷰 분석", icon: BarChart3 },
  { href: "/report", label: "AI 리포트", icon: FileText },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* 로고 */}
        <Link href="/" className="flex items-center gap-2">
          {/* APR 로고(SVG) */}
          <span className="relative h-5 w-[3rem] shrink-0 sm:h-6 sm:w-[3.5rem]">
            <Image
              src="/apr_logo.svg"
              alt="APR 로고"
              fill
              className="object-contain object-left"
              sizes="(max-width: 640px) 48px, 56px"
              priority
            />
          </span>
          <span className="hidden text-sm font-semibold text-zinc-700 sm:inline">
            인텔리전스 대시보드
          </span>
        </Link>

        {/* 내비게이션 */}
        <nav className="flex items-center gap-0.5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                  isActive
                    ? "bg-zinc-100 font-medium text-zinc-900"
                    : "font-normal text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
                }`}
              >
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}