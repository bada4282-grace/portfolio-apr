import { streamText, convertToModelMessages, stepCountIs, tool } from "ai";
import { z } from "zod";
import { openai } from "@/lib/openai";
import {
  fetchReviewsSnapshotForReport,
  formatReviewsSnapshotForPrompt,
} from "@/lib/reportSnapshot";
import { runPolicySyncPipeline } from "@/lib/policySyncRun";
import { formatPoliciesForPrompt } from "@/lib/formatPolicyContext";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai("gpt-4o"),
    system: `당신은 K-Beauty 글로벌 이커머스 아마존/틱톡샵 운영팀을 위한 리포트 어시스턴트입니다.

반드시 지킬 것:
- 사용자가 리뷰·VOC·정책 현황을 묻거나 리포트를 요청하면, 먼저 도구 getLatestReviewsSummary 또는 getLatestPolicyNews로 실제 데이터를 조회한 뒤 답하세요.
- 도구 결과에 없는 수치나 사실을 만들어내지 마세요.
- 정책 뉴스 도구는 RSS 수집·AI 분류로 시간이 걸릴 수 있음을 사용자에게 안내할 수 있습니다.

출력: 한국어(본사) 또는 사용자가 영어를 요청한 경우 영어.`,
    messages: await convertToModelMessages(messages),
    tools: {
      getLatestReviewsSummary: tool({
        description:
          "Apify Dataset 기준 리뷰 통계, 채널별 감성 건수, 최근 리뷰 원문 샘플을 가져옵니다. 리포트·분석 전에 호출하세요.",
        inputSchema: z.object({
          maxSamples: z
            .number()
            .min(5)
            .max(80)
            .optional()
            .describe("샘플 리뷰 최대 개수(기본 35)"),
        }),
        execute: async ({ maxSamples }) => {
          const snap = await fetchReviewsSnapshotForReport(maxSamples ?? 35);
          if (!snap.ok) {
            return { error: snap.error };
          }
          return {
            stats: snap.stats,
            chartData: snap.chartData,
            formattedText: formatReviewsSnapshotForPrompt(snap),
          };
        },
      }),
      getLatestPolicyNews: tool({
        description:
          "RSS 피드에서 정책·뉴스를 수집하고 관련 기사만 한국어 제목·요약으로 정리합니다. 수십 초 이상 걸릴 수 있습니다.",
        inputSchema: z.object({}),
        execute: async () => {
          const r = await runPolicySyncPipeline();
          return {
            message: r.message,
            totalFetched: r.total,
            relevantCount: r.relevant,
            formattedText: formatPoliciesForPrompt(r.policies, r.total),
          };
        },
      }),
    },
    stopWhen: stepCountIs(14),
  });

  return result.toUIMessageStreamResponse();
}
