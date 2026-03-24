"use client";

import { useState, useEffect, useCallback } from "react";
import PolicyCard from "@/components/PolicyCard";
import Image from "next/image";
import { Shield, RefreshCw, Info, AlertCircle } from "lucide-react";

interface Policy {
  id: string;
  title: string;
  platform: string;
  channel: "amazon" | "tiktok" | "general";
  date: string;
  summary: string;
  severity: "high" | "medium" | "low";
  countries: string[];
  source_url: string | null;
}

// 플랫폼 탭
const PLATFORM_TABS = ["전체", "Amazon", "TikTok"] as const;
type PlatformTab = (typeof PLATFORM_TABS)[number];

// 긴급도 필터
const SEVERITY_FILTERS = ["전체", "긴급", "동향"] as const;
type SeverityFilter = (typeof SEVERITY_FILTERS)[number];

const severityToValue: Record<SeverityFilter, string | null> = {
  전체: null,
  긴급: "high",
  동향: "medium",
};

const platformToChannel: Record<PlatformTab, string | null> = {
  전체: null,
  Amazon: "amazon",
  TikTok: "tiktok",
};

type SyncStatus = "idle" | "syncing" | "done" | "error";

const COLLECTION_SOURCES = [
  { href: "https://channelx.world/category/amazon", label: "ChannelX Amazon" },
  { href: "https://channelx.world/?s=tiktok+shop", label: "ChannelX TikTok Shop" },
  { href: "https://ecommercenews.eu", label: "Ecommerce News Europe" },
  { href: "https://internetretailing.net", label: "Internet Retailing UK" },
] as const;

export default function PolicyPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [activePlatform, setActivePlatform] = useState<PlatformTab>("전체");
  const [activeSeverity, setActiveSeverity] = useState<SeverityFilter>("전체");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("syncing");
  const [syncMessage, setSyncMessage] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [syncElapsedSec, setSyncElapsedSec] = useState(0);

  const handleSync = useCallback(async () => {
    setSyncStatus("syncing");
    setSyncMessage("");

    try {
      const res = await fetch("/api/policy/sync", { method: "POST" });
      const json = (await res.json()) as {
        total?: number;
        relevant?: number;
        policies?: Policy[];
        error?: string;
      };

      if (!res.ok) {
        setSyncStatus("error");
        setSyncMessage(json.error ?? "수집 실패");
        return;
      }

      setPolicies(json.policies ?? []);
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      setLastUpdatedAt(`${hh}:${mm}`);
      setSyncStatus("done");
      setSyncMessage("");
    } catch {
      setSyncStatus("error");
      setSyncMessage("네트워크 오류가 발생했습니다.");
    }
  }, []);

  useEffect(() => {
    void handleSync();
  }, [handleSync]);

  // 동기화 중 경과 초(리뷰 페이지 로딩 UI와 동일 패턴)
  useEffect(() => {
    if (syncStatus !== "syncing") return;
    setSyncElapsedSec(0);
    const id = window.setInterval(() => {
      setSyncElapsedSec((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [syncStatus]);

  // 플랫폼별 카운트 계산
  const countByPlatform = (tab: PlatformTab) => {
    const ch = platformToChannel[tab];
    return ch
      ? policies.filter((p) => p.channel === ch || (ch === "amazon" && p.channel === "general")).length
      : policies.length;
  };

  // 긴급도별 카운트 (현재 플랫폼 기준)
  const platformFiltered = policies.filter((p) => {
    const ch = platformToChannel[activePlatform];
    if (!ch) return true;
    if (ch === "amazon") return p.channel === "amazon" || p.channel === "general";
    return p.channel === ch;
  });

  const countBySeverity = (sf: SeverityFilter) => {
    const sv = severityToValue[sf];
    return sv ? platformFiltered.filter((p) => p.severity === sv).length : platformFiltered.length;
  };

  // 최종 필터 적용
  const filtered = platformFiltered.filter((p) => {
    const sv = severityToValue[activeSeverity];
    return sv === null || p.severity === sv;
  });

  return (
    <div className="bg-zinc-50">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* 헤더 — 랜딩 카드와 동일 Shield 아이콘(zinc-400·stroke 1.5) */}
      <div className="mb-8 rounded-[10px] border border-[#e5e7eb] bg-white p-8">
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2.5">
          <Shield
            className="col-start-1 row-span-3 h-7 w-7 shrink-0 self-start text-zinc-400"
            strokeWidth={1.5}
            aria-hidden
          />
          <h1 className="col-start-2 row-start-1 min-w-0 self-center text-lg font-bold leading-tight tracking-tight text-zinc-900 sm:text-xl">
            정책·뉴스 모니터링
          </h1>
          <p className="col-start-2 row-start-2 text-[15px] leading-relaxed text-[#666666]">
            아마존 유럽(UK+EU) · 틱톡샵 관련 정책·뉴스를 이커머스 전문 미디어에서 수집해 AI가
            요약합니다.
          </p>
          {/* 수집 소스 — 본문보다 한 단계 작은 글자 */}
          <div className="col-start-2 row-start-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs leading-relaxed text-[#757575]">
            <Info className="h-3 w-3 shrink-0 text-[#a3a3a3]" aria-hidden />
            <span>수집 소스 (4개):</span>
            {COLLECTION_SOURCES.map((src, i) => (
              <span key={src.href} className="inline-flex items-center gap-x-1.5">
                {i > 0 ? <span className="text-[#b8b8b8]">·</span> : null}
                <a
                  href={src.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#757575] underline-offset-2 hover:text-[#555555] hover:underline"
                >
                  {src.label}
                </a>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 수집 실패 시에만 배너 표시 */}
      {syncStatus === "error" && syncMessage !== "" && (
        <div className="mb-6 flex items-center gap-2 rounded-[10px] bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <p>{syncMessage}</p>
        </div>
      )}
      {lastUpdatedAt && syncStatus === "done" && (
        <p className="mb-6 text-xs text-gray-400">
          마지막 갱신 시각: {lastUpdatedAt}
        </p>
      )}

      {/* 1단 필터: 플랫폼 — 헤더 카드와 동일 톤의 심플 세그먼트 (아마존·틱톡 PNG 유지) */}
      <div className="mb-6 flex gap-1 rounded-[10px] border border-[#e5e7eb] bg-white p-1">
        {PLATFORM_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => {
              setActivePlatform(tab);
              setActiveSeverity("전체");
            }}
            className={`flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-[10px] px-2 py-2 text-sm transition-colors ${
              activePlatform === tab
                ? "bg-zinc-100 font-medium text-zinc-900"
                : "font-normal text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
            }`}
          >
            {tab === "Amazon" && (
              <Image
                src="/amazon.png"
                alt=""
                width={16}
                height={16}
                className="shrink-0 object-contain"
              />
            )}
            {tab === "TikTok" && (
              <Image
                src="/tiktok.png"
                alt=""
                width={16}
                height={16}
                className="shrink-0 object-contain"
              />
            )}
            <span className="truncate">{tab}</span>
            {policies.length > 0 && (
              <span className="tabular-nums text-xs text-zinc-400">
                {countByPlatform(tab)}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 2단 필터: 두 번째 목업 — 둥근 사각(10px)·얇은 테두리·약한 그림자 */}
      <div className="mb-6 flex flex-wrap gap-2.5">
        {SEVERITY_FILTERS.map((sf) => (
          <button
            key={sf}
            type="button"
            onClick={() => setActiveSeverity(sf)}
            className={`rounded-[10px] border bg-white px-5 py-2.5 text-sm font-medium transition-colors ${
              activeSeverity === sf
                ? "border-[#ea0029] text-[#ea0029]"
                : "border-gray-200 text-zinc-800 hover:border-gray-300 hover:bg-zinc-50"
            }`}
          >
            {sf}
            {policies.length > 0 ? ` (${countBySeverity(sf)})` : ""}
          </button>
        ))}
      </div>

      {/* 카드 목록 — 수집 중: apr_logo.svg 링 레드(#ea0029) 톤 스피너·진행 바 */}
      {syncStatus === "syncing" ? (
        <div className="flex flex-col items-center justify-center rounded-[10px] border border-zinc-200 bg-white px-6 py-20 text-center">
          <div
            className="mb-4 h-10 w-10 animate-spin rounded-full border-[3px] border-[#ea0029]/20 border-t-[#ea0029]"
            role="status"
            aria-label="뉴스 수집 중"
          />
          <p className="text-sm font-semibold text-zinc-800">
            정책·뉴스를 수집하고 있습니다…
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            실시간 수집 경과 {syncElapsedSec}초 · 약 30~60초 소요될 수 있습니다
          </p>
          <div className="mt-5 h-2 w-full max-w-xs overflow-hidden rounded-full bg-[#ea0029]/12">
            <div
              className="h-full rounded-full bg-[#ea0029] transition-[width] duration-500 ease-out"
              style={{
                width: `${Math.min(Math.round((syncElapsedSec / 55) * 100), 92)}%`,
              }}
            />
          </div>
        </div>
      ) : policies.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[10px] border border-dashed border-gray-200 bg-white py-20 text-center">
          <RefreshCw className="mb-3 h-8 w-8 text-gray-300" />
          <p className="mb-1 text-sm font-medium text-gray-500">
            수집된 뉴스가 없습니다
          </p>
          <p className="text-xs text-gray-400">
            페이지 진입 시 최신 뉴스를 자동 수집합니다. 잠시 후 다시 확인해 주세요.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filtered.map((policy) => (
            <PolicyCard key={policy.id} {...policy} />
          ))}
          {filtered.length === 0 && (
            <p className="col-span-2 py-10 text-center text-sm text-gray-400">
              해당 조건의 뉴스가 없습니다.
            </p>
          )}
        </div>
      )}
      </div>
    </div>
  );
}