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

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function emailDraftSchema(locale: "ko" | "en") {
  if (locale === "en") {
    return z.object({
      subject: z
        .string()
        .describe(
          "One-line English email subject: daily platform/marketplace pulse for Amazon FR/UK, TikTok Shop, etc."
        ),
      body: z
        .string()
        .describe(
          "Full plain-text email: greeting → bullets from policy/RSS + VOC if data exists → suggested follow-ups → closing. End with exactly two lines: Best regards, then Corporate Support — Amazon/TikTok Shop Operations Team (no other team name). No fabricated numbers."
        ),
    });
  }
  return z.object({
    subject: z
      .string()
      .describe(
        "한국어 이메일 제목 한 줄. 날짜·플랫폼(아마존·틱톡 등) 동향이 한눈에 들어오게."
      ),
    body: z
      .string()
      .describe(
        "보낼 이메일 본문 전문(plain text). 인사 → RSS·정책·뉴스 요약 불릿 → (가능하면) VOC 한 줄 → 권장 다음 액션 → 맺음말. 마지막 줄은 반드시 정확히 '경영지원 아마존/틱톡샵 운영팀 드림' 한 줄로 끝낼 것('운영팀 드림' 등 다른 표기 금지). 사내 공유용 존댓말·간결한 톤. 데이터에 없는 수치는 쓰지 말 것."
      ),
  });
}

export async function POST(req: Request) {
  let locale: "ko" | "en" = "ko";
  try {
    const raw = await req.text();
    if (raw) {
      const j = JSON.parse(raw) as { locale?: string };
      if (j.locale === "en") locale = "en";
    }
  } catch {
    locale = "ko";
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY가 설정되지 않았습니다." },
      { status: 503 }
    );
  }

  const [revSettled, polSettled] = await Promise.allSettled([
    fetchReviewsSnapshotForReport(40),
    runPolicySyncPipeline(),
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

  if (polSettled.status === "fulfilled" && polSettled.value) {
    const p = polSettled.value;
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

  const context = dataParts.join("\n\n");

  const promptKo = `당신은 K-Beauty 글로벌 이커머스 아마존/틱톡샵 운영팀 담당자입니다. 아래 블록은 서버가 방금 Apify 리뷰 Dataset과 RSS→정책 파이프라인으로 가져온 실제 데이터입니다.

규칙:
- 데이터에 없는 수치·사실을 지어내지 마세요.
- 정책·뉴스는 반드시 아래 [정책·뉴스] 구간에 나온 항목만 근거로 요약하세요.
- 아마존/틱톡샵 운영팀이 사내 타 부서에 공유하는 '플랫폼 동향 브리핑 메일' 초안을 작성하세요.
- 본문 맺음말(서명)은 마지막 줄에 정확히 다음 문구만 사용: 경영지원 아마존/틱톡샵 운영팀 드림 (앞에 '운영팀 드림' 등 다른 팀 서명을 쓰지 말 것).

--- 데이터 시작 ---
${context}
--- 데이터 끝 ---`;

  const promptEn = `You are on the K-Beauty global e-commerce ops team. The block below is real data from Apify review Dataset and RSS→policy pipeline.

Rules:
- Do not invent numbers or facts not in the data.
- Policy/news bullets must only reflect items in the [정책·뉴스] / policy section below.
- Write an internal email draft for cross-functional sharing (CS, marketing, leadership): same-day platform pulse for Amazon FR/UK and relevant marketplace signals.
- Close the body with exactly: Best regards, (line break) Corporate Support — Amazon/TikTok Shop Operations Team. Do not use a generic "Operations team" sign-off only.

--- Data start ---
${context}
--- Data end ---`;

  try {
    const { object } = await generateObject({
      model: openai("gpt-4o"),
      schema: emailDraftSchema(locale),
      prompt: locale === "en" ? promptEn : promptKo,
    });

    const policyCount =
      polSettled.status === "fulfilled" && polSettled.value
        ? polSettled.value.policies.length
        : 0;

    return NextResponse.json(
      {
        subject: object.subject,
        body: object.body,
        meta: {
          reviewsOk: rev.ok,
          reviewTotal: rev.ok ? rev.stats.total : 0,
          policyItemsUsed: policyCount,
        },
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (err) {
    console.error("메일 초안 생성 오류:", err);
    return NextResponse.json(
      { error: "메일 초안 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
