import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { z } from "zod";
import { openai } from "@/lib/openai";
import {
  fetchReviewsSnapshotForReport,
  formatReviewsSnapshotForPrompt,
} from "@/lib/reportSnapshot";
import { runPolicySyncPipeline } from "@/lib/policySyncRun";
import { formatPoliciesForPrompt } from "@/lib/formatPolicyContext";
import type { PolicyItem } from "@/lib/policySyncRun";
import type { ChartDataPoint, NewsItem, ReportData } from "@/types/report";
import type { ReviewsSnapshot } from "@/lib/reportSnapshot";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const AiCoreSchema = z.object({
  topic: z.string(),
  executiveSummary: z.string(),
  keyFindings: z.array(z.string()).min(2).max(10),
  trends: z
    .array(
      z.object({
        keyword: z.string(),
        direction: z.enum(["up", "down", "stable"]),
        insight: z.string(),
      })
    )
    .min(2)
    .max(12),
  players: z
    .array(
      z.object({
        name: z.string(),
        movement: z.string(),
        significance: z.string(),
      })
    )
    .min(2)
    .max(10),
  chartTitle: z.string(),
  outlook: z.string(),
  insightQuote: z.string(),
});

interface Body {
  locale?: string;
  skipPolicySync?: boolean;
}

function buildChartData(rev: ReviewsSnapshot): ChartDataPoint[] {
  if (!rev.ok) {
    return [{ label: "리뷰 데이터", value: 0, note: rev.error }];
  }
  return rev.chartData.map((c) => ({
    label: c.country,
    value: c.positive + c.neutral + c.negative,
    note: `긍정 ${c.positive} · 중립 ${c.neutral} · 부정 ${c.negative}`,
  }));
}

function policiesToNewsItems(
  policies: PolicyItem[],
  locale: "ko" | "en"
): NewsItem[] {
  return policies.slice(0, 24).map((p) => ({
    title: locale === "en" ? p.rssTitle : p.title,
    link: p.source_url && p.source_url.length > 0 ? p.source_url : "#",
    pubDate: p.date,
    source: p.platform,
    summary: p.summary.length > 300 ? `${p.summary.slice(0, 300)}…` : p.summary,
  }));
}

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY가 설정되지 않았습니다." },
      { status: 503 }
    );
  }

  let body: Body = {};
  try {
    const t = await req.text();
    if (t) body = JSON.parse(t) as Body;
  } catch {
    body = {};
  }

  const locale = body.locale === "en" ? "en" : "ko";
  const skipPolicySync = Boolean(body.skipPolicySync);

  const [revSettled, polSettled] = await Promise.allSettled([
    fetchReviewsSnapshotForReport(50),
    skipPolicySync ? Promise.resolve(null) : runPolicySyncPipeline(),
  ]);

  const rev: ReviewsSnapshot =
    revSettled.status === "fulfilled"
      ? revSettled.value
      : { ok: false, error: "리뷰 스냅샷 조회 실패" };

  const dataParts: string[] = [];
  if (rev.ok) {
    dataParts.push(formatReviewsSnapshotForPrompt(rev));
  } else {
    dataParts.push(`[리뷰 데이터 없음] ${rev.error}`);
  }

  let policies: PolicyItem[] = [];
  let policyTotal = 0;

  if (skipPolicySync) {
    dataParts.push("[정책·뉴스] 사용자 요청으로 이번 생성에서는 생략했습니다.");
  } else if (polSettled.status === "fulfilled" && polSettled.value) {
    const p = polSettled.value;
    policies = p.policies;
    policyTotal = p.total;
    dataParts.push(formatPoliciesForPrompt(p.policies, p.total));
  } else if (polSettled.status === "rejected") {
    const msg =
      polSettled.reason instanceof Error
        ? polSettled.reason.message
        : String(polSettled.reason);
    dataParts.push(`[정책·뉴스 수집 실패] ${msg}`);
  } else {
    dataParts.push("[정책·뉴스] 수집 결과 없음");
  }

  const chartData = buildChartData(rev);
  const newsItems = policiesToNewsItems(policies, locale);
  const context = dataParts.join("\n\n");

  const langRule =
    locale === "en"
      ? "Write ALL narrative fields (topic, executiveSummary, keyFindings, trends, players, chartTitle, outlook, insightQuote) in professional English."
      : "모든 서술 필드(topic, executiveSummary, keyFindings, trends, players, chartTitle, outlook, insightQuote)는 한국어로 작성하세요.";

  try {
    const { object } = await generateObject({
      model: openai("gpt-4o"),
      schema: AiCoreSchema,
      prompt: `K-Beauty 글로벌 이커머스(아마존 유럽 FR/UK 등, 틱톡샵) 운영 관점의 플랫폼 동향 리포트를 작성합니다.
아래 블록은 서버가 Apify 리뷰 Dataset과 RSS 정책 파이프라인에서 가져온 실제 데이터입니다.

규칙:
- 데이터에 없는 수치·사실을 지어내지 마세요.
- 차트 수치는 서버가 별도로 채웁니다. chartTitle은 이 리뷰 채널·감성 분포 맥락에 맞게 짧게 지으세요.
- insightQuote는 한 문장 또는 짧은 인용 형태의 핵심 메시지입니다.
- trends/players는 데이터와 정책 뉴스에서 도출 가능한 범위에서만 서술하세요.

${langRule}

--- 데이터 시작 ---
${context}
--- 데이터 끝 ---`,
    });

    const report: ReportData = {
      ...object,
      generatedAt: new Date().toISOString(),
      chartData,
      newsItems,
    };

    return NextResponse.json(
      {
        report,
        meta: {
          reviewsOk: rev.ok,
          reviewTotal: rev.ok ? rev.stats.total : 0,
          policyItemsUsed: policies.length,
          skippedPolicySync: skipPolicySync,
          policyFeedTotal: policyTotal,
        },
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (err) {
    console.error("구조화 리포트 오류:", err);
    return NextResponse.json(
      { error: "구조화 리포트 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
