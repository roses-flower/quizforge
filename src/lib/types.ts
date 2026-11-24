export const INFERENCE_MODES = {
  PREFER_ON_DEVICE: 'prefer_on_device',
  ONLY_ON_DEVICE: 'only_on_device',
  PREFER_IN_CLOUD: 'prefer_in_cloud',
  ONLY_IN_CLOUD: 'only_in_cloud',
} as const;

export type InferenceModeKey = keyof typeof INFERENCE_MODES;

export type InferenceSourceLabel = 'on_device' | 'in_cloud' | 'unknown';

export interface Flashcard {
  front: string;
  back: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  /** 0-based index into options */
  answerIndex: number;
  explanation: string;
}

export interface GeneratedQuiz {
  title: string;
  questions: QuizQuestion[];
}

export interface GeneratedContent<T> {
  data: T;
  /** Where the inference actually ran, read from result.response.inferenceSource */
  source: InferenceSourceLabel;
  /** Human-readable label for the badge */
  sourceLabel: string;
  modeUsed: InferenceModeKey;
  modelHint: string;
  generatedAt: Date;
}

export interface DeckDoc {
  id?: string;
  title: string;
  notes: string;
  flashcards: Flashcard[];
  quiz: GeneratedQuiz | null;
  difficulty: string;
  createdAt?: unknown;
}

export type Difficulty = 'easy' | 'medium' | 'hard';

export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];
