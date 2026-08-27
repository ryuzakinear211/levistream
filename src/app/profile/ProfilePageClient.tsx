'use client';

import React, { useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  User,
  Bookmark,
  History,
  LogIn,
  LogOut,
  Trash2,
  Play,
  Film,
  Star,
  Clock,
  ShieldCheck,
  Calendar,
  ArrowRight,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import ProfileSkeleton from '@/components/skeletons/ProfileSkeleton';
import { getImageUrl } from '@/lib/tmdb';

function formatRelativeTime(timestamp?: number): string {
  if (!timestamp) return 'Baru saja';
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Baru saja';
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Kemarin';
  if (days < 30) return `${days} hari lalu`;
  return new Date(timestamp).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatJoinDate(dateVal?: string | number): string {
  if (!dateVal) return '2026';
  try {
    const d = new Date(dateVal);
    return d.toLocaleDateString('id-ID', {
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '2026';
  }
}

const WATCHLIST_PER_PAGE = 12;
const HISTORY_PER_PAGE = 10;

export default function ProfilePageClient() {
  const {
    user,
    authStatus,
    isLoggedIn,
    openAuthModal,
    logout,
    watchlist,
    removeFromWatchlist,
    history,
    removeFromHistory,
    clearHistory,
    refreshProfile,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<'watchlist' | 'history'>('watchlist');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [confirmClearHistory, setConfirmClearHistory] = useState(false);

  // Pagination states
  const [watchlistPage, setWatchlistPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const contentSectionRef = useRef<HTMLDivElement>(null);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refreshProfile();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleClearAllHistory = async () => {
    await clearHistory();
    setConfirmClearHistory(false);
    setHistoryPage(1);
  };

  // Watchlist Pagination calculations
  const totalWatchlistPages = Math.max(1, Math.ceil(watchlist.length / WATCHLIST_PER_PAGE));
  const paginatedWatchlist = useMemo(() => {
    const start = (watchlistPage - 1) * WATCHLIST_PER_PAGE;
    return watchlist.slice(start, start + WATCHLIST_PER_PAGE);
  }, [watchlist, watchlistPage]);

  // History Pagination calculations
  const totalHistoryPages = Math.max(1, Math.ceil(history.length / HISTORY_PER_PAGE));
  const paginatedHistory = useMemo(() => {
    const start = (historyPage - 1) * HISTORY_PER_PAGE;
    return history.slice(start, start + HISTORY_PER_PAGE);
  }, [history, historyPage]);

  const scrollToContent = () => {
    if (contentSectionRef.current) {
      contentSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const onWatchlistPageChange = (newPage: number) => {
    setWatchlistPage(newPage);
    scrollToContent();
  };

  const onHistoryPageChange = (newPage: number) => {
    setHistoryPage(newPage);
    scrollToContent();
  };

  // While checking initial session (and no local cache available), show smooth ProfileSkeleton
  if (authStatus === 'initializing') {
    return <ProfileSkeleton />;
  }

  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-20 px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-14" style={{ background: '#050816' }}>
      <div className="max-w-6xl mx-auto space-y-8">

        {/* ── 1. USER PROFILE HEADER CARD ── */}
        <div
          className="relative rounded-3xl p-6 sm:p-8 overflow-hidden transition-all duration-300"
          style={{
            background: 'rgba(11, 16, 32, 0.85)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5), 0 0 30px rgba(6, 182, 212, 0.08)',
          }}
        >
          {/* Ambient Glow Orbs */}
          <div
            className="absolute -top-24 -right-24 w-72 h-72 rounded-full pointer-events-none opacity-20 blur-3xl"
            style={{ background: 'radial-gradient(circle, #06b6d4, #7c3aed)' }}
          />
          <div
            className="absolute -bottom-24 -left-24 w-60 h-60 rounded-full pointer-events-none opacity-15 blur-3xl"
            style={{ background: 'radial-gradient(circle, #ec4899, #7c3aed)' }}
          />

          <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
            
            {/* Left: Avatar + Details */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-5">
              {/* Avatar Frame */}
              <div className="relative group">
                <div
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl p-1 flex items-center justify-center shadow-2xl transition-transform duration-300 group-hover:scale-105"
                  style={{
                    background: isLoggedIn
                      ? 'linear-gradient(135deg, #06b6d4, #7c3aed, #ec4899)'
                      : 'linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.05))',
                    boxShadow: isLoggedIn ? '0 0 25px rgba(6, 182, 212, 0.4)' : 'none',
                  }}
                >
                  <div className="w-full h-full rounded-xl bg-[#0b1020] flex items-center justify-center overflow-hidden">
                    {isLoggedIn && user?.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.username}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-cyan-500/20 to-purple-600/20 text-cyan-400">
                        <User size={36} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Status Indicator Dot */}
                <div
                  className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-[#0b1020] flex items-center justify-center ${
                    isLoggedIn ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-slate-500'
                  }`}
                />
              </div>

              {/* User Info Details */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight">
                    {isLoggedIn ? user?.username : 'Guest'}
                  </h1>

                  {/* Status Badge */}
                  {isLoggedIn ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.2)]">
                      <ShieldCheck size={12} className="text-cyan-400" />
                      MEMBER
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-500/20 border border-slate-500/30 text-slate-300">
                      Guest
                    </span>
                  )}
                </div>

                <p className="text-xs sm:text-sm text-slate-400">
                  {isLoggedIn
                    ? user?.email
                    : 'Login untuk melihat riwayat tontonan & watchlist'}
                </p>

                {/* Meta details */}
                {isLoggedIn && (
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 pt-1 text-xs text-slate-400">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar size={13} className="text-purple-400" />
                      Bergabung: {formatJoinDate(user?.createdAt)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Quick Stats & Actions */}
            <div className="flex flex-col items-center sm:items-end gap-3.5 w-full sm:w-auto">
              {/* Stats Pills */}
              <div className="flex items-center gap-3">
                <div className="px-4 py-2 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-center min-w-[90px]">
                  <p className="text-xs text-slate-400">Watchlist</p>
                  <p className="text-lg font-black text-cyan-400">
                    {isLoggedIn ? watchlist.length : 0}
                  </p>
                </div>
                <div className="px-4 py-2 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-center min-w-[90px]">
                  <p className="text-xs text-slate-400">Riwayat</p>
                  <p className="text-lg font-black text-purple-400">
                    {isLoggedIn ? history.length : 0}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                {isLoggedIn ? (
                  <>
                    <button
                      onClick={handleManualRefresh}
                      disabled={isRefreshing}
                      className="p-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-slate-300 hover:text-white transition-all active:scale-95"
                      title="Refresh Data"
                    >
                      <RefreshCw
                        size={16}
                        className={isRefreshing ? 'animate-spin text-cyan-400' : ''}
                      />
                    </button>

                    <button
                      onClick={logout}
                      className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs text-rose-300 hover:text-white bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/30 transition-all duration-200 active:scale-95"
                    >
                      <LogOut size={15} />
                      <span>Keluar</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => openAuthModal('login', 'Masuk untuk mengakses profil dan watchlist Anda')}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg"
                    style={{
                      background: 'linear-gradient(135deg, #06b6d4, #7c3aed)',
                      boxShadow: '0 0 20px rgba(6, 182, 212, 0.4)',
                    }}
                  >
                    <LogIn size={16} />
                    <span>Masuk / Daftar Akun</span>
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* ── 2. TAB SWITCHER ── */}
        <div ref={contentSectionRef} className="flex items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Watchlist Tab Button */}
            <button
              onClick={() => {
                setActiveTab('watchlist');
                setWatchlistPage(1);
              }}
              className={`relative flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all duration-200 ${
                activeTab === 'watchlist'
                  ? 'text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04] border border-transparent'
              }`}
            >
              <Bookmark
                size={16}
                fill={activeTab === 'watchlist' ? 'currentColor' : 'none'}
              />
              <span>Watchlist</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                  activeTab === 'watchlist'
                    ? 'bg-cyan-500 text-slate-950'
                    : 'bg-white/10 text-slate-400'
                }`}
              >
                {isLoggedIn ? watchlist.length : 0}
              </span>
            </button>

            {/* History Tab Button */}
            <button
              onClick={() => {
                setActiveTab('history');
                setHistoryPage(1);
              }}
              className={`relative flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all duration-200 ${
                activeTab === 'history'
                  ? 'text-purple-400 bg-purple-500/10 border border-purple-500/30 shadow-[0_0_15px_rgba(124,58,237,0.2)]'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04] border border-transparent'
              }`}
            >
              <History size={16} />
              <span>Riwayat Tonton</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                  activeTab === 'history'
                    ? 'bg-purple-500 text-white'
                    : 'bg-white/10 text-slate-400'
                }`}
              >
                {isLoggedIn ? history.length : 0}
              </span>
            </button>
          </div>

          {/* Right Action: Clear History (only on history tab when logged in and has items) */}
          {activeTab === 'history' && isLoggedIn && history.length > 0 && (
            <div>
              {confirmClearHistory ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleClearAllHistory}
                    className="px-3 py-1.5 rounded-xl bg-rose-500 text-white font-bold text-xs shadow-lg hover:bg-rose-600 transition-colors"
                  >
                    Ya, Bersihkan
                  </button>
                  <button
                    onClick={() => setConfirmClearHistory(false)}
                    className="px-2.5 py-1.5 rounded-xl bg-white/10 text-slate-300 text-xs hover:text-white transition-colors"
                  >
                    Batal
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmClearHistory(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 transition-colors"
                >
                  <Trash2 size={13} />
                  <span className="hidden sm:inline">Bersihkan Riwayat</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── 3. TAB CONTENT VIEWS ── */}

        {/* ── TAB 1: WATCHLIST ── */}
        {activeTab === 'watchlist' && (
          <div className="space-y-8">
            {!isLoggedIn ? (
              /* Guest Preview State for Watchlist */
              <div
                className="rounded-3xl p-8 sm:p-12 text-center max-w-xl mx-auto space-y-5"
                style={{
                  background: 'rgba(11, 16, 32, 0.7)',
                  border: '1px dashed rgba(6, 182, 212, 0.3)',
                }}
              >
                <div
                  className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, rgba(6,182,212,0.2), rgba(124,58,237,0.2))',
                    border: '1px solid rgba(6,182,212,0.3)',
                    boxShadow: '0 0 25px rgba(6, 182, 212, 0.2)',
                  }}
                >
                  <Bookmark size={28} className="text-cyan-400" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg sm:text-xl font-black text-white">
                    Watchlist Pribadi
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                    Login untuk melihat riwayat tontonan & watchlist. Semua film dan serial favoritmu akan tersimpan rapi di akunmu.
                  </p>
                </div>

                <button
                  onClick={() => openAuthModal('login', 'Masuk untuk menyimpan ke Watchlist')}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-xs sm:text-sm text-white shadow-xl hover:scale-105 active:scale-95 transition-all"
                  style={{
                    background: 'linear-gradient(135deg, #06b6d4, #7c3aed)',
                    boxShadow: '0 0 20px rgba(6, 182, 212, 0.4)',
                  }}
                >
                  <LogIn size={16} />
                  <span>Masuk Sekarang</span>
                </button>
              </div>
            ) : watchlist.length === 0 ? (
              /* Logged in but empty watchlist */
              <div
                className="rounded-3xl p-8 sm:p-12 text-center max-w-md mx-auto space-y-4"
                style={{
                  background: 'rgba(11, 16, 32, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                <div className="w-14 h-14 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center mx-auto text-slate-400">
                  <Bookmark size={24} />
                </div>
                <h3 className="text-base font-bold text-white">Watchlist Masih Kosong</h3>
                <p className="text-xs text-slate-400">
                  Jelajahi ribuan film dan serial pilihan, lalu klik tombol Watchlist untuk menyimpannya di sini.
                </p>
                <Link
                  href="/movie"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 transition-all"
                >
                  <Film size={14} />
                  <span>Jelajahi Film & Serial</span>
                </Link>
              </div>
            ) : (
              /* Watchlist Grid & Pagination */
              <>
                <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4.5 md:gap-5">
                  {paginatedWatchlist.map((item) => {
                    const targetUrl = item.urlPath || (item.type === 'tv' ? `/tv/${item.contentId}` : `/movie/${item.contentId}`);
                    const posterSrc = item.posterPath
                      ? item.posterPath.startsWith('http')
                        ? item.posterPath
                        : getImageUrl(item.posterPath, 'w500')
                      : '/placeholder-poster.svg';

                    return (
                      <div
                        key={String(item.contentId)}
                        className="group relative flex flex-col rounded-2xl overflow-hidden bg-[#0c1226] border border-white/[0.08] hover:border-cyan-500/50 transition-all duration-300 hover:shadow-[0_8px_30px_rgba(6,182,212,0.2)] hover:-translate-y-1"
                      >
                        {/* Poster Container */}
                        <Link href={targetUrl} className="relative aspect-[2/3] w-full overflow-hidden bg-slate-900 block">
                          <Image
                            src={posterSrc}
                            alt={item.title}
                            fill
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                          />

                          {/* Top Badges */}
                          <div className="absolute top-2 left-2 flex items-center gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider text-white shadow-md ${
                                item.type === 'tv'
                                  ? 'bg-gradient-to-r from-pink-600 to-purple-600'
                                  : 'bg-gradient-to-r from-cyan-600 to-blue-600'
                              }`}
                            >
                              {item.type === 'tv' ? 'Series' : 'Movie'}
                            </span>
                          </div>

                          {/* Rating Badge */}
                          {Boolean(item.rating) && item.rating! > 0 && (
                            <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-black/70 backdrop-blur-md border border-amber-500/30 text-amber-300 text-[10px] font-black">
                              <Star size={10} className="fill-amber-400 text-amber-400" />
                              <span>{item.rating?.toFixed(1)}</span>
                            </div>
                          )}

                          {/* Hover Overlay with Play Icon */}
                          <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                            <div className="w-11 h-11 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.8)] transform scale-75 group-hover:scale-100 transition-transform duration-300">
                              <Play size={18} className="fill-current ml-0.5" />
                            </div>
                          </div>
                        </Link>

                        {/* Info & Remove Button */}
                        <div className="p-3 flex flex-col justify-between flex-1 gap-2">
                          <Link href={targetUrl} className="block">
                            <h4 className="text-xs sm:text-sm font-bold text-white line-clamp-1 group-hover:text-cyan-400 transition-colors">
                              {item.title}
                            </h4>
                            <p className="text-[10px] text-slate-400">
                              {item.releaseDate ? item.releaseDate.slice(0, 4) : '2026'}
                            </p>
                          </Link>

                          <div className="flex items-center justify-between pt-1 border-t border-white/[0.06]">
                            <Link
                              href={targetUrl}
                              className="text-[11px] font-bold text-cyan-400 hover:underline flex items-center gap-1"
                            >
                              <span>Tonton</span>
                              <ArrowRight size={11} />
                            </Link>

                            <button
                              onClick={() => removeFromWatchlist(item.contentId)}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                              title="Hapus dari Watchlist"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Watchlist Pagination Controls */}
                {totalWatchlistPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-white/[0.06]">
                    <p className="text-xs text-slate-400 text-center sm:text-left">
                      Menampilkan <span className="text-white font-bold">{paginatedWatchlist.length}</span> dari{' '}
                      <span className="text-white font-bold">{watchlist.length}</span> item tersimpan
                    </p>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onWatchlistPageChange(watchlistPage - 1)}
                        disabled={watchlistPage === 1}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-slate-300 hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center gap-1"
                      >
                        <ChevronLeft size={14} />
                        <span>Prev</span>
                      </button>

                      <div className="flex items-center gap-1 px-1">
                        {Array.from({ length: totalWatchlistPages }).map((_, idx) => {
                          const p = idx + 1;
                          const isActive = p === watchlistPage;
                          // Display smart range
                          if (
                            p === 1 ||
                            p === totalWatchlistPages ||
                            (p >= watchlistPage - 1 && p <= watchlistPage + 1)
                          ) {
                            return (
                              <button
                                key={p}
                                onClick={() => onWatchlistPageChange(p)}
                                className={`w-8 h-8 rounded-xl text-xs font-bold transition-all ${
                                  isActive
                                    ? 'bg-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(6,182,212,0.5)]'
                                    : 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white border border-white/5'
                                }`}
                              >
                                {p}
                              </button>
                            );
                          }
                          if (p === watchlistPage - 2 || p === watchlistPage + 2) {
                            return (
                              <span key={p} className="text-slate-600 text-xs px-0.5">
                                •
                              </span>
                            );
                          }
                          return null;
                        })}
                      </div>

                      <button
                        onClick={() => onWatchlistPageChange(watchlistPage + 1)}
                        disabled={watchlistPage === totalWatchlistPages}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-slate-300 hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center gap-1"
                      >
                        <span>Next</span>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── TAB 2: HISTORY ── */}
        {activeTab === 'history' && (
          <div className="space-y-8">
            {!isLoggedIn ? (
              /* Guest Preview State for History */
              <div
                className="rounded-3xl p-8 sm:p-12 text-center max-w-xl mx-auto space-y-5"
                style={{
                  background: 'rgba(11, 16, 32, 0.7)',
                  border: '1px dashed rgba(124, 58, 237, 0.3)',
                }}
              >
                <div
                  className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(236,72,153,0.2))',
                    border: '1px solid rgba(124,58,237,0.3)',
                    boxShadow: '0 0 25px rgba(124, 58, 237, 0.2)',
                  }}
                >
                  <History size={28} className="text-purple-400" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg sm:text-xl font-black text-white">
                    Riwayat Tontonan
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                    Login untuk melihat riwayat tontonan & watchlist. Lanjutkan film atau episode serial yang sedang kamu tonton kapan saja tanpa takut terlewat.
                  </p>
                </div>

                <button
                  onClick={() => openAuthModal('login', 'Masuk untuk mencatat riwayat tontonan')}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-xs sm:text-sm text-white shadow-xl hover:scale-105 active:scale-95 transition-all"
                  style={{
                    background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
                    boxShadow: '0 0 20px rgba(124, 58, 237, 0.4)',
                  }}
                >
                  <LogIn size={16} />
                  <span>Masuk Sekarang</span>
                </button>
              </div>
            ) : history.length === 0 ? (
              /* Logged in but empty history */
              <div
                className="rounded-3xl p-8 sm:p-12 text-center max-w-md mx-auto space-y-4"
                style={{
                  background: 'rgba(11, 16, 32, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                <div className="w-14 h-14 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center mx-auto text-slate-400">
                  <Clock size={24} />
                </div>
                <h3 className="text-base font-bold text-white">Belum Ada Riwayat Tontonan</h3>
                <p className="text-xs text-slate-400">
                  Mulai putar film atau serial favoritmu dan riwayat tontonan akan otomatis dicatat di sini.
                </p>
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 transition-all"
                >
                  <Play size={14} />
                  <span>Mulai Menonton</span>
                </Link>
              </div>
            ) : (
              /* History Timeline Grid & Pagination */
              <>
                <div className="space-y-3 sm:space-y-4">
                  {paginatedHistory.map((item) => {
                    const targetUrl = item.urlPath || (item.type === 'tv' ? `/tv/${item.contentId}` : `/movie/${item.contentId}`);
                    const posterSrc = item.posterPath
                      ? item.posterPath.startsWith('http')
                        ? item.posterPath
                        : getImageUrl(item.posterPath, 'w500')
                      : '/placeholder-poster.svg';

                    return (
                      <div
                        key={`${item.contentId}-${item.viewedAt}`}
                        className="group relative flex items-center justify-between gap-4 p-3 sm:p-4 rounded-2xl bg-[#0c1226] border border-white/[0.08] hover:border-purple-500/40 hover:bg-white/[0.03] transition-all duration-200"
                      >
                        {/* Left: Thumbnail & Info */}
                        <Link href={targetUrl} className="flex items-center gap-3.5 sm:gap-4 flex-1 min-w-0">
                          {/* Thumbnail */}
                          <div className="relative w-16 sm:w-20 aspect-[16/10] rounded-xl overflow-hidden bg-slate-900 flex-shrink-0">
                            <Image
                              src={posterSrc}
                              alt={item.title}
                              fill
                              sizes="120px"
                              className="object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-slate-950/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Play size={14} className="text-cyan-400 fill-cyan-400" />
                            </div>
                          </div>

                          {/* Title & Metadata */}
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider text-white ${
                                  item.type === 'tv' ? 'bg-pink-600' : 'bg-cyan-600'
                                }`}
                              >
                                {item.type === 'tv' ? 'Series' : 'Movie'}
                              </span>
                              <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-purple-400 transition-colors">
                                {item.title}
                              </h4>
                            </div>

                            {item.episodeTitle && (
                              <p className="text-[11px] font-semibold text-purple-300 truncate">
                                {item.episodeTitle}
                              </p>
                            )}

                            <p className="text-[10px] text-slate-400 flex items-center gap-1.5">
                              <Clock size={10} className="text-slate-400" />
                              <span>Ditonton {formatRelativeTime(item.viewedAt)}</span>
                            </p>
                          </div>
                        </Link>

                        {/* Right: Quick Action Buttons */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Link
                            href={targetUrl}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs text-white bg-purple-500/20 hover:bg-purple-500/40 border border-purple-500/30 transition-colors"
                          >
                            <Play size={12} className="fill-current" />
                            <span className="hidden sm:inline">Lanjutkan</span>
                          </Link>

                          <button
                            onClick={() => removeFromHistory(item.contentId)}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="Hapus dari Riwayat"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* History Pagination Controls */}
                {totalHistoryPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-white/[0.06]">
                    <p className="text-xs text-slate-400 text-center sm:text-left">
                      Menampilkan <span className="text-white font-bold">{paginatedHistory.length}</span> dari{' '}
                      <span className="text-white font-bold">{history.length}</span> riwayat tontonan
                    </p>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onHistoryPageChange(historyPage - 1)}
                        disabled={historyPage === 1}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-slate-300 hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center gap-1"
                      >
                        <ChevronLeft size={14} />
                        <span>Prev</span>
                      </button>

                      <div className="flex items-center gap-1 px-1">
                        {Array.from({ length: totalHistoryPages }).map((_, idx) => {
                          const p = idx + 1;
                          const isActive = p === historyPage;
                          if (
                            p === 1 ||
                            p === totalHistoryPages ||
                            (p >= historyPage - 1 && p <= historyPage + 1)
                          ) {
                            return (
                              <button
                                key={p}
                                onClick={() => onHistoryPageChange(p)}
                                className={`w-8 h-8 rounded-xl text-xs font-bold transition-all ${
                                  isActive
                                    ? 'bg-purple-500 text-white shadow-[0_0_12px_rgba(124,58,237,0.5)]'
                                    : 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white border border-white/5'
                                }`}
                              >
                                {p}
                              </button>
                            );
                          }
                          if (p === historyPage - 2 || p === historyPage + 2) {
                            return (
                              <span key={p} className="text-slate-600 text-xs px-0.5">
                                •
                              </span>
                            );
                          }
                          return null;
                        })}
                      </div>

                      <button
                        onClick={() => onHistoryPageChange(historyPage + 1)}
                        disabled={historyPage === totalHistoryPages}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-slate-300 hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center gap-1"
                      >
                        <span>Next</span>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

export { ProfilePageClient };
