import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Navbar from "@/components/Navbar";
import "./globals.css";
import faviconPng from "./favicon.png";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "APR Intelligence Dashboard",
  description:
    "글로벌 이커머스 이슈 대응 모니터링 · 리뷰 분석 · AI 리포트",
  icons: {
    icon: [{ url: faviconPng.src, type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-white">
        <Navbar />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}