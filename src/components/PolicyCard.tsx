"use client";

import { Package, ShoppingBag, Globe, ChevronRight } from "lucide-react";

type Severity = "high" | "medium" | "low";

const COUNTRY_DISPLAY: Record<string, { flag: string; label: string }> = {
  UK: { flag: "\uD83C\uDDEC\uD83C\uDDE7", label: "UK" },
  DE: { flag: "\uD83C\uDDE9\uD83C\uDDEA", label: "DE" },
  FR: { flag: "\uD83C\uDDEB\uD83C\uDDF7", label: "FR" },
  IT: { flag: "\uD83C\uDDEE\uD83C\uDDF9", label: "IT" },
  ES: { flag: "\uD83C\uDDEA\uD83C\uDDF8", label: "ES" },
  NL: { flag: "\uD83C\uDDF3\uD83C\uDDF1", label: "NL" },
};

interface PolicyCardProps {
  title: string;
  platform: string;
  channel?: "amazon" | "tiktok" | "general";
  date: string;
  summary: string;
  severity: Severity;
  countries: string[];
  source_url?: string | null;
}

/** 첫 번째 목업: 헤더 줄의 플랫폼 아이콘·표기 */
const CHANNEL_HEADER: Record<
  "amazon" | "tiktok" | "general",
  { Icon: typeof Package; label: string }
> = {
  amazon: { Icon: Package, label: "Amazon" },
  tiktok: { Icon: ShoppingBag, label: "TikTok" },
  general: { Icon: Globe, label: "General" },
};

const severityLabel: Record<Severity, string> = {
  high: "\uAE34\uAE09",
  medium: "\uB3D9\uD5A5",
  low: "\uCC38\uACE0",
};

export default function PolicyCard({
  title,
  platform,
  channel,
  date,
  summary,
  severity,
  countries,
  source_url,
}: PolicyCardProps) {
  const ch = channel ?? "general";
  const { Icon: ChannelIcon, label: channelName } = CHANNEL_HEADER[ch];

  const isUrgent = severity === "high";

  return (
    <div
      className={`rounded-[10px] border p-5 transition-shadow hover:shadow-sm ${
        isUrgent
          ? /* 긴급: 얇은 레드 테두리 + 아주 연한 붉은 배경으로 카드 전체를 살짝 띄움 */
            "border-[#ea0029] bg-red-50/45"
          : "border-[#e5e7eb] bg-white"
      }`}
    >
      {/* 상단: 긴급은 배지·레드 / 그 외는 회색 메타 */}
      <div className="mb-4 flex items-center justify-between gap-3 text-sm text-gray-400">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {isUrgent ? (
            <span className="shrink-0 rounded-md bg-[#ea0029]/12 px-2 py-0.5 text-xs font-semibold text-[#ea0029]">
              {severityLabel.high}
            </span>
          ) : (
            <span>{severityLabel[severity]}</span>
          )}
          <span className="text-gray-300">·</span>
          <ChannelIcon className="h-4 w-4 shrink-0 stroke-[1.5] text-gray-400" aria-hidden />
          <span>{channelName}</span>
        </div>
        <span className="shrink-0 text-xs text-gray-400">{date}</span>
      </div>

      <h3 className="mb-1.5 text-lg font-bold leading-snug tracking-tight text-zinc-900">
        {title}
      </h3>
      <p className="mb-3 text-sm text-sky-800/80">{platform}</p>
      <p className="mb-5 text-sm leading-relaxed text-gray-600">{summary}</p>

      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {countries.map((code) => {
            const c = COUNTRY_DISPLAY[code];
            return (
              <span
                key={code}
                className="rounded-md border border-gray-200 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-gray-700"
              >
                {c ? `${c.flag} ${c.label}` : code}
              </span>
            );
          })}
        </div>

        {source_url ? (
          <a
            href={source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex shrink-0 items-center gap-0.5 text-sm font-medium text-[#1e40af] transition-colors hover:text-[#1e3a8a] hover:underline"
          >
            원문 보기
            <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
          </a>
        ) : null}
      </div>
    </div>
  );
}
