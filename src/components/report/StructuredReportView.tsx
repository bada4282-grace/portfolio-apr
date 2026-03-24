"use client";

import type { NewsItem, ReportData } from "@/types/report";
import { PlatformBarChart } from "@/components/report/PlatformBarChart";

function TrendIcon({ dir }: { dir: "up" | "down" | "stable" }) {
  if (dir === "up")
    return <span className="text-[11px] font-semibold text-[#1a1a1a]">↑</span>;
  if (dir === "down")
    return <span className="text-[11px] font-semibold text-[#888888]">↓</span>;
  return <span className="text-[11px] font-semibold text-[#aaaaaa]">→</span>;
}

function Skeleton() {
  const widths = [80, 60, 90, 50, 70];
  return (
    <div className="flex flex-col gap-2.5 py-6">
      {widths.map((w, i) => (
        <div
          key={i}
          className="h-3 animate-pulse rounded-sm bg-gradient-to-r from-[#f4f1ee] via-[#e2ddd8] to-[#f4f1ee] bg-[length:200%_100%]"
          style={{ width: `${w}%`, animationDelay: `${i * 0.1}s` }}
        />
      ))}
    </div>
  );
}

function NewsTicker({ items }: { items: NewsItem[] }) {
  if (!items.length) return null;
  const text = items.map((n) => `${n.source.toUpperCase()} · ${n.title}`).join("    /    ");
  return (
    <div className="flex h-8 items-center overflow-hidden bg-[#1a1a1a] text-[10px] tracking-wide text-white/80">
      <span className="flex h-full shrink-0 items-center bg-[#c9a96e] px-3.5 text-[9px] font-medium tracking-[0.14em] text-[#1a1a1a]">
        LIVE
      </span>
      <div className="min-w-0 flex-1 overflow-hidden">
        <span
          className="inline-block whitespace-nowrap pl-2"
          style={{
            animation: "reportTicker 40s linear infinite",
          }}
        >
          {text}
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
          {text}
        </span>
      </div>
      <style>{`
        @keyframes reportTicker {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

export function StructuredReportSkeleton() {
  return (
    <div className="border border-[#e2ddd8] bg-[#fafaf8] px-6 py-10">
      <p className="mb-4 text-[10px] uppercase tracking-[0.18em] text-[#b5ada4]">
        Generating Report
      </p>
      <Skeleton />
    </div>
  );
}

export function StructuredReportView({
  report,
  locale = "ko",
}: {
  report: ReportData;
  locale?: "ko" | "en";
}) {
  const isEn = locale === "en";
  const dateStr = new Date(report.generatedAt).toLocaleString(
    isEn ? "en-GB" : "ko-KR",
    {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );

  return (
    <div className="border border-[#e2ddd8] bg-[#fafaf8] text-[#2c2825]">
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-[#e2ddd8] bg-[#fafaf8] px-6 sm:px-12">
        <span className="font-serif text-lg font-normal uppercase tracking-[0.18em] text-[#1a1a1a]">
          Platform Report
        </span>
        <span className="text-[10px] uppercase tracking-[0.12em] text-[#b5ada4]">
          K-Beauty Intelligence
        </span>
      </header>

      <main className="mx-auto max-w-[960px] px-5 py-12 pb-24 sm:px-6">
        <article id="structured-report-anchor">
          <div className="mb-14 border-b border-[#1a1a1a] pb-8">
            <div className="mb-5 flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-[0.18em] text-[#b5ada4]">
              <span>Platform Trend Report</span>
              <span className="h-1 w-1 shrink-0 rounded-full bg-[#c9a96e]" />
              <span>K-Beauty</span>
              <span className="h-1 w-1 shrink-0 rounded-full bg-[#c9a96e]" />
              <span>AI Generated</span>
            </div>
            <h2 className="font-serif text-3xl font-light leading-tight text-[#1a1a1a] sm:text-4xl md:text-5xl">
              {report.topic}
            </h2>
            <p className="mt-3 text-[11px] tracking-wide text-[#b5ada4]">
              {isEn ? `Generated: ${dateStr}` : `${dateStr} 기준 생성`}
            </p>
          </div>

          <div className="mb-14 border-l-2 border-[#1a1a1a] py-2 pl-6">
            <p className="font-serif text-lg font-light italic leading-relaxed text-[#1a1a1a] sm:text-xl">
              &ldquo;{report.insightQuote}&rdquo;
            </p>
          </div>

          <section className="mb-16">
            <div className="mb-7 flex items-baseline gap-4 border-b border-[#e2ddd8] pb-3">
              <span className="font-serif text-[10px] text-[#b5ada4]">01</span>
              <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#1a1a1a]">
                Executive Summary
              </span>
            </div>
            <p className="mb-7 text-[15px] font-light leading-[1.9]">{report.executiveSummary}</p>
            <ul className="flex flex-col">
              {report.keyFindings.map((f, i) => (
                <li
                  key={i}
                  className="flex gap-4 border-b border-[#f4f1ee] py-3.5 text-[13px] leading-relaxed"
                >
                  <span className="w-5 shrink-0 font-serif text-[11px] text-[#b5ada4]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mb-16">
            <div className="mb-7 flex items-baseline gap-4 border-b border-[#e2ddd8] pb-3">
              <span className="font-serif text-[10px] text-[#b5ada4]">02</span>
              <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#1a1a1a]">
                {isEn ? "Market trends" : "시장 트렌드"}
              </span>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-px border border-[#e2ddd8] bg-[#e2ddd8]">
              {report.trends.map((t, i) => (
                <div key={i} className="bg-[#fafaf8] p-5">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium tracking-wide text-[#1a1a1a]">
                      {t.keyword}
                    </span>
                    <TrendIcon dir={t.direction} />
                  </div>
                  <p className="text-[11px] leading-snug text-[#b5ada4]">{t.insight}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mb-16">
            <div className="mb-7 flex items-baseline gap-4 border-b border-[#e2ddd8] pb-3">
              <span className="font-serif text-[10px] text-[#b5ada4]">03</span>
              <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#1a1a1a]">
                {isEn ? "Key players" : "주요 플레이어"}
              </span>
            </div>
            <div className="flex flex-col">
              {report.players.map((p, i) => (
                <div
                  key={i}
                  className="grid grid-cols-1 gap-2 border-b border-[#f4f1ee] py-4 sm:grid-cols-[160px_1fr_1fr] sm:gap-6"
                >
                  <span className="text-[13px] font-medium text-[#1a1a1a]">{p.name}</span>
                  <span className="text-xs leading-relaxed text-[#2c2825]">{p.movement}</span>
                  <span className="hidden text-[11px] leading-relaxed text-[#b5ada4] sm:block">
                    {p.significance}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="mb-16">
            <div className="mb-7 flex items-baseline gap-4 border-b border-[#e2ddd8] pb-3">
              <span className="font-serif text-[10px] text-[#b5ada4]">04</span>
              <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#1a1a1a]">
                {isEn ? "Data visualization" : "데이터 시각화"}
              </span>
            </div>
            <PlatformBarChart data={report.chartData} title={report.chartTitle} />
          </section>

          <section className="mb-16">
            <div className="mb-7 flex items-baseline gap-4 border-b border-[#e2ddd8] pb-3">
              <span className="font-serif text-[10px] text-[#b5ada4]">05</span>
              <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#1a1a1a]">
                {isEn ? "Outlook & insights" : "전망 및 인사이트"}
              </span>
            </div>
            <p className="text-sm font-light leading-[1.9]">{report.outlook}</p>
          </section>

          {report.newsItems.length > 0 ? (
            <section className="mb-16">
              <div className="mb-7 flex items-baseline gap-4 border-b border-[#e2ddd8] pb-3">
                <span className="font-serif text-[10px] text-[#b5ada4]">06</span>
                <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#1a1a1a]">
                  {isEn ? "Latest news" : "최신 뉴스"}
                </span>
              </div>
              <div className="flex flex-col">
                {report.newsItems.map((n, i) => (
                  <div
                    key={i}
                    className="flex flex-col gap-1 border-b border-[#f4f1ee] py-4 sm:flex-row sm:items-baseline sm:gap-5"
                  >
                    <span className="w-20 shrink-0 text-[9px] font-medium uppercase tracking-[0.12em] text-[#b5ada4]">
                      {n.source}
                    </span>
                    <span className="min-w-0 flex-1 text-[13px] leading-snug">
                      {n.link && n.link !== "#" ? (
                        <a
                          href={n.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-inherit hover:text-[#1a1a1a]"
                        >
                          {n.title}
                        </a>
                      ) : (
                        n.title
                      )}
                    </span>
                    <span className="shrink-0 whitespace-nowrap text-[10px] text-[#b5ada4]">
                      {n.pubDate}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <footer className="mt-16 flex flex-wrap items-center justify-between gap-3 border-t border-[#e2ddd8] pt-6">
            <span className="font-serif text-[13px] tracking-wide text-[#b5ada4]">
              Platform Report · K-Beauty
            </span>
            <span className="text-[10px] tracking-wide text-[#b5ada4]">
              {isEn ? "This report was generated by AI." : "본 리포트는 AI에 의해 자동 생성되었습니다"}
            </span>
          </footer>
        </article>
      </main>
    </div>
  );
}
