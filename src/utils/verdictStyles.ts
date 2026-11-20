import type { RecommendedAction, VerdictLevel } from '../types/moderation';

export interface VerdictStyle {
  textClass: string;
  surfaceClass: string;
  barClass: string;
  borderClass: string;
}

export function getVerdictStyle(verdict: VerdictLevel): VerdictStyle {
  switch (verdict) {
    case 'Safe':
      return {
        textClass: 'text-emerald-700',
        surfaceClass: 'bg-emerald-50/80',
        barClass: 'bg-emerald-600',
        borderClass: 'border-emerald-200',
      };
    case 'Borderline':
      return {
        textClass: 'text-amber-700',
        surfaceClass: 'bg-amber-50/80',
        barClass: 'bg-amber-600',
        borderClass: 'border-amber-200',
      };
    case 'Toxic':
      return {
        textClass: 'text-orange-700',
        surfaceClass: 'bg-orange-50/80',
        barClass: 'bg-orange-600',
        borderClass: 'border-orange-200',
      };
    case 'Severe':
      return {
        textClass: 'text-rose-700',
        surfaceClass: 'bg-rose-50/80',
        barClass: 'bg-rose-600',
        borderClass: 'border-rose-200',
      };
  }
}

export function getActionTextClass(action: RecommendedAction): string {
  switch (action) {
    case 'Approve':
      return 'text-emerald-700';
    case 'Hold for Review':
      return 'text-amber-700';
    case 'Block':
      return 'text-rose-700';
  }
}

export function getScoreBarClass(score: number): string {
  if (score >= 80) return 'bg-rose-600';
  if (score >= 55) return 'bg-orange-600';
  if (score >= 25) return 'bg-amber-500';
  return 'bg-emerald-600';
}
