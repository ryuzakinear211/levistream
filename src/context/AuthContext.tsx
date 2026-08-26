'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export interface UserProfile {
  username: string;
  email: string;
  avatar?: string;
  createdAt?: string;
}

export interface WatchlistItem {
  id: number | string;
  title: string;
  posterPath?: string | null;
  type: 'movie' | 'tv';
  addedAt: string;
}

interface AuthContextType {
  user: UserProfile | null;
  isLoggedIn: boolean;
  isAuthModalOpen: boolean;
  authModalTab: 'login' | 'register';
  authModalMessage?: string;
  openAuthModal: (tab?: 'login' | 'register', message?: string) => void;
  closeAuthModal: () => void;
  login: (userData: UserProfile) => void;
  logout: () => void;
  watchlist: WatchlistItem[];
  toggleWatchlist: (item: Omit<WatchlistItem, 'addedAt'>) => boolean;
  isInWatchlist: (id: number | string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_STORAGE_KEY = 'filmanesia_auth_user';
const WATCHLIST_STORAGE_KEY = 'filmanesia_watchlist';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'login' | 'register'>('login');
  const [authModalMessage, setAuthModalMessage] = useState<string | undefined>(undefined);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);

  // Load user and watchlist from localStorage on client mount
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem(USER_STORAGE_KEY);
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
      const storedWatchlist = localStorage.getItem(WATCHLIST_STORAGE_KEY);
      if (storedWatchlist) {
        setWatchlist(JSON.parse(storedWatchlist));
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const login = (userData: UserProfile) => {
    setUser(userData);
    try {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
    } catch {}
    setIsAuthModalOpen(false);
  };

  const logout = () => {
    setUser(null);
    try {
      localStorage.removeItem(USER_STORAGE_KEY);
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

  const isInWatchlist = (id: number | string): boolean => {
    return watchlist.some((item) => String(item.id) === String(id));
  };

  const toggleWatchlist = (item: Omit<WatchlistItem, 'addedAt'>): boolean => {
    if (!user) {
      openAuthModal('login', 'Silakan masuk terlebih dahulu untuk menyimpan ke Watchlist');
      return false;
    }

    const exists = isInWatchlist(item.id);
    let updated: WatchlistItem[];
    if (exists) {
      updated = watchlist.filter((w) => String(w.id) !== String(item.id));
    } else {
      updated = [{ ...item, addedAt: new Date().toISOString() }, ...watchlist];
    }

    setWatchlist(updated);
    try {
      localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
    return !exists;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn: Boolean(user),
        isAuthModalOpen,
        authModalTab,
        authModalMessage,
        openAuthModal,
        closeAuthModal,
        login,
        logout,
        watchlist,
        toggleWatchlist,
        isInWatchlist,
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
