'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Film,
  Tv,
  Search,
  Sparkles,
  Send,
  CheckCircle2,
  AlertCircle,
  X,
  Star,
  Calendar,
  Layers,
  MessageSquare,
  User,
  ArrowRight,
  RefreshCw,
  Clock,
  HelpCircle,
} from 'lucide-react';
import { Genre } from '@/types/tmdb';

interface RequestPageClientProps {
  movieGenres: Genre[];
  tvGenres: Genre[];
}

interface TMDBItem {
  id: number;
  title: string;
  overview?: string;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  year?: string | number | null;
  rating?: number | null;
  genres?: string[];
  mediaType?: 'movie' | 'tv';
}

export default function RequestPageClient({
  movieGenres = [],
  tvGenres = [],
}: RequestPageClientProps) {
  const [mediaType, setMediaType] = useState<'movie' | 'tv'>('movie');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TMDBItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);

  // Selected TMDB item
  const [selectedItem, setSelectedItem] = useState<TMDBItem | null>(null);

  // Form Fields
  const [customTitle, setCustomTitle] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [seasonRequest, setSeasonRequest] = useState('All Seasons');
  const [customSeason, setCustomSeason] = useState('');
  const [message, setMessage] = useState('');
  const [userContact, setUserContact] = useState('');

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submittedData, setSubmittedData] = useState<{
    title: string;
    mediaType: 'movie' | 'tv';
    year?: string | number | null;
  } | null>(null);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const isTV = mediaType === 'tv';
  const availableGenres = isTV ? tvGenres : movieGenres;

  // Handle clicking outside of search dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setSearchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced TMDB Search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchDropdownOpen(false);
      return;
    }

    // Don't search if query matches the already selected item title
    if (selectedItem && selectedItem.title.toLowerCase() === searchQuery.trim().toLowerCase()) {
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/admin/tmdb-search?query=${encodeURIComponent(searchQuery.trim())}&type=${mediaType}`
        );
        const data = await res.json();
        if (data.results && Array.isArray(data.results)) {
          setSearchResults(data.results);
          setSearchDropdownOpen(data.results.length > 0);
        } else {
          setSearchResults([]);
          setSearchDropdownOpen(false);
        }
      } catch (err) {
        console.error('TMDB Search failed:', err);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery, mediaType, selectedItem]);

  // When switching media type, reset specific selections
  const handleMediaTypeSwitch = (newType: 'movie' | 'tv') => {
    if (newType === mediaType) return;
    setMediaType(newType);
    setSelectedItem(null);
    setSearchQuery('');
    setSearchResults([]);
    setSelectedGenres([]);
    setErrorMessage(null);
  };

  // When an item from TMDB search is clicked
  const handleSelectTMDBItem = async (item: TMDBItem) => {
    setSelectedItem(item);
    setSearchQuery(item.title);
    setCustomTitle(item.title);
    setSearchDropdownOpen(false);
    setErrorMessage(null);

    // Fetch full details to get genres
    try {
      const previewRes = await fetch(
        `/api/admin/tmdb-preview?id=${item.id}&type=${mediaType}`
      );
      const previewData = await previewRes.json();
      if (previewData && previewData.genres && Array.isArray(previewData.genres)) {
        setSelectedGenres(previewData.genres);
        setSelectedItem((prev) =>
          prev
            ? {
                ...prev,
                genres: previewData.genres,
                overview: previewData.overview || prev.overview,
                year: previewData.year || prev.year,
                posterUrl: previewData.posterUrl || prev.posterUrl,
              }
            : null
        );
      }
    } catch (err) {
      console.warn('Failed to fetch full preview genres:', err);
    }
  };

  // Clear selection
  const handleClearSelection = () => {
    setSelectedItem(null);
    setSearchQuery('');
    setCustomTitle('');
    setSelectedGenres([]);
  };

  // Toggle genre badge
  const handleToggleGenre = (genreName: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genreName)
        ? prev.filter((g) => g !== genreName)
        : [...prev, genreName]
    );
  };

  // Handle Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const finalTitle = selectedItem?.title || customTitle.trim();
    if (!finalTitle) {
      setErrorMessage('Silakan pilih judul dari pencarian TMDB atau ketik judul film/series.');
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        mediaType,
        title: finalTitle,
        tmdbId: selectedItem?.id || undefined,
        year: selectedItem?.year || undefined,
        posterUrl: selectedItem?.posterUrl || undefined,
        genres: selectedGenres,
        season: isTV ? (seasonRequest === 'Custom' ? customSeason : seasonRequest) : undefined,
        message: message.trim(),
        userContact: userContact.trim(),
      };

      const res = await fetch('/api/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Gagal mengirim permintaan.');
      }

      setSubmittedData({
        title: finalTitle,
        mediaType,
        year: selectedItem?.year || null,
      });
      setSuccess(true);
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err: any) {
      console.error('Submit request error:', err);
      setErrorMessage(err.message || 'Terjadi kesalahan saat mengirim permintaan. Silakan coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  // Reset form to submit another request
  const handleResetForm = () => {
    setSuccess(false);
    setSelectedItem(null);
    setSearchQuery('');
    setCustomTitle('');
    setSelectedGenres([]);
    setMessage('');
    setUserContact('');
    setSeasonRequest('All Seasons');
    setCustomSeason('');
    setErrorMessage(null);
    setSubmittedData(null);
  };

  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-16 px-4 sm:px-6 md:px-8 lg:px-10" style={{ background: '#050816' }}>
      <div className="max-w-3xl mx-auto">
        {/* ── Top Header ── */}
        <div className="text-center mb-8 sm:mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.06] border border-white/10 text-xs font-bold mb-4 shadow-sm">
            <Sparkles size={14} className="text-cyan-400" />
            <span className="text-slate-300">Request Konten Baru</span>
          </div>

          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight mb-3">
            Request{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, #06b6d4 0%, #a78bfa 50%, #ec4899 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Film & TV Series
            </span>
          </h1>
          <p className="text-xs sm:text-base text-slate-400 max-w-xl mx-auto leading-relaxed">
            Punya film atau serial favorit yang belum ada di LeviStream? Kirimkan permintaanmu di bawah ini dan bot notifikasi kami akan langsung meneruskannya ke tim!
          </p>
        </div>

        {/* ── Success Card View ── */}
        {success ? (
          <div className="p-6 sm:p-10 rounded-3xl bg-[#090e21] border border-cyan-500/30 shadow-[0_0_50px_rgba(6,182,212,0.15)] text-center animate-in fade-in zoom-in-95 duration-300">
            <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-3xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-5 shadow-[0_0_30px_rgba(6,182,212,0.25)]">
              <CheckCircle2 size={40} className="sm:w-12 sm:h-12" />
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-white mb-2">
              Permintaan Berhasil Terkirim!
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto mb-6">
              Terima kasih! Permintaan untuk{' '}
              <span className="text-white font-bold">
                {submittedData?.title} {submittedData?.year ? `(${submittedData.year})` : ''}
              </span>{' '}
              telah berhasil diteruskan ke sistem notifikasi Telegram kami. Tim kami akan segera meninjaunya.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleResetForm}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold text-sm shadow-lg shadow-cyan-500/25 transition-all hover:opacity-95 active:scale-95 flex items-center justify-center gap-2"
              >
                <RefreshCw size={16} />
                <span>Kirim Request Lain</span>
              </button>
              <Link
                href="/"
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-slate-300 hover:text-white font-semibold text-sm border border-white/10 transition-all flex items-center justify-center gap-2"
              >
                <span>Kembali ke Beranda</span>
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        ) : (
          /* ── Request Form Card ── */
          <form
            onSubmit={handleSubmit}
            className="p-5 sm:p-8 rounded-3xl bg-[#090e21] border border-white/10 shadow-2xl space-y-6"
          >
            {/* Error Banner */}
            {errorMessage && (
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs sm:text-sm animate-in fade-in duration-200">
                <AlertCircle size={18} className="flex-shrink-0 mt-0.5 text-rose-400" />
                <div className="flex-1">{errorMessage}</div>
                <button
                  type="button"
                  onClick={() => setErrorMessage(null)}
                  className="text-rose-400 hover:text-rose-200 p-0.5"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {/* 1. Media Type Selector */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Pilih Tipe Konten
              </label>
              <div className="grid grid-cols-2 gap-2.5 p-1 rounded-2xl bg-white/[0.04] border border-white/10">
                <button
                  type="button"
                  onClick={() => handleMediaTypeSwitch('movie')}
                  className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                    !isTV
                      ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-md shadow-cyan-500/25'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <Film size={16} />
                  <span>Movie / Film</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleMediaTypeSwitch('tv')}
                  className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                    isTV
                      ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-md shadow-pink-500/25'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <Tv size={16} />
                  <span>TV Series / Drama</span>
                </button>
              </div>
            </div>

            {/* 2. TMDB Search & Selection */}
            <div ref={searchContainerRef} className="relative">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Cari di TMDB Database <span className="text-cyan-400">*</span>
              </label>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Search size={18} />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => {
                    if (searchResults.length > 0) setSearchDropdownOpen(true);
                  }}
                  placeholder={
                    isTV
                      ? 'Ketik nama series atau paste TMDB ID (contoh: Stranger Things / 66732)...'
                      : 'Ketik judul film atau paste TMDB ID (contoh: Spider-Man / 969681)...'
                  }
                  className="w-full pl-10 pr-10 py-3.5 rounded-2xl bg-white/[0.05] border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 focus:bg-white/[0.08] transition-all"
                />
                {searching ? (
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center">
                    <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : searchQuery ? (
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white"
                  >
                    <X size={16} />
                  </button>
                ) : null}
              </div>

              {/* Search Results Dropdown */}
              {searchDropdownOpen && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 rounded-2xl bg-[#0b1228] border border-white/15 shadow-2xl overflow-hidden z-30 max-h-72 overflow-y-auto">
                  <div className="p-1.5 space-y-1">
                    {searchResults.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectTMDBItem(item)}
                        className="w-full p-2 rounded-xl flex items-center gap-3 hover:bg-white/10 transition-colors text-left group"
                      >
                        {item.posterUrl ? (
                          <img
                            src={item.posterUrl}
                            alt={item.title}
                            className="w-10 h-14 object-cover rounded-lg flex-shrink-0 bg-slate-800"
                          />
                        ) : (
                          <div className="w-10 h-14 rounded-lg bg-slate-800 flex items-center justify-center text-slate-500 flex-shrink-0">
                            {isTV ? <Tv size={16} /> : <Film size={16} />}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-cyan-400 truncate">
                            {item.title}
                          </h4>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                            {item.year && <span>{item.year}</span>}
                            {item.rating && (
                              <span className="flex items-center gap-0.5 text-amber-400 font-semibold">
                                <Star size={10} fill="currentColor" /> {item.rating}
                              </span>
                            )}
                            <span className="text-[10px] text-slate-500 uppercase font-bold">
                              ID: {item.id}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 3. Selected TMDB Item Preview Card */}
            {selectedItem ? (
              <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-start gap-4">
                {selectedItem.posterUrl ? (
                  <img
                    src={selectedItem.posterUrl}
                    alt={selectedItem.title}
                    className="w-16 h-24 sm:w-20 sm:h-28 object-cover rounded-xl flex-shrink-0 shadow-md"
                  />
                ) : (
                  <div className="w-16 h-24 sm:w-20 sm:h-28 rounded-xl bg-slate-800 flex items-center justify-center text-slate-500 flex-shrink-0">
                    {isTV ? <Tv size={24} /> : <Film size={24} />}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 mb-1">
                        Terverifikasi TMDB #{selectedItem.id}
                      </span>
                      <h3 className="text-sm sm:text-base font-bold text-white truncate">
                        {selectedItem.title}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearSelection}
                      className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                      title="Ganti Film"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-300 mt-1">
                    {selectedItem.year && (
                      <span className="flex items-center gap-1">
                        <Calendar size={12} className="text-slate-400" />
                        {selectedItem.year}
                      </span>
                    )}
                    {selectedItem.rating && (
                      <span className="flex items-center gap-1 text-amber-400 font-bold">
                        <Star size={12} fill="currentColor" />
                        {selectedItem.rating}
                      </span>
                    )}
                  </div>

                  {selectedItem.overview && (
                    <p className="text-xs text-slate-400 line-clamp-2 mt-1.5 leading-relaxed">
                      {selectedItem.overview}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              /* Fallback custom manual title if not searching TMDB */
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Atau Masukkan Judul Manual
                </label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="Ketik judul jika tidak menemukan di pencarian TMDB..."
                  className="w-full px-4 py-3 rounded-2xl bg-white/[0.05] border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 focus:bg-white/[0.08] transition-all"
                />
              </div>
            )}

            {/* 4. Genres Badges (Auto-filled from TMDB & Selectable) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Layers size={13} className="text-cyan-400" />
                  <span>Genre Konten</span>
                </label>
                {selectedGenres.length > 0 && (
                  <span className="text-[11px] text-cyan-400 font-semibold">
                    {selectedGenres.length} genre dipilih
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5 p-3 rounded-2xl bg-white/[0.03] border border-white/10 max-h-36 overflow-y-auto">
                {availableGenres.map((genre) => {
                  const isSelected = selectedGenres.includes(genre.name);
                  return (
                    <button
                      key={genre.id}
                      type="button"
                      onClick={() => handleToggleGenre(genre.name)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all select-none ${
                        isSelected
                          ? isTV
                            ? 'bg-pink-500 text-white font-bold shadow-sm shadow-pink-500/30'
                            : 'bg-cyan-500 text-black font-bold shadow-sm shadow-cyan-500/30'
                          : 'bg-white/[0.05] text-slate-300 hover:bg-white/[0.1] hover:text-white border border-white/10'
                      }`}
                    >
                      {genre.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 5. TV Specific: Season Request Options */}
            {isTV && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Musim / Episode yang Diminta
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                  {['All Seasons', 'Season 1', 'Season Terbaru', 'Custom'].map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setSeasonRequest(option)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                        seasonRequest === option
                          ? 'bg-pink-500 text-white shadow-md shadow-pink-500/25'
                          : 'bg-white/[0.05] text-slate-400 hover:text-white border border-white/10'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                {seasonRequest === 'Custom' && (
                  <input
                    type="text"
                    value={customSeason}
                    onChange={(e) => setCustomSeason(e.target.value)}
                    placeholder="Contoh: Season 2 Episode 1-12 atau OVA..."
                    className="w-full px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/10 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/60 transition-all mt-2"
                  />
                )}
              </div>
            )}

            {/* 6. Body Message / Catatan Khusus */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <MessageSquare size={13} className="text-cyan-400" />
                  <span>Pesan / Catatan Tambahan (Opsional)</span>
                </label>
                <span className="text-[11px] text-slate-500">{message.length}/500</span>
              </div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 500))}
                rows={3}
                placeholder="Contoh: Mohon resolusi 1080p dengan subtitle Indonesia yang rapi, atau versi extended cut jika tersedia..."
                className="w-full px-4 py-3 rounded-2xl bg-white/[0.05] border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 focus:bg-white/[0.08] transition-all resize-none"
              />
            </div>

            {/* 7. Requester Contact (Optional) */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <User size={13} className="text-cyan-400" />
                <span>Kontak / Nama Pengirim (Opsional)</span>
              </label>
              <input
                type="text"
                value={userContact}
                onChange={(e) => setUserContact(e.target.value)}
                placeholder="Contoh: @username_telegram atau email kamu..."
                className="w-full px-4 py-3 rounded-2xl bg-white/[0.05] border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 focus:bg-white/[0.08] transition-all"
              />
            </div>

            {/* 8. Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 px-6 rounded-2xl font-bold text-sm sm:text-base text-white shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:opacity-95 active:scale-[0.99]"
                style={{
                  background: isTV
                    ? 'linear-gradient(135deg, #ec4899 0%, #7c3aed 100%)'
                    : 'linear-gradient(135deg, #06b6d4 0%, #7c3aed 100%)',
                  boxShadow: isTV
                    ? '0 10px 25px rgba(236, 72, 153, 0.3)'
                    : '0 10px 25px rgba(6, 182, 212, 0.3)',
                }}
              >
                {submitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Mengirim Permintaan ke Bot...</span>
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    <span>Kirim Permintaan Sekarang</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
