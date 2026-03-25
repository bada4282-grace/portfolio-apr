import { NextResponse } from "next/server";
import {
  buildProductUrlListForScraper,
  callApifyActorViaHttp,
  getReviewsActorId,
  getApifyToken,
} from "@/lib/apify";

export const runtime = "nodejs";

function extractApifyErrorMeta(err: unknown): {
  name: string;
  message: string;
  statusCode: number | null;
  type: string | null;
  code: string | null;
} {
  if (!err || typeof err !== "object") {
    return {
      name: "UnknownError",
      message: typeof err === "string" ? err : "Unknown error",
      statusCode: null,
      type: null,
      code: null,
    };
  }
  const e = err as Record<string, unknown>;
  return {
    name: typeof e.name === "string" ? e.name : "Error",
    message: typeof e.message === "string" ? e.message : "Unknown error",
    statusCode: typeof e.statusCode === "number" ? e.statusCode : null,
    type: typeof e.type === "string" ? e.type : null,
    code: typeof e.code === "string" ? e.code : null,
  };
}

export async function POST() {
  const token = getApifyToken();

  if (!token) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_APIFY_API_TOKEN 또는 APIFY_API_TOKEN이 설정되지 않았습니다." },
      { status: 503 }
    );
  }

  // 중복 URL 제거 후 액터에 전달 (동일 ASIN이 여러 줄이면 Apify가 400 반환)
  const productUrls = buildProductUrlListForScraper();

  if (productUrls.length === 0) {
    return NextResponse.json(
      { error: "PRODUCT_MAP에 ASIN이 없습니다. apify.ts를 먼저 채워주세요." },
      { status: 400 }
    );
  }

  try {
    // 무료 플랜·비용: 기본 상품당 최근 50건. Pay-per-event Run은 maxItems·과금 상한이 낮으면 Dataset이 10건 부근에서 끊길 수 있음 → maxItems 명시.
    // .env: APIFY_MAX_REVIEWS_PER_PRODUCT | APIFY_USE_RESIDENTIAL_PROXY=true | APIFY_MAX_TOTAL_CHARGE_USD
    const waitSecsRaw = process.env.APIFY_WAIT_SECS?.trim();
    const waitSecsParsed = waitSecsRaw ? parseInt(waitSecsRaw, 10) : NaN;
    const waitSecs = Number.isFinite(waitSecsParsed)
      ? Math.min(Math.max(120, waitSecsParsed), 3600)
      : 600;

    const DEFAULT_MAX_PER_PRODUCT = 50;

    const input: {
      productUrls: typeof productUrls;
      proxy: { useApifyProxy: boolean; apifyProxyGroups?: string[] };
      sort: "recent" | "helpful";
      maxReviews?: number;
    } = {
      productUrls,
      // 무료 플랜에서 RESIDENTIAL만 쓰면 페이지 수·안정성 제한으로 소수(예: 10건)만 나오는 사례가 있음 → 기본은 자동 프록시만
      proxy: { useApifyProxy: true },
      sort: "recent",
    };

    if (process.env.APIFY_USE_RESIDENTIAL_PROXY === "true") {
      input.proxy = {
        useApifyProxy: true,
        apifyProxyGroups: ["RESIDENTIAL"],
      };
    }

    const maxEnv = process.env.APIFY_MAX_REVIEWS_PER_PRODUCT?.trim().toLowerCase();
    if (maxEnv === "all" || maxEnv === "unlimited") {
      // maxReviews 미전달 — 비용·Run 시간 크게 늘 수 있음
    } else if (maxEnv && maxEnv !== "0") {
      const n = parseInt(maxEnv, 10);
      if (!Number.isNaN(n) && n > 0) {
        input.maxReviews = n;
      } else {
        input.maxReviews = DEFAULT_MAX_PER_PRODUCT;
      }
    } else {
      input.maxReviews = DEFAULT_MAX_PER_PRODUCT;
    }

    const reviewsPerProduct = input.maxReviews ?? DEFAULT_MAX_PER_PRODUCT;
    const unlimitedReviews =
      maxEnv === "all" || maxEnv === "unlimited";
    // Pay-per-event: Run maxItems가 Dataset 행 과금 상한 역할 → 너무 작으면 10건 전후로 잘림
    const runMaxItems = unlimitedReviews
      ? 50_000
      : Math.min(productUrls.length * reviewsPerProduct + 500, 50_000);

    const chargeRaw = process.env.APIFY_MAX_TOTAL_CHARGE_USD?.trim();
    const maxTotalChargeUsd = chargeRaw
      ? Math.min(Math.max(0.5, parseFloat(chargeRaw)), 500)
      : undefined;

    const actorId = getReviewsActorId();
    // #region agent log
    {
      const payload = {
        sessionId: "8a06d9",
        runId: "reviews-sync-pre-call",
        hypothesisId: "A",
        location: "api/reviews/sync/route.ts:POST:before-call",
        message: "Starting Apify actor call",
        data: {
          actorId,
          productUrlsCount: productUrls.length,
          waitSecs,
          runMaxItems,
          hasMaxTotalChargeUsd: maxTotalChargeUsd != null && !Number.isNaN(maxTotalChargeUsd),
          useResidentialProxy: process.env.APIFY_USE_RESIDENTIAL_PROXY === "true",
          maxReviewsMode: maxEnv ?? "default",
        },
        timestamp: Date.now(),
      };
      fetch("http://127.0.0.1:7941/ingest/0fffd798-6878-4afb-8f04-8b34eb04beba", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "8a06d9" },
        body: JSON.stringify(payload),
      }).catch(() => {});
    }
    // #endregion
    const run = await callApifyActorViaHttp({
      actorId,
      token,
      input,
      waitSecs,
      maxItems: runMaxItems,
      ...(maxTotalChargeUsd != null && !Number.isNaN(maxTotalChargeUsd)
        ? { maxTotalChargeUsd }
        : {}),
    });

    // #region agent log
    {
      const payload = {
        sessionId: "8a06d9",
        runId: "reviews-sync-post-call",
        hypothesisId: "B",
        location: "api/reviews/sync/route.ts:POST:after-call",
        message: "Apify actor call succeeded",
        data: {
          actorId,
          runId: run.id,
          datasetId: run.defaultDatasetId ?? null,
          status: run.status ?? null,
        },
        timestamp: Date.now(),
      };
      fetch("http://127.0.0.1:7941/ingest/0fffd798-6878-4afb-8f04-8b34eb04beba", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "8a06d9" },
        body: JSON.stringify(payload),
      }).catch(() => {});
    }
    // #endregion

    const perProductNote =
      input.maxReviews != null
        ? ` (상품당 최대 ${input.maxReviews}건, 최신순)`
        : " (상품당 상한 없음 — 비용 주의)";

    return NextResponse.json({
      message: `리뷰 수집 완료 — 제품 URL ${productUrls.length}개${perProductNote}`,
      actorId,
      runId: run.id,
      datasetId: run.defaultDatasetId,
      status: run.status,
      hint:
        "junglee 액터는 maxReviews와 관계없이 Run당 약 10건만 반환하는 경우가 있습니다. Apify 이슈/플랜을 확인하거나 .env의 APIFY_REVIEWS_ACTOR_ID로 다른 리뷰 액터를 지정하세요(입력 스키마가 다를 수 있음).",
    });
  } catch (err) {
    console.error("Apify 실행 오류:", err);
    const meta = extractApifyErrorMeta(err);
    // #region agent log
    {
      const payload = {
        sessionId: "8a06d9",
        runId: "reviews-sync-catch",
        hypothesisId: "C",
        location: "api/reviews/sync/route.ts:POST:catch",
        message: "Apify actor call failed",
        data: {
          ...meta,
          actorId: getReviewsActorId(),
        },
        timestamp: Date.now(),
      };
      fetch("http://127.0.0.1:7941/ingest/0fffd798-6878-4afb-8f04-8b34eb04beba", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "8a06d9" },
        body: JSON.stringify(payload),
      }).catch(() => {});
    }
    // #endregion
    return NextResponse.json(
      {
        error: "리뷰 수집 중 오류가 발생했습니다.",
        debug: meta,
      },
      { status: 500 }
    );
  }
}