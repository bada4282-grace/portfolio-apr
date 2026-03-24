/** 플랫폼 동향 구조화 리포트(뷰·PDF·API 공통) */

export interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  summary?: string;
}

export interface TrendItem {
  keyword: string;
  direction: "up" | "down" | "stable";
  insight: string;
}

export interface PlayerItem {
  name: string;
  movement: string;
  significance: string;
}

export interface ChartDataPoint {
  label: string;
  value: number;
  note?: string;
}

export interface ReportData {
  topic: string;
  generatedAt: string;
  executiveSummary: string;
  keyFindings: string[];
  trends: TrendItem[];
  players: PlayerItem[];
  chartData: ChartDataPoint[];
  chartTitle: string;
  outlook: string;
  insightQuote: string;
  newsItems: NewsItem[];
}
