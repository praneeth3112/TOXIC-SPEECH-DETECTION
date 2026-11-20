import { useState } from 'react';
import { Search, Trash2, ArrowUpRight } from 'lucide-react';
import type { AnalysisResult } from '../types/moderation';
import { getActionTextClass, getVerdictStyle } from '../utils/verdictStyles';

interface HistoryViewProps {
  history: AnalysisResult[];
  onInspectItem: (item: AnalysisResult) => void;
  onClearHistory: () => void;
}

export function HistoryView({
  history,
  onInspectItem,
  onClearHistory,
}: HistoryViewProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const totalCount = history.length;
  const flaggedCount = history.filter(
    (h) => h.recommendedAction !== 'Approve'
  ).length;
  const flaggedRate =
    totalCount > 0 ? Math.round((flaggedCount / totalCount) * 100) : 0;
  const avgRisk =
    totalCount > 0
      ? Math.round(
          history.reduce((sum, h) => sum + h.overallScore, 0) / totalCount
        )
      : 0;

  const filtered = history.filter((item) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      item.text.toLowerCase().includes(q) ||
      item.primaryCategory.toLowerCase().includes(q) ||
      item.verdict.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Real Session Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Total Analyzed</div>
          <div className="font-mono text-2xl font-semibold tabular-nums text-slate-900 mt-1">
            {totalCount}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Single-text scans recorded
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Flagged Rate</div>
          <div className="font-mono text-2xl font-semibold tabular-nums text-slate-900 mt-1">
            {flaggedRate}%
          </div>
          <div className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
            {flaggedCount} held or blocked
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Mean Risk Score</div>
          <div className="font-mono text-2xl font-semibold tabular-nums text-slate-900 mt-1">
            {avgRisk}%
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Across evaluated inputs
          </div>
        </div>
      </div>

      {/* Audit Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Moderation Audit History
          </h2>

          <div className="flex items-center gap-2.5">
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search history..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none w-52"
              />
            </div>

            {history.length > 0 && (
              <button
                type="button"
                onClick={onClearHistory}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-rose-700 hover:bg-rose-50 transition-colors whitespace-nowrap shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear Log
              </button>
            )}
          </div>
        </div>

        {history.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No scans recorded yet. Analyze a message in the Live Analyzer tab to log it here.
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No recorded scans match your search query.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                  <th className="py-2.5 px-4 whitespace-nowrap">Time</th>
                  <th className="py-2.5 px-4">Message</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">Verdict</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">Action</th>
                  <th className="py-2.5 px-4 text-right whitespace-nowrap">Risk</th>
                  <th className="py-2.5 px-4 text-right whitespace-nowrap">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filtered.map((item) => {
                  const style = getVerdictStyle(item.verdict);
                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono text-xs tabular-nums text-slate-500 whitespace-nowrap">
                        {new Date(item.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-4 max-w-md">
                        <div className="text-slate-900 truncate">{item.text}</div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`text-xs font-semibold ${style.textClass}`}>
                          {item.verdict}
                        </span>
                        <span className="text-slate-400 mx-1.5" aria-hidden="true">
                          ·
                        </span>
                        <span className="text-xs text-slate-500">
                          {item.primaryCategory}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`text-xs font-medium ${getActionTextClass(item.recommendedAction)}`}
                        >
                          {item.recommendedAction}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-sm font-semibold tabular-nums text-slate-900 whitespace-nowrap">
                        {item.overallScore}%
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onInspectItem(item)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900"
                        >
                          Open
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
