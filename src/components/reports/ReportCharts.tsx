"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatVnd } from "@/lib/money";

const COLORS = ["#0F4C5C", "#C9A227", "#2A9D8F", "#E76F51", "#6D597A", "#4A7C59"];

export function ReportCharts({
  months,
  sources,
}: {
  months: { label: string; thu: number; chi: number }[];
  sources: { name: string; value: number }[];
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-white p-4">
        <p className="mb-3 text-lg font-bold">Thu và chi 12 tháng</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={months}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
              <Tooltip formatter={(value) => formatVnd(Number(value ?? 0))} />
              <Legend />
              <Bar dataKey="thu" name="Thu" fill="#0F4C5C" radius={[6, 6, 0, 0]} />
              <Bar dataKey="chi" name="Chi" fill="#E76F51" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="rounded-2xl bg-white p-4">
        <p className="mb-3 text-lg font-bold">Thu theo nguồn</p>
        {sources.length === 0 ? (
          <p className="text-neutral-600">Chưa có khoản thu để vẽ.</p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={sources} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {sources.map((entry, index) => (
                    <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatVnd(Number(value ?? 0))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
