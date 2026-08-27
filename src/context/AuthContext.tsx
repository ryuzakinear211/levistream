'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  createdAt?: string | number;
}

export interface WatchlistItem {
  contentId: number | string;
  title: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  type: 'movie' | 'tv';
  rating?: number;
  releaseDate?: string;
  urlPath?: string;
  addedAt?: number;
}

export interface HistoryItem {
  contentId: number | string;
  title: string;
  episodeTitle?: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  type: 'movie' | 'tv';
  rating?: number;
  urlPath?: string;
  viewedAt?: number;
}

export type AuthStatus = 'initializing' | 'authenticated' | 'unauthenticated';

interface AuthContextType {
  user: UserProfile | null;
  authStatus: AuthStatus;
  isLoggedIn: boolean;
  isLoading: boolean;
  isAuthModalOpen: boolean;
  authModalTab: 'login' | 'register';
  authModalMessage?: string;
  openAuthModal: (tab?: 'login' | 'register', message?: string) => void;
  closeAuthModal: () => void;
  login: (identifier: string, password: string) => Promise<{ success: boolean; message?: string }>;
  register: (username: string, email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  watchlist: WatchlistItem[];
  toggleWatchlist: (item: {
    contentId: number | string;
    title: string;
    posterPath?: string | null;
    backdropPath?: string | null;
    type: 'movie' | 'tv';
    rating?: number;
    releaseDate?: string;
    urlPath?: string;
  }) => Promise<boolean>;
  removeFromWatchlist: (contentId: number | string) => Promise<void>;
  isInWatchlist: (contentId: number | string) => boolean;
  history: HistoryItem[];
  addToHistory: (item: {
    contentId: number | string;
    title: string;
    episodeTitle?: string;
    posterPath?: string | null;
    backdropPath?: string | null;
    type: 'movie' | 'tv';
    rating?: number;
    urlPath?: string;
  }) => Promise<void>;
  removeFromHistory: (contentId: number | string) => Promise<void>;
  clearHistory: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_USER_CACHE_KEY = 'filmanesia_user_cache_v2';
const LOCAL_WATCHLIST_CACHE_KEY = 'filmanesia_watchlist_cache_v2';
const LOCAL_HISTORY_CACHE_KEY = 'filmanesia_history_cache_v2';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('initializing');
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'login' | 'register'>('login');
  const [authModalMessage, setAuthModalMessage] = useState<string | undefined>(undefined);

  const isInitializedRef = useRef(false);

  // 1. Instant Synchronous Cache Hydration on Mount (0ms delay to eliminate flicker)
  useEffect(() => {
    try {
      const cachedUserRaw = localStorage.getItem(LOCAL_USER_CACHE_KEY);
      const cachedWatchlistRaw = localStorage.getItem(LOCAL_WATCHLIST_CACHE_KEY);
      const cachedHistoryRaw = localStorage.getItem(LOCAL_HISTORY_CACHE_KEY);

      if (cachedUserRaw) {
        const parsedUser = JSON.parse(cachedUserRaw);
        if (parsedUser && parsedUser.id && parsedUser.username) {
          setUser(parsedUser);
          setAuthStatus('authenticated');
        }
      }

      if (cachedWatchlistRaw) {
        setWatchlist(JSON.parse(cachedWatchlistRaw));
      }
      if (cachedHistoryRaw) {
        setHistory(JSON.parse(cachedHistoryRaw));
      }
    } catch (e) {
      console.warn('[AuthContext] localStorage read error:', e);
    }
  }, []);

  // 2. Authoritative Server Session Verification & Database Sync
  const refreshProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache, no-store' },
      });

      if (!res.ok) {
        // If 5xx or server error, retain cached user without kicking them out
        if (res.status !== 401 && res.status !== 403) {
          console.warn('[AuthContext] Server returned status', res.status);
          return;
        }
      }

      const data = await res.json();

      if (data.success && data.authenticated && data.user) {
        const freshUser: UserProfile = {
          id: data.user.id,
          username: data.user.username,
          email: data.user.email,
          avatar: data.user.avatar,
          createdAt: data.user.createdAt,
        };
        const freshWatchlist: WatchlistItem[] = data.user.watchlist || [];
        const freshHistory: HistoryItem[] = data.user.history || [];

        setUser(freshUser);
        setWatchlist(freshWatchlist);
        setHistory(freshHistory);
        setAuthStatus('authenticated');

        try {
          localStorage.setItem(LOCAL_USER_CACHE_KEY, JSON.stringify(freshUser));
          localStorage.setItem(LOCAL_WATCHLIST_CACHE_KEY, JSON.stringify(freshWatchlist));
          localStorage.setItem(LOCAL_HISTORY_CACHE_KEY, JSON.stringify(freshHistory));
        } catch {}
      } else if (data.success && data.authenticated === false) {
        // Server definitively says there is no valid session
        setUser(null);
        setWatchlist([]);
        setHistory([]);
        setAuthStatus('unauthenticated');

        try {
          localStorage.removeItem(LOCAL_USER_CACHE_KEY);
          localStorage.removeItem(LOCAL_WATCHLIST_CACHE_KEY);
          localStorage.removeItem(LOCAL_HISTORY_CACHE_KEY);
        } catch {}
      }
    } catch (err) {
      // Network error or aborted fetch -> keep existing state to avoid false logouts
      console.warn('[AuthContext] sync session network error (retaining current state):', err);
    } finally {
      if (!isInitializedRef.current) {
        isInitializedRef.current = true;
        setAuthStatus((current) => (current === 'initializing' ? 'unauthenticated' : current));
      }
    }
  }, []);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const login = async (identifier: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        const newUser: UserProfile = {
          id: data.user.id,
          username: data.user.username,
          email: data.user.email,
          avatar: data.user.avatar,
          createdAt: data.user.createdAt,
        };
        const newWatchlist: WatchlistItem[] = data.user.watchlist || [];
        const newHistory: HistoryItem[] = data.user.history || [];

        setUser(newUser);
        setWatchlist(newWatchlist);
        setHistory(newHistory);
        setAuthStatus('authenticated');

        try {
          localStorage.setItem(LOCAL_USER_CACHE_KEY, JSON.stringify(newUser));
          localStorage.setItem(LOCAL_WATCHLIST_CACHE_KEY, JSON.stringify(newWatchlist));
          localStorage.setItem(LOCAL_HISTORY_CACHE_KEY, JSON.stringify(newHistory));
        } catch {}

        setIsAuthModalOpen(false);
        return { success: true, message: data.message };
      }
      return { success: false, message: data.message || 'Gagal masuk ke akun' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Terjadi kesalahan jaringan' };
    }
  };

  const register = async (username: string, email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        const newUser: UserProfile = {
          id: data.user.id,
          username: data.user.username,
          email: data.user.email,
          avatar: data.user.avatar,
          createdAt: data.user.createdAt,
        };
        const newWatchlist: WatchlistItem[] = data.user.watchlist || [];
        const newHistory: HistoryItem[] = data.user.history || [];

        setUser(newUser);
        setWatchlist(newWatchlist);
        setHistory(newHistory);
        setAuthStatus('authenticated');

        try {
          localStorage.setItem(LOCAL_USER_CACHE_KEY, JSON.stringify(newUser));
          localStorage.setItem(LOCAL_WATCHLIST_CACHE_KEY, JSON.stringify(newWatchlist));
          localStorage.setItem(LOCAL_HISTORY_CACHE_KEY, JSON.stringify(newHistory));
        } catch {}

        setIsAuthModalOpen(false);
        return { success: true, message: data.message };
      }
      return { success: false, message: data.message || 'Gagal mendaftar akun' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Terjadi kesalahan jaringan' };
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    setUser(null);
    setWatchlist([]);
    setHistory([]);
    setAuthStatus('unauthenticated');
    try {
      localStorage.removeItem(LOCAL_USER_CACHE_KEY);
      localStorage.removeItem(LOCAL_WATCHLIST_CACHE_KEY);
      localStorage.removeItem(LOCAL_HISTORY_CACHE_KEY);
    } catch {}
  };

  const openAuthModal = (tab: 'login' | 'register' = 'login', message?: string) => {
    setAuthModalTab(tab);
    setAuthModalMessage(message);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
    setAuthModalMessage(undefined);
  };

  const isInWatchlist = (contentId: number | string): boolean => {
    const normalized = String(contentId);
    return watchlist.some((item) => String(item.contentId) === normalized);
  };

  const toggleWatchlist = async (item: {
    contentId: number | string;
    title: string;
    posterPath?: string | null;
    backdropPath?: string | null;
    type: 'movie' | 'tv';
    rating?: number;
    releaseDate?: string;
    urlPath?: string;
  }): Promise<boolean> => {
    if (!user || authStatus !== 'authenticated') {
      openAuthModal('login', 'Silakan masuk terlebih dahulu untuk menyimpan ke Watchlist');
      return false;
    }

    const normalized = String(item.contentId);
    const exists = isInWatchlist(normalized);

    // Optimistic UI update
    let nextList: WatchlistItem[];
    if (exists) {
      nextList = watchlist.filter((w) => String(w.contentId) !== normalized);
    } else {
      nextList = [
        {
          contentId: item.contentId,
          title: item.title,
          posterPath: item.posterPath,
          backdropPath: item.backdropPath,
          type: item.type,
          rating: item.rating,
          releaseDate: item.releaseDate,
          urlPath: item.urlPath,
          addedAt: Date.now(),
        },
        ...watchlist,
      ];
    }
    setWatchlist(nextList);
    try {
      localStorage.setItem(LOCAL_WATCHLIST_CACHE_KEY, JSON.stringify(nextList));
    } catch {}

    try {
      const res = await fetch('/api/user/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
      const data = await res.json();
      if (data.success && data.watchlist) {
        setWatchlist(data.watchlist);
        try {
          localStorage.setItem(LOCAL_WATCHLIST_CACHE_KEY, JSON.stringify(data.watchlist));
        } catch {}
        return data.added;
      }
    } catch (err) {
      console.error('[AuthContext] toggleWatchlist error:', err);
      refreshProfile();
    }

    return !exists;
  };

  const removeFromWatchlist = async (contentId: number | string) => {
    if (!user || authStatus !== 'authenticated') return;
    const normalized = String(contentId);
    const nextList = watchlist.filter((w) => String(w.contentId) !== normalized);
    setWatchlist(nextList);
    try {
      localStorage.setItem(LOCAL_WATCHLIST_CACHE_KEY, JSON.stringify(nextList));
    } catch {}

    try {
      const res = await fetch(`/api/user/watchlist?contentId=${encodeURIComponent(normalized)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success && data.watchlist) {
        setWatchlist(data.watchlist);
        try {
          localStorage.setItem(LOCAL_WATCHLIST_CACHE_KEY, JSON.stringify(data.watchlist));
        } catch {}
      }
    } catch (err) {
      console.error('[AuthContext] removeFromWatchlist error:', err);
      refreshProfile();
    }
  };

  const addToHistory = async (item: {
    contentId: number | string;
    title: string;
    episodeTitle?: string;
    posterPath?: string | null;
    backdropPath?: string | null;
    type: 'movie' | 'tv';
    rating?: number;
    urlPath?: string;
  }) => {
    if (!user || authStatus !== 'authenticated') return;

    const normalized = String(item.contentId);
    const now = Date.now();
    const newEntry: HistoryItem = {
      contentId: item.contentId,
      title: item.title,
      episodeTitle: item.episodeTitle,
      posterPath: item.posterPath,
      backdropPath: item.backdropPath,
      type: item.type,
      rating: item.rating,
      urlPath: item.urlPath,
      viewedAt: now,
    };

    const nextHistory = [newEntry, ...history.filter((h) => String(h.contentId) !== normalized)].slice(0, 50);
    setHistory(nextHistory);
    try {
      localStorage.setItem(LOCAL_HISTORY_CACHE_KEY, JSON.stringify(nextHistory));
    } catch {}

    try {
      const res = await fetch('/api/user/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
      const data = await res.json();
      if (data.success && data.history) {
        setHistory(data.history);
        try {
          localStorage.setItem(LOCAL_HISTORY_CACHE_KEY, JSON.stringify(data.history));
        } catch {}
      }
    } catch (err) {
      console.warn('[AuthContext] addToHistory error:', err);
    }
  };

  const removeFromHistory = async (contentId: number | string) => {
    if (!user || authStatus !== 'authenticated') return;
    const normalized = String(contentId);
    const nextHistory = history.filter((h) => String(h.contentId) !== normalized);
    setHistory(nextHistory);
    try {
      localStorage.setItem(LOCAL_HISTORY_CACHE_KEY, JSON.stringify(nextHistory));
    } catch {}

    try {
      const res = await fetch(`/api/user/history?contentId=${encodeURIComponent(normalized)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success && data.history) {
        setHistory(data.history);
        try {
          localStorage.setItem(LOCAL_HISTORY_CACHE_KEY, JSON.stringify(data.history));
        } catch {}
      }
    } catch (err) {
      console.error('[AuthContext] removeFromHistory error:', err);
      refreshProfile();
    }
  };

  const clearHistory = async () => {
    if (!user || authStatus !== 'authenticated') return;
    setHistory([]);
    try {
      localStorage.removeItem(LOCAL_HISTORY_CACHE_KEY);
    } catch {}

    try {
      const res = await fetch('/api/user/history', { method: 'DELETE' });
      const data = await res.json();
      if (data.success && data.history) {
        setHistory(data.history);
      }
    } catch (err) {
      console.error('[AuthContext] clearHistory error:', err);
      refreshProfile();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        authStatus,
        isLoggedIn: authStatus === 'authenticated',
        isLoading: authStatus === 'initializing',
        isAuthModalOpen,
        authModalTab,
        authModalMessage,
        openAuthModal,
        closeAuthModal,
        login,
        register,
        logout,
        watchlist,
        toggleWatchlist,
        removeFromWatchlist,
        isInWatchlist,
        history,
        addToHistory,
        removeFromHistory,
        clearHistory,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
