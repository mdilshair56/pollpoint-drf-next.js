"use client";

import React, { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { QuestionResult } from "@/types/poll-results";

interface QuestionPieChartProps {
  question: QuestionResult;
}

// Sophisticated, modern luxury color palette
const LUXURY_PALETTE = [
  "#2563eb", // Royal Indigo / Blue
  "#06b6d4", // Electric Cyan
  "#f59e0b", // Amber Gold
  "#10b981", // Emerald
  "#8b5cf6", // Purple
  "#ec4899", // Magenta Pink
  "#f97316", // Coral Orange
  "#64748b", // Slate
];

export function QuestionPieChart({ question }: QuestionPieChartProps) {
  const { data, totalVotes } = useMemo(() => {
    let total = 0;
    const items = question.answer_options.map((opt) => {
      const votes = opt.voters?.length || 0;
      total += votes;
      return {
        id: opt.id,
        name: opt.name,
        value: votes,
        voters: opt.voters || [],
      };
    });

    return {
      data: items,
      totalVotes: total,
    };
  }, [question]);

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <div className="relative w-full h-[280px]">
        {totalVotes === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <div className="w-16 h-16 rounded-full border-2 border-dashed border-slate-200 flex items-center justify-center mb-2">
              <span className="text-xl">📊</span>
            </div>
            <p className="text-sm font-medium">No votes submitted yet</p>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={95}
                  paddingAngle={3}
                  dataKey="value"
                  animationDuration={800}
                >
                  {data.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={LUXURY_PALETTE[index % LUXURY_PALETTE.length]}
                      stroke="#ffffff"
                      strokeWidth={2}
                      className="hover:opacity-85 transition-opacity cursor-pointer outline-none"
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomPieTooltip totalVotes={totalVotes} />} />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value) => (
                    <span className="text-xs font-medium text-slate-600 ml-1">
                      {value}
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Total Counter */}
            <div className="absolute top-[43%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
              <span className="block text-2xl font-bold text-slate-900 tracking-tight">
                {totalVotes}
              </span>
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Responses
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CustomPieTooltip({ active, payload, totalVotes }: any) {
  if (active && payload && payload.length) {
    const item = payload[0].payload;
    const pct = totalVotes > 0 ? ((item.value / totalVotes) * 100).toFixed(1) : 0;

    return (
      <div className="bg-slate-900/95 backdrop-blur-md text-white px-3.5 py-2.5 rounded-xl shadow-xl border border-slate-700 text-xs z-50">
        <p className="font-semibold text-sm mb-1 text-slate-100">{item.name}</p>
        <div className="flex items-center gap-3 text-slate-300">
          <span>
            Votes: <strong className="text-white font-bold">{item.value}</strong>
          </span>
          <span className="text-emerald-400 font-semibold">{pct}%</span>
        </div>
      </div>
    );
  }
  return null;
}
