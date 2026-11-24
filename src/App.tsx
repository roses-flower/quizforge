import { useEffect, useState } from 'react';
import type { FirebaseServices } from './lib/firebase';
import {
  checkDeviceAvailability,
  describeAvailability,
  ensureSignedIn,
  fetchRemoteConfigValues,
  initFirebaseServices,
  type DeviceAvailability,
} from './lib/firebase';
import {
  explainConcept,
  generateFlashcards,
  generateQuiz,
} from './lib/ai';
import { deleteDeck, listDecks, saveDeck } from './lib/decks';
import { SAMPLE_DECK, SAMPLE_NOTES } from './lib/sampleNotes';
import type {
  DeckDoc,
  Difficulty,
  Flashcard,
  GeneratedContent,
  GeneratedQuiz,
  InferenceModeKey,
  InferenceSourceLabel,
} from './lib/types';
import { DIFFICULTIES } from './lib/types';

type Tab = 'flashcards' | 'quiz' | 'explain' | 'saved';
type BusyKind = 'flashcards' | 'quiz' | 'explain' | null;

const MODE_DESCRIPTIONS: Record<InferenceModeKey, string> = {
  PREFER_ON_DEVICE: 'On-device first, cloud fallback',
  ONLY_ON_DEVICE: 'On-device only — fails if unavailable',
  PREFER_IN_CLOUD: 'Cloud first, on-device fallback',
  ONLY_IN_CLOUD: 'Cloud only — needs internet',
};

const MODE_LABELS: Record<InferenceModeKey, string> = {
  PREFER_ON_DEVICE: 'Prefer on-device',
  ONLY_ON_DEVICE: 'Only on-device',
  PREFER_IN_CLOUD: 'Prefer in cloud',
  ONLY_IN_CLOUD: 'Only in cloud',
};

/* ------------------------------------------------------------------ */
/* Small components                                                    */
/* ------------------------------------------------------------------ */

function BoltIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
      <path
        d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2z"
        fill="currentColor"
      />
    </svg>
  );
}

function CloudIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
      <path
        d="M7 18a4.5 4.5 0 0 1-.4-8.98 6 6 0 0 1 11.7 1.6A3.75 3.75 0 0 1 17.5 18H7z"
        fill="currentColor"
      />
    </svg>
  );
}

function SourceBadge({
  source,
  sample = false,
  label,
}: {
  source: InferenceSourceLabel;
  sample?: boolean;
  label?: string;
}) {
  if (sample) {
    return (
      <span className="badge badge-sample" title="Hand-written sample data, not AI output">
        Sample deck — not AI-generated
      </span>
    );
  }
  if (source === 'on_device') {
    return (
      <span className="badge badge-device">
        <BoltIcon /> Ran on-device
      </span>
    );
  }
  if (source === 'in_cloud') {
    return (
      <span className="badge badge-cloud">
        <CloudIcon /> Ran in cloud
      </span>
    );
  }
  // Loaded decks carry a sourceLabel ('Saved deck'); a genuinely unknown AI
  // result carries 'Source unknown' via the same field, so this stays honest.
  return <span className="badge badge-unknown">{label ?? 'Source unknown'}</span>;
}

function FlashcardViewer({ cards }: { cards: Flashcard[] }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = cards[index];

  const go = (dir: 1 | -1) => {
    setFlipped(false);
    setIndex((i) => Math.min(cards.length - 1, Math.max(0, i + dir)));
  };

  return (
    <div className="card-viewer">
      <button
        type="button"
        className={`flashcard ${flipped ? 'flipped' : ''}`}
        onClick={() => setFlipped((f) => !f)}
        aria-label="Flip flashcard"
      >
        <span className="flashcard-side-label">
          {flipped ? 'Answer — click to flip back' : 'Question — click to reveal'}
        </span>
        <span className="flashcard-text">
          {flipped ? card.back : card.front}
        </span>
      </button>
      <div className="card-nav">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => go(-1)}
          disabled={index === 0}
        >
          ← Previous
        </button>
        <span className="card-progress">
          {index + 1} / {cards.length}
        </span>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => go(1)}
          disabled={index === cards.length - 1}
        >
          Next →
        </button>
      </div>
    </div>
  );
}

function QuizTaker({ quiz }: { quiz: GeneratedQuiz }) {
  const [answers, setAnswers] = useState<(number | null)[]>(
    quiz.questions.map(() => null),
  );
  const [submitted, setSubmitted] = useState(false);

  const score = submitted
    ? quiz.questions.reduce(
        (s, q, i) => s + (answers[i] === q.answerIndex ? 1 : 0),
        0,
      )
    : 0;

  return (
    <div className="quiz">
      {submitted && (
        <div className="score-banner">
          Your score: <strong>{score} / {quiz.questions.length}</strong>
          {score === quiz.questions.length
            ? ' — Perfect! 🎉'
            : score >= quiz.questions.length / 2
              ? ' — Good work!'
              : ' — Keep studying, you will get there!'}
        </div>
      )}
      {quiz.questions.map((q, qi) => {
        const picked = answers[qi];
        const correct = submitted && picked === q.answerIndex;
        const wrong = submitted && picked !== null && picked !== q.answerIndex;
        return (
          <div
            key={qi}
            className={`quiz-question ${correct ? 'q-correct' : ''} ${wrong ? 'q-wrong' : ''}`}
          >
            <p className="quiz-q-text">
              <strong>Q{qi + 1}.</strong> {q.question}
            </p>
            <div className="quiz-options">
              {q.options.map((opt, oi) => {
                const isPicked = picked === oi;
                const isAnswer = q.answerIndex === oi;
                return (
                  <button
                    key={oi}
                    type="button"
                    className={`quiz-option ${isPicked ? 'picked' : ''} ${
                      submitted && isAnswer ? 'is-answer' : ''
                    }`}
                    disabled={submitted}
                    onClick={() =>
                      setAnswers((a) => {
                        const next = [...a];
                        next[qi] = oi;
                        return next;
                      })
                    }
                  >
                    <span className="option-letter">
                      {String.fromCharCode(65 + oi)}
                    </span>
                    {opt}
                    {submitted && isAnswer && (
                      <span className="option-mark"> ✓ correct</span>
                    )}
                    {submitted && isPicked && !isAnswer && (
                      <span className="option-mark"> ✗ your answer</span>
                    )}
                  </button>
                );
              })}
            </div>
            {submitted && (
              <p className="quiz-explanation">{q.explanation}</p>
            )}
          </div>
        );
      })}
      <div className="quiz-actions">
        {!submitted ? (
          <button
            type="button"
            className="btn btn-primary"
            disabled={answers.some((a) => a === null)}
            onClick={() => setSubmitted(true)}
          >
            Check answers
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setAnswers(quiz.questions.map(() => null));
              setSubmitted(false);
            }}
          >
            Retake quiz
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* App                                                                 */
/* ------------------------------------------------------------------ */

export default function App() {
  const [services, setServices] = useState<FirebaseServices | null>(null);
  const [configured, setConfigured] = useState(false);
  const [availability, setAvailability] =
    useState<DeviceAvailability>('checking');
  const [mode, setMode] = useState<InferenceModeKey>('PREFER_ON_DEVICE');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [cloudModelId, setCloudModelId] = useState('gemini-3.8-flash');
  const [remoteConfigLoaded, setRemoteConfigLoaded] = useState(false);

  const [notes, setNotes] = useState('');
  const [flashcards, setFlashcards] =
    useState<GeneratedContent<Flashcard[]> | null>(null);
  const [quiz, setQuiz] = useState<GeneratedContent<GeneratedQuiz> | null>(
    null,
  );
  const [explanation, setExplanation] = useState<
    (GeneratedContent<string> & { concept: string }) | null
  >(null);
  const [isSample, setIsSample] = useState(false);
  const [deckKey, setDeckKey] = useState(0);

  const [busy, setBusy] = useState<BusyKind>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(
    null,
  );
  const [tab, setTab] = useState<Tab>('flashcards');

  const [concept, setConcept] = useState('');
  const [deckTitle, setDeckTitle] = useState('');
  const [savedDecks, setSavedDecks] = useState<DeckDoc[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    const svc = initFirebaseServices();
    setConfigured(svc !== null);
    setServices(svc);
    void checkDeviceAvailability().then(setAvailability);
    if (svc) {
      void fetchRemoteConfigValues(svc.remoteConfig).then((values) => {
        setCloudModelId(values.cloudModelId);
        setDifficulty(values.defaultDifficulty);
        setRemoteConfigLoaded(true);
      });
    }
  }, []);

  const wordCount = notes.trim()
    ? notes.trim().split(/\s+/).filter(Boolean).length
    : 0;

  function friendlyErrorMessage(err: unknown): string {
    const msg = err instanceof Error ? err.message : String(err);
    if (/api key|API_KEY|not configured/i.test(msg)) {
      return 'Firebase rejected the request (API key / project). Check the config in src/firebaseConfig.ts. — ' + msg;
    }
    if (/app check/i.test(msg)) {
      return 'App Check rejected the request. Add a reCAPTCHA v3 site key or an App Check debug token in src/firebaseConfig.ts. — ' + msg;
    }
    if (/on-device|only_on_device|device model/i.test(msg)) {
      return 'The on-device model is not available on this device. Try “Prefer on-device” or “Prefer in cloud” instead. — ' + msg;
    }
    return msg;
  }

  async function handleGenerateFlashcards() {
    if (!services) return;
    if (!notes.trim()) {
      setError('Paste or type some study notes first.');
      return;
    }
    setError(null);
    setBusy('flashcards');
    setDownloadProgress(null);
    try {
      const result = await generateFlashcards(services.ai, notes, {
        mode,
        cloudModelId,
        difficulty,
        onDownloadProgress: (p) => setDownloadProgress(p),
      });
      setFlashcards(result);
      setIsSample(false);
      setDeckKey((k) => k + 1);
      setTab('flashcards');
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setBusy(null);
      setDownloadProgress(null);
    }
  }

  async function handleGenerateQuiz() {
    if (!services) return;
    if (!notes.trim()) {
      setError('Paste or type some study notes first.');
      return;
    }
    setError(null);
    setBusy('quiz');
    setDownloadProgress(null);
    try {
      const result = await generateQuiz(services.ai, notes, {
        mode,
        cloudModelId,
        difficulty,
        onDownloadProgress: (p) => setDownloadProgress(p),
      });
      setQuiz(result);
      setIsSample(false);
      setDeckKey((k) => k + 1);
      setTab('quiz');
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setBusy(null);
      setDownloadProgress(null);
    }
  }

  async function handleExplain() {
    if (!services) return;
    if (!notes.trim()) {
      setError('Paste or type some study notes first.');
      return;
    }
    if (!concept.trim()) {
      setError('Type a concept to explain (for example: “Calvin cycle”).');
      return;
    }
    setError(null);
    setBusy('explain');
    try {
      const result = await explainConcept(services.ai, notes, concept.trim(), {
        cloudModelId,
        difficulty,
      });
      setExplanation(result);
      setTab('explain');
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  function handleLoadSampleDeck() {
    setFlashcards({
      data: SAMPLE_DECK.flashcards,
      source: 'unknown',
      sourceLabel: 'Sample deck',
      modeUsed: 'PREFER_ON_DEVICE',
      modelHint: 'Hand-written sample data',
      generatedAt: new Date(),
    });
    setQuiz({
      data: SAMPLE_DECK.quiz,
      source: 'unknown',
      sourceLabel: 'Sample deck',
      modeUsed: 'PREFER_ON_DEVICE',
      modelHint: 'Hand-written sample data',
      generatedAt: new Date(),
    });
    setNotes(SAMPLE_NOTES[0].notes);
    setDeckTitle(SAMPLE_DECK.title);
    setIsSample(true);
    setError(null);
    setDeckKey((k) => k + 1);
    setTab('flashcards');
  }

  async function refreshSavedDecks() {
    if (!services) return;
    setSavedLoading(true);
    try {
      const user = await ensureSignedIn(services.auth);
      setSavedDecks(await listDecks(services.db, user.uid));
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setSavedLoading(false);
    }
  }

  async function handleSaveDeck() {
    if (!services) return;
    if (!flashcards && !quiz) {
      setError('Generate flashcards or a quiz first, then save the deck.');
      return;
    }
    setSaveStatus(null);
    setError(null);
    try {
      const user = await ensureSignedIn(services.auth);
      const title =
        deckTitle.trim() ||
        (notes.trim() ? notes.trim().split('\n')[0].slice(0, 60) : 'Untitled deck');
      await saveDeck(services.db, user.uid, {
        title,
        notes,
        flashcards: flashcards?.data ?? [],
        quiz: quiz?.data ?? null,
        difficulty,
      });
      setSaveStatus(`Saved “${title}” to your library.`);
      await refreshSavedDecks();
    } catch (err) {
      setError(friendlyErrorMessage(err));
    }
  }

  function handleLoadDeck(deck: DeckDoc) {
    setNotes(deck.notes);
    setDeckTitle(deck.title);
    setFlashcards(
      deck.flashcards.length
        ? {
            data: deck.flashcards,
            source: 'unknown',
            sourceLabel: 'Saved deck',
            modeUsed: 'PREFER_ON_DEVICE',
            modelHint: 'Loaded from Firestore',
            generatedAt: new Date(),
          }
        : null,
    );
    setQuiz(
      deck.quiz
        ? {
            data: deck.quiz,
            source: 'unknown',
            sourceLabel: 'Saved deck',
            modeUsed: 'PREFER_ON_DEVICE',
            modelHint: 'Loaded from Firestore',
            generatedAt: new Date(),
          }
        : null,
    );
    setIsSample(false);
    setDeckKey((k) => k + 1);
    setTab('flashcards');
  }

  async function handleDeleteDeck(deckId: string) {
    if (!services) return;
    try {
      const user = await ensureSignedIn(services.auth);
      await deleteDeck(services.db, user.uid, deckId);
      setSavedDecks((d) => d.filter((x) => x.id !== deckId));
    } catch (err) {
      setError(friendlyErrorMessage(err));
    }
  }

  const aiDisabled = !configured || busy !== null;

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <span className="logo" aria-hidden="true">
            <BoltIcon />
          </span>
          <div>
            <h1>QuizForge</h1>
            <p className="tagline">
              Offline-first AI study companion — notes in, flashcards &amp;
              quizzes out.
            </p>
          </div>
        </div>
        <div className="status-panel" aria-label="Service status">
          <span className={`status-chip ${configured ? 'ok' : 'warn'}`}>
            <span className="dot" />
            Firebase: {configured ? 'Configured' : 'Not configured'}
          </span>
          <span
            className={`status-chip ${
              availability === 'available'
                ? 'ok'
                : availability === 'unsupported' || availability === 'unavailable'
                  ? 'warn'
                  : 'info'
            }`}
            title={describeAvailability(availability)}
          >
            <span className="dot" />
            On-device: {availability}
          </span>
          <span className="status-chip info" title="Cloud model id, from Remote Config when loaded">
            <span className="dot" />
            Cloud model: {cloudModelId}
            {remoteConfigLoaded ? ' (Remote Config)' : ' (default)'}
          </span>
        </div>
      </header>

      {!configured && (
        <section className="banner banner-warn" role="alert">
          <strong>Firebase is not configured yet.</strong> AI generation,
          saving decks, and Remote Config need a Firebase project. Add your
          web-app config to <code>src/firebaseConfig.ts</code> (see README).
          Until then you can explore the full UI with the hand-written sample
          deck below — it is clearly labelled and is not AI output.
          <div className="banner-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleLoadSampleDeck}
            >
              Try the sample deck
            </button>
          </div>
        </section>
      )}

      <main className="layout">
        <section className="panel">
          <h2>1 · Your study notes</h2>
          <label className="field-label" htmlFor="notes">
            Paste or type your notes
          </label>
          <textarea
            id="notes"
            className="notes-input"
            rows={10}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Paste your lecture notes, textbook chapter, or revision summary here…"
          />
          <div className="notes-meta">
            <span>{wordCount} words</span>
            <span>On-device context: up to 9,216 tokens</span>
          </div>
          <div className="sample-buttons">
            <span>Try a sample:</span>
            {SAMPLE_NOTES.map((s) => (
              <button
                key={s.id}
                type="button"
                className="btn btn-chip"
                onClick={() => {
                  setNotes(s.notes);
                  setError(null);
                }}
              >
                {s.title}
              </button>
            ))}
          </div>

          <h2>2 · Inference mode</h2>
          <p className="hint">
            Choose where the AI runs. Every result shows a badge telling you
            where it actually ran.
          </p>
          <div
            className="mode-grid"
            role="radiogroup"
            aria-label="Inference mode"
          >
            {(Object.keys(MODE_LABELS) as InferenceModeKey[]).map((key) => (
              <label
                key={key}
                className={`mode-card ${mode === key ? 'selected' : ''}`}
              >
                <input
                  type="radio"
                  name="inference-mode"
                  value={key}
                  checked={mode === key}
                  onChange={() => setMode(key)}
                  disabled={!configured}
                />
                <strong>{MODE_LABELS[key]}</strong>
                <span>{MODE_DESCRIPTIONS[key]}</span>
              </label>
            ))}
          </div>

          <div className="field-row">
            <label className="field-label" htmlFor="difficulty">
              Difficulty
            </label>
            <select
              id="difficulty"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as Difficulty)}
              disabled={!configured}
            >
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </option>
              ))}
            </select>
            <span className="hint">
              Default comes from Remote Config ({remoteConfigLoaded ? 'loaded' : 'default: medium'}).
            </span>
          </div>

          <h2>3 · Generate</h2>
          <div className="generate-buttons">
            <button
              type="button"
              className="btn btn-primary"
              disabled={aiDisabled || !notes.trim()}
              onClick={handleGenerateFlashcards}
            >
              {busy === 'flashcards' ? 'Generating…' : 'Generate flashcards'}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={aiDisabled || !notes.trim()}
              onClick={handleGenerateQuiz}
            >
              {busy === 'quiz' ? 'Generating…' : 'Generate quiz (5 questions)'}
            </button>
          </div>
          {downloadProgress !== null && downloadProgress < 1 && (
            <div className="progress" aria-label="On-device model download progress">
              <div
                className="progress-bar"
                style={{ width: `${Math.round(downloadProgress * 100)}%` }}
              />
              <span>
                Downloading on-device model…{' '}
                {Math.round(downloadProgress * 100)}%
              </span>
            </div>
          )}
          <p className="hint">
            Flashcards and quiz use the mode above. “Explain this” always
            prefers the cloud model for deeper answers.
          </p>

          {error && (
            <div className="banner banner-error" role="alert">
              {error}
            </div>
          )}
        </section>

        <section className="panel results">
          <div className="tabs" role="tablist" aria-label="Results">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'flashcards'}
              className={tab === 'flashcards' ? 'active' : ''}
              onClick={() => setTab('flashcards')}
            >
              Flashcards {flashcards ? `(${flashcards.data.length})` : ''}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'quiz'}
              className={tab === 'quiz' ? 'active' : ''}
              onClick={() => setTab('quiz')}
            >
              Quiz {quiz ? `(${quiz.data.questions.length})` : ''}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'explain'}
              className={tab === 'explain' ? 'active' : ''}
              onClick={() => setTab('explain')}
            >
              Explain
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'saved'}
              className={tab === 'saved' ? 'active' : ''}
              onClick={() => {
                setTab('saved');
                void refreshSavedDecks();
              }}
            >
              Saved decks
            </button>
          </div>

          {tab === 'flashcards' && (
            <div className="tab-body">
              {flashcards ? (
                <>
                  <div className="result-head">
                    <SourceBadge source={flashcards.source} sample={isSample} label={flashcards.sourceLabel} />
                    <span className="result-meta">
                      {flashcards.modelHint} ·{' '}
                      {flashcards.generatedAt.toLocaleTimeString()}
                    </span>
                  </div>
                  <FlashcardViewer
                    key={`fc-${deckKey}`}
                    cards={flashcards.data}
                  />
                </>
              ) : (
                <p className="empty-state">
                  No flashcards yet. Paste your notes and press “Generate
                  flashcards” — or try the sample deck above.
                </p>
              )}
            </div>
          )}

          {tab === 'quiz' && (
            <div className="tab-body">
              {quiz ? (
                <>
                  <div className="result-head">
                    <SourceBadge source={quiz.source} sample={isSample} label={quiz.sourceLabel} />
                    <span className="result-meta">
                      {quiz.modelHint} · {quiz.generatedAt.toLocaleTimeString()}
                    </span>
                  </div>
                  <h3 className="quiz-title">{quiz.data.title}</h3>
                  <QuizTaker key={`qz-${deckKey}`} quiz={quiz.data} />
                </>
              ) : (
                <p className="empty-state">
                  No quiz yet. Paste your notes and press “Generate quiz” — or
                  try the sample deck above.
                </p>
              )}
            </div>
          )}

          {tab === 'explain' && (
            <div className="tab-body">
              <div className="explain-form">
                <label className="field-label" htmlFor="concept">
                  Concept to explain
                </label>
                <div className="explain-row">
                  <input
                    id="concept"
                    type="text"
                    value={concept}
                    onChange={(e) => setConcept(e.target.value)}
                    placeholder="e.g. Calvin cycle"
                    disabled={!configured}
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={aiDisabled || !notes.trim() || !concept.trim()}
                    onClick={handleExplain}
                  >
                    {busy === 'explain' ? 'Explaining…' : 'Explain this'}
                  </button>
                </div>
                <p className="hint">
                  Explanations prefer the cloud model for depth. The badge
                  shows where the answer actually ran.
                </p>
              </div>
              {explanation ? (
                <div className="explanation">
                  <div className="result-head">
                    <SourceBadge source={explanation.source} />
                    <span className="result-meta">
                      {explanation.modelHint} ·{' '}
                      {explanation.generatedAt.toLocaleTimeString()}
                    </span>
                  </div>
                  <h3>{explanation.concept}</h3>
                  {explanation.data.split(/\n\n+/).map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
              ) : (
                <p className="empty-state">
                  No explanation yet. Pick a concept from your notes above.
                </p>
              )}
            </div>
          )}

          {tab === 'saved' && (
            <div className="tab-body">
              <div className="save-form">
                <label className="field-label" htmlFor="deck-title">
                  Deck title
                </label>
                <div className="explain-row">
                  <input
                    id="deck-title"
                    type="text"
                    value={deckTitle}
                    onChange={(e) => setDeckTitle(e.target.value)}
                    placeholder="e.g. Biology — Photosynthesis"
                    disabled={!configured}
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!configured || (!flashcards && !quiz)}
                    onClick={handleSaveDeck}
                  >
                    Save current deck
                  </button>
                </div>
                {saveStatus && <p className="save-status">{saveStatus}</p>}
                <p className="hint">
                  Decks are saved to Firestore under an anonymous account — no
                  sign-up, no personal data.
                </p>
              </div>
              {savedLoading ? (
                <p className="empty-state">Loading saved decks…</p>
              ) : savedDecks.length === 0 ? (
                <p className="empty-state">
                  {configured
                    ? 'No saved decks yet.'
                    : 'Saving needs a configured Firebase project.'}
                </p>
              ) : (
                <ul className="deck-list">
                  {savedDecks.map((deck) => (
                    <li key={deck.id} className="deck-item">
                      <div>
                        <strong>{deck.title}</strong>
                        <span className="deck-meta">
                          {deck.flashcards.length} cards ·{' '}
                          {deck.quiz ? `${deck.quiz.questions.length} quiz questions` : 'no quiz'} ·{' '}
                          {deck.difficulty}
                        </span>
                      </div>
                      <div className="deck-actions">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => handleLoadDeck(deck)}
                        >
                          Load
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={() => deck.id && void handleDeleteDeck(deck.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      </main>

      <footer className="footer">
        Built with Firebase AI Logic hybrid inference — Gemini Nano on-device
        when available, Gemini in the cloud otherwise. When inference runs
        on-device, your notes never leave your device.
      </footer>
    </div>
  );
}
