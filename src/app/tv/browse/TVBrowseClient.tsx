'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { SlidersHorizontal, ChevronLeft, ChevronRight, Tv, Globe, MessageSquarePlus } from 'lucide-react';
import { TVShow, Genre } from '@/types/tmdb';
import { discoverTVShows, getTVGenres, getGenres, prefetchImages } from '@/lib/tmdb';
import MovieCard, { MovieCardSkeleton } from '@/components/MovieCard';
import GenreFilter from '@/components/GenreFilter';

interface TVBrowseClientProps {
  initialShows?: TVShow[];
  totalPages?: number;
  totalResults?: number;
  initialPage?: number;
  initialSort?: string;
  initialGenreId?: number;
  allGenres?: Genre[];
}

const tvClientCache = new Map<string, any>();

const SORT_OPTIONS = [
  { value: 'popularity.desc', label: 'Most Popular' },
  { value: 'vote_average.desc', label: 'Top Rated' },
  { value: 'first_air_date.desc', label: 'Newest First' },
  { value: 'first_air_date.asc', label: 'Oldest First' },
];

function sortLocalTVShows(items: TVShow[], sortOption: string): TVShow[] {
  const copy = [...items];
  if (sortOption === 'vote_average.desc') {
    return copy.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
  }
  if (sortOption === 'first_air_date.desc') {
    return copy.sort((a, b) => new Date(b.first_air_date || 0).getTime() - new Date(a.first_air_date || 0).getTime());
  }
  if (sortOption === 'first_air_date.asc') {
    return copy.sort((a, b) => new Date(a.first_air_date || 0).getTime() - new Date(b.first_air_date || 0).getTime());
  }
  if (sortOption === 'popularity.desc') {
    return copy.sort((a, b) => (b.popularity || 100) - (a.popularity || 100));
  }
  return copy;
}

function filterByLanguage(items: TVShow[], lang: 'all' | 'en' | 'id'): TVShow[] {
  if (lang === 'en') return items.filter((s: any) => (s.language || 'ID').toUpperCase() === 'EN');
  if (lang === 'id') return items.filter((s: any) => (s.language || 'ID').toUpperCase() === 'ID');
  return items;
}

export default function TVBrowseClient({
  initialShows = [],
  totalPages: initialTotalPages = 1,
  totalResults: initialTotalResults = 0,
  initialPage = 1,
  initialSort = 'popularity.desc',
  initialGenreId,
  allGenres: propGenres = [],
}: TVBrowseClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [genres, setGenres] = useState<Genre[]>(propGenres);
  const [languageFilter, setLanguageFilter] = useState<'all' | 'en' | 'id'>('all');
  const [page, setPage] = useState(initialPage);
  const [sort, setSort] = useState(initialSort);
  const [genreId, setGenreId] = useState<number | undefined>(initialGenreId);
  const [shows, setShows] = useState<TVShow[]>(() => {
    if (initialShows.length === 0) return [];
    const filtered = filterByLanguage(initialShows, 'all');
    return sortLocalTVShows(filtered, initialSort);
  });
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  const sortRef = useRef<HTMLDivElement>(null);

  // Fetch genres if not provided
  useEffect(() => {
    if (genres.length === 0) {
      getTVGenres()
        .catch(() => getGenres())
        .then((g) => setGenres(g))
        .catch(() => {});
    }
  }, [genres.length]);

  // Close sort dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
        setSortOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync state when searchParams change (e.g. browser back/forward)
  useEffect(() => {
    const p = Number(searchParams.get('page')) || 1;
    const s = searchParams.get('sort') || 'popularity.desc';
    const g = searchParams.get('genre') ? Number(searchParams.get('genre')) : undefined;
    const l = (searchParams.get('lang') as 'all' | 'en' | 'id') || 'all';

    setPage(p);
    setSort(s);
    setGenreId(g);
    if (l === 'en' || l === 'id' || l === 'all') {
      setLanguageFilter(l);
    }
  }, [searchParams]);

  // Fetch or filter TV shows when filter/sort/page/language change
  useEffect(() => {
    // 1. If local TV shows exist:
    if (initialShows.length > 0) {
      let filtered = filterByLanguage(initialShows, languageFilter);
      if (genreId) {
        filtered = filtered.filter((s) => s.genre_ids && s.genre_ids.includes(genreId));
      }
      const sorted = sortLocalTVShows(filtered, sort);
      const start = (page - 1) * 20;
      setShows(sorted.slice(start, start + 20));
      setTotalPages(Math.max(1, Math.ceil(sorted.length / 20)));
      setTotalResults(sorted.length);
      setLoading(false);
      return;
    }

    const cacheKey = `${page}_${sort}_${genreId || 'all'}`;
    if (tvClientCache.has(cacheKey)) {
      const cached = tvClientCache.get(cacheKey);
      setShows(cached.results);
      setTotalPages(Math.min(cached.total_pages, 500));
      setTotalResults(cached.total_results);
      setLoading(false);
      return;
    }

    setLoading(true);
    discoverTVShows(page, sort, genreId)
      .then((data) => {
        tvClientCache.set(cacheKey, data);
        setShows(data.results);
        const maxPages = Math.min(data.total_pages, 500);
        setTotalPages(maxPages);
        setTotalResults(data.total_results);
        prefetchImages(data.results);
      })
      .catch(() => setShows([]))
      .finally(() => setLoading(false));
  }, [page, sort, genreId, languageFilter, initialShows]);

  const updateUrl = (newPage: number, newSort: string, newGenreId?: number, newLang: string = languageFilter) => {
    const params = new URLSearchParams();
    if (newSort && newSort !== 'popularity.desc') params.set('sort', newSort);
    if (newPage > 1) params.set('page', String(newPage));
    if (newGenreId) params.set('genre', String(newGenreId));
    if (newLang && newLang !== 'all') params.set('lang', newLang);

    const qs = params.toString();
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', qs ? `/tv/browse?${qs}` : '/tv/browse');
    }
  };

  const handleLanguageChange = (newLang: 'all' | 'en' | 'id') => {
    setLanguageFilter(newLang);
    setPage(1);
    updateUrl(1, sort, genreId, newLang);
  };

  const handleSortChange = (newSort: string) => {
    setSort(newSort);
    setPage(1);
    setSortOpen(false);
    updateUrl(1, newSort, genreId, languageFilter);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleGenreSelect = (gId: number) => {
    setGenreId(gId);
    setPage(1);
    updateUrl(1, sort, gId, languageFilter);
  };

  const handleAllSelect = () => {
    setGenreId(undefined);
    setPage(1);
    updateUrl(1, sort, undefined, languageFilter);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage === page || newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
    updateUrl(newPage, sort, genreId, languageFilter);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const currentSortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label || 'Sort';
  const selectedGenreName = genres.find((g) => g.id === genreId)?.name;

  // Helper to build page numbers array with ellipsis
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (page <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }
    if (page >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', page - 1, page, page + 1, '...', totalPages];
  };

  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-4 sm:pb-6" style={{ background: '#050816' }}>
      <div className="w-full px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-14">
        
        {/* ── Page Header: Title on Left, Language & Sort Controls on Right ── */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-3xl md:text-4xl font-black truncate sm:whitespace-normal mb-1">
                <span
                  style={{
                    background: 'linear-gradient(135deg, #ec4899 0%, #a78bfa 50%, #06b6d4 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  Browse TV Series
                </span>
              </h1>
              <p className="text-xs sm:text-sm font-medium" style={{ color: '#94a3b8' }}>
                Jelajahi <span className="text-pink-400 font-bold">{totalResults > 0 ? totalResults.toLocaleString() : '0'}</span> series untuk ditonton
              </p>
            </div>

            {/* Right: Language Filter & Sort Controls */}
            <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
              {/* Language Filter Pills: All (default, left), EN, ID */}
              <div className="flex items-center p-1 rounded-xl bg-white/[0.06] border border-white/10 text-xs font-bold shadow-sm">
                <div className="flex items-center gap-1 px-2 text-slate-400 hidden xs:flex">
                  <Globe size={13} />
                  <span className="text-[11px] uppercase tracking-wider font-semibold">Bahasa:</span>
                </div>
                <button
                  onClick={() => handleLanguageChange('all')}
                  className={`px-3 py-1.5 rounded-lg transition-all text-xs font-bold ${
                    languageFilter === 'all'
                      ? 'bg-pink-500 text-white shadow-md shadow-pink-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Semua Bahasa"
                >
                  All
                </button>
                <button
                  onClick={() => handleLanguageChange('en')}
                  className={`px-3 py-1.5 rounded-lg transition-all text-xs font-bold ${
                    languageFilter === 'en'
                      ? 'bg-pink-500 text-white shadow-md shadow-pink-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Bahasa Inggris (English)"
                >
                  EN
                </button>
                <button
                  onClick={() => handleLanguageChange('id')}
                  className={`px-3 py-1.5 rounded-lg transition-all text-xs font-bold ${
                    languageFilter === 'id'
                      ? 'bg-pink-500 text-white shadow-md shadow-pink-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Bahasa Indonesia"
                >
                  ID
                </button>
              </div>

              {/* Sort Dropdown */}
              <div className="relative flex-shrink-0" ref={sortRef}>
                <button
                  onClick={() => setSortOpen(!sortOpen)}
                  className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#94a3b8',
                  }}
                >
                  <SlidersHorizontal size={14} className="sm:w-[15px] sm:h-[15px] text-pink-400" />
                  <span className="whitespace-nowrap">{currentSortLabel}</span>
                  <ChevronRight
                    size={13}
                    className="transition-transform duration-200"
                    style={{ transform: sortOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
                  />
                </button>

                {sortOpen && (
                  <div
                    className="absolute right-0 top-full mt-2 w-44 sm:w-48 rounded-xl overflow-hidden z-30"
                    style={{
                      background: '#0B1020',
                      border: '1px solid rgba(236,72,153,0.3)',
                      boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
                    }}
                  >
                    {SORT_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handleSortChange(option.value)}
                        className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 text-left text-xs sm:text-sm transition-colors duration-150 hover:bg-white/5"
                        style={{
                          color: sort === option.value ? '#ec4899' : '#94a3b8',
                          fontWeight: sort === option.value ? 600 : 400,
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Browse by Genre Filter ── */}
        {genres.length > 0 && (
          <div className="mb-8">
            <GenreFilter
              genres={genres}
              activeGenreId={genreId}
              type="tv"
              allHref="/tv/browse"
              hideTitle={true}
              onGenreSelect={handleGenreSelect}
              onAllSelect={handleAllSelect}
            />
          </div>
        )}

        {/* ── TV Shows Grid ── */}
        {loading ? (
          <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4.5 md:gap-5">
            {Array.from({ length: 18 }).map((_, i) => (
              <MovieCardSkeleton key={i} />
            ))}
          </div>
        ) : shows.length > 0 ? (
          <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4.5 md:gap-5">
            {shows.map((show, i) => (
              <MovieCard key={show.id} item={show} type="tv" priority={i < 6} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-[#090e1f] rounded-2xl border border-white/5 max-w-2xl mx-auto my-8">
            <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-pink-400 mb-4 shadow-lg shadow-pink-500/10">
              <Tv size={28} />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white mb-2">
              Belum Ada Series {selectedGenreName ? `Genre ${selectedGenreName}` : ''}
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 mb-6 max-w-md">
              {selectedGenreName
                ? `Serial TV dengan genre "${selectedGenreName}" belum tersedia di katalog kami. Anda dapat me-request serial TV favorit Anda untuk ditambahkan segera.`
                : `Tidak ada serial TV yang sesuai dengan filter yang dipilih.`}
            </p>
            <div className="flex items-center gap-3 flex-wrap justify-center">
              {genreId && (
                <button
                  onClick={handleAllSelect}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 bg-gradient-to-r from-pink-500 to-purple-600 hover:opacity-90 text-white shadow-pink-500/20"
                >
                  <span>Lihat Semua Series</span>
                </button>
              )}
              {languageFilter !== 'all' && (
                <button
                  onClick={() => handleLanguageChange('all')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all bg-white/10 hover:bg-white/20 text-white border border-white/10"
                >
                  <Globe size={14} />
                  <span>Semua Bahasa</span>
                </button>
              )}
              <Link
                href="/request"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all bg-white/5 hover:bg-white/10 text-pink-300 border border-pink-500/30 hover:border-pink-500/50"
              >
                <MessageSquarePlus size={14} />
                <span>Request Series Ini</span>
              </Link>
            </div>
          </div>
        )}

        {/* ── Pagination with Large Page Window and Go-To-Top ── */}
        {totalPages > 1 && !loading && (
          <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 mt-8 sm:mt-10 mb-2">
            {/* Prev button */}
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1}
              aria-label="Previous page"
              className="p-2 sm:px-3 sm:py-2 rounded-xl transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#94a3b8',
              }}
            >
              <ChevronLeft size={18} />
            </button>

            {/* Dynamic Page numbers with ellipsis */}
            {getPageNumbers().map((item, idx) => {
              if (item === '...') {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    className="w-8 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-xs sm:text-sm font-bold text-slate-500 select-none"
                  >
                    ...
                  </span>
                );
              }

              const pageNum = item as number;
              const isCurrent = page === pageNum;

              return (
                <button
                  key={pageNum}
                  onClick={() => handlePageChange(pageNum)}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 hover:scale-105"
                  style={
                    isCurrent
                      ? {
                          background: 'linear-gradient(135deg, #ec4899, #7c3aed)',
                          color: 'white',
                          boxShadow: '0 0 15px rgba(236,72,153,0.4)',
                        }
                      : {
                          background: 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          color: '#94a3b8',
                        }
                  }
                >
                  {pageNum}
                </button>
              );
            })}

            {/* Next button */}
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page === totalPages}
              aria-label="Next page"
              className="p-2 sm:px-3 sm:py-2 rounded-xl transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#94a3b8',
              }}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
