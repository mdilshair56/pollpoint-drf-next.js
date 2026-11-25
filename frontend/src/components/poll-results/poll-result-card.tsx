"use client";

import React, { useState, useRef, useEffect } from "react";
import type { PollResultDetail } from "@/types/poll-results";
import type { User } from "@/types/auth";
import { QuestionPieChart } from "./question-pie-chart";
import { QuestionBarChart } from "./question-bar-chart";
import {
  Calendar,
  Clock,
  User as UserIcon,
  ShieldCheck,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  ChevronDown,
} from "lucide-react";

interface PollResultCardProps {
  poll: PollResultDetail;
  currentUser: User | null;
}

export function PollResultCard({ poll, currentUser }: PollResultCardProps) {
  const [downloadingFormat, setDownloadingFormat] = useState<"excel" | "pdf" | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsExportOpen(false);
      }
    }

    if (isExportOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isExportOpen]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-400/30";
      case "in_progress":
        return "bg-cyan-500/20 text-cyan-200 border-cyan-400/30";
      default:
        return "bg-slate-500/20 text-slate-300 border-slate-400/30";
    }
  };

  const getVisibilityBadge = (visibility: string) => {
    switch (visibility) {
      case "live":
        return "bg-indigo-500/20 text-indigo-200 border-indigo-400/30";
      case "after_submission":
        return "bg-amber-500/20 text-amber-300 border-amber-400/30";
      case "restricted":
        return "bg-rose-500/20 text-rose-300 border-rose-400/30";
      default:
        return "bg-slate-500/20 text-slate-300 border-slate-400/30";
    }
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return "N/A";
    return new Date(isoString).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Authorization check: Admin & Superadmin can export all polls. Clients can only export their own polls.
  const canExport =
    currentUser &&
    (currentUser.is_superuser ||
      currentUser.role === "admin" ||
      currentUser.role === "superadmin" ||
      currentUser.id === poll.created_by?.user_id);

  const handleDownload = async (format: "excel" | "pdf") => {
    setIsExportOpen(false);
    setDownloadingFormat(format);
    const endpoint =
      format === "excel"
        ? `/api/backend/poll-results/${poll.poll_id}/export-excel/`
        : `/api/backend/poll-results/${poll.poll_id}/export-pdf/`;

    try {
      const response = await fetch(endpoint, {
        method: "GET",
        credentials: "same-origin",
      });

      if (!response.ok) {
        throw new Error("Export failed. You might not have permission to export this poll.");
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `poll_${poll.poll_id}_${format === "excel" ? "results.xlsx" : "report.pdf"}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err: any) {
      alert(err?.message || "Failed to download export file.");
    } finally {
      setDownloadingFormat(null);
    }
  };

  return (
    <article className="bg-white rounded-3xl shadow-lg border border-slate-200/90 hover:shadow-xl transition-all overflow-hidden mb-12 p-3 sm:p-4">
      {/* Luxury Gradient Header Banner */}
      <div className="relative p-6 sm:p-8 md:p-10 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white rounded-2xl sm:rounded-3xl shadow-md border border-slate-800/80 overflow-visible">
        {/* Subtle decorative glow overlay */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Badges, Export Action, & Timing Row (z-20 renders above title & description, but scrolls cleanly under z-50 sticky navbar) */}
        <div className="relative z-20 flex flex-wrap items-center justify-between gap-4 mb-6 pb-5 border-b border-slate-800/80">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs font-mono font-bold tracking-wider text-slate-300 bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-700/80 shadow-inner">
              POLL #{poll.poll_id}
            </span>
            <span
              className={`text-xs font-bold px-3 py-1.5 rounded-xl border capitalize tracking-wide shadow-sm flex items-center gap-1.5 ${getStatusBadge(
                poll.status
              )}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              {poll.status.replace("_", " ")}
            </span>
            <span
              className={`text-xs font-bold px-3 py-1.5 rounded-xl border capitalize tracking-wide shadow-sm flex items-center gap-1.5 ${getVisibilityBadge(
                poll.result_visibility
              )}`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              {poll.result_visibility.replace("_", " ")}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Click-to-Open Export Menu with Click-Outside Guard */}
            {canExport && (
              <div className="relative z-20" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsExportOpen((prev) => !prev)}
                  disabled={downloadingFormat !== null}
                  className="relative inline-flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-blue-900/30 border border-blue-400/40 transition-colors cursor-pointer select-none disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {downloadingFormat ? (
                    <Loader2 className="w-4 h-4 animate-spin pointer-events-none shrink-0" />
                  ) : (
                    <Download className="w-4 h-4 pointer-events-none shrink-0" />
                  )}
                  <span className="pointer-events-none">Export</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 pointer-events-none shrink-0 ${
                      isExportOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* Dropdown Menu (z-30 ensures it renders over the poll name & description below, while staying below the sticky navbar) */}
                {isExportOpen && (
                  <div className="absolute right-0 top-full mt-2.5 z-30 w-64 bg-slate-900/98 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/80 p-2 text-xs space-y-1.5 pointer-events-auto">
                    <div className="px-2.5 py-1 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Choose Export Format
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDownload("excel")}
                      disabled={downloadingFormat !== null}
                      className="w-full group flex items-center justify-between p-3 rounded-xl bg-slate-800/90 hover:bg-slate-750 active:bg-slate-850 text-slate-100 hover:text-white border border-slate-700/80 hover:border-emerald-500/50 shadow-sm transition-colors cursor-pointer select-none text-left disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-center gap-3 pointer-events-none">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                          <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div>
                          <span className="font-bold text-white block text-xs">Raw Data (Excel)</span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">Spreadsheet .xlsx file</span>
                        </div>
                      </div>
                      <Download className="w-4 h-4 text-slate-400 group-hover:text-emerald-400 pointer-events-none shrink-0 ml-2 transition-colors" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownload("pdf")}
                      disabled={downloadingFormat !== null}
                      className="w-full group flex items-center justify-between p-3 rounded-xl bg-slate-800/90 hover:bg-slate-750 active:bg-slate-850 text-slate-100 hover:text-white border border-slate-700/80 hover:border-blue-500/50 shadow-sm transition-colors cursor-pointer select-none text-left disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-center gap-3 pointer-events-none">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4 text-blue-400" />
                        </div>
                        <div>
                          <span className="font-bold text-white block text-xs">Visual PDF Report</span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">Exact branded results</span>
                        </div>
                      </div>
                      <Download className="w-4 h-4 text-slate-400 group-hover:text-blue-400 pointer-events-none shrink-0 ml-2 transition-colors" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Dates Section */}
            <div className="flex flex-col sm:items-end text-xs space-y-1.5 bg-slate-900/90 p-3 px-4 rounded-2xl border border-slate-800/90 shadow-sm">
              <div className="flex items-center gap-2 text-slate-300">
                <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                <span>
                  Starts: <strong className="text-white font-semibold">{formatDate(poll.starts_at)}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  Ends: <strong className="text-white font-semibold">{formatDate(poll.ends_at)}</strong>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Poll Name (Standard flow element: stacked underneath z-20 and z-30 dropdown) */}
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-3 drop-shadow-sm">
          {poll.poll_name}
        </h2>

        {/* Poll Description (Standard flow element: stacked underneath z-20 and z-30 dropdown) */}
        {poll.description ? (
          <p className="text-slate-300 text-sm md:text-base max-w-3xl leading-relaxed mb-6 font-normal">
            {poll.description}
          </p>
        ) : (
          <p className="text-slate-500 text-xs italic mb-6">
            No description provided for this poll.
          </p>
        )}

        {/* Created By Pill (Standard flow element) */}
        <div className="inline-flex items-center gap-2.5 text-xs text-slate-200 bg-slate-900/95 px-4 py-2 rounded-full border border-slate-700/80 shadow-md">
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center font-bold text-xs shadow-sm">
            {poll.created_by?.first_name?.[0]?.toUpperCase() || <UserIcon className="w-3.5 h-3.5" />}
          </div>
          <span>
            Created by:{" "}
            <strong className="text-white font-bold ml-0.5">
              {poll.created_by?.first_name} {poll.created_by?.last_name}
            </strong>
          </span>
        </div>
      </div>

      {/* Questions Breakdown Section */}
      <div className="mt-6 p-4 sm:p-6 md:p-8 space-y-8 bg-slate-50/80 rounded-2xl sm:rounded-3xl border border-slate-100">
        {poll.questions.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            No questions attached to this poll.
          </div>
        ) : (
          poll.questions.map((q, idx) => (
            <div
              key={q.poll_question_id}
              className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/90 shadow-sm"
            >
              {/* Question Header */}
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                <span className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold border border-blue-100 shadow-sm">
                  Q{idx + 1}
                </span>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                  {q.Question_name}
                </h3>
              </div>

              {/* Grid: Pie Chart (Left) + Descending Bar Graph with Voter Hover Tooltip (Right) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                {/* Left: Pie Graph showing total responses */}
                <div className="lg:col-span-5 flex flex-col items-center justify-center p-5 bg-slate-50/80 rounded-2xl border border-slate-100">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Response Breakdown
                  </h4>
                  <QuestionPieChart question={q} />
                </div>

                {/* Right: Descending Bar Graph with Hover Voters Tooltip */}
                <div className="lg:col-span-7 flex flex-col justify-center p-3 sm:p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Options Ranking (Highest to Lowest)
                    </h4>
                    <span className="text-[11px] text-slate-400 italic">
                      Hover bars to view voters
                    </span>
                  </div>
                  <QuestionBarChart question={q} />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </article>
  );
}
