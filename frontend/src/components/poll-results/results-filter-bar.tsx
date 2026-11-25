"use client";

import React from "react";
import type { PollResultFilters } from "@/types/poll-results";

interface ResultsFilterBarProps {
  filters: PollResultFilters;
  onChange: (filters: PollResultFilters) => void;
  onSearch: (e: React.FormEvent) => void;
  loading: boolean;
}

export function ResultsFilterBar({
  filters,
  onChange,
  onSearch,
  loading,
}: ResultsFilterBarProps) {
  return (
    <form
      onSubmit={onSearch}
      className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm mb-8 space-y-4"
    >
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
        {/* Search input (poll name, question, user name) */}
        <div className="md:col-span-5 relative">
          <input
            type="text"
            placeholder="Search by poll, question, or creator name..."
            value={filters.search || ""}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500 focus:bg-white transition-all text-slate-800 placeholder-slate-400"
          />
        </div>

        {/* Status filter */}
        <div className="md:col-span-3">
          <select
            value={filters.status || ""}
            onChange={(e) => onChange({ ...filters, status: e.target.value })}
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-indigo-500 text-slate-700 cursor-pointer"
          >
            <option value="">All Statuses (Active & Completed)</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        {/* Visibility filter */}
        <div className="md:col-span-2">
          <select
            value={filters.result_visibility || ""}
            onChange={(e) => onChange({ ...filters, result_visibility: e.target.value })}
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-indigo-500 text-slate-700 cursor-pointer"
          >
            <option value="">All Visibilities</option>
            <option value="live">Live</option>
            <option value="after_submission">After Submission</option>
            <option value="polls_end">Polls End</option>
            <option value="restricted">Restricted (Admin)</option>
          </select>
        </div>

        {/* Submit button */}
        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full h-full min-h-[38px] bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer select-none disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <span className="pointer-events-none">{loading ? "Filtering..." : "Apply Filters"}</span>
          </button>
        </div>
      </div>
    </form>
  );
}
