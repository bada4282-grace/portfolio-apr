"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface ReviewChartProps {
  data: {
    country: string;
    positive: number;
    neutral: number;
    negative: number;
  }[];
}

export default function ReviewChart({ data }: ReviewChartProps) {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" />
          <XAxis
            dataKey="country"
            tick={{ fontSize: 13, fill: "#6b7280" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "#9ca3af" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: "12px",
              border: "1px solid #f3f4f6",
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              fontSize: "13px",
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: "13px", paddingTop: "12px" }}
          />
          <Bar
            dataKey="positive"
            name="긍정"
            fill="#f472b6"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="neutral"
            name="중립"
            fill="#c4b5fd"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="negative"
            name="부정"
            fill="#94a3b8"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
