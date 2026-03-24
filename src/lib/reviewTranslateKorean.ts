import { generateText } from "ai";
import { openai } from "@/lib/openai";
import { translateToKorean as translateViaDeepL } from "@/lib/deepl";
import { isLikelyUntranslatedKorean } from "@/lib/policyKorean";

function hasOpenAIKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

/**
 * 리뷰 한 줄을 한국어로 번역. DeepL 우선, 미설정·실패·미번역 결과면 OpenAI(gpt-4o-mini)로 폴백.
 */
export async function translateReviewToKorean(text: string): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return text;

  const fromDeepL = await translateViaDeepL(text);

  // 원문이 이미 한국어로 보이면 DeepL 결과만 사용(불필요한 재번역 방지)
  const sourceLooksKorean = !isLikelyUntranslatedKorean(trimmed);
  if (sourceLooksKorean) {
    return fromDeepL;
  }

  const stillForeign =
    fromDeepL.trim() === trimmed.trim() || isLikelyUntranslatedKorean(fromDeepL);

  if (!stillForeign) return fromDeepL;
  if (!hasOpenAIKey()) return fromDeepL;

  try {
    const { text: out } = await generateText({
      model: openai("gpt-4o-mini"),
      prompt: [
        "아래는 이커머스(아마존 등) 상품 리뷰 원문이다.",
        "자연스러운 한국어로만 번역하라. 설명·따옴표·접두어 없이 번역문만 출력하라.",
        "",
        trimmed.slice(0, 5000),
      ].join("\n"),
    });
    const ko = out.trim();
    return ko.length > 0 ? ko : fromDeepL;
  } catch {
    return fromDeepL;
  }
}
