import {
  resolveReviewDatasetId,
  fetchDatasetItemsPaginated,
  toReviewItems,
  aggregateByChannel,
  getApifyToken,
} from "@/lib/apify";
import type { ReviewSummary } from "@/lib/apify";

/** 리포트·도구용 샘플 한 줄 (토큰 절약) */
export interface ReviewSampleLine {
  channel: string;
  rating: number;
  sentiment: string;
  category: string;
  product: string;
  text: string;
}

export type ReviewsSnapshot =
  | {
      ok: true;
      stats: {
        total: number;
        avgRating: number;
        positiveRate: number;
        channelCount: number;
      };
      chartData: ReviewSummary[];
      samples: ReviewSampleLine[];
    }
  | { ok: false; error: string };

const MAX_TEXT = 220;

/**
 * Apify Dataset 기준 리뷰 스냅샷 (/api/reviews GET과 동일 소스)
 */
export async function fetchReviewsSnapshotForReport(
  maxSamples = 45
): Promise<ReviewsSnapshot> {
  const token = getApifyToken();
  if (!token) {
    return { ok: false, error: "NEXT_PUBLIC_APIFY_API_TOKEN 또는 APIFY_API_TOKEN이 설정되지 않았습니다." };
  }

  let datasetId: string | null;
  try {
    datasetId = await resolveReviewDatasetId();
  } catch {
    return { ok: false, error: "Dataset ID를 확인할 수 없습니다." };
  }

  if (!datasetId) {
    return {
      ok: false,
      error:
        "조회할 Dataset이 없습니다. 리뷰 수집을 성공 실행하거나 APIFY_DATASET_ID를 설정하세요.",
    };
  }

  try {
    const items = await fetchDatasetItemsPaginated(datasetId);
    const reviews = toReviewItems(items);
    const chartData = aggregateByChannel(reviews);
    const total = reviews.length;
    const positiveCount = reviews.filter((r) => r.sentiment === "positive").length;
    const avgRating =
      total > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / total : 0;

    const sorted = [...reviews].sort((a, b) => b.reviewedAtMs - a.reviewedAtMs);
    const samples: ReviewSampleLine[] = sorted.slice(0, maxSamples).map((r) => ({
      channel: r.channel,
      rating: r.rating,
      sentiment: r.sentiment,
      category: r.category,
      product: r.product,
      text:
        r.original.length > MAX_TEXT
          ? `${r.original.slice(0, MAX_TEXT)}…`
          : r.original,
    }));

    return {
      ok: true,
      stats: {
        total,
        avgRating: Math.round(avgRating * 10) / 10,
        positiveRate:
          total > 0 ? Math.round((positiveCount / total) * 1000) / 10 : 0,
        channelCount: chartData.length,
      },
      chartData,
      samples,
    };
  } catch (err) {
    console.error("리뷰 스냅샷 오류:", err);
    return { ok: false, error: "리뷰 데이터를 불러오는 중 오류가 발생했습니다." };
  }
}

/** LLM에 붙일 텍스트 블록 생성 */
export function formatReviewsSnapshotForPrompt(s: Extract<ReviewsSnapshot, { ok: true }>): string {
  const lines = [
    `[리뷰 통계] 총 ${s.stats.total}건, 평균 평점 ${s.stats.avgRating}, 긍정 비율(4~5점 기준) 약 ${s.stats.positiveRate}%, 채널 수 ${s.stats.channelCount}`,
    `[채널별 감성 건수] ${JSON.stringify(s.chartData)}`,
    `[최근 리뷰 샘플 최대 ${s.samples.length}건 — 아래 원문은 실제 Dataset에서 가져온 것입니다]`,
    ...s.samples.map(
      (r, i) =>
        `${i + 1}. [${r.channel}] ★${r.rating} ${r.sentiment} | ${r.category} / ${r.product}\n   ${r.text}`
    ),
  ];
  return lines.join("\n");
}
