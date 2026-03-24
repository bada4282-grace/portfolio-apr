import { parse } from "node-html-parser";
import type { RssEntry, SourceResult } from "@/lib/rss";

// ?�롤�??�??TikTok ?�???�이지
const TIKTOK_SOURCES = [
  {
    name: "TikTok Seller UK ??University",
    url: "https://seller-uk.tiktok.com/university/",
    siteUrl: "https://seller-uk.tiktok.com/university",
    platform: "TikTok Shop ??UK Seller University",
    countries: ["?��?�� UK"],
  },
  {
    name: "TikTok Shop ??Global Newsroom",
    url: "https://seller.tiktokglobalshop.com/business/en/newsroom",
    siteUrl: "https://seller.tiktokglobalshop.com/business/en/newsroom",
    platform: "TikTok Shop ??Global Newsroom",
    countries: ["?��?�� UK", "?��?�� DE", "?��?�� FR", "?��?�� IT", "?��?�� ES", "?��?�� NL"],
  },
  {
    name: "TikTok Seller EU ??University",
    url: "https://seller-eu.tiktok.com/university/",
    siteUrl: "https://seller-eu.tiktok.com/university",
    platform: "TikTok Shop ??EU Seller University",
    countries: ["?��?�� DE", "?��?�� FR", "?��?�� IT", "?��?�� ES", "?��?�� NL"],
  },
];

export interface TikTokEntry {
  title: string;
  link: string;
  content: string;
  pubDate: string;
  source: (typeof TIKTOK_SOURCES)[number];
}

export interface TikTokFetchResult {
  entries: TikTokEntry[];
  sourceResults: SourceResult[];
}

// ?�이지?�서 __NEXT_DATA__ ?�는 구조???�이??JSON-LD)?�서 ??�� 추출 ?�도
function extractFromNextData(html: string, source: (typeof TIKTOK_SOURCES)[number]): TikTokEntry[] {
  try {
    const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!match) return [];

    const nextData = JSON.parse(match[1]) as {
      props?: {
        pageProps?: {
          articles?: { title: string; url: string; summary: string; publishTime: string }[];
          newsList?: { title: string; link: string; content: string; publishTime: string }[];
          list?: { title: string; url: string; desc: string; time: string }[];
        };
      };
    };

    const pageProps = nextData?.props?.pageProps;
    if (!pageProps) return [];

    // ?�양???�드�??�턴 ?�도
    const rawList =
      pageProps.articles ??
      pageProps.newsList ??
      pageProps.list ??
      [];

    return rawList.map((item) => ({
      title: item.title ?? "",
      // articles | newsList | list ? ?? ?? ???? ??? in ???? ??
      link:
        ("url" in item && item.url ? item.url : undefined) ??
        ("link" in item && item.link ? item.link : undefined) ??
        source.siteUrl,
      content:
        ("summary" in item && item.summary ? item.summary : undefined) ??
        ("content" in item && item.content ? item.content : undefined) ??
        ("desc" in item && item.desc ? item.desc : undefined) ??
        "",
      pubDate:
        ("publishTime" in item && item.publishTime
          ? item.publishTime
          : undefined) ??
        ("time" in item && item.time ? item.time : undefined) ??
        new Date().toISOString(),
      source,
    }));
  } catch {
    return [];
  }
}

// HTML?�서 기사 카드 ?�소�?직접 ?�싱 (SSR ?�이지 ?�??
function extractFromHtml(html: string, source: (typeof TIKTOK_SOURCES)[number]): TikTokEntry[] {
  try {
    const root = parse(html);
    const entries: TikTokEntry[] = [];

    // ?�반?�인 기사 카드 ?�?�터 ?�턴 ?�도
    const selectors = [
      "article",
      '[class*="article"]',
      '[class*="news-item"]',
      '[class*="card"]',
      "li[class*='item']",
    ];

    for (const selector of selectors) {
      const nodes = root.querySelectorAll(selector);
      if (nodes.length === 0) continue;

      for (const node of nodes.slice(0, 10)) {
        const titleEl = node.querySelector("h1, h2, h3, h4, [class*='title']");
        const linkEl = node.querySelector("a");
        const summaryEl = node.querySelector("p, [class*='desc'], [class*='summary']");
        const timeEl = node.querySelector("time, [class*='date'], [class*='time']");

        const title = titleEl?.text.trim() ?? "";
        if (!title) continue;

        const href = linkEl?.getAttribute("href") ?? "";
        const link = href.startsWith("http") ? href : `${source.siteUrl}${href}`;

        entries.push({
          title,
          link,
          content: summaryEl?.text.trim() ?? "",
          pubDate: timeEl?.getAttribute("datetime") ?? timeEl?.text.trim() ?? new Date().toISOString(),
          source,
        });
      }

      if (entries.length > 0) break;
    }

    return entries;
  } catch {
    return [];
  }
}

// ?�이지 JSON-LD 구조???�이?�에??기사 추출
function extractFromJsonLd(html: string, source: (typeof TIKTOK_SOURCES)[number]): TikTokEntry[] {
  try {
    const matches = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
    const entries: TikTokEntry[] = [];

    for (const match of matches) {
      const data = JSON.parse(match[1]) as {
        "@type"?: string;
        headline?: string;
        url?: string;
        description?: string;
        datePublished?: string;
        itemListElement?: { name: string; url: string; description?: string }[];
      };

      if (data["@type"] === "NewsArticle" || data["@type"] === "Article") {
        entries.push({
          title: data.headline ?? "",
          link: data.url ?? source.siteUrl,
          content: data.description ?? "",
          pubDate: data.datePublished ?? new Date().toISOString(),
          source,
        });
      }

      if (data["@type"] === "ItemList" && data.itemListElement) {
        for (const item of data.itemListElement) {
          entries.push({
            title: item.name,
            link: item.url ?? source.siteUrl,
            content: item.description ?? "",
            pubDate: new Date().toISOString(),
            source,
          });
        }
      }
    }

    return entries;
  } catch {
    return [];
  }
}

// 단일 TikTok 소스 페이지 크롤링
async function crawlTikTokPage(
  source: (typeof TIKTOK_SOURCES)[number],
  maxItems = 10
): Promise<{ entries: TikTokEntry[]; result: SourceResult }> {
  try {
    const res = await fetch(source.url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      return {
        entries: [],
        result: { name: source.name, siteUrl: source.siteUrl, status: "fail", count: 0 },
      };
    }

    const html = await res.text();

    // 추출 ?�선?�위: __NEXT_DATA__ ??JSON-LD ??HTML 직접 ?�싱
    const entries = (
      extractFromNextData(html, source).length > 0
        ? extractFromNextData(html, source)
        : extractFromJsonLd(html, source).length > 0
        ? extractFromJsonLd(html, source)
        : extractFromHtml(html, source)
    ).slice(0, maxItems);

    return {
      entries,
      result: { name: source.name, siteUrl: source.siteUrl, status: "ok", count: entries.length },
    };
  } catch {
    return {
      entries: [],
      result: { name: source.name, siteUrl: source.siteUrl, status: "fail", count: 0 },
    };
  }
}

// 모든 TikTok 소스 병렬 크롤링
export async function fetchTikTokPolicies(): Promise<TikTokFetchResult> {
  const results = await Promise.all(TIKTOK_SOURCES.map((s) => crawlTikTokPage(s)));
  return {
    entries: results.flatMap((r) => r.entries),
    sourceResults: results.map((r) => r.result),
  };
}
