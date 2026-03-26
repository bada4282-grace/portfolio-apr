"use client";

import { usePathname } from "next/navigation";
import Navbar from "@/components/Navbar";

/** 인쇄 전용 라우트(/report/print)에서는 네비·여백 없이 본문만 렌더 (확장 오버레이 최소화) */
export function LayoutChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const printOnly = pathname === "/report/print";

  return (
    <>
      {!printOnly ? <Navbar /> : null}
      <main className={printOnly ? "min-h-0 flex-1 p-0" : "flex-1"}>{children}</main>
    </>
  );
}
