/**
 * Firebase configuration — SINGLE SOURCE OF TRUTH.
 *
 * Fill in the values below with your own Firebase project's web-app config
 * (Firebase console → Project settings → Your apps → Web app).
 *
 * Until these placeholders are replaced, QuizForge runs in "not configured"
 * mode: the UI is fully explorable (including a hand-written sample deck),
 * but all AI and cloud features stay disabled and say so clearly.
 *
 * NEVER commit real credentials for a production project to a public repo.
 * For this hackathon submission, use a throwaway Firebase project.
 */

export const firebaseConfig = {
  apiKey: 'AIzaSyA0vXrMSlNtYRDe4EQa8ASxxGHvdJL30ac',
  authDomain: 'quizforge-b3bb3.firebaseapp.com',
  projectId: 'quizforge-b3bb3',
  storageBucket: 'quizforge-b3bb3.firebasestorage.app',
  messagingSenderId: '794785806290',
  appId: '1:794785806290:web:f3d1fbb476ef3f4a437a0b',
};

/**
 * reCAPTCHA v3 site key for Firebase App Check (Firebase console →
 * App Check → Apps → reCAPTCHA v3). Required by initializeAppCheck.
 * AI Logic enforces App Check, so a real key (or a debug token below) is
 * needed for AI calls to succeed.
 */
export const recaptchaSiteKey = 'YOUR_RECAPTCHA_SITE_KEY';

/**
 * App Check debug token. Leave empty for production.
 *
 * For local development / hackathon judging, set this to a debug token
 * (Firebase console → App Check → Apps → Manage debug tokens) or to the
 * string "true" to auto-generate one — the token is printed to the browser
 * console on first load and must be allow-listed in the console.
 * Debug tokens are accepted for hackathon submissions.
 */
export const appCheckDebugToken: string = '01DAA3F9-0B10-4300-AB23-43F51CD92651';

/** True when the config still contains placeholder values. */
export function isFirebaseConfigured(): boolean {
  const values = [
    firebaseConfig.apiKey,
    firebaseConfig.authDomain,
    firebaseConfig.projectId,
    firebaseConfig.storageBucket,
    firebaseConfig.messagingSenderId,
    firebaseConfig.appId,
  ];
  return values.every(
    (v) => typeof v === 'string' && v.length > 0 && !v.startsWith('YOUR_'),
  );
}
