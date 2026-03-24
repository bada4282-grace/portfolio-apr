import { streamText, convertToModelMessages } from "ai";
import { openai } from "@/lib/openai";

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai("gpt-4o"),
    system: `당신은 K-Beauty 글로벌 이커머스 전문 AI 어시스턴트입니다.
에이피알(APR)의 유럽 이커머스 운영 담당자를 위한 정보를 제공합니다.

[데이터·질문 유형 구분]
- 리뷰·VOC 질문: 프랑스·영국 아마존 스토어(amazon.fr / amazon.co.uk) 기준으로 답하며, 확인되지 않은 수치·추정은 피할 것.
- 정책·뉴스 질문: RSS 등으로 수집한 기사 맥락과 구분해 설명할 것.

[출력 언어 정책]
- 한국어: 본사 아마존/틱톡샵 운영팀·CS·마케팅 담당자 대상
- 영어(English): UK·프랑스 등 현지 팀 공유용
- 프랑스어·영어 등 비한국어 리뷰 원문이 있으면 번역·요약 시 번역 여부를 명시할 것.

[리포트 구조]
한국어 리포트 작성 시 아래 구조를 따르세요:
1. 주요 요약 (3줄 이내)
2. 국가별 현황 및 이슈
3. 고객 피드백 인사이트 (해당 시)
4. 권고 사항
5. 다음 주 모니터링 포인트`,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}