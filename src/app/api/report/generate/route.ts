import { NextResponse } from "next/server";
import { generateText } from "ai";
import { openai } from "@/lib/openai";
import {
  fetchReviewsSnapshotForReport,
  formatReviewsSnapshotForPrompt,
} from "@/lib/reportSnapshot";
import { runPolicySyncPipeline } from "@/lib/policySyncRun";
import { formatPoliciesForPrompt } from "@/lib/formatPolicyContext";

export const dynamic = "force-dynamic";

/** Vercel 등에서 긴 정책 파이프라인 허용 */
export const maxDuration = 300;

interface Body {
  userPrompt?: string;
  /** true면 RSS·정책 파이프라인 생략(리뷰만) */
  skipPolicySync?: boolean;
}

export async function POST(req: Request) {
  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    body = {};
  }

  const userPrompt =
    body.userPrompt?.trim() ||
    "수집된 리뷰와 정책·뉴스를 근거로 본사 아마존/틱톡샵 운영팀용 주간 브리핑 형식의 한국어 보고서를 작성하세요. 표·번호 목록을 활용해도 됩니다.";

  const [revSettled, polSettled] = await Promise.allSettled([
    fetchReviewsSnapshotForReport(55),
    body.skipPolicySync ? Promise.resolve(null) : runPolicySyncPipeline(),
  ]);

  const rev =
    revSettled.status === "fulfilled"
      ? revSettled.value
      : ({ ok: false as const, error: "리뷰 스냅샷 조회 실패" });

  const dataParts: string[] = [];
  if (rev.ok) {
    dataParts.push(formatReviewsSnapshotForPrompt(rev));
  } else {
    dataParts.push(`[리뷰 데이터 없음] ${rev.error}`);
  }

  if (body.skipPolicySync) {
    dataParts.push("[정책·뉴스] 사용자 요청으로 이번 생성에서는 생략했습니다.");
  } else if (polSettled.status === "fulfilled" && polSettled.value) {
    const p = polSettled.value;
    dataParts.push(formatPoliciesForPrompt(p.policies, p.total));
  } else if (polSettled.status === "rejected") {
    const msg =
      polSettled.reason instanceof Error
        ? polSettled.reason.message
        : String(polSettled.reason);
    dataParts.push(`[정책·뉴스 수집 실패] ${msg}`);
  }

  const context = dataParts.join("\n\n");

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY가 설정되지 않았습니다." },
      { status: 503 }
    );
  }

  try {
    const { text } = await generateText({
      model: openai("gpt-4o"),
      prompt: `아래 블록은 이 포트폴리오 대시보드에서 방금 서버가 API(Apify 리뷰 Dataset, RSS→정책 파이프라인)로 가져온 실제 데이터입니다.

규칙:
- 데이터에 없는 수치·사실을 지어내지 마세요.
- 근거가 없으면 "해당 데이터 없음" 또는 "샘플에 포함되지 않음"이라고 쓰세요.
- 리뷰 샘플 원문은 고객 의견 인용 시 그대로 또는 요약해 사용할 수 있습니다.

--- 데이터 시작 ---
${context}
--- 데이터 끝 ---

[보고서 요청]
${userPrompt}`,
    });

    const policyCount =
      polSettled.status === "fulfilled" && polSettled.value
        ? polSettled.value.policies.length
        : 0;

    return NextResponse.json(
      {
        report: text,
        meta: {
          reviewsOk: rev.ok,
          reviewTotal: rev.ok ? rev.stats.total : 0,
          policyItemsUsed: policyCount,
          skippedPolicySync: Boolean(body.skipPolicySync),
        },
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (err) {
    console.error("리포트 생성 오류:", err);
    return NextResponse.json(
      { error: "리포트 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
