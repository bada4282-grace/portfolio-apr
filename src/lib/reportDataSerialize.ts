import type { ReportData } from "@/types/report";

/** 기존 PDF 라우트(@react-pdf)용 평문 직렬화 */
export function reportDataToPlainText(d: ReportData): string {
  const blocks: string[] = [];
  blocks.push(d.topic);
  blocks.push(`생성 시각: ${d.generatedAt}`);
  blocks.push("");
  blocks.push(`인사이트: ${d.insightQuote}`);
  blocks.push("");
  blocks.push("— Executive Summary —");
  blocks.push(d.executiveSummary);
  blocks.push("");
  blocks.push("— 핵심 발견 —");
  d.keyFindings.forEach((f, i) => blocks.push(`${i + 1}. ${f}`));
  blocks.push("");
  blocks.push("— 시장 트렌드 —");
  d.trends.forEach((t) =>
    blocks.push(`· ${t.keyword} [${t.direction}] ${t.insight}`)
  );
  blocks.push("");
  blocks.push("— 주요 플레이어 —");
  d.players.forEach((p) =>
    blocks.push(`· ${p.name} — ${p.movement} (${p.significance})`)
  );
  blocks.push("");
  blocks.push(`— ${d.chartTitle} —`);
  d.chartData.forEach((c) =>
    blocks.push(`· ${c.label}: ${c.value}${c.note ? ` (${c.note})` : ""}`)
  );
  blocks.push("");
  blocks.push("— 전망 —");
  blocks.push(d.outlook);
  blocks.push("");
  blocks.push("— 최신 뉴스 —");
  d.newsItems.forEach((n) => {
    blocks.push(`[${n.source}] ${n.title} (${n.pubDate})`);
    if (n.summary) blocks.push(n.summary);
    if (n.link && n.link !== "#") blocks.push(n.link);
  });
  return blocks.join("\n");
}
