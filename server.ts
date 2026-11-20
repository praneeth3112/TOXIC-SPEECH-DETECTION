import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const MODEL_NAME = 'gemini-4-hydrogen';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    const err = new Error(
      'GEMINI_API_KEY is not configured on the server. Please set GEMINI_API_KEY in Settings > Secrets.'
    );
    (err as Error & { statusCode?: number }).statusCode = 500;
    throw err;
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function formatGeminiError(error: unknown): { status: number; message: string } {
  const raw = error instanceof Error ? error.message : String(error);
  const statusCode =
    typeof (error as { statusCode?: number })?.statusCode === 'number'
      ? (error as { statusCode: number }).statusCode
      : typeof (error as { status?: number })?.status === 'number'
        ? (error as { status: number }).status
        : 500;

  if (raw.includes('PERMISSION_DENIED') || statusCode === 403) {
    return {
      status: 403,
      message:
        'Gemini API access denied (403). Please verify your GEMINI_API_KEY in the Settings > Secrets panel.',
    };
  }
  if (raw.includes('API_KEY_INVALID') || raw.includes('API key not valid') || statusCode === 400) {
    return {
      status: 400,
      message:
        'Invalid Gemini API request or API key (400). Please check GEMINI_API_KEY in the Settings > Secrets panel.',
    };
  }
  if (raw.includes('RESOURCE_EXHAUSTED') || statusCode === 429) {
    return {
      status: 429,
      message:
        'Gemini API rate limit or quota exceeded (429). Please retry shortly or check your API quota in Settings > Secrets.',
    };
  }

  return {
    status: statusCode >= 400 && statusCode < 600 ? statusCode : 500,
    message: raw || 'An unexpected error occurred while analyzing content.',
  };
}

function computeRecommendedAction(
  score: number,
  flagThreshold: number,
  blockThreshold: number
): 'Approve' | 'Hold for Review' | 'Block' {
  if (score >= blockThreshold) return 'Block';
  if (score >= flagThreshold) return 'Hold for Review';
  return 'Approve';
}

function computeVerdict(score: number): 'Safe' | 'Borderline' | 'Toxic' | 'Severe' {
  if (score >= 80) return 'Severe';
  if (score >= 55) return 'Toxic';
  if (score >= 25) return 'Borderline';
  return 'Safe';
}

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  const key = process.env.GEMINI_API_KEY;
  res.json({
    ok: true,
    configured: Boolean(key && key !== 'MY_GEMINI_API_KEY'),
    model: MODEL_NAME,
  });
});

app.post('/api/analyze', async (req, res) => {
  try {
    const {
      text,
      rewriteTone = 'professional',
      policy = {
        presetId: 'workplace',
        name: 'Workplace & PR Review',
        flagThreshold: 30,
        blockThreshold: 65,
        customRules: '',
      },
    } = req.body ?? {};

    if (typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ error: 'Please enter text content to analyze.' });
      return;
    }

    if (text.length > 8000) {
      res.status(400).json({ error: 'Input text exceeds the 8,000-character limit.' });
      return;
    }

    const ai = getGeminiClient();

    const toneInstructions: Record<string, string> = {
      professional:
        'constructive, calm, workplace-appropriate, and solution-oriented while preserving legitimate technical or factual feedback',
      empathetic:
        'warm, respectful, supportive, and mindful of the recipient while keeping the core point clear',
      neutral:
        'objective, matter-of-fact, stripped of emotional hostility or sarcasm, and concise',
      concise:
        'direct, polite, and minimal without unnecessary filler or aggression',
    };

    const selectedToneGuide =
      toneInstructions[String(rewriteTone)] ?? toneInstructions.professional;

    const systemInstruction = `You are ToxicShield AI, a calibrated trust-and-safety content moderation and constructive detoxification engine.
Evaluate the user-submitted text carefully across six toxicity dimensions, identify exact trigger phrases present verbatim in the text, and produce a detoxified rewrite.

Policy Context:
- Policy Mode: ${String(policy.name ?? 'Workplace & PR Review')}
- Flag threshold: ${Number(policy.flagThreshold ?? 30)}/100
- Block threshold: ${Number(policy.blockThreshold ?? 65)}/100
${policy.customRules ? `- Additional Community Guidelines: ${String(policy.customRules)}` : ''}

Scoring Rules (0-100 integer scale):
- 0-24: Safe / constructive / benign.
- 25-54: Borderline / passive-aggressive / dismissive / mildly rude.
- 55-79: Toxic / insulting / hostile / profanity-laced personal attack.
- 80-100: Severe toxicity / hate speech / explicit threats / extreme harassment.

Important:
- Distinguishing constructive criticism ("This function has an O(n^2) bottleneck and lacks unit tests") from personal toxicity ("Whoever wrote this garbage code should be fired") is critical. Legitimate technical or factual critique without insults should score low (0-20).
- Every item in triggerSpans.phrase MUST be an exact substring from the input text (case-insensitive match allowed, prefer exact casing). If the text is completely safe, return an empty triggerSpans array.
- For rewrittenText: rewrite the message in a ${selectedToneGuide} tone. If the original message is already completely safe and constructive, keep its meaning intact with minimal polish and note that no detoxification was needed.`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Analyze the following text:\n\n"""\n${text.trim()}\n"""`,
      config: {
        systemInstruction,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overallScore: {
              type: Type.INTEGER,
              description: 'Overall toxicity risk score from 0 (completely safe) to 100 (severely toxic).',
            },
            primaryCategory: {
              type: Type.STRING,
              description:
                'Primary classification label such as Safe, Passive-Aggressive, Insult / Harassment, Profanity, Identity Attack, Threat, or Constructive Critique.',
            },
            summary: {
              type: Type.STRING,
              description: 'Concise 1-2 sentence assessment explaining why the content received this score.',
            },
            dimensions: {
              type: Type.ARRAY,
              description: 'Exactly 6 toxicity dimension evaluations.',
              items: {
                type: Type.OBJECT,
                properties: {
                  key: {
                    type: Type.STRING,
                    description:
                      'One of: toxicity, severeToxicity, insult, profanity, identityAttack, threat',
                  },
                  label: {
                    type: Type.STRING,
                    description: 'Human-readable dimension name.',
                  },
                  score: {
                    type: Type.INTEGER,
                    description: 'Integer score 0-100 for this dimension.',
                  },
                  explanation: {
                    type: Type.STRING,
                    description: 'Short 1-sentence reason for this dimension score.',
                  },
                },
                required: ['key', 'label', 'score', 'explanation'],
              },
            },
            triggerSpans: {
              type: Type.ARRAY,
              description: 'Exact substrings from the input text that contribute to toxicity.',
              items: {
                type: Type.OBJECT,
                properties: {
                  phrase: {
                    type: Type.STRING,
                    description: 'Exact phrase copied verbatim from the input text.',
                  },
                  category: {
                    type: Type.STRING,
                    description: 'Category of the phrase (e.g., Personal Attack, Hostile Tone, Threat, Profanity).',
                  },
                  severity: {
                    type: Type.STRING,
                    description: 'One of: low, medium, high',
                  },
                  reason: {
                    type: Type.STRING,
                    description: 'Brief explanation of why this phrase is problematic.',
                  },
                },
                required: ['phrase', 'category', 'severity', 'reason'],
              },
            },
            rewrittenText: {
              type: Type.STRING,
              description: 'Detoxified, constructive version of the input text preserving core intent.',
            },
            rewriteNotes: {
              type: Type.STRING,
              description: 'Short note explaining what tone adjustments were made.',
            },
          },
          required: [
            'overallScore',
            'primaryCategory',
            'summary',
            'dimensions',
            'triggerSpans',
            'rewrittenText',
            'rewriteNotes',
          ],
        },
      },
    });

    const rawText = (response.text ?? '').trim();
    if (!rawText) {
      throw new Error('Gemini returned an empty response.');
    }

    const parsed = JSON.parse(rawText);
    const clampedScore = Math.max(0, Math.min(100, Math.round(Number(parsed.overallScore) || 0)));
    const flagThreshold = Number(policy.flagThreshold ?? 30);
    const blockThreshold = Number(policy.blockThreshold ?? 65);

    const dimensionDefaults: Array<{ key: string; label: string }> = [
      { key: 'toxicity', label: 'General Toxicity' },
      { key: 'severeToxicity', label: 'Severe Toxicity' },
      { key: 'insult', label: 'Insult & Harassment' },
      { key: 'profanity', label: 'Profanity & Obscenity' },
      { key: 'identityAttack', label: 'Identity & Hate' },
      { key: 'threat', label: 'Threat & Intimidation' },
    ];

    const incomingDims = Array.isArray(parsed.dimensions) ? parsed.dimensions : [];
    const normalizedDimensions = dimensionDefaults.map((def) => {
      const found = incomingDims.find(
        (d: { key?: string }) => d.key === def.key
      );
      return {
        key: def.key,
        label: def.label,
        score: Math.max(0, Math.min(100, Math.round(Number(found?.score) || 0))),
        explanation: String(found?.explanation || 'No indicators detected in this dimension.'),
      };
    });

    const result = {
      id: `scan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      text: text.trim(),
      timestamp: new Date().toISOString(),
      overallScore: clampedScore,
      verdict: computeVerdict(clampedScore),
      recommendedAction: computeRecommendedAction(clampedScore, flagThreshold, blockThreshold),
      primaryCategory: String(parsed.primaryCategory || 'Evaluated'),
      summary: String(parsed.summary || ''),
      dimensions: normalizedDimensions,
      triggerSpans: Array.isArray(parsed.triggerSpans)
        ? parsed.triggerSpans
            .filter((s: { phrase?: string }) => typeof s?.phrase === 'string' && s.phrase.trim().length > 0)
            .map((s: { phrase: string; category?: string; severity?: string; reason?: string }) => ({
              phrase: s.phrase,
              category: String(s.category || 'Flagged Language'),
              severity:
                s.severity === 'high' || s.severity === 'medium' || s.severity === 'low'
                  ? s.severity
                  : 'medium',
              reason: String(s.reason || ''),
            }))
        : [],
      rewrittenText: String(parsed.rewrittenText || text.trim()),
      rewriteTone,
      rewriteNotes: String(parsed.rewriteNotes || ''),
      policyUsed: policy.presetId ?? 'workplace',
    };

    res.json(result);
  } catch (error) {
    const formatted = formatGeminiError(error);
    res.status(formatted.status).json({ error: formatted.message });
  }
});

app.post('/api/rewrite', async (req, res) => {
  try {
    const { text, tone = 'professional' } = req.body ?? {};
    if (typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ error: 'Text is required to generate a rewrite.' });
      return;
    }

    const ai = getGeminiClient();
    const toneDescriptions: Record<string, string> = {
      professional: 'Calm, constructive, workplace-appropriate, and solution-oriented.',
      empathetic: 'Warm, validating, respectful, and mindful of feelings while preserving clarity.',
      neutral: 'Objective, matter-of-fact, concise, and free of emotional charge.',
      concise: 'Brief, polite, direct, and actionable with zero hostility.',
    };

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Original message:\n"""\n${text.trim()}\n"""\n\nTarget tone: ${tone} (${toneDescriptions[String(tone)] ?? toneDescriptions.professional})`,
      config: {
        systemInstruction:
          'You are ToxicShield AI. Rewrite the user message to remove hostility, insults, profanity, or passive-aggressiveness while preserving any legitimate underlying feedback or question.',
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            rewrittenText: {
              type: Type.STRING,
              description: 'The detoxified rewritten message.',
            },
            rewriteNotes: {
              type: Type.STRING,
              description: 'One-sentence summary of the tone adjustments made.',
            },
          },
          required: ['rewrittenText', 'rewriteNotes'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    res.json({
      rewrittenText: String(parsed.rewrittenText || text.trim()),
      rewriteNotes: String(parsed.rewriteNotes || 'Tone adjusted.'),
      tone,
    });
  } catch (error) {
    const formatted = formatGeminiError(error);
    res.status(formatted.status).json({ error: formatted.message });
  }
});

app.post('/api/analyze-batch', async (req, res) => {
  try {
    const {
      items,
      policy = {
        presetId: 'workplace',
        name: 'Workplace & PR Review',
        flagThreshold: 30,
        blockThreshold: 65,
        customRules: '',
      },
    } = req.body ?? {};

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Provide at least one text line to run batch moderation.' });
      return;
    }

    const sanitizedItems = items
      .map((item) => String(item ?? '').trim())
      .filter((item) => item.length > 0)
      .slice(0, 25);

    if (sanitizedItems.length === 0) {
      res.status(400).json({ error: 'All provided lines were empty.' });
      return;
    }

    const ai = getGeminiClient();

    const numberedPrompt = sanitizedItems
      .map((line, idx) => `[${idx}] ${line}`)
      .join('\n');

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Moderate each numbered message below:\n\n${numberedPrompt}`,
      config: {
        systemInstruction: `You are ToxicShield AI batch moderator. Evaluate every numbered message independently.
Policy Mode: ${String(policy.name ?? 'Workplace & PR Review')}
Flag Threshold: ${Number(policy.flagThreshold ?? 30)}/100
Block Threshold: ${Number(policy.blockThreshold ?? 65)}/100
${policy.customRules ? `Custom Guidelines: ${String(policy.customRules)}` : ''}

Return an array with one object per input index. Keep constructive technical feedback safe (0-24). Provide a concise detoxified rewrite for any item scoring >= 25 (or return the clean original for safe items).`,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              index: { type: Type.INTEGER },
              overallScore: { type: Type.INTEGER },
              primaryCategory: { type: Type.STRING },
              reason: { type: Type.STRING },
              rewrittenText: { type: Type.STRING },
            },
            required: ['index', 'overallScore', 'primaryCategory', 'reason', 'rewrittenText'],
          },
        },
      },
    });

    const parsedArray = JSON.parse((response.text ?? '[]').trim());
    const flagThreshold = Number(policy.flagThreshold ?? 30);
    const blockThreshold = Number(policy.blockThreshold ?? 65);

    const results = sanitizedItems.map((originalText, idx) => {
      const match = Array.isArray(parsedArray)
        ? parsedArray.find((entry: { index?: number }) => entry.index === idx)
        : undefined;
      const score = Math.max(0, Math.min(100, Math.round(Number(match?.overallScore) || 0)));
      return {
        id: `batch_${Date.now()}_${idx}`,
        index: idx,
        text: originalText,
        overallScore: score,
        verdict: computeVerdict(score),
        recommendedAction: computeRecommendedAction(score, flagThreshold, blockThreshold),
        primaryCategory: String(match?.primaryCategory || 'Evaluated'),
        reason: String(match?.reason || 'Evaluated against active moderation policy.'),
        rewrittenText: String(match?.rewrittenText || originalText),
      };
    });

    res.json({ results });
  } catch (error) {
    const formatted = formatGeminiError(error);
    res.status(formatted.status).json({ error: formatted.message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ToxicShield AI server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
