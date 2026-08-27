'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

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

interface AuthContextType {
  user: UserProfile | null;
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'login' | 'register'>('login');
  const [authModalMessage, setAuthModalMessage] = useState<string | undefined>(undefined);

  // Sync user profile, watchlist, and history from server session on mount
  const refreshProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
      });
      const data = await res.json();
      if (data.success && data.user) {
        setUser({
          id: data.user.id,
          username: data.user.username,
          email: data.user.email,
          avatar: data.user.avatar,
          createdAt: data.user.createdAt,
        });
        setWatchlist(data.user.watchlist || []);
        setHistory(data.user.history || []);
      } else {
        setUser(null);
        setWatchlist([]);
        setHistory([]);
      }
    } catch (err) {
      console.warn('[AuthContext] sync session error:', err);
    } finally {
      setIsLoading(false);
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
        setUser({
          id: data.user.id,
          username: data.user.username,
          email: data.user.email,
          avatar: data.user.avatar,
          createdAt: data.user.createdAt,
        });
        setWatchlist(data.user.watchlist || []);
        setHistory(data.user.history || []);
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
        setUser({
          id: data.user.id,
          username: data.user.username,
          email: data.user.email,
          avatar: data.user.avatar,
          createdAt: data.user.createdAt,
        });
        setWatchlist(data.user.watchlist || []);
        setHistory(data.user.history || []);
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
    if (!user) {
      openAuthModal('login', 'Silakan masuk terlebih dahulu untuk menyimpan ke Watchlist');
      return false;
    }

    const normalized = String(item.contentId);
    const exists = isInWatchlist(normalized);

    // Optimistic UI update
    if (exists) {
      setWatchlist((prev) => prev.filter((w) => String(w.contentId) !== normalized));
    } else {
      setWatchlist((prev) => [
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
        ...prev,
      ]);
    }

    try {
      const res = await fetch('/api/user/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
      const data = await res.json();
      if (data.success && data.watchlist) {
        setWatchlist(data.watchlist);
        return data.added;
      }
    } catch (err) {
      console.error('[AuthContext] toggleWatchlist error:', err);
      // Revert if error
      refreshProfile();
    }

    return !exists;
  };

  const removeFromWatchlist = async (contentId: number | string) => {
    if (!user) return;
    const normalized = String(contentId);
    setWatchlist((prev) => prev.filter((w) => String(w.contentId) !== normalized));

    try {
      const res = await fetch(`/api/user/watchlist?contentId=${encodeURIComponent(normalized)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success && data.watchlist) {
        setWatchlist(data.watchlist);
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
    // If user is not logged in, don't record to MongoDB
    if (!user) return;

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

    // Optimistic UI update
    setHistory((prev) => [newEntry, ...prev.filter((h) => String(h.contentId) !== normalized)].slice(0, 50));

    try {
      const res = await fetch('/api/user/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
      const data = await res.json();
      if (data.success && data.history) {
        setHistory(data.history);
      }
    } catch (err) {
      console.warn('[AuthContext] addToHistory error:', err);
    }
  };

  const removeFromHistory = async (contentId: number | string) => {
    if (!user) return;
    const normalized = String(contentId);
    setHistory((prev) => prev.filter((h) => String(h.contentId) !== normalized));

    try {
      const res = await fetch(`/api/user/history?contentId=${encodeURIComponent(normalized)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success && data.history) {
        setHistory(data.history);
      }
    } catch (err) {
      console.error('[AuthContext] removeFromHistory error:', err);
      refreshProfile();
    }
  };

  const clearHistory = async () => {
    if (!user) return;
    setHistory([]);
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
        isLoggedIn: Boolean(user),
        isLoading,
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
