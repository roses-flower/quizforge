import {
  getGenerativeModel,
  InferenceMode,
  InferenceSource,
  Schema,
  type AI,
  type GenerativeModel,
} from 'firebase/ai';
import type {
  Difficulty,
  Flashcard,
  GeneratedContent,
  GeneratedQuiz,
  InferenceModeKey,
  InferenceSourceLabel,
} from './types';

/** Keep prompts well inside Gemini Nano's 9,216-token on-device context. */
const MAX_NOTES_CHARS = 6000;

export interface AiCallOptions {
  mode: InferenceModeKey;
  cloudModelId: string;
  difficulty: Difficulty;
  onDownloadProgress?: (progress: number) => void;
}

/* ------------------------------------------------------------------ */
/* Structured-output schemas (used for cloud) + plain JSON constraint */
/* (serialised for the on-device Prompt API)                           */
/* ------------------------------------------------------------------ */

const flashcardSchema = Schema.object({
  properties: {
    flashcards: Schema.array({
      items: Schema.object({
        properties: {
          front: Schema.string({
            description: 'A short question, term, or prompt for the front of the card.',
          }),
          back: Schema.string({
            description: 'A clear, concise answer for the back of the card.',
          }),
        },
      }),
      minItems: 6,
      maxItems: 10,
      description: 'The flashcards generated from the notes.',
    }),
  },
});

const quizSchema = Schema.object({
  properties: {
    title: Schema.string({
      description: 'A short title for the quiz, based on the topic of the notes.',
    }),
    questions: Schema.array({
      items: Schema.object({
        properties: {
          question: Schema.string({
            description: 'The quiz question.',
          }),
          options: Schema.array({
            items: Schema.string(),
            minItems: 4,
            maxItems: 4,
            description: 'Exactly four answer options.',
          }),
          answerIndex: Schema.integer({
            description: '0-based index of the correct option.',
            minimum: 0,
            maximum: 3,
          }),
          explanation: Schema.string({
            description: 'One sentence explaining why the correct answer is right.',
          }),
        },
      }),
      minItems: 5,
      maxItems: 5,
      description: 'Exactly five multiple-choice questions.',
    }),
  },
});

/** Plain JSON-schema object for the on-device responseConstraint. */
function toPlainSchema(schema: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(schema)) as Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/* Hybrid model factory                                                */
/* ------------------------------------------------------------------ */

function createHybridModel(
  ai: AI,
  mode: InferenceModeKey,
  cloudModelId: string,
  jsonSchema?: unknown,
): GenerativeModel {
  const modeValue = InferenceMode[mode];
  if (jsonSchema) {
    return getGenerativeModel(ai, {
      mode: modeValue,
      inCloudParams: {
        model: cloudModelId,
        generationConfig: {
          responseMimeType: 'application/json',
          // The Schema class instance is a TypedSchema, accepted directly.
          responseSchema: jsonSchema as never,
        },
      },
      onDeviceParams: {
        promptOptions: { responseConstraint: toPlainSchema(jsonSchema) },
      },
    });
  }
  return getGenerativeModel(ai, {
    mode: modeValue,
    inCloudParams: { model: cloudModelId },
  });
}

/**
 * Initialise the on-device model. Must be called after a user gesture and
 * before the first prompt. For ONLY_ON_DEVICE we await it so a missing
 * model fails fast; otherwise we kick it off and let the request fall back
 * to the cloud while the model downloads.
 */
async function prepareDeviceModel(
  model: GenerativeModel,
  mode: InferenceModeKey,
  onDownloadProgress?: (progress: number) => void,
): Promise<void> {
  if (mode === 'ONLY_IN_CLOUD') return;
  if (mode === 'ONLY_ON_DEVICE') {
    await model.initializeDeviceModel(onDownloadProgress);
    return;
  }
  // Fire-and-forget: the request can fall back to the cloud meanwhile.
  void model.initializeDeviceModel(onDownloadProgress);
}

function mapSource(source: string | undefined): InferenceSourceLabel {
  if (source === InferenceSource.ON_DEVICE) return 'on_device';
  if (source === InferenceSource.IN_CLOUD) return 'in_cloud';
  return 'unknown';
}

function sourceLabel(source: InferenceSourceLabel): string {
  if (source === 'on_device') return 'Ran on-device';
  if (source === 'in_cloud') return 'Ran in cloud';
  return 'Source unknown';
}

function modelHint(mode: InferenceModeKey, cloudModelId: string): string {
  return mode === 'ONLY_ON_DEVICE' || mode === 'PREFER_ON_DEVICE'
    ? `Gemini Nano on-device · fallback ${cloudModelId}`
    : `${cloudModelId} in cloud`;
}

/** Parse model output as JSON, tolerating surrounding prose. */
function parseJsonObject<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end + 1)) as T;
    }
    throw new Error(
      'The model returned a response that could not be parsed as JSON. Please try again.',
    );
  }
}

function truncateNotes(notes: string): string {
  return notes.length > MAX_NOTES_CHARS
    ? notes.slice(0, MAX_NOTES_CHARS) + '\n…(notes truncated)'
    : notes;
}

function friendlyError(err: unknown): Error {
  if (err instanceof Error) return err;
  return new Error(String(err));
}

/**
 * Errors worth retrying: the cloud backend sheds load on the free tier
 * ("high demand" 500s) and occasionally hangs until the SDK's own timeout.
 * Parse errors and empty results are app-level failures — never retry those.
 */
const RETRYABLE = /500|429|503|overload|high demand|timeout|Timeout has expired|Failed to fetch/i;

function isRetryable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  if (/could not be parsed as JSON|returned no flashcards|returned no quiz|returned an empty explanation/i.test(msg)) {
    return false;
  }
  return RETRYABLE.test(msg);
}

/** Call generateContent with up to 3 attempts and exponential backoff. */
async function generateWithRetry(
  model: GenerativeModel,
  prompt: string,
): Promise<{ text: string; inferenceSource: string | undefined }> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      return {
        text: result.response.text(),
        inferenceSource: result.response.inferenceSource,
      };
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || attempt === 3) throw friendlyError(err);
      // Back off before retrying: the 500s are transient load shedding.
      await new Promise((r) =>
        setTimeout(r, attempt === 1 ? 5000 : 15000),
      );
    }
  }
  throw friendlyError(lastErr);
}

/* ------------------------------------------------------------------ */
/* Flashcards                                                           */
/* ------------------------------------------------------------------ */

export async function generateFlashcards(
  ai: AI,
  notes: string,
  opts: AiCallOptions,
): Promise<GeneratedContent<Flashcard[]>> {
  const model = createHybridModel(
    ai,
    opts.mode,
    opts.cloudModelId,
    flashcardSchema,
  );
  try {
    await prepareDeviceModel(model, opts.mode, opts.onDownloadProgress);
    const prompt = `You are a study assistant. Create flashcards from the study notes below.

Rules:
- Create 8 flashcards. Each has a short question or term on the "front" and a clear, concise answer on the "back".
- Difficulty: ${opts.difficulty}.
- Use only facts from the notes. Do not invent facts.
- Respond with JSON only, matching the requested schema.

Study notes:
${truncateNotes(notes)}`;
    const { text, inferenceSource } = await generateWithRetry(model, prompt);
    const parsed = parseJsonObject<{ flashcards: Flashcard[] }>(text);
    if (!Array.isArray(parsed.flashcards) || parsed.flashcards.length === 0) {
      throw new Error('The model returned no flashcards. Please try again.');
    }
    const source = mapSource(inferenceSource);
    return {
      data: parsed.flashcards,
      source,
      sourceLabel: sourceLabel(source),
      modeUsed: opts.mode,
      modelHint: modelHint(opts.mode, opts.cloudModelId),
      generatedAt: new Date(),
    };
  } catch (err) {
    throw friendlyError(err);
  }
}

/* ------------------------------------------------------------------ */
/* Quiz                                                                 */
/* ------------------------------------------------------------------ */

export async function generateQuiz(
  ai: AI,
  notes: string,
  opts: AiCallOptions,
): Promise<GeneratedContent<GeneratedQuiz>> {
  const model = createHybridModel(
    ai,
    opts.mode,
    opts.cloudModelId,
    quizSchema,
  );
  try {
    await prepareDeviceModel(model, opts.mode, opts.onDownloadProgress);
    const prompt = `You are a study assistant. Create a multiple-choice quiz from the study notes below.

Rules:
- Create exactly 5 questions. Each question has exactly 4 options and exactly one correct answer (answerIndex is the 0-based index of the correct option).
- Add a one-sentence explanation for each question.
- Difficulty: ${opts.difficulty}.
- Use only facts from the notes. Do not invent facts.
- Respond with JSON only, matching the requested schema.

Study notes:
${truncateNotes(notes)}`;
    const { text, inferenceSource } = await generateWithRetry(model, prompt);
    const parsed = parseJsonObject<GeneratedQuiz>(text);
    if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      throw new Error('The model returned no quiz questions. Please try again.');
    }
    const source = mapSource(inferenceSource);
    return {
      data: parsed,
      source,
      sourceLabel: sourceLabel(source),
      modeUsed: opts.mode,
      modelHint: modelHint(opts.mode, opts.cloudModelId),
      generatedAt: new Date(),
    };
  } catch (err) {
    throw friendlyError(err);
  }
}

/* ------------------------------------------------------------------ */
/* Explain (cloud preferred — deeper answers)                           */
/* ------------------------------------------------------------------ */

export async function explainConcept(
  ai: AI,
  notes: string,
  concept: string,
  opts: Omit<AiCallOptions, 'mode'>,
): Promise<GeneratedContent<string> & { concept: string }> {
  // Explanations always prefer the cloud model for depth; the mode control
  // still applies to flashcard/quiz generation.
  const model = createHybridModel(ai, 'PREFER_IN_CLOUD', opts.cloudModelId);
  try {
    const prompt = `Explain the concept "${concept}" in depth for a student, using the study notes below as context.

Rules:
- Write 150-250 words in clear, simple language, with a short example.
- Use facts from the notes where possible. If you add general knowledge beyond the notes, say so in the text.
- Do not use headings or bullet lists; write flowing paragraphs.

Study notes:
${truncateNotes(notes)}`;
    const { text: rawText, inferenceSource } = await generateWithRetry(
      model,
      prompt,
    );
    const text = rawText.trim();
    if (!text) {
      throw new Error('The model returned an empty explanation. Please try again.');
    }
    const source = mapSource(inferenceSource);
    return {
      data: text,
      source,
      sourceLabel: sourceLabel(source),
      modeUsed: 'PREFER_IN_CLOUD',
      modelHint: modelHint('PREFER_IN_CLOUD', opts.cloudModelId),
      generatedAt: new Date(),
      concept,
    };
  } catch (err) {
    throw friendlyError(err);
  }
}
