import { NextResponse } from "next/server";
import {
  aggregateByChannel,
  toReviewItems,
  resolveReviewDatasetId,
  fetchDatasetItemsPaginated,
  getApifyToken,
} from "@/lib/apify";

// 리뷰는 수집 직후 갱신되어야 하므로 정적/캐시 최적화 비활성화
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const token = getApifyToken();

  if (!token) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_APIFY_API_TOKEN 또는 APIFY_API_TOKEN이 설정되지 않았습니다." },
      { status: 503 }
    );
  }

  const datasetId = await resolveReviewDatasetId();
  if (!datasetId) {
    return NextResponse.json(
      {
        error:
          "조회할 Dataset이 없습니다. 먼저 「리뷰 다시 수집」으로 스크래퍼를 1회 이상 성공 실행하거나, APIFY_DATASET_ID를 지정하세요.",
      },
      { status: 503 }
    );
  }

  try {
    const items = await fetchDatasetItemsPaginated(datasetId);

    // ASIN 매핑 + url 기반 채널(FR/UK)은 toReviewItems 내부에서 처리
    const reviews = toReviewItems(items);

    const chartData = aggregateByChannel(reviews);
    const total = reviews.length;
    const positiveCount = reviews.filter((r) => r.sentiment === "positive").length;
    const avgRating =
      total > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / total : 0;

    return NextResponse.json(
      {
        chartData,
        reviews,
        stats: {
          total,
          avgRating: Math.round(avgRating * 10) / 10,
          positiveRate:
            total > 0 ? Math.round((positiveCount / total) * 1000) / 10 : 0,
          channelCount: chartData.length,
        },
      },
      {
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  } catch (err) {
    console.error("Apify dataset fetch 오류:", err);
    const is404 =
      typeof err === "object" &&
      err !== null &&
      "statusCode" in err &&
      (err as { statusCode: unknown }).statusCode === 404;
    if (is404) {
      return NextResponse.json(
        {
          error:
            "Dataset을 찾을 수 없습니다. APIFY_DATASET_ID가 오래된 값이면 제거하거나, Apify에서 최근 성공 Run의 Dataset을 확인하세요.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "데이터 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}