import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore';
import type { DeckDoc } from './types';

function decksCollection(db: Firestore, uid: string) {
  return collection(db, 'users', uid, 'decks');
}

/** Save a deck (flashcards + quiz) under the anonymous user's account. */
export async function saveDeck(
  db: Firestore,
  uid: string,
  deck: Omit<DeckDoc, 'id' | 'createdAt'>,
): Promise<string> {
  const ref = await addDoc(decksCollection(db, uid), {
    ...deck,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** List the user's saved decks, newest first. */
export async function listDecks(
  db: Firestore,
  uid: string,
): Promise<DeckDoc[]> {
  const snap = await getDocs(
    query(decksCollection(db, uid), orderBy('createdAt', 'desc')),
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as DeckDoc) }));
}

/** Delete one saved deck. */
export async function deleteDeck(
  db: Firestore,
  uid: string,
  deckId: string,
): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'decks', deckId));
}
