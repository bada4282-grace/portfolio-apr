import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { z } from "zod";
import { openai } from "@/lib/openai";

export const dynamic = "force-dynamic";

const KeywordSchema = z.object({
  positive: z
    .array(z.string())
    .max(2)
    .describe("긍정 리뷰에서 많이 등장한 한국어 형용사 상위 2개"),
  negative: z
    .array(z.string())
    .max(2)
    .describe("부정 리뷰에서 많이 등장한 한국어 형용사 상위 2개"),
});

interface KeywordRequest {
  reviews?: unknown;
}

interface InputReview {
  sentiment: "positive" | "neutral" | "negative";
  text: string;
}

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY가 설정되지 않았습니다." },
      { status: 503 }
    );
  }

  let body: KeywordRequest;
  try {
    body = (await req.json()) as KeywordRequest;
  } catch {
    return NextResponse.json({ error: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  if (!Array.isArray(body.reviews)) {
    return NextResponse.json({ error: "reviews 배열이 필요합니다." }, { status: 400 });
  }

  const reviews: InputReview[] = [];
  for (const row of body.reviews) {
    if (typeof row !== "object" || row === null) {
      continue;
    }
    const candidate = row as { sentiment?: unknown; text?: unknown };
    if (
      (candidate.sentiment === "positive" ||
        candidate.sentiment === "neutral" ||
        candidate.sentiment === "negative") &&
      typeof candidate.text === "string" &&
      candidate.text.trim().length > 0
    ) {
      reviews.push({
        sentiment: candidate.sentiment,
        text: candidate.text.slice(0, 700),
      });
    }
  }

  if (reviews.length === 0) {
    return NextResponse.json({ positive: [], negative: [] });
  }

  try {
    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: KeywordSchema,
      prompt: [
        "다음은 상품 리뷰 목록입니다.",
        "요구사항:",
        "1) 리뷰 텍스트 언어(영어/프랑스어 등)를 한국어 의미로 해석한다.",
        "2) 명사/동사/부사를 제외하고 형용사만 추출한다.",
        "3) 의미 중복 표현은 하나로 통합한다. 예: 촉촉한/보습되는 -> 촉촉한",
        "4) 긍정 리뷰에서 형용사 상위 2개, 부정 리뷰에서 형용사 상위 2개를 뽑는다.",
        "5) 반드시 한국어 단어만 반환한다.",
        "리뷰 데이터(JSON):",
        JSON.stringify(reviews),
      ].join("\n"),
    });

    return NextResponse.json(
      {
        positive: object.positive.slice(0, 2),
        negative: object.negative.slice(0, 2),
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (err) {
    console.error("리뷰 형용사 키워드 추출 오류:", err);
    return NextResponse.json(
      { error: "리뷰 키워드 분석 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
