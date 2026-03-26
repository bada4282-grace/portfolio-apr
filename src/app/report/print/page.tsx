"use client";

import { useEffect, useRef, useState } from "react";
import { StructuredReportView } from "@/components/report/StructuredReportView";
import type { ReportData } from "@/types/report";
import "./print-only.css";

const STORAGE_REPORT = "structuredReportForPrint";
const STORAGE_LOCALE = "structuredReportPrintLocale";

type UiLocale = "ko" | "en";

/** 리포트 PDF만 인쇄하는 전용 탭 (확장·데스크톱 오버레이 최소화) */
export default function ReportPrintPage() {
  const [report, setReport] = useState<ReportData | null | undefined>(undefined);
  const [locale, setLocale] = useState<UiLocale>("ko");
  const printOnceRef = useRef(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_REPORT);
      const loc = sessionStorage.getItem(STORAGE_LOCALE);
      if (!raw) {
        setReport(null);
        return;
      }
      setReport(JSON.parse(raw) as ReportData);
      setLocale(loc === "en" ? "en" : "ko");
    } catch {
      setReport(null);
    }
  }, []);

  useEffect(() => {
    if (report === undefined || report === null) return;
    if (printOnceRef.current) return;
    printOnceRef.current = true;
    const t = window.setTimeout(() => {
      window.print();
    }, 450);
    return () => window.clearTimeout(t);
  }, [report]);

  useEffect(() => {
    const onAfterPrint = () => {
      try {
        sessionStorage.removeItem(STORAGE_REPORT);
        sessionStorage.removeItem(STORAGE_LOCALE);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("afterprint", onAfterPrint);
    return () => window.removeEventListener("afterprint", onAfterPrint);
  }, []);

  if (report === undefined) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center bg-zinc-50 text-sm text-zinc-500">
        불러오는 중…
      </div>
    );
  }

  if (report === null) {
    const loc =
      typeof window !== "undefined" &&
      sessionStorage.getItem(STORAGE_LOCALE) === "en"
        ? "en"
        : "ko";
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 bg-zinc-50 px-4 text-center text-sm text-zinc-600">
        <p>
          {loc === "en"
            ? "No report data to print."
            : "인쇄할 리포트 데이터가 없습니다."}
        </p>
        <p className="text-xs text-zinc-500">
          {loc === "en"
            ? "Generate a report on AI Report, then click «PDF download»."
            : "AI 리포트에서 리포트를 생성한 뒤 «PDF 다운로드»를 눌러 주세요."}
        </p>
      </div>
    );
  }

  return (
    <div id="printable-structured-report" className="print:bg-white">
      <StructuredReportView report={report} locale={locale} />
    </div>
  );
}
