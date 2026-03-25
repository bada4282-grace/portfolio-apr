import { NextResponse } from "next/server";
import {
  aggregateBySelectedChannel,
  toReviewItems,
  resolveProductAsin,
  buildAmazonDpUrl,
  scrapeReviewsForSingleProductUrl,
  extractAsinFromApifyItem,
  getApifyToken,
  type ChannelKey,
} from "@/lib/apify";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

function parseMaxReviews(): number {
  const raw = process.env.APIFY_PRODUCT_SELECT_MAX_REVIEWS?.trim();
  if (raw) {
    const n = parseInt(raw, 10);
    if (!Number.isNaN(n) && n > 0 && n <= 500) return n;
  }
  return 10;
}

/** 필터에서 특정 제품 선택 시 해당 ASIN만 Apify로 다시 수집 */
export async function POST(req: Request) {
  const token = getApifyToken();
  if (!token) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_APIFY_API_TOKEN 또는 APIFY_API_TOKEN이 설정되지 않았습니다." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("channel" in body) ||
    !("category" in body) ||
    !("product" in body)
  ) {
    return NextResponse.json(
      { error: "channel, category, product 필드가 필요합니다." },
      { status: 400 }
    );
  }

  const { channel, category, product } = body as {
    channel: unknown;
    category: unknown;
    product: unknown;
  };

  if (channel !== "FR" && channel !== "UK") {
    return NextResponse.json(
      { error: "channel은 FR 또는 UK여야 합니다." },
      { status: 400 }
    );
  }
  if (typeof category !== "string" || typeof product !== "string") {
    return NextResponse.json(
      { error: "category와 product는 문자열이어야 합니다." },
      { status: 400 }
    );
  }

  const asin = resolveProductAsin(channel, category, product);
  if (!asin) {
    return NextResponse.json(
      { error: "PRODUCT_MAP에 없는 제품이거나 카테고리가 전체입니다." },
      { status: 400 }
    );
  }

  const maxReviews = parseMaxReviews();
  const url = buildAmazonDpUrl(channel, asin);

  try {
    const { items, runId, datasetId } = await scrapeReviewsForSingleProductUrl(
      url,
      maxReviews
    );

    // ASIN 일치 행만 쓰되, 그 행들에 본문 필드가 없어 전부 탈락하면 전체 행으로 폴백(0건 유령 방지)
    const onlyRequestedAsinItems = items.filter(
      (item) => extractAsinFromApifyItem(item) === asin
    );
    let reviews = toReviewItems(
      onlyRequestedAsinItems.length > 0 ? onlyRequestedAsinItems : items
    );
    if (reviews.length === 0 && onlyRequestedAsinItems.length > 0) {
      reviews = toReviewItems(items);
    }
    reviews.sort((a, b) => {
      if (b.reviewedAtMs !== a.reviewedAtMs) {
        return b.reviewedAtMs - a.reviewedAtMs;
      }
      return a.sourceOrder - b.sourceOrder;
    });
    reviews = reviews.slice(0, maxReviews);

    const chartData = aggregateBySelectedChannel(reviews, channel as ChannelKey);
    const total = reviews.length;
    const positiveCount = reviews.filter((r) => r.sentiment === "positive").length;
    const avgRating =
      total > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / total : 0;

    return NextResponse.json(
      {
        reviews,
        chartData,
        stats: {
          total,
          avgRating: Math.round(avgRating * 10) / 10,
          positiveRate:
            total > 0 ? Math.round((positiveCount / total) * 1000) / 10 : 0,
          channelCount: chartData.length,
        },
        meta: {
          asin,
          url,
          runId,
          datasetId,
          maxReviews,
          rawCount: items.length,
          asinMatchedCount: onlyRequestedAsinItems.length,
        },
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (err) {
    console.error("단일 제품 리뷰 수집 오류:", err);
    return NextResponse.json(
      { error: "Apify 실행 또는 데이터 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
