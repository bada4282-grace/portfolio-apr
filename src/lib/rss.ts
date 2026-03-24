import Parser from "rss-parser";

export const rssParser = new Parser({
  timeout: 10000,
  headers: { "User-Agent": "Mozilla/5.0 (compatible; K-Beauty-Dashboard/1.0)" },
});

const PUBLIC_SOURCES = [
  {
    name: "ChannelX - Amazon UK+EU",
    url: "https://channelx.world/category/amazon/feed/",
    siteUrl: "https://channelx.world/category/amazon",
    platform: "ChannelX",
    countries: ["UK", "DE", "FR", "IT", "ES", "NL"],
    cookie: undefined,
  },
  {
    name: "ChannelX - TikTok Shop",
    url: "https://channelx.world/?s=tiktok+shop&feed=rss2",
    siteUrl: "https://channelx.world/?s=tiktok+shop",
    platform: "TikTok Shop - ChannelX",
    countries: ["UK", "DE", "FR", "IT", "ES", "NL"],
    cookie: undefined,
  },
  {
    name: "Ecommerce News Europe",
    url: "https://ecommercenews.eu/feed/",
    siteUrl: "https://ecommercenews.eu",
    platform: "Ecommerce News EU",
    countries: ["DE", "FR", "IT", "ES", "UK", "NL"],
    cookie: undefined,
  },
  {
    name: "Internet Retailing - UK",
    url: "https://internetretailing.net/feed/",
    siteUrl: "https://internetretailing.net",
    platform: "Internet Retailing",
    countries: ["UK"],
    cookie: undefined,
  },
];

export const RSS_SOURCES = [...PUBLIC_SOURCES];

export interface RssEntry {
  title: string;
  link: string;
  content: string;
  pubDate: string;
  source: (typeof RSS_SOURCES)[number];
}

export interface SourceResult {
  name: string;
  siteUrl: string;
  status: "ok" | "fail";
  count: number;
}

// \uD53C\uB4DC 1\uAC1C\uB97C \uD30C\uC2F1\uD574\uC11C \uCD5C\uC2E0 \uD56D\uBAA9 + \uC0C1\uD0DC \uBC18\uD658
export async function parseFeed(
  source: (typeof RSS_SOURCES)[number],
  maxItems = 10
): Promise<{ entries: RssEntry[]; result: SourceResult }> {
  try {
    const feed = await rssParser.parseURL(source.url);
    const entries = (feed.items ?? []).slice(0, maxItems).map((item) => ({
      title: item.title ?? "",
      link: item.link ?? "",
      content: item.contentSnippet ?? item.content ?? item.summary ?? "",
      pubDate: item.pubDate ?? item.isoDate ?? new Date().toISOString(),
      source,
    }));
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

// 모든 소스에서 병렬 수집 (maxItems로 OpenAI·번역 호출 횟수 조절)
export async function fetchAllFeeds(
  maxItemsPerFeed = 8
): Promise<{
  entries: RssEntry[];
  sourceResults: SourceResult[];
}> {
  const results = await Promise.all(
    RSS_SOURCES.map((s) => parseFeed(s, maxItemsPerFeed))
  );
  return {
    entries: results.flatMap((r) => r.entries),
    sourceResults: results.map((r) => r.result),
  };
}