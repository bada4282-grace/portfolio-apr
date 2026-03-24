import { NextResponse } from "next/server";
import { translateReviewToKorean } from "@/lib/reviewTranslateKorean";

export const dynamic = "force-dynamic";

interface TranslateRequestBody {
  texts?: unknown;
}

export async function POST(req: Request) {
  let body: TranslateRequestBody;
  try {
    body = (await req.json()) as TranslateRequestBody;
  } catch {
    return NextResponse.json({ error: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  if (!Array.isArray(body.texts)) {
    return NextResponse.json({ error: "texts 배열이 필요합니다." }, { status: 400 });
  }

  const rawTexts = body.texts;
  if (rawTexts.length > 200) {
    return NextResponse.json(
      { error: "한 번에 최대 200개까지 번역할 수 있습니다." },
      { status: 400 }
    );
  }

  const texts: string[] = [];
  for (const t of rawTexts) {
    if (typeof t !== "string") {
      return NextResponse.json(
        { error: "texts는 문자열 배열이어야 합니다." },
        { status: 400 }
      );
    }
    texts.push(t.slice(0, 5000));
  }

  try {
    const translations: string[] = [];
    for (const text of texts) {
      const translated = await translateReviewToKorean(text);
      translations.push(translated);
    }

    return NextResponse.json(
      { translations },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (err) {
    console.error("리뷰 번역 오류:", err);
    return NextResponse.json(
      { error: "리뷰 번역 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
