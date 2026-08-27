import { ObjectId } from 'mongodb';
import { getDatabase, resetMongoClient } from './client';
import { hashPassword, verifyPassword } from '@/lib/auth/password';

export interface MongoWatchlistItem {
  contentId: string | number;
  type: 'movie' | 'tv';
  title: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  rating?: number;
  releaseDate?: string;
  urlPath: string;
  addedAt: number;
}

export interface MongoHistoryItem {
  contentId: string | number;
  type: 'movie' | 'tv';
  title: string;
  episodeTitle?: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  rating?: number;
  urlPath: string;
  viewedAt: number;
}

export interface MongoUser {
  _id?: ObjectId;
  username: string;
  email: string;
  passwordHash: string;
  salt: string;
  avatar?: string;
  watchlist: MongoWatchlistItem[];
  history: MongoHistoryItem[];
  createdAt: number;
  updatedAt: number;
}

const USERS_COLLECTION = 'users';

async function getUsersCollection() {
  const db = await getDatabase();
  return db.collection<MongoUser>(USERS_COLLECTION);
}

let isUserIndexInitialized = false;

function ensureUserIndexesBackground() {
  if (isUserIndexInitialized) return;
  isUserIndexInitialized = true;
  (async () => {
    try {
      const col = await getUsersCollection();
      await Promise.allSettled([
        col.createIndex({ username: 1 }, { unique: true }),
        col.createIndex({ email: 1 }, { unique: true }),
      ]);
    } catch (err) {
      console.warn('[MongoDB] ensureUserIndexesBackground warning:', err);
    }
  })();
}

/**
 * Executes a MongoDB operation with 1 automatic retry on SSL/connection errors
 */
async function withMongoRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (
      msg.includes('SSL') ||
      msg.includes('tlsv1') ||
      msg.includes('closed') ||
      msg.includes('topology') ||
      msg.includes('connection') ||
      msg.includes('ECONNRESET')
    ) {
      console.warn('[MongoDB] Transient connection/SSL error detected, resetting and retrying once:', msg);
      resetMongoClient();
      return await operation();
    }
    throw err;
  }
}

/**
 * Normalizes username (lowercase, trimmed).
 */
export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

/**
 * Normalizes email (lowercase, trimmed).
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Finds user by ObjectId string.
 */
export async function getUserById(userId: string): Promise<MongoUser | null> {
  ensureUserIndexesBackground();
  if (!ObjectId.isValid(userId)) return null;

  return withMongoRetry(async () => {
    const col = await getUsersCollection();
    return await col.findOne({ _id: new ObjectId(userId) });
  });
}

/**
 * Finds user by username or email.
 */
export async function getUserByUsernameOrEmail(identifier: string): Promise<MongoUser | null> {
  ensureUserIndexesBackground();
  const clean = identifier.trim().toLowerCase();

  return withMongoRetry(async () => {
    const col = await getUsersCollection();
    return await col.findOne({
      $or: [{ username: clean }, { email: clean }],
    });
  });
}

/**
 * Creates a new user in MongoDB.
 */
export async function createUser(data: {
  username: string;
  email: string;
  password: string;
}): Promise<MongoUser> {
  ensureUserIndexesBackground();
  const cleanUsername = normalizeUsername(data.username);
  const cleanEmail = normalizeEmail(data.email);

  return withMongoRetry(async () => {
    const col = await getUsersCollection();

    // Check uniqueness
    const existing = await col.findOne({
      $or: [{ username: cleanUsername }, { email: cleanEmail }],
    });

    if (existing) {
      if (existing.username === cleanUsername) {
        throw new Error('Username sudah digunakan oleh akun lain');
      }
      if (existing.email === cleanEmail) {
        throw new Error('Email sudah terdaftar. Silakan login atau gunakan email lain');
      }
    }

    const { salt, hash } = hashPassword(data.password);
    const now = Date.now();

    const newUser: MongoUser = {
      username: cleanUsername,
      email: cleanEmail,
      passwordHash: hash,
      salt,
      avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(cleanUsername)}`,
      watchlist: [],
      history: [],
      createdAt: now,
      updatedAt: now,
    };

    const result = await col.insertOne(newUser);
    newUser._id = result.insertedId;
    return newUser;
  });
}

/**
 * Authenticates user credentials.
 */
export async function authenticateUser(
  identifier: string,
  password: string
): Promise<MongoUser | null> {
  const user = await getUserByUsernameOrEmail(identifier);
  if (!user || !user.passwordHash || !user.salt) return null;

  const isValid = verifyPassword(password, user.salt, user.passwordHash);
  if (!isValid) return null;

  return user;
}

// ─────────────────────────────────────────────────────────────────────────────
// WATCHLIST OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retrieves the user's watchlist.
 */
export async function getUserWatchlist(userId: string): Promise<MongoWatchlistItem[]> {
  const user = await getUserById(userId);
  return user?.watchlist || [];
}

/**
 * Toggles an item in the user's watchlist.
 * Returns true if added, false if removed.
 */
export async function toggleUserWatchlist(
  userId: string,
  item: {
    contentId: string | number;
    type: 'movie' | 'tv';
    title: string;
    posterPath?: string | null;
    backdropPath?: string | null;
    rating?: number;
    releaseDate?: string;
    urlPath?: string;
  }
): Promise<{ added: boolean; watchlist: MongoWatchlistItem[] }> {
  return withMongoRetry(async () => {
    const col = await getUsersCollection();
    const user = await getUserById(userId);
    if (!user) throw new Error('User not found');

    const currentList = user.watchlist || [];
    const normalizedId = String(item.contentId);
    const exists = currentList.some((w) => String(w.contentId) === normalizedId);

    let updatedList: MongoWatchlistItem[];

    if (exists) {
      // Remove
      updatedList = currentList.filter((w) => String(w.contentId) !== normalizedId);
    } else {
      // Add to front
      const newItem: MongoWatchlistItem = {
        contentId: item.contentId,
        type: item.type,
        title: item.title,
        posterPath: item.posterPath || null,
        backdropPath: item.backdropPath || null,
        rating: item.rating || 0,
        releaseDate: item.releaseDate || '2026',
        urlPath: item.urlPath || (item.type === 'tv' ? `/tv/${item.contentId}` : `/movie/${item.contentId}`),
        addedAt: Date.now(),
      };
      updatedList = [newItem, ...currentList];
    }

    await col.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { watchlist: updatedList, updatedAt: Date.now() } }
    );

    return { added: !exists, watchlist: updatedList };
  });
}

/**
 * Removes an item from the user's watchlist.
 */
export async function removeUserWatchlist(
  userId: string,
  contentId: string | number
): Promise<MongoWatchlistItem[]> {
  return withMongoRetry(async () => {
    const col = await getUsersCollection();
    const normalizedId = String(contentId);

    const user = await getUserById(userId);
    if (!user) throw new Error('User not found');

    const updatedList = (user.watchlist || []).filter(
      (w) => String(w.contentId) !== normalizedId
    );

    await col.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { watchlist: updatedList, updatedAt: Date.now() } }
    );

    return updatedList;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// HISTORY OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retrieves the user's viewing history sorted by newest first.
 */
export async function getUserHistory(userId: string): Promise<MongoHistoryItem[]> {
  const user = await getUserById(userId);
  return user?.history || [];
}

/**
 * Records content visit into user history.
 * Eliminates duplicates by bumping existing entries to the top with new timestamp.
 */
export async function addUserHistory(
  userId: string,
  item: {
    contentId: string | number;
    type: 'movie' | 'tv';
    title: string;
    episodeTitle?: string;
    posterPath?: string | null;
    backdropPath?: string | null;
    rating?: number;
    urlPath?: string;
  }
): Promise<MongoHistoryItem[]> {
  return withMongoRetry(async () => {
    const col = await getUsersCollection();
    const user = await getUserById(userId);
    if (!user) throw new Error('User not found');

    const currentHistory = user.history || [];
    const normalizedId = String(item.contentId);
    const now = Date.now();

    const newHistoryItem: MongoHistoryItem = {
      contentId: item.contentId,
      type: item.type,
      title: item.title,
      episodeTitle: item.episodeTitle,
      posterPath: item.posterPath || null,
      backdropPath: item.backdropPath || null,
      rating: item.rating || 0,
      urlPath: item.urlPath || (item.type === 'tv' ? `/tv/${item.contentId}` : `/movie/${item.contentId}`),
      viewedAt: now,
    };

    const filtered = currentHistory.filter((h) => String(h.contentId) !== normalizedId);
    const updatedHistory = [newHistoryItem, ...filtered].slice(0, 50);

    await col.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { history: updatedHistory, updatedAt: now } }
    );

    return updatedHistory;
  });
}

/**
 * Deletes an item or clears entire history for a user.
 */
export async function removeUserHistory(
  userId: string,
  contentId?: string | number
): Promise<MongoHistoryItem[]> {
  return withMongoRetry(async () => {
    const col = await getUsersCollection();
    const user = await getUserById(userId);
    if (!user) throw new Error('User not found');

    let updatedHistory: MongoHistoryItem[] = [];

    if (contentId !== undefined && contentId !== null) {
      const normalizedId = String(contentId);
      updatedHistory = (user.history || []).filter((h) => String(h.contentId) !== normalizedId);
    } else {
      updatedHistory = [];
    }

    await col.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { history: updatedHistory, updatedAt: Date.now() } }
    );

    return updatedHistory;
  });
}
