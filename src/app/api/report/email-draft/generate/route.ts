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
          "Plain text ONLY — no Markdown (no **, __, #, code fences). Use blank lines between blocks, [Section Title] lines, '- ' bullets, indented '  - ' sub-bullets, numbered actions 1. 2. Structure: greeting → one-line summary → [Platform & policy] → [Review highlights] if data → [Recommended actions] → Best regards, + Corporate Support — Amazon/TikTok Shop Operations Team. No fabricated numbers."
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
        "plain text만 — Markdown 금지(**, __, #, 코드블록 없음). 블록 사이 빈 줄, 구역 제목은 [플랫폼·정책 동향] 형식, 본문은 '- ' 불릿·하위는 '  - ' 들여쓰기, 액션은 1. 2. 번호. 순서: 인사 → 한 줄 핵심 요약 → [플랫폼·정책 동향] → (데이터 있으면) [리뷰·VOC 요약] → [제안 액션] → 감사 인사 한 줄 → 마지막 줄만 정확히 '경영지원 아마존/틱톡샵 운영팀 드림'. 존댓말·간결. 근거 없는 수치 금지."
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

  const systemKo = `이메일 본문은 반드시 일반 텍스트만. Markdown·슬랙 스타일 금지: ** 굵게, # 제목, 백틱 코드블록, 수평선(---) 장식 없음.
가독성: 섹션 사이에 빈 줄 1줄. 한 불릿은 한 줄에 핵심만(너무 길면 하위 불릿으로 쪼갬).
고정 틀(이 순서·형식을 지킬 것):
1) 인사 한 줄
2) 빈 줄
3) 오늘 브리핑 핵심 한 줄
4) 빈 줄
5) 첫 줄에 정확히 "[플랫폼·정책 동향]" (대괄호 포함)만 쓰고 다음 줄부터 "- " 불릿. 세부는 "  - " 두 칸 들여쓰기
6) 리뷰 데이터가 있으면 빈 줄 후 "[리뷰·VOC 요약]" 한 줄, 다음 줄부터 "- " 불릿 (채널·제품명은 짧게)
7) 빈 줄 후 "[제안 액션]" 한 줄, 다음 줄부터 "1. " "2. " 번호 목록(3~5개 내)
8) 빈 줄 후 "감사합니다." 한 줄
9) 빈 줄 후 마지막 줄만 서명: 경영지원 아마존/틱톡샵 운영팀 드림`;

  const systemEn = `Email body must be plain text only. No Markdown: no **, #, code fences, or decorative --- lines.
Readability: one blank line between sections. One bullet = one line; split long points with indented sub-bullets "  - ".
Fixed structure (follow this order):
1) One-line greeting (e.g. Hello team,)
2) blank line
3) One-line executive summary of today's pulse
4) blank line
5) Section title line exactly "[Platform & policy updates]" then "- " bullets; use "  - " for sub-points
6) If review data exists: blank line, section title "[Review highlights]", then "- " bullets (keep product/channel names short)
7) blank line, section title "[Recommended actions]", then numbered "1. " "2. " (3–5 items)
8) blank line, one short closing (e.g. Thank you.)
9) blank line, then exactly two lines: Best regards, / Corporate Support — Amazon/TikTok Shop Operations Team`;

  const promptKo = `당신은 K-Beauty 글로벌 이커머스 아마존/틱톡샵 운영팀 담당자입니다. 아래 블록은 서버가 방금 Apify 리뷰 Dataset과 RSS→정책 파이프라인으로 가져온 실제 데이터입니다.

내용 규칙:
- 데이터에 없는 수치·사실을 지어내지 마세요.
- 정책·뉴스는 반드시 아래 [정책·뉴스] 구간에 나온 항목만 근거로 요약하세요.
- 사내 타 부서 공유용 '플랫폼 동향 브리핑' 메일 초안입니다. 톤은 존댓말·간결.

--- 데이터 시작 ---
${context}
--- 데이터 끝 ---`;

  const promptEn = `You are on the K-Beauty global e-commerce ops team. The block below is real data from Apify review Dataset and RSS→policy pipeline.

Content rules:
- Do not invent numbers or facts not in the data.
- Policy/news bullets must only reflect items in the [정책·뉴스] / policy section below.
- Internal email for CS, marketing, leadership: same-day platform pulse for Amazon FR/UK and relevant marketplace signals.

--- Data start ---
${context}
--- Data end ---`;

  try {
    const { object } = await generateObject({
      model: openai("gpt-4o"),
      schema: emailDraftSchema(locale),
      system: locale === "en" ? systemEn : systemKo,
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
