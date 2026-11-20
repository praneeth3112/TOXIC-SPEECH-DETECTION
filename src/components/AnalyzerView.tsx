import { useState, type ReactNode } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  ShieldAlert,
  Ban,
  Copy,
  Check,
  RotateCcw,
  Loader2,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import type {
  AnalysisResult,
  ModerationPolicy,
  RewriteTone,
  TriggerSpan,
} from '../types/moderation';
import { SAMPLE_INPUTS } from '../data/presets';
import {
  getActionTextClass,
  getScoreBarClass,
  getVerdictStyle,
} from '../utils/verdictStyles';

interface AnalyzerViewProps {
  policy: ModerationPolicy;
  onAnalysisComplete: (result: AnalysisResult) => void;
  initialText?: string;
  initialResult?: AnalysisResult | null;
}

const REWRITE_TONES: Array<{ id: RewriteTone; label: string }> = [
  { id: 'professional', label: 'Professional' },
  { id: 'empathetic', label: 'Empathetic' },
  { id: 'neutral', label: 'Neutral' },
  { id: 'concise', label: 'Concise' },
];

function VerdictIcon({ verdict }: { verdict: AnalysisResult['verdict'] }) {
  switch (verdict) {
    case 'Safe':
      return <ShieldCheck className="h-5 w-5 text-emerald-700 shrink-0" />;
    case 'Borderline':
      return <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0" />;
    case 'Toxic':
      return <ShieldAlert className="h-5 w-5 text-orange-700 shrink-0" />;
    case 'Severe':
      return <Ban className="h-5 w-5 text-rose-700 shrink-0" />;
  }
}

function renderHighlightedText(
  text: string,
  spans: TriggerSpan[]
): ReactNode {
  if (!spans || spans.length === 0) {
    return <span>{text}</span>;
  }

  const lowerText = text.toLowerCase();
  const matches: Array<{
    start: number;
    end: number;
    span: TriggerSpan;
  }> = [];

  for (const span of spans) {
    const phrase = span.phrase.trim();
    if (!phrase) continue;
    const lowerPhrase = phrase.toLowerCase();
    let searchFrom = 0;
    while (searchFrom < lowerText.length) {
      const idx = lowerText.indexOf(lowerPhrase, searchFrom);
      if (idx === -1) break;
      const overlaps = matches.some(
        (m) => idx < m.end && idx + phrase.length > m.start
      );
      if (!overlaps) {
        matches.push({
          start: idx,
          end: idx + phrase.length,
          span,
        });
      }
      searchFrom = idx + phrase.length;
    }
  }

  if (matches.length === 0) {
    return <span>{text}</span>;
  }

  matches.sort((a, b) => a.start - b.start);

  const nodes: ReactNode[] = [];
  let cursor = 0;

  matches.forEach((m, i) => {
    if (m.start > cursor) {
      nodes.push(<span key={`t-${i}`}>{text.slice(cursor, m.start)}</span>);
    }
    const highlightStyle =
      m.span.severity === 'high'
        ? 'bg-rose-100 text-rose-900 underline decoration-rose-400 decoration-2 underline-offset-2'
        : m.span.severity === 'medium'
          ? 'bg-orange-100 text-orange-900 underline decoration-orange-400 decoration-2 underline-offset-2'
          : 'bg-amber-100 text-amber-900 underline decoration-amber-400 decoration-2 underline-offset-2';

    nodes.push(
      <mark
        key={`m-${i}`}
        title={`${m.span.category}: ${m.span.reason}`}
        className={`rounded px-0.5 font-medium ${highlightStyle}`}
      >
        {text.slice(m.start, m.end)}
      </mark>
    );
    cursor = m.end;
  });

  if (cursor < text.length) {
    nodes.push(<span key="t-end">{text.slice(cursor)}</span>);
  }

  return <>{nodes}</>;
}

export function AnalyzerView({
  policy,
  onAnalysisComplete,
  initialText = SAMPLE_INPUTS[0].text,
  initialResult = null,
}: AnalyzerViewProps) {
  const [inputText, setInputText] = useState(initialText);
  const [selectedTone, setSelectedTone] = useState<RewriteTone>('professional');
  const [result, setResult] = useState<AnalysisResult | null>(initialResult);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedRewrite, setCopiedRewrite] = useState(false);

  async function handleAnalyze(textOverride?: string) {
    const targetText = (textOverride ?? inputText).trim();
    if (!targetText) {
      setErrorMessage('Enter a comment, message, or review to analyze.');
      return;
    }

    setErrorMessage(null);
    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: targetText,
          rewriteTone: selectedTone,
          policy,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Analysis failed.');
      }
      setResult(data as AnalysisResult);
      onAnalysisComplete(data as AnalysisResult);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Unable to complete toxicity analysis.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleToneChange(tone: RewriteTone) {
    setSelectedTone(tone);
    if (!result) return;

    setIsRewriting(true);
    setErrorMessage(null);
    try {
      const response = await fetch('/api/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: result.text,
          tone,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Rewrite generation failed.');
      }
      setResult((prev) =>
        prev
          ? {
              ...prev,
              rewrittenText: data.rewrittenText,
              rewriteNotes: data.rewriteNotes,
              rewriteTone: tone,
            }
          : prev
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Unable to regenerate rewrite.'
      );
    } finally {
      setIsRewriting(false);
    }
  }

  function handleCopyRewrite() {
    if (!result?.rewrittenText) return;
    navigator.clipboard?.writeText(result.rewrittenText);
    setCopiedRewrite(true);
    setTimeout(() => setCopiedRewrite(false), 1800);
  }

  function handleSelectPreset(text: string) {
    setInputText(text);
    setErrorMessage(null);
  }

  const verdictStyle = result ? getVerdictStyle(result.verdict) : null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: Input Composer */}
        <section className="xl:col-span-5 bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-slate-900">
                Content Inspection Input
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Evaluate comments, chat messages, or reviews for toxicity and generate a constructive rewrite.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium text-slate-500">
              Sample Test Cases
            </div>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_INPUTS.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => handleSelectPreset(sample.text)}
                  className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-md transition-colors whitespace-nowrap shrink-0"
                >
                  {sample.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="analyzer-input"
              className="block text-sm font-medium text-slate-800"
            >
              Message to Moderate
            </label>
            <textarea
              id="analyzer-input"
              rows={7}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste any comment, pull request review, email draft, or user message..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 leading-relaxed resize-y"
            />
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-mono tabular-nums">
                {inputText.length} / 8,000 chars
              </span>
              <span>
                Flag ≥ <span className="font-mono tabular-nums">{policy.flagThreshold}%</span> · Block ≥{' '}
                <span className="font-mono tabular-nums">{policy.blockThreshold}%</span>
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <span className="block text-xs font-medium text-slate-500">
              Target Detoxification Tone
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 bg-slate-100 rounded-lg">
              {REWRITE_TONES.map((tone) => (
                <button
                  key={tone.id}
                  type="button"
                  onClick={() => setSelectedTone(tone.id)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    selectedTone === tone.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tone.label}
                </button>
              ))}
            </div>
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800"
            >
              {errorMessage}
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              disabled={isAnalyzing}
              onClick={() => handleAnalyze()}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing Content...
                </>
              ) : (
                <>
                  Analyze Content
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setInputText('');
                setResult(null);
                setErrorMessage(null);
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="h-4 w-4" />
              Clear
            </button>
          </div>
        </section>

        {/* Right: Results Workspace */}
        <section className="xl:col-span-7 space-y-6">
          {!result && !isAnalyzing && (
            <div className="bg-white border border-slate-200 rounded-xl p-8 sm:p-12 text-center space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div className="max-w-md mx-auto space-y-1.5">
                <h3 className="font-display text-base font-semibold text-slate-900">
                  Ready to Evaluate Message Safety
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Select a sample test case or paste any message on the left, then click{' '}
                  <strong className="font-medium text-slate-900">Analyze Content</strong> to inspect
                  six-dimension toxicity scores, flagged phrases, and an AI-detoxified rewrite.
                </p>
              </div>
            </div>
          )}

          {isAnalyzing && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div className="flex items-center gap-3 text-sm font-medium text-slate-700">
                <Loader2 className="h-4 w-4 animate-spin text-slate-900" />
                Running multi-dimension toxicity evaluation with Gemini...
              </div>
              <div className="space-y-3 animate-pulse">
                <div className="h-14 bg-slate-100 rounded-lg" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="h-16 bg-slate-100 rounded-lg" />
                  <div className="h-16 bg-slate-100 rounded-lg" />
                  <div className="h-16 bg-slate-100 rounded-lg" />
                  <div className="h-16 bg-slate-100 rounded-lg" />
                </div>
                <div className="h-28 bg-slate-100 rounded-lg" />
              </div>
            </div>
          )}

          {result && !isAnalyzing && verdictStyle && (
            <>
              {/* Verdict Overview */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-5">
                <div
                  className={`rounded-lg border px-4 py-3.5 flex flex-wrap items-center justify-between gap-4 ${verdictStyle.surfaceClass} ${verdictStyle.borderClass}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <VerdictIcon verdict={result.verdict} />
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <span className={verdictStyle.textClass}>{result.verdict}</span>
                        <span className="text-slate-400" aria-hidden="true">
                          ·
                        </span>
                        <span>{result.primaryCategory}</span>
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5">
                        Recommended Action:{' '}
                        <strong className={`font-semibold ${getActionTextClass(result.recommendedAction)}`}>
                          {result.recommendedAction}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs text-slate-500">Overall Risk</div>
                    <div
                      className={`font-mono text-2xl font-semibold tabular-nums ${verdictStyle.textClass}`}
                    >
                      {result.overallScore}%
                    </div>
                  </div>
                </div>

                <p className="text-sm text-slate-700 leading-relaxed">
                  {result.summary}
                </p>

                {/* Highlighted Trigger Spans */}
                <div className="pt-4 border-t border-slate-100 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-slate-700">
                      Inspected Text & Flagged Phrases
                    </h3>
                    <span className="text-xs text-slate-500 font-mono tabular-nums">
                      {result.triggerSpans.length} span
                      {result.triggerSpans.length === 1 ? '' : 's'} detected
                    </span>
                  </div>
                  <div className="rounded-lg bg-slate-50 border border-slate-200 p-3.5 text-sm text-slate-800 leading-relaxed">
                    {renderHighlightedText(result.text, result.triggerSpans)}
                  </div>
                  {result.triggerSpans.length > 0 && (
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg bg-white">
                      {result.triggerSpans.map((span, idx) => (
                        <div
                          key={`${span.phrase}-${idx}`}
                          className="px-3.5 py-2.5 flex flex-wrap items-baseline justify-between gap-2 text-xs"
                        >
                          <div className="flex items-baseline gap-2">
                            <span className="font-mono font-medium text-slate-900">
                              “{span.phrase}”
                            </span>
                            <span className="text-slate-400" aria-hidden="true">
                              ·
                            </span>
                            <span className="text-slate-600">{span.reason}</span>
                          </div>
                          <span className="text-slate-500 shrink-0">
                            {span.category} ({span.severity})
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 6-Dimension Breakdown */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-base font-semibold text-slate-900">
                    Dimension Breakdown
                  </h3>
                  <span className="text-xs text-slate-500">0–100 Risk Scale</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {result.dimensions.map((dim) => (
                    <div
                      key={dim.key}
                      className="rounded-lg border border-slate-200 p-3.5 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-slate-900">
                          {dim.label}
                        </span>
                        <span className="font-mono text-sm font-semibold tabular-nums text-slate-800">
                          {dim.score}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${getScoreBarClass(dim.score)}`}
                          style={{ width: `${dim.score}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {dim.explanation}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Constructive Detoxification Studio */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-slate-700" />
                    <h3 className="font-display text-base font-semibold text-slate-900">
                      Constructive Detoxification Rewrite
                    </h3>
                  </div>

                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                    {REWRITE_TONES.map((tone) => (
                      <button
                        key={tone.id}
                        type="button"
                        disabled={isRewriting}
                        onClick={() => handleToneChange(tone.id)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                          result.rewriteTone === tone.id
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {tone.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-900 leading-relaxed">
                  {isRewriting ? (
                    <div className="flex items-center gap-2 text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating {selectedTone} rewrite...
                    </div>
                  ) : (
                    result.rewrittenText
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
                  <span>{result.rewriteNotes}</span>
                  <button
                    type="button"
                    onClick={handleCopyRewrite}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                  >
                    {copiedRewrite ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        Copied Rewrite
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 text-slate-500" />
                        Copy Rewrite
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
