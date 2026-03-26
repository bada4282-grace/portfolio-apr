"use client";

import { useState, useCallback, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  FileText,
  Send,
  Loader2,
  User,
  Bot,
  ChevronLeft,
  Mail,
  LayoutList,
  Download,
} from "lucide-react";
import { EmailDraftComposer } from "@/components/EmailDraftComposer";
import {
  StructuredReportView,
  StructuredReportSkeleton,
} from "@/components/report/StructuredReportView";
import type { ReportData } from "@/types/report";

type FlowKind = "pick" | "email" | "report";
type UiLocale = "ko" | "en";

const langBadge: Record<string, string> = {
  KR: "bg-[#ea0029]/10 text-[#ea0029]",
  EN: "bg-zinc-100 text-zinc-600",
};

export default function ReportPage() {
  const [flow, setFlow] = useState<FlowKind>("pick");
  const [locale, setLocale] = useState<UiLocale>("ko");
  const [input, setInput] = useState(
    "아마존 프랑스·영국 채널 VOC와 최근 정책 뉴스를 반영한 운영 브리핑을 요약해줘."
  );

  const [structuredReport, setStructuredReport] = useState<ReportData | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [structuredMeta, setStructuredMeta] = useState<{
    reviewsOk: boolean;
    reviewTotal: number;
    policyItemsUsed: number;
    skippedPolicySync: boolean;
  } | null>(null);
  const [skipPolicySync, setSkipPolicySync] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat/report" }),
  });

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    setStructuredReport(null);
    setStructuredMeta(null);
    setReportError(null);
  }, [locale]);

  useEffect(() => {
    if (!structuredReport) return;
    const id = requestAnimationFrame(() => {
      document.getElementById("structured-report-anchor")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
    return () => cancelAnimationFrame(id);
  }, [structuredReport]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const text = input;
    setInput("");
    sendMessage({ text });
  };

  const generateStructured = useCallback(async () => {
    setReportError(null);
    setReportLoading(true);
    setStructuredReport(null);
    setStructuredMeta(null);
    try {
      const res = await fetch("/api/report/structured", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale, skipPolicySync }),
      });
      const json = (await res.json()) as {
        report?: ReportData;
        error?: string;
        meta?: {
          reviewsOk: boolean;
          reviewTotal: number;
          policyItemsUsed: number;
          skippedPolicySync: boolean;
        };
      };
      if (!res.ok) {
        throw new Error(json.error ?? `요청 실패 (${res.status})`);
      }
      if (!json.report) {
        throw new Error("응답 형식이 올바르지 않습니다.");
      }
      setStructuredReport(json.report);
      setStructuredMeta(json.meta ?? null);
    } catch (e) {
      setStructuredReport(null);
      setStructuredMeta(null);
      setReportError(e instanceof Error ? e.message : "리포트 생성 실패");
    } finally {
      setReportLoading(false);
    }
  }, [locale, skipPolicySync]);

  const handleDownloadStructuredPdf = useCallback(() => {
    if (!structuredReport) return;
    setReportError(null);
    setPdfLoading(true);

    const onAfterPrint = () => {
      setPdfLoading(false);
      window.removeEventListener("afterprint", onAfterPrint);
    };

    window.addEventListener("afterprint", onAfterPrint);
    window.print();
  }, [structuredReport]);

  const goPick = () => {
    setFlow("pick");
    setStructuredReport(null);
    setStructuredMeta(null);
    setReportError(null);
  };

  const isKo = locale === "ko";

  return (
    <div className="bg-zinc-50">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="report-no-print mb-8 rounded-[10px] border border-[#e5e7eb] bg-white p-8">
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2.5">
            <FileText
              className="col-start-1 row-span-2 h-6 w-6 shrink-0 self-start text-zinc-400"
              strokeWidth={1.5}
              aria-hidden
            />
            <h1 className="col-start-2 row-start-1 min-w-0 self-center text-lg font-bold leading-tight tracking-tight text-zinc-900 sm:text-xl">
              AI 리포트
            </h1>
            <p className="col-start-2 row-start-2 text-[15px] leading-relaxed text-[#666666]">
              {isKo
                ? "플랫폼 동향 메일 초안 또는 리포트를 고른 뒤, 한국어/영어를 선택하세요."
                : "Choose platform trends email draft or report, then select Korean or English."}
            </p>
          </div>
        </div>

        {flow === "pick" ? (
          <div className="report-no-print mb-10 grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setFlow("email")}
              className="group flex flex-col items-start gap-4 rounded-[10px] border border-[#e5e7eb] bg-white p-8 text-left transition-colors hover:border-zinc-300 hover:bg-zinc-50/80"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-[10px] bg-[#ea0029]/10 text-[#ea0029]">
                <Mail className="h-6 w-6" strokeWidth={1.5} aria-hidden />
              </div>
              <div>
                <h2 className="text-lg font-bold text-zinc-900">플랫폼 동향 메일 초안</h2>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                  RSS 정책·뉴스와 리뷰를 반영해 제목·본문 초안을 채웁니다. 수신 이메일을 입력하고 발송합니다.
                </p>
              </div>
              <span className="text-sm font-medium text-[#ea0029] group-hover:underline">
                시작하기 →
              </span>
            </button>
            <button
              type="button"
              onClick={() => setFlow("report")}
              className="group flex flex-col items-start gap-4 rounded-[10px] border border-[#e5e7eb] bg-white p-8 text-left transition-colors hover:border-zinc-300 hover:bg-zinc-50/80"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-[10px] bg-zinc-100 text-zinc-700">
                <LayoutList className="h-6 w-6" strokeWidth={1.5} aria-hidden />
              </div>
              <div>
                <h2 className="text-lg font-bold text-zinc-900">플랫폼 동향 리포트</h2>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                  AI가 Executive Summary, 트렌드, 플레이어, 차트, 뉴스 목록이 담긴 리포트 화면을 생성합니다. PDF로
                  저장할 수 있습니다.
                </p>
              </div>
              <span className="text-sm font-medium text-zinc-700 group-hover:underline">
                시작하기 →
              </span>
            </button>
          </div>
        ) : (
          <div className="mb-8 space-y-6">
            <div className="report-no-print space-y-6">
              <button
                type="button"
                onClick={goPick}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
                {isKo ? "유형 다시 선택" : "Change workflow"}
              </button>

              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium text-zinc-700">{isKo ? "언어" : "Language"}</span>
                <div className="flex rounded-full border border-[#e5e7eb] bg-white p-1">
                  <button
                    type="button"
                    onClick={() => setLocale("ko")}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                      locale === "ko"
                        ? "bg-[#ea0029] text-white"
                        : "text-zinc-600 hover:bg-zinc-50"
                    }`}
                  >
                    한국어
                  </button>
                  <button
                    type="button"
                    onClick={() => setLocale("en")}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                      locale === "en"
                        ? "bg-zinc-900 text-white"
                        : "text-zinc-600 hover:bg-zinc-50"
                    }`}
                  >
                    English
                  </button>
                </div>
              </div>
            </div>

            {flow === "email" ? (
              <div className="report-no-print">
                <EmailDraftComposer key={`draft-${locale}`} locale={locale} />
              </div>
            ) : (
              <>
                <div className="report-no-print space-y-4">
                  <div className="rounded-[10px] border border-[#e5e7eb] bg-white p-4">
                  <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                    <p className="text-sm font-medium text-zinc-800">
                      {isKo
                        ? "정책 뉴스 RSS로 구조화 리포트를 생성합니다."
                        : "Generates structured reports from policy news RSS."}
                    </p>
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-600">
                      <input
                        type="checkbox"
                        checked={skipPolicySync}
                        onChange={(e) => setSkipPolicySync(e.target.checked)}
                        className="rounded border-zinc-300 text-[#ea0029] focus:ring-[#ea0029]"
                      />
                      {isKo ? "정책·뉴스 수집 생략 (더 빠름)" : "Skip policy/RSS (faster)"}
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void generateStructured()}
                      disabled={reportLoading}
                      className="inline-flex items-center gap-2 rounded-[10px] bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:bg-zinc-300"
                    >
                      {reportLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : null}
                      {reportLoading
                        ? isKo
                          ? "생성 중…"
                          : "Generating…"
                        : isKo
                          ? "리포트 생성"
                          : "Generate report"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDownloadStructuredPdf()}
                      disabled={!structuredReport || pdfLoading}
                      className="inline-flex items-center gap-2 rounded-[10px] border border-[#e5e7eb] bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
                    >
                      {pdfLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <Download className="h-4 w-4" aria-hidden />
                      )}
                      PDF 다운로드
                    </button>
                  </div>
                  <p className="report-no-print mt-2 text-xs text-zinc-500">
                    {isKo
                      ? "PDF 저장 시 «머리글/바닥글» 끄기, «배율»은 100%·«여백» 최소로 설정 — 화면 미리보기와 같은 비율로 인쇄됩니다."
                      : "When saving to PDF, turn off «Headers and footers», set «Scale» to 100% and «Margins» to minimum — print matches the on-screen preview ratio."}
                  </p>
                  {reportError ? (
                    <p className="mt-3 text-sm text-red-600">{reportError}</p>
                  ) : null}
                  {structuredMeta ? (
                    <p className="mt-2 text-xs text-zinc-500">
                      {isKo ? "근거 데이터" : "Data"}:{" "}
                      {structuredMeta.reviewsOk
                        ? `${isKo ? "리뷰" : "Reviews"} ${structuredMeta.reviewTotal}`
                        : isKo
                          ? "리뷰 조회 실패"
                          : "Reviews failed"}{" "}
                      · {isKo ? "정책 항목" : "Policy items"}{" "}
                      {structuredMeta.skippedPolicySync
                        ? isKo
                          ? "(생략됨)"
                          : "(skipped)"
                        : structuredMeta.policyItemsUsed}
                    </p>
                  ) : null}
                  </div>

                  {reportLoading ? <StructuredReportSkeleton /> : null}
                </div>

                {structuredReport ? (
                  <div
                    id="printable-structured-report"
                    className="rounded-[10px] py-2 print:rounded-none print:py-0"
                  >
                    <StructuredReportView report={structuredReport} locale={locale} />
                  </div>
                ) : null}
              </>
            )}
          </div>
        )}

        <details className="report-no-print mb-6 rounded-[10px] border border-[#e5e7eb] bg-white">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-zinc-800">
            {isKo ? "채팅으로 추가 질문 (선택) — 리뷰·정책 도구 연동" : "Optional chat — review & policy tools"}
          </summary>
          <div className="border-t border-zinc-100 px-4 pb-4 pt-2">
            <div className="mb-4 min-h-[280px] max-h-[480px] overflow-y-auto rounded-[10px] border border-zinc-100 bg-zinc-50/50">
              {messages.length === 0 ? (
                <div className="flex h-[280px] flex-col items-center justify-center px-4 text-center text-sm text-zinc-500">
                  <Bot className="mb-3 h-8 w-8 text-zinc-400" strokeWidth={1.5} aria-hidden />
                  {isKo
                    ? "도구로 리뷰·정책을 조회한 뒤 답합니다."
                    : "The assistant may call review/policy tools before answering."}
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <span
                      className={`rounded-full border border-[#e5e7eb] px-3 py-1 text-xs font-medium ${langBadge["KR"]}`}
                    >
                      한국어
                    </span>
                    <span
                      className={`rounded-full border border-[#e5e7eb] px-3 py-1 text-xs font-medium ${langBadge["EN"]}`}
                    >
                      English
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-1 p-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex gap-3 rounded-[10px] p-3 ${
                        message.role === "user" ? "bg-white" : "bg-zinc-50"
                      }`}
                    >
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          message.role === "user"
                            ? "bg-zinc-200 text-zinc-700"
                            : "bg-zinc-900 text-white"
                        }`}
                      >
                        {message.role === "user" ? (
                          <User className="h-4 w-4" aria-hidden />
                        ) : (
                          <Bot className="h-4 w-4" aria-hidden />
                        )}
                      </div>
                      <div className="flex-1 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">
                        {message.parts.map((part, i) => {
                          if (part.type === "text") {
                            return <span key={i}>{part.text}</span>;
                          }
                          return null;
                        })}
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex items-center gap-2 px-2 py-2 text-sm text-zinc-500">
                      <Loader2 className="h-4 w-4 animate-spin text-zinc-400" aria-hidden />
                      …
                    </div>
                  )}
                </div>
              )}
            </div>
            <form onSubmit={handleSubmit} className="relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  isKo
                    ? "리포트 관련 질문을 입력하세요…"
                    : "Ask about reviews, policy, or reports…"
                }
                rows={3}
                className="w-full resize-none rounded-[10px] border border-[#e5e7eb] bg-white px-4 py-3 pr-14 text-sm text-zinc-800 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="absolute right-3 bottom-3 flex h-9 w-9 items-center justify-center rounded-lg bg-[#ea0029] text-white transition-colors hover:bg-[#c90022] disabled:bg-zinc-200 disabled:text-zinc-400"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Send className="h-4 w-4" aria-hidden />
                )}
              </button>
            </form>
          </div>
        </details>
      </div>

      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm;
          }
          html,
          body {
            background: #fff !important;
            height: auto !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          /* body 다음 형제로 붙는 확장 UI(제미나이 FAB 등). head는 건드리지 않음 */
          body ~ * {
            display: none !important;
          }
          body > *:not(main) {
            display: none !important;
          }
          /*
            main 내부에 주입된 고정 오버레이는 visibility로 차단.
            자손은 부모가 hidden이어도 visible 지정 가능 → 리포트 블록만 표시.
          */
          main * {
            visibility: hidden !important;
          }
          #printable-structured-report,
          #printable-structured-report * {
            visibility: visible !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            background: #fff !important;
          }
          .report-no-print {
            display: none !important;
          }
          .bg-zinc-50 {
            background: #fff !important;
            padding-top: 0 !important;
            padding-bottom: 0 !important;
          }
          .mx-auto.max-w-7xl {
            max-width: none !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
          }
          #printable-structured-report {
            position: static !important;
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
}
