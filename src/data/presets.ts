import type { ModerationPolicy } from '../types/moderation';

export const POLICY_PRESETS: ModerationPolicy[] = [
  {
    presetId: 'strict',
    name: 'Strict Community',
    description:
      'Low tolerance for profanity, sarcasm, or personal friction. Ideal for education, support forums, and moderated user groups.',
    flagThreshold: 20,
    blockThreshold: 50,
    customRules:
      'Flag even mild profanity, dismissive sarcasm, or condescending phrasing.',
  },
  {
    presetId: 'workplace',
    name: 'Workplace & PR Review',
    description:
      'Allows candid technical critique while flagging personal attacks, condescending remarks, and hostile communication.',
    flagThreshold: 30,
    blockThreshold: 65,
    customRules:
      'Allow direct technical feedback on code, metrics, or bugs, but flag ad-hominem remarks or blame.',
  },
  {
    presetId: 'casual',
    name: 'Open Forum',
    description:
      'Permissive threshold suited for open discussions. Blocks severe harassment, hate speech, and explicit threats.',
    flagThreshold: 45,
    blockThreshold: 75,
    customRules:
      'Focus primarily on targeted harassment, identity-based attacks, and credible threats.',
  },
  {
    presetId: 'custom',
    name: 'Custom Policy',
    description:
      'Tailored sensitivity thresholds and explicit moderation rules authored for your organization.',
    flagThreshold: 30,
    blockThreshold: 65,
    customRules:
      'Flag any insults about competence, aggressive demands, or discriminatory language.',
  },
];

export interface SamplePreset {
  id: string;
  label: string;
  context: string;
  text: string;
}

export const SAMPLE_INPUTS: SamplePreset[] = [
  {
    id: 'hostile-pr',
    label: 'Hostile PR Review',
    context: 'Code Review',
    text: 'Honestly, whoever pushed this garbage commit clearly has no clue how async state works. Fix this mess immediately instead of wasting everyone’s time.',
  },
  {
    id: 'passive-aggressive',
    label: 'Passive-Aggressive Slack',
    context: 'Team Chat',
    text: 'Per my last three emails, maybe try actually reading the spec before asking obvious questions. It is not that hard.',
  },
  {
    id: 'constructive',
    label: 'Constructive Feedback',
    context: 'Code Review',
    text: 'This query currently performs an N+1 lookup inside the loop, which will bottleneck under load. Could we batch these IDs into a single fetch?',
  },
  {
    id: 'harassment',
    label: 'User Harassment',
    context: 'Community Comment',
    text: 'You are completely pathetic and nobody wants people like you posting here. Delete your account before we make you regret it.',
  },
];

export const SAMPLE_BATCH_LINES: string[] = [
  'Great breakdown of the quarterly metrics — the churn chart makes the root cause obvious.',
  'Are you seriously dumb enough to ship this to production without testing it?',
  'Per my previous message, I already explained this twice. Please pay attention.',
  'Could we schedule a quick 15-minute sync to align on the API schema changes?',
  'Shut up and stop spamming the thread with your useless opinions.',
  'I disagree with the caching strategy here because stale reads could break billing invariants.',
  'Nobody asked you, loser. Stay out of this channel or else.',
  'Thanks for jumping on the incident call so quickly — the rollback resolved the spike.',
];
