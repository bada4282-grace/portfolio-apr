"use client";
// 리뷰·차트는 /api/reviews(Apify 데이터셋) 응답만 사용합니다. 더미/샘플 폴백 없음.

import { useState, useEffect, useCallback, useMemo } from "react";
import ReviewChart from "@/components/ReviewChart";
import {
  BarChart3,
  Star,
  MessageSquare,
  Smile,
  Frown,
  AlertCircle,
  Inbox,
} from "lucide-react";
import {
  CHANNELS,
  PRODUCT_MAP,
  resolveReviewLabels,
  aggregateBySelectedChannel,
} from "@/lib/apify";
import type { ChannelKey, ReviewSummary, ReviewItem } from "@/lib/apify";

interface ApiResponse {
  chartData: ReviewSummary[];
  reviews: ReviewItem[];
  stats: {
    total: number;
    avgRating: number;
    positiveRate: number;
    channelCount: number;
  };
}

const EMPTY_REVIEWS: ReviewItem[] = [];

const SENTIMENT_OPTIONS = [
  { value: "전체",     label: "전체", border: "",        text: "",        bg: ""        },
  { value: "positive", label: "긍정", border: "#fda4af", text: "#be123c", bg: "#fff1f2" },
  { value: "neutral",  label: "중립", border: "#d4d4d8", text: "#52525b", bg: "#fafafa" },
  { value: "negative", label: "부정", border: "#94a3b8", text: "#475569", bg: "#f8fafc" },
] as const;
type SentimentValue = (typeof SENTIMENT_OPTIONS)[number]["value"];

function Pill({
  label,
  active,
  onClick,
  borderColor,
  textColor,
  bgColor,
  disabled,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  borderColor?: string;
  textColor?: string;
  bgColor?: string;
  disabled?: boolean;
}) {
  const activeStyle = active
    ? { background: "#ea0029", color: "#fff", borderColor: "transparent" }
    : borderColor
      ? { borderColor, color: textColor, background: bgColor }
      : {};

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={activeStyle}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        disabled
          ? "cursor-not-allowed border-gray-100 bg-gray-50 text-gray-300"
          : active
            ? ""
            : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
      }`}
    >
      {label}
    </button>
  );
}

function FilterRow({
  step,
  label,
  children,
}: {
  step: number;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-gray-100 py-2.5 last:border-0">
      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#ea0029] text-[10px] font-semibold text-white">
        {step}
      </div>
      <span className="w-16 shrink-0 pt-0.5 text-xs font-medium text-gray-400">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

export default function ReviewsPage() {
  const [selectedChannel, setSelectedChannel] = useState<ChannelKey | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("전체");
  const [selectedSentiment, setSelectedSentiment] = useState<SentimentValue>("전체");

  const [data, setData] = useState<ApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  /** 제품 필터에서 특정 SKU 선택 시 /api/reviews/product로 Apify 1회 Run */
  const [productPreview, setProductPreview] = useState<{ reviews: ReviewItem[] } | null>(
    null
  );
  const [productPreviewLoading, setProductPreviewLoading] = useState(false);
  const [productPreviewError, setProductPreviewError] = useState<string | null>(null);
  const [productPreviewUpdatedAt, setProductPreviewUpdatedAt] = useState<string | null>(null);
  const [translatedByKey, setTranslatedByKey] = useState<Record<string, string>>({});
  const [translationLoading, setTranslationLoading] = useState(false);
  const [liveLoadingSeconds, setLiveLoadingSeconds] = useState(0);
  const [adjectiveKeywords, setAdjectiveKeywords] = useState<{
    positive: string[];
    negative: string[];
  }>({ positive: [], negative: [] });
  const [keywordLoading, setKeywordLoading] = useState(false);

  // 국가 변경 → 카테고리·제품 초기화
  const handleChannelChange = (ch: ChannelKey) => {
    setSelectedChannel(ch);
    const categories = Object.keys(PRODUCT_MAP[ch]);
    setSelectedCategory(categories[0] ?? "");
    setSelectedProduct("전체");
  };

  // 카테고리 변경 → 제품 초기화
  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    setSelectedProduct("전체");
  };

  const loadReviews = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const res = await fetch("/api/reviews", { cache: "no-store" });
      if (!res.ok) { setData(null); setHasError(true); }
      else { setData(await res.json()); }
    } catch {
      setData(null); setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadReviews(); }, [loadReviews]);

  const isProductDetailMode =
    selectedProduct !== "전체" &&
    selectedChannel != null &&
    selectedCategory.length > 0;

  useEffect(() => {
    if (!isProductDetailMode) {
      setProductPreview(null);
      setProductPreviewError(null);
      setProductPreviewLoading(false);
      setProductPreviewUpdatedAt(null);
      return;
    }

    const ac = new AbortController();
    (async () => {
      setProductPreview(null);
      setProductPreviewError(null);
      setProductPreviewLoading(true);
      try {
        const res = await fetch("/api/reviews/product", {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channel: selectedChannel,
            category: selectedCategory,
            product: selectedProduct,
          }),
          signal: ac.signal,
        });
        const json = (await res.json()) as {
          error?: string;
          reviews?: ReviewItem[];
        };
        if (!res.ok) {
          throw new Error(json.error ?? `요청 실패 (${res.status})`);
        }
        if (!Array.isArray(json.reviews)) {
          throw new Error("응답 형식이 올바르지 않습니다.");
        }
        setProductPreview({ reviews: json.reviews });
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, "0");
        const d = String(now.getDate()).padStart(2, "0");
        const hh = String(now.getHours()).padStart(2, "0");
        const mm = String(now.getMinutes()).padStart(2, "0");
        setProductPreviewUpdatedAt(`${y}-${m}-${d} ${hh}:${mm}`);
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        setProductPreviewError(
          e instanceof Error ? e.message : "알 수 없는 오류"
        );
      } finally {
        if (!ac.signal.aborted) {
          setProductPreviewLoading(false);
        }
      }
    })();

    return () => ac.abort();
  }, [
    isProductDetailMode,
    selectedChannel,
    selectedCategory,
    selectedProduct,
  ]);

  useEffect(() => {
    if (!productPreviewLoading) {
      setLiveLoadingSeconds(0);
      return;
    }
    const timer = setInterval(() => {
      setLiveLoadingSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [productPreviewLoading]);

  // 선택된 국가의 카테고리 목록
  const categoryOptions: string[] =
    selectedChannel == null
      ? []
      : Object.keys(PRODUCT_MAP[selectedChannel]);

  // 선택된 카테고리의 제품 목록
  const productOptions: string[] =
    selectedChannel == null || selectedCategory.length === 0
      ? []
      : [
          "전체",
          ...(PRODUCT_MAP[selectedChannel][selectedCategory]?.map((p) => p.name) ?? []),
        ];

  const reviews = data?.reviews ?? [];
  const stats = data?.stats;
  const hasData = !isLoading && data !== null && reviews.length > 0;
  const showAnalysis = hasData && isProductDetailMode;

  // 4축 필터 (FR·UK 공통 ASIN + 마켓 단서 없음 → channelMatch로 양쪽 국가 필터 허용)
  const filtered = useMemo(
    () =>
      reviews.filter((r) => {
        if (selectedChannel == null) return false;
        const match = r.channelMatch ?? [r.channel];
        if (!match.includes(selectedChannel)) return false;
        const { category, product } = resolveReviewLabels(r, selectedChannel);
        if (selectedCategory.length > 0 && category !== selectedCategory) return false;
        if (selectedProduct !== "전체" && product !== selectedProduct) return false;
        if (selectedSentiment !== "전체" && r.sentiment !== selectedSentiment) return false;
        return true;
      }),
    [reviews, selectedChannel, selectedCategory, selectedProduct, selectedSentiment]
  );

  const previewBase = productPreview?.reviews ?? EMPTY_REVIEWS;
  const previewSentimentFiltered = useMemo(
    () =>
      previewBase.filter((r) =>
        selectedSentiment === "전체" ? true : r.sentiment === selectedSentiment
      ),
    [previewBase, selectedSentiment]
  );

  const displayedReviews = useMemo(
    () => (isProductDetailMode ? previewSentimentFiltered : filtered),
    [isProductDetailMode, previewSentimentFiltered, filtered]
  );
  const displayedReviewsSignature = useMemo(
    () =>
      displayedReviews
        .map((r) => `${r.channel}|${r.sourceOrder}|${r.original}`)
        .join("||"),
    [displayedReviews]
  );

  const statsRows = displayedReviews;
  const statTotal = statsRows.length;
  const statAvgRating =
    statTotal > 0
      ? statsRows.reduce((s, r) => s + r.rating, 0) / statTotal
      : 0;
  const positiveKeywordsText = adjectiveKeywords.positive.length
    ? adjectiveKeywords.positive
        .map((word, idx) => `${idx + 1}위 ${word}`)
        .join(" · ")
    : keywordLoading
      ? "분석 중..."
      : "-";
  const negativeKeywordsText = adjectiveKeywords.negative.length
    ? adjectiveKeywords.negative
        .map((word, idx) => `${idx + 1}위 ${word}`)
        .join(" · ")
    : keywordLoading
      ? "분석 중..."
      : "-";

  const chartDataForView =
    showAnalysis && selectedChannel != null
      ? aggregateBySelectedChannel(previewSentimentFiltered, selectedChannel)
      : [];

  const chartCaptionTotal =
    isProductDetailMode && productPreview
      ? productPreview.reviews.length
      : stats?.total ?? 0;

  const showReviewListEmpty = isProductDetailMode
    ? !productPreviewLoading &&
      !productPreviewError &&
      displayedReviews.length === 0
    : filtered.length === 0;
  const liveLoadingMessage =
    liveLoadingSeconds < 8
      ? "선택한 제품 페이지에 접속하고 있습니다..."
      : liveLoadingSeconds < 20
        ? "최근 리뷰를 수집하고 있습니다..."
        : "리뷰를 정리하고 화면에 반영하는 중입니다...";

  useEffect(() => {
    if (displayedReviews.length === 0) {
      setTranslatedByKey((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      setTranslationLoading((prev) => (prev ? false : prev));
      return;
    }

    const ac = new AbortController();
    (async () => {
      setTranslationLoading(true);
      try {
        const res = await fetch("/api/reviews/translate", {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            texts: displayedReviews.map((r) => r.original),
          }),
          signal: ac.signal,
        });

        const json = (await res.json()) as {
          translations?: string[];
          error?: string;
        };
        if (!res.ok || !Array.isArray(json.translations)) {
          throw new Error(json.error ?? `번역 요청 실패 (${res.status})`);
        }

        const mapped: Record<string, string> = {};
        displayedReviews.forEach((r, i) => {
          const key = `${r.channel}-${r.sourceOrder}-${r.original}`;
          mapped[key] = json.translations?.[i] ?? r.original;
        });
        setTranslatedByKey(mapped);
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        const fallback: Record<string, string> = {};
        displayedReviews.forEach((r) => {
          const key = `${r.channel}-${r.sourceOrder}-${r.original}`;
          fallback[key] = r.original;
        });
        setTranslatedByKey(fallback);
      } finally {
        if (!ac.signal.aborted) {
          setTranslationLoading(false);
        }
      }
    })();

    return () => ac.abort();
  }, [displayedReviewsSignature, selectedSentiment]);

  useEffect(() => {
    if (!showAnalysis || statsRows.length === 0) {
      setAdjectiveKeywords({ positive: [], negative: [] });
      setKeywordLoading(false);
      return;
    }

    const ac = new AbortController();
    (async () => {
      setKeywordLoading(true);
      try {
        const res = await fetch("/api/reviews/keywords", {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reviews: statsRows.map((r) => ({
              sentiment: r.sentiment,
              text: r.original,
            })),
          }),
          signal: ac.signal,
        });
        const json = (await res.json()) as {
          positive?: string[];
          negative?: string[];
          error?: string;
        };
        if (!res.ok) {
          throw new Error(json.error ?? `키워드 요청 실패 (${res.status})`);
        }
        setAdjectiveKeywords({
          positive: Array.isArray(json.positive) ? json.positive.slice(0, 2) : [],
          negative: Array.isArray(json.negative) ? json.negative.slice(0, 2) : [],
        });
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        setAdjectiveKeywords({ positive: [], negative: [] });
      } finally {
        if (!ac.signal.aborted) {
          setKeywordLoading(false);
        }
      }
    })();

    return () => ac.abort();
  }, [displayedReviewsSignature, showAnalysis]);

  return (
    <div className="bg-zinc-50">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">

      {/* 헤더 — 랜딩 2번 카드(유럽 리뷰 분석)와 동일 BarChart3·zinc-400·stroke 1.5 */}
      <div className="mb-8 rounded-[10px] border border-[#e5e7eb] bg-white p-8">
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2.5">
          <BarChart3
            className="col-start-1 row-span-2 h-6 w-6 shrink-0 self-start text-zinc-400"
            strokeWidth={1.5}
            aria-hidden
          />
          <h1 className="col-start-2 row-start-1 min-w-0 self-center text-lg font-bold leading-tight tracking-tight text-zinc-900 sm:text-xl">
            리뷰 분석
          </h1>
          <p className="col-start-2 row-start-2 text-[15px] leading-relaxed text-[#666666]">
            MEDICUBE — Amazon FR · Amazon UK 공식 채널 리뷰를 바탕으로 감성 분포와 핵심 키워드를
            확인합니다.
          </p>
        </div>
      </div>

      {/* 에러 */}
      {hasError && !isLoading && (
        <div className="mb-5 flex items-center gap-2 rounded-[10px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            데이터를 불러올 수 없습니다.{" "}
            <code className="rounded bg-red-100 px-1">NEXT_PUBLIC_APIFY_API_TOKEN</code>
            (또는 <code className="rounded bg-red-100 px-1">APIFY_API_TOKEN</code>)과
            수집 실행 여부를 확인하세요. (Dataset은 최근 성공 Run에서 자동 조회)
          </span>
        </div>
      )}

      {/* 로딩 */}
      {isLoading && (
        <div className="flex h-64 items-center justify-center text-sm text-gray-400">
          데이터 불러오는 중...
        </div>
      )}

      {/* 빈 상태 */}
      {!isLoading && !hasData && (
        <div className="flex flex-col items-center justify-center rounded-[10px] border border-dashed border-gray-200 bg-white py-20 text-center">
          <Inbox className="mb-4 h-10 w-10 text-gray-300" />
          <p className="mb-1 text-sm font-medium text-gray-500">수집된 리뷰가 없습니다</p>
          <p className="text-xs text-gray-400">
            제품 필터를 선택하면 해당 ASIN 리뷰를 자동으로 다시 수집합니다.
          </p>
        </div>
      )}

      {/* 데이터 있을 때 */}
      {hasData && (
        <>
          {/* 4축 필터 */}
          <div className="mb-8 rounded-[10px] border border-[#e5e7eb] bg-white px-5 py-3">

            {/* 1. 국가 */}
            <FilterRow step={1} label="국가">
              {(["FR", "UK"] as const).map((key) => {
                const ch = CHANNELS[key];
                return (
                  <Pill
                    key={key}
                    label={`${ch.flag} ${ch.label}`}
                    active={selectedChannel === key}
                    onClick={() => handleChannelChange(key)}
                  />
                );
              })}
            </FilterRow>

            {/* 2. 카테고리 */}
            <FilterRow step={2} label="카테고리">
              {selectedChannel == null ? (
                <span className="pt-0.5 text-xs text-gray-300">국가를 먼저 선택하세요</span>
              ) : (
                categoryOptions.map((cat) => (
                  <Pill
                    key={cat}
                    label={cat}
                    active={selectedCategory === cat}
                    onClick={() => handleCategoryChange(cat)}
                  />
                ))
              )}
            </FilterRow>

            {/* 3. 제품 */}
            <FilterRow step={3} label="제품">
              {selectedChannel == null ? (
                <span className="pt-0.5 text-xs text-gray-300">국가를 먼저 선택하세요</span>
              ) : selectedCategory.length === 0 ? (
                <span className="pt-0.5 text-xs text-gray-500">
                  카테고리를 먼저 선택해 주세요.
                </span>
              ) : (
                productOptions.map((p) => (
                  <Pill
                    key={p}
                    label={p}
                    active={selectedProduct === p}
                    onClick={() => setSelectedProduct(p)}
                  />
                ))
              )}
            </FilterRow>

            {/* 4. 감성 */}
            <FilterRow step={4} label="감성">
              {SENTIMENT_OPTIONS.map((s) => (
                <Pill
                  key={s.value}
                  label={s.label}
                  active={selectedSentiment === s.value}
                  onClick={() => setSelectedSentiment(s.value)}
                  borderColor={s.border || undefined}
                  textColor={s.text || undefined}
                  bgColor={s.bg || undefined}
                />
              ))}
            </FilterRow>
          </div>

          {!showAnalysis ? (
            <div className="rounded-[10px] border border-dashed border-zinc-200 bg-zinc-50/60 px-6 py-16 text-center">
              <p className="text-sm font-medium text-zinc-800">
                국가, 카테고리, 제품을 선택하면 실시간 리뷰 분석을 시작합니다.
              </p>
              <p className="mt-2 text-xs text-[#757575]">
                제품을 선택하기 전에는 차트와 리뷰 목록을 표시하지 않습니다.
              </p>
            </div>
          ) : (
            <>
              {/* 요약 지표 */}
              <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  {
                    icon: MessageSquare,
                    label:
                      isProductDetailMode
                        ? "표시 리뷰(실시간)"
                        : "필터된 리뷰",
                    value: `${statTotal.toLocaleString()}건`,
                  },
                  {
                    icon: Star,
                    label: "평균 평점",
                    value: `${Math.round(statAvgRating * 10) / 10} / 5.0`,
                  },
                  {
                    icon: Smile,
                    label: "긍정 리뷰 핵심 키워드",
                    value: positiveKeywordsText,
                  },
                  {
                    icon: Frown,
                    label: "부정 리뷰 핵심 키워드",
                    value: negativeKeywordsText,
                  },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="rounded-[10px] border border-[#e5e7eb] bg-white p-4">
                    <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100">
                      <Icon className="h-4 w-4 text-zinc-700" />
                    </div>
                    <p className="text-lg font-bold text-gray-900">{value}</p>
                    <p className="text-xs text-gray-400">{label}</p>
                  </div>
                ))}
              </div>

              {/* 차트 */}
              <div className="mb-10 rounded-[10px] border border-[#e5e7eb] bg-white p-6">
                <h2 className="mb-1 text-lg font-bold text-gray-900">채널별 감성 분포</h2>
                <p className="mb-4 text-xs text-gray-400">
                  {isProductDetailMode
                    ? productPreviewLoading
                      ? "선택한 제품으로 리뷰를 수집하는 중입니다…"
                      : productPreviewError
                        ? "차트를 표시할 수 없습니다."
                        : `이번 실행으로 수집된 ${chartCaptionTotal.toLocaleString()}건 기준 (아래 감성 필터 반영)`
                    : `데이터셋 전체 ${stats!.total.toLocaleString()}건 기준`}
                </p>
                {isProductDetailMode && productPreviewLoading ? (
                  <div className="flex h-80 flex-col items-center justify-center gap-3 text-sm text-gray-500">
                    <div className="h-7 w-7 animate-spin rounded-full border-2 border-zinc-200 border-t-[#ea0029]" />
                    <p className="font-medium text-gray-700">{liveLoadingMessage}</p>
                    <p className="text-xs text-gray-400">실시간 수집 경과 {liveLoadingSeconds}초</p>
                    <div className="h-1.5 w-64 overflow-hidden rounded-full bg-zinc-200">
                      <div className="h-full w-1/2 animate-pulse rounded-full bg-[#ea0029]/70" />
                    </div>
                  </div>
                ) : (
                  <ReviewChart data={chartDataForView} />
                )}
              </div>

              {/* 리뷰 목록 */}
              <div>
                <h2
                  className={`text-lg font-bold text-gray-900 ${
                    isProductDetailMode ? "mb-1" : "mb-4"
                  }`}
                >
                  리뷰 목록
                </h2>
                {isProductDetailMode && (
                  <p className="mb-4 text-xs text-gray-400">
                    선택한 제품의 최근 리뷰 10개를 실시간으로 가져옵니다.
                    {productPreviewUpdatedAt
                      ? ` 마지막 갱신: ${productPreviewUpdatedAt}`
                      : ""}
                  </p>
                )}

                {isProductDetailMode && productPreviewLoading && (
                  <div className="mb-4 rounded-[10px] border border-zinc-200 bg-zinc-50/80 px-4 py-8 text-center">
                    <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-zinc-200 border-t-[#ea0029]" />
                    <p className="text-sm font-medium text-zinc-900">{liveLoadingMessage}</p>
                    <p className="mt-1 text-xs text-[#757575]">
                      실시간 수집 경과 {liveLoadingSeconds}초 (네트워크/액터 상태에 따라 달라질 수 있습니다)
                    </p>
                  </div>
                )}

                {isProductDetailMode && productPreviewError && (
                  <div className="mb-4 flex items-start gap-2 rounded-[10px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{productPreviewError}</span>
                  </div>
                )}

                {showReviewListEmpty ? (
                  <div className="rounded-[10px] border border-dashed border-gray-200 bg-white p-10 text-center text-sm text-gray-400">
                    {isProductDetailMode
                      ? "이번 수집 결과가 없거나, 감성 필터에 맞는 리뷰가 없습니다."
                      : "선택한 필터 조건에 해당하는 리뷰가 없습니다."}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {displayedReviews.map((r, i) => {
                      const s = SENTIMENT_OPTIONS.find((o) => o.value === r.sentiment)!;
                      const ch = CHANNELS[selectedChannel!];
                      const { category: rowCat, product: rowProd } = resolveReviewLabels(
                        r,
                        selectedChannel!
                      );
                      return (
                        <div
                          key={`${r.channel}-${i}-${r.original.slice(0, 15)}`}
                          className="rounded-[10px] border border-[#e5e7eb] bg-white p-5"
                        >
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              {/* 채널 (국가) */}
                              <span className="rounded-full bg-[#ea0029]/10 px-2 py-0.5 text-xs font-medium text-[#ea0029]">
                                {ch.flag} {ch.label}
                              </span>
                              {/* 카테고리 */}
                              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                                {rowCat}
                              </span>
                              {/* 제품 */}
                              <span className="rounded-full bg-gray-50 px-2 py-0.5 text-xs text-gray-400">
                                {rowProd}
                              </span>
                              {/* 감성 */}
                              <span
                                style={{ borderColor: s.border, color: s.text, background: s.bg }}
                                className="rounded-full border px-2 py-0.5 text-xs font-medium"
                              >
                                {s.label}
                              </span>
                            </div>
                            {/* 별점 */}
                            <div className="flex shrink-0 items-center gap-0.5">
                              {Array.from({ length: 5 }).map((_, idx) => (
                                <Star
                                  key={idx}
                                  className={`h-3.5 w-3.5 ${
                                    idx < r.rating ? "fill-amber-400 text-amber-400" : "text-gray-200"
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="rounded-lg bg-gray-50 p-3">
                              <p className="mb-1 text-[11px] font-semibold text-gray-500">원문</p>
                              <p className="text-sm italic text-gray-500">&ldquo;{r.original}&rdquo;</p>
                            </div>
                            <div className="rounded-lg bg-zinc-100 p-3">
                              <p className="mb-1 text-[11px] font-semibold text-zinc-600">번역</p>
                              <p className="text-sm text-gray-700">
                                &ldquo;
                                {translatedByKey[`${r.channel}-${r.sourceOrder}-${r.original}`] ??
                                  (translationLoading ? "번역 중..." : r.original)}
                                &rdquo;
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
      </div>
    </div>
  );
}