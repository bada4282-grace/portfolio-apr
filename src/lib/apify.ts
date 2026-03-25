/** junglee 액터: Input에 maxReviews=100이어도 Run당 ~10건만 주는 사례 있음(점검·과금 모델). 교체 시 APIFY_REVIEWS_ACTOR_ID 사용 */
export const DEFAULT_REVIEWS_ACTOR_ID = "junglee/amazon-reviews-scraper";

/** @deprecated sync/resolve에서는 getReviewsActorId() 사용 */
export const ACTOR_ID = DEFAULT_REVIEWS_ACTOR_ID;

export function getApifyToken(): string {
  const nextPublic = process.env.NEXT_PUBLIC_APIFY_API_TOKEN?.trim();
  if (nextPublic) return nextPublic;
  const legacy = process.env.APIFY_API_TOKEN?.trim();
  if (legacy) return legacy;
  return "";
}

/** 리뷰 수집·lastRun 조회에 쓰는 Store 액터 ID */
export function getReviewsActorId(): string {
  const v = process.env.APIFY_REVIEWS_ACTOR_ID?.trim();
  return v && v.length > 0 ? v : DEFAULT_REVIEWS_ACTOR_ID;
}

/** Apify REST 경로용 액터 ID — 문서 권장 `username~actor` (slash만 tilde로 통일) */
export function apifyActorIdForRestPath(actorId: string): string {
  return actorId.replace(/\//g, "~");
}

/** Apify REST Run 응답의 data 객체 */
export interface ApifyRunRestData {
  id: string;
  defaultDatasetId?: string;
  status?: string;
}

/** 액터 실행 POST URL (sync·단일 제품 수집 공통) */
export function buildApifyRunUrl(params: {
  actorId: string;
  waitSecs: number;
  maxItems: number;
  maxTotalChargeUsd?: number;
}): string {
  const actSeg = encodeURIComponent(apifyActorIdForRestPath(params.actorId));
  const url = new URL(`https://api.apify.com/v2/acts/${actSeg}/runs`);
  url.searchParams.set("waitForFinish", String(params.waitSecs));
  url.searchParams.set("maxItems", String(params.maxItems));
  if (
    params.maxTotalChargeUsd != null &&
    Number.isFinite(params.maxTotalChargeUsd)
  ) {
    url.searchParams.set("maxTotalChargeUsd", String(params.maxTotalChargeUsd));
  }
  return url.toString();
}

/** apify-client 대신 REST — Vercel에서 proxy-agent 로딩 이슈 회피 */
export async function callApifyActorViaHttp(args: {
  actorId: string;
  token: string;
  input: object;
  waitSecs: number;
  maxItems: number;
  maxTotalChargeUsd?: number;
}): Promise<ApifyRunRestData> {
  const endpoint = buildApifyRunUrl({
    actorId: args.actorId,
    waitSecs: args.waitSecs,
    maxItems: args.maxItems,
    maxTotalChargeUsd: args.maxTotalChargeUsd,
  });

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.token}`,
    },
    body: JSON.stringify(args.input),
  });

  const payload = (await res.json().catch(() => null)) as
    | {
        data?: ApifyRunRestData;
        error?: { message?: string; type?: string };
      }
    | null;

  if (!res.ok || !payload?.data?.id) {
    const message =
      payload?.error?.message ??
      `Apify HTTP 요청 실패 (${res.status} ${res.statusText})`;
    throw new Error(message);
  }

  return payload.data;
}

/**
 * 리뷰 조회에 쓸 Dataset ID 결정.
 * - APIFY_DATASET_ID가 있으면 해당 ID 고정 사용(특정 스냅샷만 보고 싶을 때).
 * - 없으면 getReviewsActorId() 액터의 가장 최근 SUCCEEDED Run 기본 데이터셋을 사용(수집 후 .env 수정 불필요).
 */
export async function resolveReviewDatasetId(): Promise<string | null> {
  const pinned = process.env.APIFY_DATASET_ID?.trim();
  if (pinned) return pinned;

  const token = getApifyToken();
  if (!token) return null;

  const actorId = getReviewsActorId();
  const actSeg = encodeURIComponent(apifyActorIdForRestPath(actorId));
  const url = new URL(`https://api.apify.com/v2/acts/${actSeg}/runs/last`);
  url.searchParams.set("status", "SUCCEEDED");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;

  const payload = (await res.json().catch(() => null)) as
    | { data?: { defaultDatasetId?: string } }
    | null;
  const id = payload?.data?.defaultDatasetId;
  if (typeof id === "string" && id.length > 0) return id;

  // runs/last가 빈 data를 주는 경우: 최근 Run 목록에서 SUCCEEDED + datasetId 보강
  const listUrl = new URL(`https://api.apify.com/v2/acts/${actSeg}/runs`);
  listUrl.searchParams.set("limit", "20");
  listUrl.searchParams.set("desc", "1");
  listUrl.searchParams.set("status", "SUCCEEDED");

  const listRes = await fetch(listUrl.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!listRes.ok) return null;

  const listPayload = (await listRes.json().catch(() => null)) as
    | { data?: { items?: { defaultDatasetId?: string; status?: string }[] } }
    | null;
  const items = listPayload?.data?.items;
  if (!Array.isArray(items)) return null;

  for (const run of items) {
    if (run.status !== "SUCCEEDED") continue;
    const ds = run.defaultDatasetId;
    if (typeof ds === "string" && ds.length > 0) return ds;
  }

  return null;
}

// ─────────────────────────────────────────────
// 공식 채널 (고정)
// ─────────────────────────────────────────────
export const CHANNELS = {
  FR: {
    label: "프랑스",
    flag: "🇫🇷",
    domain: "amazon.fr",
    storeUrl: "https://www.amazon.fr/stores/page/8FDE7826-EC48-4E33-A826-79908DF9BC30?channel=FR%20ME_SNS",
  },
  UK: {
    label: "영국",
    flag: "🇬🇧",
    domain: "amazon.co.uk",
    storeUrl: "https://www.amazon.co.uk/stores/page/4EFC153A-0371-48D9-B947-9A828BA1EDC0?channel=UK%20ME_SNS",
  },
} as const;

export type ChannelKey = keyof typeof CHANNELS;

// ─────────────────────────────────────────────
// ✏️ 수동 입력: 국가별 카테고리 → 제품 목록
//
// ASIN 찾는 법:
//   amazon.fr 또는 amazon.co.uk에서 제품 페이지 열면
//   URL에 /dp/B0XXXXXXXXX 형태로 나옴
//
// 카테고리는 각 스토어 페이지의 "By category" 기준
// ─────────────────────────────────────────────
export const PRODUCT_MAP: Record<
  ChannelKey,
  Record<string, { name: string; asin: string }[]>
> = {
  FR: {
    뷰티기기: [
      { name: "Age-R Booster Pro", asin: "B0DHGP8TZ2" },
    ],
    토너: [
      { name: "Zero Pore Pads 2.0", asin: "B09V7Z4TJG" },
      { name: "Deep Vita C Facial Toner Pads", asin: "B0BPLYHDPG" },
      { name: "Zero Pore Pads Mild", asin: "B0CW1KV8B6" },
      { name: "Triple Collagen Toner", asin: "B085VS2J3T" },
      { name: "PDRN Pink Cica Soothing Toner", asin: "B0DK3111J9" },
      { name: "Exosome Cica Calming Pads", asin: "B0DFG4MRC9" },
      { name: "Exosome Cica Toner", asin: "B0DGQ2SXSF" },
    ],
    세럼: [
      { name: "PDRN Pink Peptide Serum", asin: "B0DBF65JYY" },
      { name: "Triple Collagen Serum", asin: "B085VWWJJT" },
      { name: "Exosome Cica Ampoule", asin: "B0DGPVMCQG" },
      { name: "One Day Exosome Shot 2000", asin: "B0D16L5F2M" },
      { name: "One Day Exosome Shot 7500", asin: "B0D137TMRB" },
    ],
    크림: [
      { name: "Collagen Jelly Cream", asin: "B0CM2PPNMW" },
      { name: "Deep Vita C Capsule Cream", asin: "B0D2Z3GGCY" },
      { name: "Triple Collagen Cream", asin: "B0BPXT3GBN" },
      { name: "PDRN Pink Hyaluronic Moisturizing Cream", asin: "B0DKNP4TL6" },
      { name: "Exosome Cica Cream", asin: "B0DJGM32D4" },
    ],
    마스크팩: [
      { name: "PDRN Pink Collagen Gel Mask", asin: "B0DGTMR754" },
      { name: "Kojic Acid Tumeric Brightening Gel Mask", asin: "B0DPJRS9DS" },
      { name: "Zero Pore Blackhead Mud Mask", asin: "B0D1G7XF9X" },
    ],
    클렌저: [
      { name: "Zero Pore Blackhead Cleansing Oil", asin: "B0DPJR1N27" },
      { name: "Zero Foam Cleanser", asin: "B09C1B7BH5" },
      { name: "Red Foam Cleanser", asin: "B0CVRD7N68" },
    ],
  },
  UK: {
    토너: [
      { name: "Zero Pore Pads 2.0", asin: "B09V7Z4TJG" },
      { name: "Zero Pore Pads Mild", asin: "B0CW1KV8B6" },
      { name: "Red Succinic Acid Peeling Pad", asin: "B0CV7RX6ML" },
      { name: "PDRN Pink Collagen Jelly Pad", asin: "B0DX74CWSQ" },
      { name: "Deep Vita C Pads", asin: "B0BPLYHDPG" },
      { name: "Triple Collagen Toner", asin: "B085VS2J3T" },
      { name: "PDRN Pink Cica Soothing Toner", asin: "B0DK3111J9" },
      { name: "Exosome Cica Toner", asin: "B0DGQ2SXSF" },
    ],
    마스크팩: [
      { name: "PDRN pink collagen jelly gel mask", asin: "B0DGTMR754" },
      { name: "Kojic Acid Turmeric Brightening Gel Mask", asin: "B0DPJRS9DS" },
      { name: "Collagen Night Wrapping Cream  mask", asin: "B0BRMYHMS5" },
      { name: "Zero Pore Blackhead Mud Mask", asin: "B0D1G7XF9X" },
      { name: "Kojic Acid Turmeric Night Wrapping Mask", asin: "B0FB36X74P" },
    ],
    세럼: [
      { name: "PDRN Pink Peptide Serum", asin: "B0DBF65JYY" },
      { name: "Triple Collagen Serum", asin: "B085VWWJJT" },
      { name: "Zero Exosome Shot 2,000 PPM Spicule Facial Serum", asin: "B0D16L5F2M" },
      { name: "Zero Exosome Shot 7,500 PPM Spicule Facial Serum", asin: "B0D137TMRB" },
      { name: "PDRN Pink Collagen Exosome Shot Serum 2,000 PPM", asin: "B0DQCJ9T9N" },
      { name: "PDRN Pink Collagen Exosome Shot Serum 7,500 PPM", asin: "B0DQCLFJCB" },
      { name: "Zero Pore One-day Serum", asin: "B09G267W27" },
      { name: "Exosome Cica Tea Tree Ampoule", asin: "B0DGPVMCQG" },
      { name: "Deep Vita C Serum 2.0", asin: "B08PTX9BYJ" },
      { name: "Deep Vita A Retinol Serum", asin: "B0CW1FR28X" },
    ],
    크림: [
      { name: "Collagen Jelly Cream", asin: "B0CM2PPNMW" },
      { name: "Triple Collagen Cream", asin: "B0BPXT3GBN" },
      { name: "Deep Vitamin C Golden Capsule Cream", asin: "B0D2Z3GGCY" },
      { name: "TXA+Niacinamide Capsule Cream", asin: "B0F29C8N84" },
      { name: "PDRN Pink Hyaluronic Moisturising Cream", asin: "B0DKNP4TL6" },
      { name: "Exosome Cica Tea Tree Cream", asin: "B0DJGM32D4" },
    ],
    클렌저: [
      { name: "Zero Pore Blackhead Cleansing Oil", asin: "B0DPJR1N27" },
      { name: "Zero Foam Cleanser", asin: "B09C1B7BH5" },
      { name: "Zero Pore SA Clear Capsule Cleansing Foam", asin: "B0DYTQ5GYQ" },
      { name: "Double Cleansing Duo for Pore Care", asin: "B0DSZJBPHG" },
      { name: "Red Foam Cleanser", asin: "B0CVRD7N68" },
    ],
  },
};

/**
 * Apify amazon-reviews-scraper는 productUrls 배열에 동일 URL이 있으면 400을 반환함.
 * PRODUCT_MAP에 같은 ASIN이 카테고리/표기만 다르게 중복돼 있어도, 채널+URL 기준으로 1회만 넘김.
 */
export function buildProductUrlListForScraper(): { url: string }[] {
  const seen = new Set<string>();
  const out: { url: string }[] = [];

  for (const [channelKey, categories] of Object.entries(PRODUCT_MAP) as [
    ChannelKey,
    Record<string, { name: string; asin: string }[]>,
  ][]) {
    const domain = CHANNELS[channelKey].domain;
    for (const products of Object.values(categories)) {
      for (const p of products) {
        if (!p.asin) continue;
        const url = `https://www.${domain}/dp/${p.asin}`;
        if (seen.has(url)) continue;
        seen.add(url);
        out.push({ url });
      }
    }
  }
  return out;
}

/**
 * 카테고리·제품명으로 PRODUCT_MAP에서 ASIN 조회 (허용 목록 — 임의 URL 스크랩 방지)
 */
export function resolveProductAsin(
  channelKey: ChannelKey,
  category: string,
  productName: string
): string | null {
  if (category === "전체" || productName === "전체") return null;
  const list = PRODUCT_MAP[channelKey]?.[category];
  if (!list?.length) return null;
  const row = list.find((p) => p.name === productName);
  const asin = row?.asin?.trim();
  return asin ? asin.toUpperCase() : null;
}

/** 국가별 Amazon 상품 페이지 URL */
export function buildAmazonDpUrl(channelKey: ChannelKey, asin: string): string {
  const domain = CHANNELS[channelKey].domain;
  return `https://www.${domain}/dp/${asin}`;
}

export interface SingleProductScrapeResult {
  items: ApifyReviewItem[];
  runId: string;
  datasetId: string;
}

/**
 * 제품 필터 선택 시 1회 Run — 해당 dp URL만 넣어 최신 리뷰 수집 (전체 동기화와 별도)
 * sync/route와 동일한 프록시·maxReviews 환경변수 규칙을 맞춤.
 */
export async function scrapeReviewsForSingleProductUrl(
  productPageUrl: string,
  maxReviews: number
): Promise<SingleProductScrapeResult> {
  const waitSecsRaw = process.env.APIFY_WAIT_SECS?.trim();
  const waitSecsParsed = waitSecsRaw ? parseInt(waitSecsRaw, 10) : NaN;
  const waitSecs = Number.isFinite(waitSecsParsed)
    ? Math.min(Math.max(120, waitSecsParsed), 3600)
    : 600;

  const productUrls = [{ url: productPageUrl }];

  const input: {
    productUrls: typeof productUrls;
    proxy: { useApifyProxy: boolean; apifyProxyGroups?: string[] };
    sort: "recent" | "helpful";
    maxReviews?: number;
  } = {
    productUrls,
    proxy: { useApifyProxy: true },
    sort: "recent",
    maxReviews,
  };

  if (process.env.APIFY_USE_RESIDENTIAL_PROXY === "true") {
    input.proxy = {
      useApifyProxy: true,
      apifyProxyGroups: ["RESIDENTIAL"],
    };
  }

  const runMaxItems = Math.min(maxReviews + 200, 10_000);

  const chargeRaw = process.env.APIFY_MAX_TOTAL_CHARGE_USD?.trim();
  const maxTotalChargeUsd = chargeRaw
    ? Math.min(Math.max(0.5, parseFloat(chargeRaw)), 500)
    : undefined;

  const token = getApifyToken();
  if (!token) {
    throw new Error("Apify 토큰이 없습니다.");
  }

  const actorId = getReviewsActorId();
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

  const datasetId = run.defaultDatasetId;
  if (typeof datasetId !== "string" || !datasetId.length) {
    throw new Error("Run 결과에 defaultDatasetId가 없습니다.");
  }

  const items = await fetchDatasetItemsPaginated(datasetId);
  return { items, runId: run.id, datasetId };
}

// ─────────────────────────────────────────────

/** junglee/amazon-reviews-scraper 등 액터별 필드 차이를 흡수 */
export interface ApifyReviewItem {
  asin?: string;
  productAsin?: string;
  text?: string;
  reviewText?: string;
  reviewDescription?: string;
  reviewTitle?: string;
  rating?: number;
  ratingValue?: number;
  ratingScore?: number;
  url?: string;
  reviewUrl?: string;
  /** 예: "Reviewed in the United Kingdom on ..." / "Commenté en France le ..." */
  reviewedIn?: string;
  /** Junglee 등에서 오는 게시 시각(필드명은 액터마다 다름) */
  publishedAt?: string;
  publishedAtDate?: string;
  reviewDate?: string;
  date?: string;
  /** 같은 상품 내 목록 순서(수집이 최신순이면 작을수록 최근일 수 있음) */
  position?: number;
}

/** 대시보드로 읽는 Dataset 최대 행 수 (응답 크기·Apify 호출 상한) */
export const REVIEW_DATASET_MAX_ITEMS = 50_000;

const DATASET_PAGE_SIZE = 1000;

/**
 * Dataset을 페이지네이션으로 모두 가져옴.
 * listItems를 한 번만 호출하면 limit(예: 1000) 이상의 수집분이 UI에서 누락됨.
 */
export async function fetchDatasetItemsPaginated(
  datasetId: string
): Promise<ApifyReviewItem[]> {
  const token = getApifyToken();
  if (!token) {
    throw new Error("Apify 토큰이 없습니다.");
  }

  const all: ApifyReviewItem[] = [];
  let offset = 0;

  while (all.length < REVIEW_DATASET_MAX_ITEMS) {
    const take = Math.min(DATASET_PAGE_SIZE, REVIEW_DATASET_MAX_ITEMS - all.length);
    const url = new URL(
      `https://api.apify.com/v2/datasets/${encodeURIComponent(datasetId)}/items`
    );
    url.searchParams.set("format", "json");
    // clean=true 시 일부 액터 필드가 과도하게 정리되어 본문이 비는 사례가 있어 false 유지
    url.searchParams.set("clean", "false");
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("limit", String(take));

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = new Error(
        `Dataset items 조회 실패 (${res.status} ${res.statusText})`
      ) as Error & { statusCode?: number };
      err.statusCode = res.status;
      throw err;
    }

    const batchUnknown = (await res.json()) as unknown;
    if (!Array.isArray(batchUnknown) || batchUnknown.length === 0) break;
    const batch = batchUnknown as ApifyReviewItem[];
    all.push(...batch);
    if (batch.length < take) break;
    offset += batch.length;
  }

  return all;
}

export interface ReviewSummary {
  country: string;
  positive: number;
  neutral: number;
  negative: number;
}

export interface ReviewItem {
  original: string;
  sentiment: "positive" | "neutral" | "negative";
  rating: number;
  category: string;
  product: string;
  /** UI·차트 표시용 대표 채널 */
  channel: ChannelKey;
  /**
   * 필터에 통과하는 채널 (ASIN이 FR·UK 맵에 모두 있고 마켓 단서가 없을 때 ['FR','UK']).
   * 그 외에는 [channel] 한 개.
   */
  channelMatch: ChannelKey[];
  /** dual FR·UK 매칭일 때 프랑스 쪽 카테고리/제품명 (필터 pill과 동일하게 맞춤) */
  frCategory?: string;
  frProduct?: string;
  ukCategory?: string;
  ukProduct?: string;
  /** 최신순 정렬용(밀리초). 파싱 실패 시 0 */
  reviewedAtMs: number;
  /** Dataset에 나온 순서(보조 정렬) */
  sourceOrder: number;
}

/** 리스트·필터와 동일한 기준으로 국가별 라벨 해석 */
export function resolveReviewLabels(
  r: ReviewItem,
  selectedChannel: ChannelKey
): { category: string; product: string } {
  const category =
    selectedChannel === "FR" && r.frCategory != null
      ? r.frCategory
      : selectedChannel === "UK" && r.ukCategory != null
        ? r.ukCategory
        : r.category;
  const product =
    selectedChannel === "FR" && r.frProduct != null
      ? r.frProduct
      : selectedChannel === "UK" && r.ukProduct != null
        ? r.ukProduct
        : r.product;
  return { category, product };
}

export function classifySentiment(
  rating: number
): "positive" | "neutral" | "negative" {
  if (rating >= 4) return "positive";
  if (rating === 3) return "neutral";
  return "negative";
}

// 채널(FR / UK)별 ASIN → { category, product } (동일 ASIN이 양쪽에 있어도 서로 덮어쓰지 않음)
export function buildAsinMapByChannel(): Record<
  ChannelKey,
  Record<string, { category: string; product: string }>
> {
  const map: Record<ChannelKey, Record<string, { category: string; product: string }>> = {
    FR: {},
    UK: {},
  };
  (["FR", "UK"] as ChannelKey[]).forEach((channelKey) => {
    const categories = PRODUCT_MAP[channelKey];
    for (const [category, products] of Object.entries(categories)) {
      for (const p of products) {
        map[channelKey][p.asin] = { category, product: p.name };
      }
    }
  });
  return map;
}

// 채널별 감성 집계 (차트용 — 대표 channel만 사용, 동일 리뷰 이중 막대 방지)
export function aggregateByChannel(items: ReviewItem[]): ReviewSummary[] {
  const acc: Record<string, ReviewSummary> = {};
  for (const item of items) {
    const label = CHANNELS[item.channel].label;
    if (!acc[label]) {
      acc[label] = { country: label, positive: 0, neutral: 0, negative: 0 };
    }
    acc[label][item.sentiment] += 1;
  }
  return Object.values(acc);
}

/**
 * 제품 상세(국가·SKU 선택) 모드용 — 리스트 국가 pill과 동일하게 `selectedChannel` 한 축에만 집계.
 * (원문 언어·URL 추론으로 r.channel이 UK로 잡혀도, 사용자가 고른 마켓 기준으로 차트를 맞춤)
 */
export function aggregateBySelectedChannel(
  items: ReviewItem[],
  selectedChannel: ChannelKey
): ReviewSummary[] {
  const label = CHANNELS[selectedChannel].label;
  const row: ReviewSummary = {
    country: label,
    positive: 0,
    neutral: 0,
    negative: 0,
  };
  for (const item of items) {
    row[item.sentiment] += 1;
  }
  return [row];
}

/**
 * Junglee 액터는 reviewUrl을 amazon.com으로 두는 경우가 많고, EU 프록시 시 amazon.fr 링크만 오기도 함.
 * reviewedIn 문구로 실제 구매/작성 마켓을 구분한다.
 */
function inferChannelFromReviewedIn(
  reviewedIn: string | undefined
): ChannelKey | null {
  if (!reviewedIn?.trim()) return null;
  const raw = reviewedIn.trim();
  const lower = raw.toLowerCase();
  const ascii = lower.normalize("NFD").replace(/\p{M}/gu, "");

  if (
    /\b(united kingdom|great britain|u\.k\.|england|scotland|wales|northern ireland)\b/i.test(
      raw
    ) ||
    /\b(royaume-uni|royaume uni)\b/i.test(raw) ||
    ascii.includes("united kingdom")
  ) {
    return "UK";
  }
  if (
    /\bfrance\b/i.test(raw) ||
    /\b(french|français|francais)\b/i.test(raw) ||
    /commenté en france|commente en france|évalué en france|evalue en france/i.test(
      raw
    )
  ) {
    return "FR";
  }
  return null;
}

/** 채널별 매핑이 비어 있으면 동일 ASIN의 반대 채널 라벨을 사용(카테고리 필터 누락 방지) */
function resolveProductMeta(
  channelKey: ChannelKey,
  asin: string,
  byChannel: ReturnType<typeof buildAsinMapByChannel>
): { category: string; product: string } | undefined {
  const primary = byChannel[channelKey][asin];
  if (primary) return primary;
  const other = channelKey === "UK" ? byChannel.FR[asin] : byChannel.UK[asin];
  return other;
}

/** Apify ASIN 필드 정규화 (공백·소문자) */
export function normalizeAsin(raw: string | undefined): string {
  if (!raw?.trim()) return "";
  return raw.trim().toUpperCase();
}

/** 리뷰/제품 URL에서 ASIN 추출 (본문 필드가 비었을 때) */
export function extractAsinFromAmazonUrl(url: string): string {
  const m = url.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:\/|[?#]|$)/i);
  return m?.[1] ? m[1].toUpperCase() : "";
}

/** Apify 원본 아이템에서 ASIN 추출(명시 필드 우선, 없으면 URL 파싱) */
export function extractAsinFromApifyItem(item: ApifyReviewItem): string {
  const direct = normalizeAsin(item.asin ?? item.productAsin);
  if (direct) return direct;
  return extractAsinFromAmazonUrl(item.url ?? item.reviewUrl ?? "");
}

/** 액터별로 제각각인 본문 필드·중첩 객체에서 리뷰 텍스트 추출 */
function pickReviewTextFromApifyItem(item: ApifyReviewItem): string {
  const rec = item as unknown as Record<string, unknown>;
  const candidates: unknown[] = [
    item.reviewDescription,
    item.text,
    item.reviewText,
    item.reviewTitle,
    rec.body,
    rec.content,
    rec.comment,
    rec.reviewComment,
    rec.fullReview,
    rec.reviewBody,
    rec.summary,
    rec.reviewContent,
  ];
  const nested = rec.review;
  if (nested !== null && typeof nested === "object" && !Array.isArray(nested)) {
    const nr = nested as Record<string, unknown>;
    candidates.push(nr.text, nr.body, nr.content, nr.description);
  }
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return "";
}

/** Apify 행에서 타임스탬프(ms) 추출 — 없으면 0 */
function extractReviewedAtMs(item: ApifyReviewItem): number {
  const raw = [
    item.publishedAt,
    item.publishedAtDate,
    item.reviewDate,
    item.date,
  ];
  for (const s of raw) {
    if (typeof s !== "string" || !s.trim()) continue;
    const t = Date.parse(s);
    if (!Number.isNaN(t)) return t;
  }
  return 0;
}

export function toReviewItems(items: ApifyReviewItem[]): ReviewItem[] {
  const byChannel = buildAsinMapByChannel();

  return items
    .map((item, sourceOrder) => {
      const text = pickReviewTextFromApifyItem(item);
      if (!text) return null;

      const ratingRaw =
        item.rating ?? item.ratingValue ?? item.ratingScore ?? 3;
      const rating =
        typeof ratingRaw === "number" && !Number.isNaN(ratingRaw)
          ? ratingRaw
          : 3;
      const urlRaw = item.url ?? item.reviewUrl ?? "";
      const urlLower = urlRaw.toLowerCase();
      let asin = normalizeAsin(item.asin ?? item.productAsin);
      if (!asin) asin = extractAsinFromAmazonUrl(urlRaw);

      const inFr = Boolean(byChannel.FR[asin]);
      const inUk = Boolean(byChannel.UK[asin]);

      const fromReviewed = inferChannelFromReviewedIn(item.reviewedIn);
      const explicitFr = urlLower.includes("amazon.fr");
      const explicitUk = urlLower.includes("amazon.co.uk");

      /** ASIN이 양쪽 맵에 있고, URL·reviewedIn으로 마켓을 못 정할 때 → FR/UK 필터 둘 다에서 보이게 */
      const dualFrUkAmbiguous =
        inFr &&
        inUk &&
        fromReviewed == null &&
        !explicitFr &&
        !explicitUk;

      let channelKey: ChannelKey;
      let channelMatch: ChannelKey[];

      if (fromReviewed) {
        channelKey = fromReviewed;
        channelMatch = [fromReviewed];
      } else if (explicitFr) {
        channelKey = "FR";
        channelMatch = ["FR"];
      } else if (explicitUk) {
        channelKey = "UK";
        channelMatch = ["UK"];
      } else if (inFr && !inUk) {
        channelKey = "FR";
        channelMatch = ["FR"];
      } else if (inUk && !inFr) {
        channelKey = "UK";
        channelMatch = ["UK"];
      } else if (dualFrUkAmbiguous) {
        channelKey = "FR";
        channelMatch = ["FR", "UK"];
      } else {
        channelKey = inUk ? "UK" : inFr ? "FR" : "UK";
        channelMatch = [channelKey];
      }

      const meta = resolveProductMeta(channelKey, asin, byChannel);
      const frRow = byChannel.FR[asin];
      const ukRow = byChannel.UK[asin];
      const reviewedAtMs = extractReviewedAtMs(item);

      return {
        original: text,
        sentiment: classifySentiment(rating),
        rating,
        category: meta?.category ?? "Unknown",
        product: meta?.product ?? "Unknown",
        channel: channelKey,
        channelMatch,
        reviewedAtMs,
        sourceOrder,
        ...(dualFrUkAmbiguous && frRow && ukRow
          ? {
              frCategory: frRow.category,
              frProduct: frRow.product,
              ukCategory: ukRow.category,
              ukProduct: ukRow.product,
            }
          : {}),
      };
    })
    .filter((r): r is ReviewItem => r !== null);
}
