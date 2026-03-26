import { generateObject } from "ai";
import { z } from "zod";
import { openai } from "@/lib/openai";
import { fetchAllFeeds } from "@/lib/rss";
import { translateEntry } from "@/lib/deepl";
import {
  isLikelyUntranslatedKorean,
  translatePolicyEntryOpenAI,
} from "@/lib/policyKorean";
import { mapPool } from "@/lib/promisePool";

// OpenAI는 관련성·분류만 판단 (번역은 DeepL이 담당)
const ClassifySchema = z.object({
  isRelevant: z
    .boolean()
    .describe("K-Beauty 글로벌 이커머스 운영에 관련된 내용인지 여부"),
  severity: z
    .enum(["high", "medium", "low"])
    .describe(
      "긴급도 분류 기준:\n" +
        "- high(조치 필요): 수수료 인상, 리스팅 정책 변경, 판매 제한, 계정 정책 변경처럼 셀러가 즉시 대응 조치를 취해야 하는 경우\n" +
        "- medium(모니터링): 신기능 출시, 이벤트·프로모션 기회, 물류 변경처럼 즉각 조치는 불필요하지만 지속적으로 지켜봐야 하는 경우\n" +
        "- low(정보): 시장 트렌드, 업계 뉴스, 참고용 분석 기사"
    ),
  countries: z
    .array(z.enum(["UK", "DE", "FR", "IT", "ES", "NL"]))
    .describe(
      "기사에서 명시적으로 언급된 국가 코드만 포함하세요. " +
        "예: UK 한정 정책이면 ['UK'], 독일·프랑스 언급이면 ['DE', 'FR']. " +
        "특정 국가가 명확히 언급되지 않거나 불명확하면 빈 배열 []을 반환하세요."
    ),
  channel: z
    .enum(["amazon", "tiktok", "general"])
    .describe(
      "기사의 주요 플랫폼을 판단하세요. " +
        "amazon: 아마존 마켓플레이스·셀러 정책 관련, " +
        "tiktok: 틱톡샵·틱톡 커머스 관련, " +
        "general: 두 플랫폼 모두에 해당하거나 일반 이커머스 트렌드"
    ),
});

export interface PolicyItem {
  id: string;
  /** 한국어(DeepL/OpenAI) — 정책 카드·한국어 리포트용 */
  title: string;
  /** RSS 원문 제목 — 영어 리포트·원문 표시용 */
  rssTitle: string;
  platform: string;
  channel: "amazon" | "tiktok" | "general";
  date: string;
  summary: string;
  severity: "high" | "medium" | "low";
  countries: string[];
  source_url: string | null;
}

/** DeepL 우선, 키 없음·실질 미번역(영어 등)이면 OpenAI로 한국어 제목·요약 */
async function resolveKoreanPolicyText(
  title: string,
  content: string
): Promise<{ title: string; summary: string }> {
  if (process.env.DEEPL_API_KEY?.trim()) {
    const deepLOut = await translateEntry(title, content);
    const merged = `${deepLOut.title} ${deepLOut.summary}`;
    if (!isLikelyUntranslatedKorean(merged)) {
      return deepLOut;
    }
  }
  return translatePolicyEntryOpenAI(title, content);
}

export type PolicySyncResult = {
  message: string;
  total: number;
  relevant: number;
  policies: PolicyItem[];
  sourceResults: Awaited<ReturnType<typeof fetchAllFeeds>>["sourceResults"];
};

/**
 * RSS 수집 → 관련성 분류 → 한국어 요약까지 한 번에 실행 (정책 페이지 동기화와 동일 파이프라인)
 */
export async function runPolicySyncPipeline(): Promise<PolicySyncResult> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");
  }

  const { entries, sourceResults } = await fetchAllFeeds(8);

  if (entries.length === 0) {
    return {
      message: "수집된 항목 없음",
      total: 0,
      relevant: 0,
      policies: [],
      sourceResults,
    };
  }

  const classified = await Promise.allSettled(
    entries.map(async (entry) => {
      const { object } = await generateObject({
        model: openai("gpt-4o-mini"),
        schema: ClassifySchema,
        prompt:
          `아래 뉴스 기사를 분석해주세요.\n\n제목: ${entry.title}\n본문: ${entry.content.slice(0, 600)}\n출처: ${entry.source.name}\n날짜: ${entry.pubDate}\n\nK-Beauty 제품을 아마존 유럽(DE/FR/IT/ES/UK/NL) 또는 틱톡샵에서 판매하는\n운영 담당자에게 정책·규정·수수료·리스팅 규칙 측면에서 관련이 있는지 판단하세요.`,
      });
      return { entry, classification: object };
    })
  );

  const relevant = classified.filter(
    (r): r is PromiseFulfilledResult<{
      entry: (typeof entries)[number];
      classification: z.infer<typeof ClassifySchema>;
    }> => r.status === "fulfilled" && r.value.classification.isRelevant
  );

  const translateConcurrency = Math.min(
    6,
    Math.max(
      1,
      Number.parseInt(process.env.POLICY_TRANSLATE_CONCURRENCY ?? "4", 10) || 4
    )
  );

  const policyChunks = await mapPool(relevant, translateConcurrency, async (r, idx) => {
    const { entry, classification } = r.value;
    const rawTitle = entry.title.trim();
    const { title, summary } = await resolveKoreanPolicyText(
      entry.title,
      entry.content
    );
    return {
      id: `${Date.now()}-${idx}`,
      title,
      rssTitle: rawTitle || title,
      platform: entry.source.platform,
      channel: classification.channel,
      date: new Date(entry.pubDate).toISOString().split("T")[0],
      summary,
      severity: classification.severity,
      countries: classification.countries,
      source_url: entry.link || null,
      _order: idx,
    };
  });

  const policies: PolicyItem[] = policyChunks
    .sort((a, b) => a._order - b._order)
    .map(({ _order: _o, ...item }) => item);

  return {
    message: "수집 완료",
    total: entries.length,
    relevant: policies.length,
    policies,
    sourceResults,
  };
}
