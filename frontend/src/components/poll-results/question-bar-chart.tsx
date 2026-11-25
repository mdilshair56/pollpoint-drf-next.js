"use client";

import React, { useMemo, useState } from "react";
import type { QuestionResult } from "@/types/poll-results";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { BarChart3, AlignLeft } from "lucide-react";

interface QuestionBarChartProps {
  question: QuestionResult;
}

const COLUMN_COLORS = [
  "#2563eb", // Royal Blue
  "#4f46e5", // Indigo
  "#06b6d4", // Cyan
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#64748b", // Slate
];

export function QuestionBarChart({ question }: QuestionBarChartProps) {
  const [layout, setLayout] = useState<"vertical" | "horizontal">("vertical");

  // Sort answer options descending: highest votes first
  const { sortedOptions, totalResponses } = useMemo(() => {
    let total = 0;
    const items = (question.answer_options || []).map((opt) => {
      const voteCount = opt.voters?.length || 0;
      total += voteCount;
      return {
        id: opt.id,
        name: opt.name,
        votes: voteCount,
        voters: opt.voters || [],
      };
    });

    // Sort descending by votes, then by id
    items.sort((a, b) => b.votes - a.votes || a.id - b.id);

    return {
      sortedOptions: items,
      totalResponses: total,
    };
  }, [question]);

  const chartData = useMemo(() => {
    return sortedOptions.map((opt) => {
      const percentage =
        totalResponses > 0
          ? Number(((opt.votes / totalResponses) * 100).toFixed(1))
          : 0;

      return {
        id: opt.id,
        name: opt.name,
        votes: opt.votes,
        percentage,
        voters: opt.voters,
      };
    });
  }, [sortedOptions, totalResponses]);

  if (sortedOptions.length === 0) {
    return <p className="text-xs text-slate-400 py-3 text-center">No options available.</p>;
  }

  return (
    <div className="w-full space-y-4">
      {/* Layout Switcher (Vertical Columns vs Horizontal Bars) */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Ranked Options ({sortedOptions.length})
        </span>

        <div className="inline-flex items-center p-1 bg-slate-100/90 rounded-xl border border-slate-200/80 select-none">
          <button
            type="button"
            onClick={() => setLayout("vertical")}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer select-none ${
              layout === "vertical"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-500 hover:text-slate-900"
            }`}
            title="Vertical Columns View"
          >
            <BarChart3 className="w-3.5 h-3.5 pointer-events-none shrink-0" />
            <span className="hidden sm:inline pointer-events-none">Vertical</span>
          </button>
          <button
            type="button"
            onClick={() => setLayout("horizontal")}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer select-none ${
              layout === "horizontal"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-500 hover:text-slate-900"
            }`}
            title="Horizontal Bars View"
          >
            <AlignLeft className="w-3.5 h-3.5 pointer-events-none shrink-0" />
            <span className="hidden sm:inline pointer-events-none">Horizontal</span>
          </button>
        </div>
      </div>

      {/* VERTICAL COLUMNS VIEW */}
      {layout === "vertical" ? (
        <div className="w-full pt-2">
          <div className="h-[270px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 10, left: -20, bottom: 25 }}
              >
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "#475569", fontWeight: 500 }}
                  interval={0}
                  tickLine={false}
                  axisLine={{ stroke: "#e2e8f0" }}
                  tickFormatter={(val: string) =>
                    val.length > 12 ? `${val.slice(0, 10)}…` : val
                  }
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  tickFormatter={(val) => `${val}%`}
                  domain={[0, 100]}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "rgba(59, 130, 246, 0.05)", radius: 8 }}
                  content={<CustomVerticalTooltip />}
                />
                <Bar
                  dataKey="percentage"
                  radius={[8, 8, 2, 2]}
                  animationDuration={800}
                >
                  {chartData.map((_, index) => (
                    <Cell
                      key={`col-${index}`}
                      fill={COLUMN_COLORS[index % COLUMN_COLORS.length]}
                      className="hover:opacity-85 transition-opacity cursor-pointer"
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-center text-slate-400 italic pt-1">
            Hover over any column to see full option details and voter names
          </p>
        </div>
      ) : (
        /* HORIZONTAL BARS VIEW */
        <div className="space-y-4 pt-1">
          {sortedOptions.map((opt, idx) => {
            const percentage =
              totalResponses > 0
                ? Number(((opt.votes / totalResponses) * 100).toFixed(1))
                : 0;

            return (
              <div key={opt.id} className="group relative">
                <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                  <div className="flex items-center gap-2 max-w-[70%]">
                    <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-bold">
                      #{idx + 1}
                    </span>
                    <span className="text-slate-800 truncate" title={opt.name}>
                      {opt.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-normal text-[11px]">
                      ({opt.votes} {opt.votes === 1 ? "vote" : "votes"})
                    </span>
                    <span className="text-blue-600 font-bold min-w-[42px] text-right">
                      {percentage}%
                    </span>
                  </div>
                </div>

                {/* Horizontal Progress Bar Container */}
                <div className="relative h-6 w-full bg-slate-100 rounded-lg overflow-visible p-0.5 cursor-pointer">
                  <div
                    className="h-full rounded-md bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-500 transition-all duration-700 ease-out flex items-center justify-end pr-2 group-hover:brightness-110 shadow-sm"
                    style={{ width: `${Math.max(percentage, percentage > 0 ? 3 : 0)}%` }}
                  />

                  {/* Floating Tooltip displaying voter names on hover */}
                  <div className="absolute left-1/2 -top-2 -translate-x-1/2 -translate-y-full opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 z-50 min-w-[220px] max-w-[320px]">
                    <div className="bg-slate-900/95 backdrop-blur-md text-white p-3 rounded-xl shadow-2xl border border-slate-700 text-xs">
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-700/60 mb-2">
                        <span className="font-semibold text-slate-200">{opt.name}</span>
                        <span className="bg-indigo-500/20 text-indigo-300 font-bold px-1.5 py-0.5 rounded text-[10px]">
                          {percentage}%
                        </span>
                      </div>

                      <div className="text-[11px]">
                        <p className="text-slate-400 font-medium mb-1">
                          Voters ({opt.voters.length}):
                        </p>
                        {opt.voters.length === 0 ? (
                          <p className="text-slate-500 italic">No voters for this option</p>
                        ) : (
                          <div className="max-h-36 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                            {opt.voters.map((voter) => (
                              <div
                                key={voter.user_id}
                                className="flex items-center gap-1.5 text-slate-200 bg-slate-800/60 px-2 py-1 rounded"
                              >
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                <span>
                                  {voter.first_name} {voter.last_name}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="absolute left-1/2 -bottom-1 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45 border-r border-b border-slate-700" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CustomVerticalTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-xl shadow-2xl border border-slate-700 text-xs z-50 min-w-[210px] max-w-[280px]">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-700/60 mb-2">
          <p className="font-bold text-sm text-slate-100 truncate pr-2">{data.name}</p>
          <span className="bg-blue-500/20 text-blue-300 font-bold px-2 py-0.5 rounded text-[11px]">
            {data.percentage}%
          </span>
        </div>

        <div className="flex items-center justify-between text-slate-300 mb-2">
          <span>Total Votes:</span>
          <strong className="text-white font-bold">{data.votes}</strong>
        </div>

        <div className="text-[11px]">
          <p className="text-slate-400 font-medium mb-1">
            Voters ({data.voters.length}):
          </p>
          {data.voters.length === 0 ? (
            <p className="text-slate-500 italic">No voters</p>
          ) : (
            <div className="max-h-32 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
              {data.voters.map((voter: any) => (
                <div
                  key={voter.user_id}
                  className="flex items-center gap-1.5 text-slate-200 bg-slate-800/60 px-2 py-1 rounded"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>
                    {voter.first_name} {voter.last_name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
}
