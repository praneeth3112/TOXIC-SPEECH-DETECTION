import { useRef, useState, type ChangeEvent } from 'react';
import {
  Upload,
  Play,
  Download,
  Search,
  Loader2,
  Copy,
  Check,
  FileText,
  Trash2,
} from 'lucide-react';
import type { BatchItemResult, ModerationPolicy } from '../types/moderation';
import { SAMPLE_BATCH_LINES } from '../data/presets';
import { getActionTextClass, getVerdictStyle } from '../utils/verdictStyles';

interface BatchViewProps {
  policy: ModerationPolicy;
  results: BatchItemResult[];
  onBatchComplete: (items: BatchItemResult[]) => void;
  onClearBatch: () => void;
}

type BatchFilter = 'all' | 'flagged' | 'safe';

export function BatchView({
  policy,
  results,
  onBatchComplete,
  onClearBatch,
}: BatchViewProps) {
  const [rawInput, setRawInput] = useState(SAMPLE_BATCH_LINES.join('\n'));
  const [filter, setFilter] = useState<BatchFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const lines = rawInput
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  async function handleRunBatch() {
    if (lines.length === 0) {
      setErrorMessage('Paste at least one message line or upload a text/CSV file.');
      return;
    }

    setErrorMessage(null);
    setIsProcessing(true);
    try {
      const response = await fetch('/api/analyze-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: lines.slice(0, 25),
          policy,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Batch moderation failed.');
      }
      onBatchComplete(data.results as BatchItemResult[]);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Unable to complete batch moderation.'
      );
    } finally {
      setIsProcessing(false);
    }
  }

  function handleFileUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result ?? '');
      const parsedLines = content
        .split(/\r?\n/)
        .map((row) => row.replace(/^"|"$/g, '').trim())
        .filter((row) => row.length > 0 && row.toLowerCase() !== 'text' && row.toLowerCase() !== 'comment');
      setRawInput(parsedLines.slice(0, 25).join('\n'));
      setErrorMessage(null);
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleExportCsv() {
    if (results.length === 0) return;
    const escape = (val: string | number) =>
      `"${String(val).replace(/"/g, '""')}"`;

    const header = [
      'Index',
      'Verdict',
      'RiskScore',
      'RecommendedAction',
      'PrimaryCategory',
      'OriginalText',
      'Reason',
      'DetoxifiedRewrite',
    ].join(',');

    const rows = results.map((r) =>
      [
        r.index + 1,
        r.verdict,
        r.overallScore,
        r.recommendedAction,
        r.primaryCategory,
        r.text,
        r.reason,
        r.rewrittenText,
      ]
        .map(escape)
        .join(',')
    );

    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `toxicshield-batch-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleCopyRewrite(id: string, text: string) {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1600);
  }

  const filteredResults = results.filter((item) => {
    const matchesFilter =
      filter === 'all'
        ? true
        : filter === 'flagged'
          ? item.recommendedAction !== 'Approve'
          : item.recommendedAction === 'Approve';
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      item.text.toLowerCase().includes(q) ||
      item.primaryCategory.toLowerCase().includes(q) ||
      item.rewrittenText.toLowerCase().includes(q);
    return matchesFilter && matchesSearch;
  });

  const flaggedCount = results.filter(
    (r) => r.recommendedAction !== 'Approve'
  ).length;
  const avgScore =
    results.length > 0
      ? Math.round(
          results.reduce((sum, r) => sum + r.overallScore, 0) / results.length
        )
      : 0;

  return (
    <div className="space-y-6">
      {/* Input Card */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Batch Comment Queue
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Paste up to 25 comments (one per line) or import a `.txt` / `.csv` file to score, classify, and generate safe rewrites in one pass.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Upload className="h-3.5 w-3.5 text-slate-500" />
              Import File
            </button>
            <button
              type="button"
              onClick={() => setRawInput(SAMPLE_BATCH_LINES.join('\n'))}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <FileText className="h-3.5 w-3.5 text-slate-500" />
              Load Sample Feed
            </button>
          </div>
        </div>

        <textarea
          rows={6}
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          placeholder="Enter one comment or message per line..."
          className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-sans text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 leading-relaxed resize-y"
        />

        {errorMessage && (
          <div
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800"
          >
            {errorMessage}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500 font-mono tabular-nums">
            {Math.min(lines.length, 25)} / 25 lines queued
            {lines.length > 25 ? ' (first 25 will be analyzed)' : ''}
          </div>
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleRunBatch}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Moderating Batch...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Run Batch Moderation
              </>
            )}
          </button>
        </div>
      </section>

      {/* Results Data Grid */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <h3 className="font-display text-base font-semibold text-slate-900">
              Moderation Queue Results
            </h3>
            {results.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-slate-600 font-mono tabular-nums">
                <span>{results.length} scanned</span>
                <span className="text-slate-300" aria-hidden="true">
                  ·
                </span>
                <span>{flaggedCount} flagged</span>
                <span className="text-slate-300" aria-hidden="true">
                  ·
                </span>
                <span>{avgScore}% avg risk</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter messages..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none w-48"
              />
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'flagged', label: 'Flagged' },
                  { id: 'safe', label: 'Safe' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    filter === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {results.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                >
                  <Download className="h-3.5 w-3.5 text-slate-500" />
                  Export CSV
                </button>
                <button
                  type="button"
                  onClick={onClearBatch}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-rose-700 hover:bg-rose-50 transition-colors whitespace-nowrap shrink-0"
                  aria-label="Clear batch results"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        {results.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Run batch moderation above to populate the queue with toxicity scores, verdicts, and constructive rewrites.
          </div>
        ) : filteredResults.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No messages match the current filter or search query.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                  <th className="py-2.5 px-4 w-12">#</th>
                  <th className="py-2.5 px-4">Message & Detoxified Rewrite</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">Classification</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">Action</th>
                  <th className="py-2.5 px-4 text-right whitespace-nowrap">Risk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredResults.map((item) => {
                  const style = getVerdictStyle(item.verdict);
                  const needsRewrite = item.overallScore >= policy.flagThreshold;
                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/70 transition-colors align-top"
                    >
                      <td className="py-3 px-4 font-mono text-xs tabular-nums text-slate-400">
                        {item.index + 1}
                      </td>
                      <td className="py-3 px-4 space-y-2 max-w-xl">
                        <p className="text-slate-900 leading-snug">{item.text}</p>
                        <p className="text-xs text-slate-500">{item.reason}</p>
                        {needsRewrite && item.rewrittenText && (
                          <div className="rounded-md bg-slate-50 border border-slate-200 px-3 py-2 flex items-start justify-between gap-3">
                            <div className="text-xs text-slate-700 leading-relaxed">
                              <span className="font-medium text-slate-900">
                                Suggested Rewrite:{' '}
                              </span>
                              {item.rewrittenText}
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                handleCopyRewrite(item.id, item.rewrittenText)
                              }
                              className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 shrink-0"
                              aria-label="Copy rewrite"
                            >
                              {copiedId === item.id ? (
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className={`text-xs font-semibold ${style.textClass}`}>
                          {item.verdict}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {item.primaryCategory}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`text-xs font-medium ${getActionTextClass(item.recommendedAction)}`}
                        >
                          {item.recommendedAction}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-sm font-semibold tabular-nums whitespace-nowrap text-slate-900">
                        {item.overallScore}%
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
