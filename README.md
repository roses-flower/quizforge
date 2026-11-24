# QuizForge — Offline-first AI study companion

**Entry for Google's #BuildHybridAI 2026 hackathon** (Devpost). Target track:
Best Web/Chrome App.

QuizForge turns study notes into flashcards and a multiple-choice quiz, and
explains concepts in depth — with one twist that makes it a true hybrid app:
**every AI result shows a badge saying where it actually ran — "Ran
on-device" or "Ran in cloud"** — read live from
`result.response.inferenceSource`.

## What it does

1. **Paste or type study notes** (or load one of two built-in sample sets:
   photosynthesis, or Indonesia's Independence — 17 August 1945).
2. **Generate flashcards** (8 cards, front/back) from the notes — JSON
   structured output via Firebase AI Logic.
3. **Generate a multiple-choice quiz** (5 questions, 4 options, 1 correct
   answer + explanation) — JSON structured output.
4. **Study mode**: flip through flashcards; take the quiz, get a score and
   per-question feedback.
5. **"Explain this"**: pick a concept from your notes and get a deeper
   explanation (cloud preferred).
6. **Save decks to Firestore** with anonymous Firebase Auth sign-in; list,
   load, and delete saved decks.
7. **Remote Config** drives two tunables: the cloud model id
   (`cloud_model_id`) and the default difficulty (`default_difficulty`).

## How Firebase AI Logic hybrid inference is used

The app uses the Firebase JavaScript SDK (`firebase@13.3.0`,
`@firebase/ai@3.1.0`) with the Gemini Developer API backend:

```ts
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode } from 'firebase/ai';

const ai = getAI(app, { backend: new GoogleAIBackend() });
const model = getGenerativeModel(ai, {
  mode: InferenceMode.PREFER_ON_DEVICE, // or ONLY_ON_DEVICE / PREFER_IN_CLOUD / ONLY_IN_CLOUD
  inCloudParams: { model: cloudModelId, generationConfig: { responseMimeType: 'application/json', responseSchema } },
  onDeviceParams: { promptOptions: { responseConstraint: plainJsonSchema } },
});
await model.initializeDeviceModel(onDownloadProgress); // after a user click
const result = await model.generateContent(prompt);
const source = result.response.inferenceSource; // "on_device" | "in_cloud"
```

- **On-device**: Chrome on desktop (v139+) runs Gemini Nano via the Prompt
  API when available. The status panel shows live availability from
  `LanguageModel.availability()`.
- **Cloud**: Gemini (model id from Remote Config, default
  `gemini-2.5-flash`) when on-device is unavailable or the user prefers it.
- **Mode control**: the user picks Prefer on-device / Only on-device /
  Prefer in cloud / Only in cloud. Flashcards and quiz use the selected mode;
  explanations always prefer the cloud for depth.
- **Structured output**: flashcards and quiz use a JSON schema on both
  paths — `responseSchema` for the cloud model and `responseConstraint`
  (the same schema serialised) for the on-device model.
- **App Check** is wired in (`initializeAppCheck` with a reCAPTCHA v3
  provider; a debug token can be set in `src/firebaseConfig.ts` for local
  development — debug tokens are accepted for submissions).

## Value proposition

Students study everywhere — on the bus, in a classroom with bad Wi-Fi, on a
shared laptop. QuizForge keeps the core study loop working **offline and
private**: flashcards and quizzes generate on-device with Gemini Nano at no
cost, and the app only reaches for the cloud when the user asks for deeper
explanations. The visible "Ran on-device / Ran in cloud" badge makes the
hybrid behaviour honest and visible instead of a black box. Notes are
truncated to fit Gemini Nano's 9,216-token on-device context.

## Run locally

```bash
npm install
npm run dev      # dev server (http://localhost:5173)
npm run build    # type-check + production build (outputs dist/)
npm run preview  # serve the production build locally
```

Requirements: Node.js 22+.

## Firebase setup (required for AI features)

1. Create a Firebase project at https://console.firebase.google.com.
2. In the console, go to **AI Services → AI Logic** and click **Get started**
   (choose the **Gemini Developer API** provider — free to start).
3. Register a Web app and copy its config.
4. Paste the config into **`src/firebaseConfig.ts`** (apiKey, authDomain,
   projectId, storageBucket, messagingSenderId, appId).
5. **App Check**: in the console go to **App Check → Apps** and register
   your app with reCAPTCHA v3; put the site key in
   `src/firebaseConfig.ts`. For local development you can instead set
   `appCheckDebugToken` there (the token is printed to the browser console
   on first load; allow-list it under App Check → Manage debug tokens).
6. **Firestore**: create a Firestore database (production mode) and add a
   rule allowing the signed-in anonymous user to read/write only their own
   decks, e.g.:
   ```
   match /users/{userId}/decks/{deckId} {
     allow read, write: if request.auth != null && request.auth.uid == userId;
   }
   ```
7. **Authentication**: enable the **Anonymous** sign-in provider.
8. **Remote Config**: (optional) add parameters `cloud_model_id` and
   `default_difficulty` (`easy` / `medium` / `hard`). Defaults are used
   when they are absent.

Until the config is filled in, the app shows a clear "Firebase is not
configured yet" state: AI buttons are disabled, but the full UI can be
explored with a hand-written **sample deck** (clearly labelled "Sample deck —
not AI-generated").

## Project structure

```
src/
  firebaseConfig.ts   # THE ONLY place Firebase config lives (placeholders)
  lib/
    firebase.ts       # init, App Check, Auth, Remote Config, availability
    ai.ts             # hybrid model factory + flashcards / quiz / explain
    decks.ts          # Firestore save / list / delete
    sampleNotes.ts    # built-in sample notes + sample deck
    types.ts          # shared types
  App.tsx             # UI: notes, mode picker, flashcards, quiz, explain, saved decks
  index.css           # design system (CSS only)
```

## License

Apache-2.0 — see `LICENSE`.
