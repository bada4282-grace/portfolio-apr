import type { PolicyItem } from "@/lib/policySyncRun";

/** 리포트 프롬프트용 정책 블록 */
export function formatPoliciesForPrompt(
  policies: PolicyItem[],
  totalFetched: number,
  maxItems = 20
): string {
  const slice = policies.slice(0, maxItems);
  const lines = [
    `[정책·뉴스] RSS 처리 ${totalFetched}건 중 관련 ${policies.length}건 (아래는 한국어 제목·요약)`,
    ...slice.map(
      (p, i) =>
        `${i + 1}. [${p.severity}/${p.channel}] ${p.title} (${p.date}, ${p.countries.join(",") || "국가미상"})\n   ${p.summary.slice(0, 450)}${p.summary.length > 450 ? "…" : ""}`
    ),
  ];
  return lines.join("\n");
}
