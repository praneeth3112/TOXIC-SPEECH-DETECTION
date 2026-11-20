export type VerdictLevel = 'Safe' | 'Borderline' | 'Toxic' | 'Severe';

export type RecommendedAction = 'Approve' | 'Hold for Review' | 'Block';

export type RewriteTone = 'professional' | 'empathetic' | 'neutral' | 'concise';

export type PolicyPresetId = 'strict' | 'workplace' | 'casual' | 'custom';

export interface DimensionScore {
  key:
    | 'toxicity'
    | 'severeToxicity'
    | 'insult'
    | 'profanity'
    | 'identityAttack'
    | 'threat';
  label: string;
  score: number; // 0 to 100
  explanation: string;
}

export interface TriggerSpan {
  phrase: string;
  category: string;
  severity: 'low' | 'medium' | 'high';
  reason: string;
}

export interface AnalysisResult {
  id: string;
  text: string;
  timestamp: string;
  overallScore: number; // 0 to 100
  verdict: VerdictLevel;
  recommendedAction: RecommendedAction;
  primaryCategory: string;
  summary: string;
  dimensions: DimensionScore[];
  triggerSpans: TriggerSpan[];
  rewrittenText: string;
  rewriteTone: RewriteTone;
  rewriteNotes: string;
  policyUsed: PolicyPresetId;
}

export interface BatchItemResult {
  id: string;
  index: number;
  text: string;
  overallScore: number;
  verdict: VerdictLevel;
  recommendedAction: RecommendedAction;
  primaryCategory: string;
  reason: string;
  rewrittenText: string;
}

export interface ModerationPolicy {
  presetId: PolicyPresetId;
  name: string;
  description: string;
  flagThreshold: number; // 0-100
  blockThreshold: number; // 0-100
  customRules: string;
}
