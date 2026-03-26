import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "리포트 인쇄 · APR",
  robots: { index: false, follow: false },
};

export default function ReportPrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
