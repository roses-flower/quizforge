import { initializeApp, type FirebaseApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getAI, GoogleAIBackend, type AI } from 'firebase/ai';
import {
  getAuth,
  signInAnonymously,
  type Auth,
  type User,
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import {
  fetchAndActivate,
  getRemoteConfig,
  getString,
  type RemoteConfig,
} from 'firebase/remote-config';
import {
  appCheckDebugToken,
  firebaseConfig,
  isFirebaseConfigured,
  recaptchaSiteKey,
} from '../firebaseConfig';
import type { Difficulty } from './types';

export interface FirebaseServices {
  app: FirebaseApp;
  ai: AI;
  auth: Auth;
  db: Firestore;
  remoteConfig: RemoteConfig;
}

export interface RemoteConfigValues {
  cloudModelId: string;
  defaultDifficulty: Difficulty;
}

export const DEFAULT_CLOUD_MODEL_ID = 'gemini-2.5-flash';
export const DEFAULT_DIFFICULTY: Difficulty = 'medium';

/** The on-device model availability, as reported by Chrome's Prompt API. */
export type DeviceAvailability =
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloadable'
  | 'unavailable'
  | 'unsupported';

declare global {
  interface Window {
    LanguageModel?: {
      availability: () => Promise<string>;
    };
  }
}

let cachedServices: FirebaseServices | null = null;

/**
 * Initialise Firebase (app, App Check, AI Logic, Auth, Firestore,
 * Remote Config) exactly once. Returns null when the config still holds
 * placeholders — callers must handle the "not configured" state.
 */
export function initFirebaseServices(): FirebaseServices | null {
  if (cachedServices) return cachedServices;
  if (!isFirebaseConfigured()) return null;

  const app = initializeApp(firebaseConfig);

  // App Check is enforced for AI Logic. A debug token (set before
  // initializeAppCheck) lets local/dev builds pass attestation; debug
  // tokens are accepted for hackathon submissions.
  const hasDebugToken = appCheckDebugToken.trim().length > 0;
  const hasSiteKey =
    recaptchaSiteKey.trim().length > 0 &&
    !recaptchaSiteKey.startsWith('YOUR_');
  if (hasDebugToken || hasSiteKey) {
    if (hasDebugToken) {
      (globalThis as unknown as Record<string, unknown>).FIREBASE_APPCHECK_DEBUG_TOKEN =
        appCheckDebugToken === 'true' ? true : appCheckDebugToken;
    }
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(
        hasSiteKey ? recaptchaSiteKey : 'debug-token-only',
      ),
      isTokenAutoRefreshEnabled: true,
    });
  }

  const ai = getAI(app, { backend: new GoogleAIBackend() });
  const auth = getAuth(app);
  const db = getFirestore(app);
  const remoteConfig = getRemoteConfig(app);
  remoteConfig.settings = {
    minimumFetchIntervalMillis: 3_600_000,
    fetchTimeoutMillis: 10_000,
  };
  remoteConfig.defaultConfig = {
    cloud_model_id: DEFAULT_CLOUD_MODEL_ID,
    default_difficulty: DEFAULT_DIFFICULTY,
  };

  cachedServices = { app, ai, auth, db, remoteConfig };
  return cachedServices;
}

let signedInUser: User | null = null;

/** Sign in anonymously (no account, no personal data) for Firestore saves. */
export async function ensureSignedIn(auth: Auth): Promise<User> {
  if (signedInUser) return signedInUser;
  const credential = await signInAnonymously(auth);
  signedInUser = credential.user;
  return signedInUser;
}

/** Fetch Remote Config values, falling back to the defaults on any failure. */
export async function fetchRemoteConfigValues(
  remoteConfig: RemoteConfig,
): Promise<RemoteConfigValues> {
  try {
    await fetchAndActivate(remoteConfig);
  } catch (err) {
    console.warn('Remote Config fetch failed, using defaults:', err);
  }
  const cloudModelId =
    getString(remoteConfig, 'cloud_model_id') || DEFAULT_CLOUD_MODEL_ID;
  const rawDifficulty = getString(remoteConfig, 'default_difficulty');
  const defaultDifficulty: Difficulty =
    rawDifficulty === 'easy' || rawDifficulty === 'hard'
      ? rawDifficulty
      : DEFAULT_DIFFICULTY;
  return { cloudModelId, defaultDifficulty };
}

/** Check whether Chrome's on-device model (Gemini Nano) is available. */
export async function checkDeviceAvailability(): Promise<DeviceAvailability> {
  try {
    const lm = window.LanguageModel;
    if (!lm || typeof lm.availability !== 'function') return 'unsupported';
    const status = await lm.availability();
    if (status === 'available') return 'available';
    if (status === 'downloading') return 'downloading';
    if (status === 'downloadable') return 'downloadable';
    return 'unavailable';
  } catch {
    return 'unavailable';
  }
}

export function describeAvailability(status: DeviceAvailability): string {
  switch (status) {
    case 'checking':
      return 'Checking…';
    case 'available':
      return 'Gemini Nano is ready on this device';
    case 'downloading':
      return 'Gemini Nano is downloading — it will be ready shortly';
    case 'downloadable':
      return 'Gemini Nano is not downloaded yet — it downloads automatically on first use';
    case 'unavailable':
      return 'On-device model is not available on this device';
    case 'unsupported':
      return 'On-device AI needs Chrome 139+ on desktop';
  }
}
