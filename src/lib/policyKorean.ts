import { generateObject } from "ai";
import { z } from "zod";
import { openai } from "@/lib/openai";

const KoreanPolicySchema = z.object({
  titleKo: z.string().describe("한국어 제목, 따옴표 없이, 약 60자 이내"),
  summaryKo: z
    .string()
    .describe("본문을 한국어로 2~4문장 요약, 약 300자 이내"),
});

/** DeepL 실패·미설정 시 정책 카드용 한국어 제목·요약 (OpenAI) */
export async function translatePolicyEntryOpenAI(
  title: string,
  content: string
): Promise<{ title: string; summary: string }> {
  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: KoreanPolicySchema,
    prompt:
      "아래는 이커머스(아마존·틱톡샵 등) 관련 뉴스 제목과 본문이다. " +
      "운영 담당자가 읽기 쉬운 한국어로 제목을 번역하고, 본문은 핵심만 담아 요약하라.\n\n" +
      `제목:\n${title}\n\n본문:\n${content.slice(0, 1200)}`,
  });
  return {
    title: object.titleKo.trim().slice(0, 60),
    summary: object.summaryKo.trim().slice(0, 300),
  };
}

/** 한글 음절 수가 너무 적으면 DeepL이 통과시킨 원문(영어)일 가능성이 큼 */
export function isLikelyUntranslatedKorean(text: string): boolean {
  const hangul = text.match(/[가-힣]/g);
  return (hangul?.length ?? 0) < 6;
}
