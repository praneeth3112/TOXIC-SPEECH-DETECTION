import { POLICY_PRESETS } from '../data/presets';
import type { ModerationPolicy, PolicyPresetId } from '../types/moderation';
import { RotateCcw } from 'lucide-react';

interface PolicyViewProps {
  policy: ModerationPolicy;
  onChangePolicy: (updated: ModerationPolicy) => void;
}

export function PolicyView({ policy, onChangePolicy }: PolicyViewProps) {
  function handleSelectPreset(presetId: PolicyPresetId) {
    const preset = POLICY_PRESETS.find((p) => p.presetId === presetId);
    if (preset) {
      onChangePolicy({ ...preset });
    }
  }

  function handleFlagChange(value: number) {
    const clampedFlag = Math.min(value, policy.blockThreshold - 5);
    onChangePolicy({
      ...policy,
      presetId: 'custom',
      name: 'Custom Policy',
      flagThreshold: Math.max(5, clampedFlag),
    });
  }

  function handleBlockChange(value: number) {
    const clampedBlock = Math.max(value, policy.flagThreshold + 5);
    onChangePolicy({
      ...policy,
      presetId: 'custom',
      name: 'Custom Policy',
      blockThreshold: Math.min(95, clampedBlock),
    });
  }

  return (
    <div className="max-w-4xl space-y-6">
      <section className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Moderation Policy Presets
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Select a baseline guardrail profile. Thresholds determine when content is approved, held for moderator review, or automatically blocked.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleSelectPreset('workplace')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
            Reset to Default
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {POLICY_PRESETS.map((preset) => {
            const isSelected = policy.presetId === preset.presetId;
            return (
              <button
                key={preset.presetId}
                type="button"
                onClick={() => handleSelectPreset(preset.presetId)}
                className={`text-left rounded-xl border p-4 transition-colors ${
                  isSelected
                    ? 'border-slate-900 bg-slate-50/70'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-sm font-semibold text-slate-900">
                    {preset.name}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-slate-500">
                    {preset.flagThreshold}% / {preset.blockThreshold}%
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  {preset.description}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-6">
        <div>
          <h3 className="font-display text-base font-semibold text-slate-900">
            Action Threshold Calibration
          </h3>
          <p className="text-sm text-slate-600 mt-1">
            Fine-tune the numeric cutoffs applied to every Gemini toxicity score.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-sm">
              <label htmlFor="flag-threshold" className="font-medium text-slate-800">
                Hold for Review Threshold
              </label>
              <span className="font-mono font-semibold tabular-nums text-amber-700">
                {policy.flagThreshold}%
              </span>
            </div>
            <input
              id="flag-threshold"
              type="range"
              min={5}
              max={85}
              step={5}
              value={policy.flagThreshold}
              onChange={(e) => handleFlagChange(Number(e.target.value))}
              className="w-full accent-slate-900"
            />
            <p className="text-xs text-slate-500">
              Messages scoring at or above this value are flagged for moderator inspection.
            </p>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-sm">
              <label htmlFor="block-threshold" className="font-medium text-slate-800">
                Auto-Block Threshold
              </label>
              <span className="font-mono font-semibold tabular-nums text-rose-700">
                {policy.blockThreshold}%
              </span>
            </div>
            <input
              id="block-threshold"
              type="range"
              min={15}
              max={95}
              step={5}
              value={policy.blockThreshold}
              onChange={(e) => handleBlockChange(Number(e.target.value))}
              className="w-full accent-slate-900"
            />
            <p className="text-xs text-slate-500">
              Messages scoring at or above this value are recommended for immediate blocking.
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 space-y-2">
          <label
            htmlFor="custom-rules"
            className="block text-sm font-medium text-slate-800"
          >
            Custom Community Guidelines (Sent to Gemini Classifier)
          </label>
          <textarea
            id="custom-rules"
            rows={4}
            value={policy.customRules}
            onChange={(e) =>
              onChangePolicy({
                ...policy,
                presetId: 'custom',
                name: 'Custom Policy',
                customRules: e.target.value,
              })
            }
            placeholder="Describe domain-specific rules, e.g., distinguish technical bug critiques from personal attacks..."
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 leading-relaxed"
          />
        </div>
      </section>
    </div>
  );
}
