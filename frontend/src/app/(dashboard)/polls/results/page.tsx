"use client";

import React, { useEffect, useState, useCallback } from "react";
import { pollResultsService } from "@/services/poll-results-service";
import { authService } from "@/services/auth-service";
import type { PollResultDetail, PollResultFilters } from "@/types/poll-results";
import type { PaginationMeta } from "@/types/api";
import type { User } from "@/types/auth";
import { PollResultCard } from "@/components/poll-results/poll-result-card";
import { ResultsFilterBar } from "@/components/poll-results/results-filter-bar";
import { ChevronLeft, ChevronRight, BarChart3 } from "lucide-react";

const emptyPagination: PaginationMeta = {
  count: 0,
  next: null,
  previous: null,
  page: 1,
  page_size: 5,
  total_pages: 1,
};

export default function PollResultsPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [results, setResults] = useState<PollResultDetail[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>(emptyPagination);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<PollResultFilters>({
    status: "",
    result_visibility: "",
    search: "",
    page: 1,
    page_size: 5,
  });

  useEffect(() => {
    authService
      .getCurrentUser()
      .then((res) => setCurrentUser(res.data))
      .catch(() => setCurrentUser(null));
  }, []);

  const fetchResults = useCallback(async (currentFilters: PollResultFilters) => {
    setLoading(true);
    setError(null);
    try {
      const data = await pollResultsService.list(currentFilters);
      setResults(data.results || []);
      if (data.pagination) {
        setPagination(data.pagination);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load poll results. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResults(filters);
  }, [fetchResults, filters.page, filters.page_size]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters((prev) => ({ ...prev, page: 1 }));
    fetchResults({ ...filters, page: 1 });
  };

  const changePage = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="page-shell py-8 max-w-6xl mx-auto px-4">
      {/* Page Title & Intro */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2.5 h-2.5 rounded-full bg-interactive animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-interactive">
            Real-time Analytics
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
              Poll Results & Insights
            </h1>
            <p className="text-sm text-slate-500 mt-1 max-w-2xl">
              Visual reports, response breakdown pie charts, and voter statistics
              ranked by highest responses.
            </p>
          </div>
          {pagination.count > 0 && (
            <div className="flex items-center gap-2 bg-blue-50 text-brand px-3.5 py-1.5 rounded-xl border border-blue-100 text-xs font-semibold">
              <BarChart3 className="w-4 h-4 text-interactive" />
              <span>{pagination.count} Total Polls</span>
            </div>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <ResultsFilterBar
        filters={filters}
        onChange={setFilters}
        onSearch={handleSearch}
        loading={loading}
      />

      {/* Error Banner */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-5 py-4 rounded-xl text-sm mb-8 flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => fetchResults(filters)}
            className="text-xs font-bold underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading ? (
        <div className="space-y-6">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="bg-white rounded-3xl p-8 border border-slate-200/80 animate-pulse space-y-6"
            >
              <div className="h-7 bg-slate-200 rounded w-1/3" />
              <div className="h-4 bg-slate-100 rounded w-2/3" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                <div className="h-48 bg-slate-100 rounded-2xl" />
                <div className="h-48 bg-slate-100 rounded-2xl" />
              </div>
            </div>
          ))}
        </div>
      ) : results.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-sm max-w-md mx-auto my-12">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-brand flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
            📊
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">No Poll Results Found</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            There are no active or completed polls matching your search criteria.
          </p>
        </div>
      ) : (
        /* Poll Cards List */
        <div className="space-y-8">
          {results.map((poll) => (
            <PollResultCard
              key={poll.poll_id}
              poll={poll}
              currentUser={currentUser}
            />
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {!loading && pagination.total_pages > 1 && (
        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-sm">
          <button
            type="button"
            disabled={loading || pagination.page <= 1}
            onClick={() => changePage(Math.max(1, (filters.page ?? 1) - 1))}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-border bg-white text-brand hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-medium text-slate-500">
              Page{" "}
              <strong className="text-brand font-bold">
                {pagination.page}
              </strong>{" "}
              of{" "}
              <strong className="text-slate-800 font-bold">
                {Math.max(1, pagination.total_pages)}
              </strong>
            </span>
          </div>

          <button
            type="button"
            disabled={loading || pagination.page >= pagination.total_pages}
            onClick={() => changePage((filters.page ?? 1) + 1)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-border bg-white text-brand hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
