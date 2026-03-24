"use client";

import {
  Bar,
  BarChart as RBarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartDataPoint } from "@/types/report";

/** 구조화 리포트용 막대 차트(채널별 리뷰 건수 등) */
export function PlatformBarChart({
  data,
  title,
}: {
  data: ChartDataPoint[];
  title: string;
}) {
  if (!data.length) return null;

  return (
    <div className="w-full">
      <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.12em] text-[#b5ada4]">
        {title}
      </p>
      <div className="h-[240px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <RBarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2ddd8" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#6b6560" }}
              axisLine={{ stroke: "#e2ddd8" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#9c958c" }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: "#fafaf8",
                border: "1px solid #e2ddd8",
                borderRadius: 4,
                fontSize: 12,
              }}
            />
            <Bar dataKey="value" fill="#2c2825" radius={[2, 2, 0, 0]} maxBarSize={48} />
          </RBarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
