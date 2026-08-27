'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SlidersHorizontal, ChevronLeft, ChevronRight, Tv } from 'lucide-react';
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
  const [shows, setShows] = useState<TVShow[]>(initialShows);
  const [page, setPage] = useState(initialPage);
  const [sort, setSort] = useState(initialSort);
  const [genreId, setGenreId] = useState<number | undefined>(initialGenreId);
  const [totalPages, setTotalPages] = useState(Math.min(initialTotalPages, 500));
  const [totalResults, setTotalResults] = useState(initialTotalResults);
  const [loading, setLoading] = useState(initialShows.length === 0);
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

    setPage(p);
    setSort(s);
    setGenreId(g);
  }, [searchParams]);

  // Fetch TV shows when filter/sort/page change
  useEffect(() => {
    const cacheKey = `${page}_${sort}_${genreId || 'all'}`;
    if (tvClientCache.has(cacheKey)) {
      const cached = tvClientCache.get(cacheKey);
      setShows(cached.results);
      setTotalPages(Math.min(cached.total_pages, 500));
      setTotalResults(cached.total_results);
      setLoading(false);

      // Background prefetch next page
      const nextPage = page + 1;
      if (nextPage <= Math.min(cached.total_pages, 500)) {
        const nextKey = `${nextPage}_${sort}_${genreId || 'all'}`;
        if (!tvClientCache.has(nextKey)) {
          discoverTVShows(nextPage, sort, genreId)
            .then((nextData) => {
              tvClientCache.set(nextKey, nextData);
              prefetchImages(nextData.results);
            })
            .catch(() => {});
        }
      }
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

        // Background prefetch next page for instant next-page clicks
        const nextPage = page + 1;
        if (nextPage <= maxPages) {
          const nextKey = `${nextPage}_${sort}_${genreId || 'all'}`;
          if (!tvClientCache.has(nextKey)) {
            discoverTVShows(nextPage, sort, genreId)
              .then((nextData) => {
                tvClientCache.set(nextKey, nextData);
                prefetchImages(nextData.results);
              })
              .catch(() => {});
          }
        }
      })
      .catch(() => setShows([]))
      .finally(() => setLoading(false));
  }, [page, sort, genreId]);

  const updateUrl = (newPage: number, newSort: string, newGenreId?: number) => {
    const params = new URLSearchParams();
    if (newSort && newSort !== 'popularity.desc') params.set('sort', newSort);
    if (newPage > 1) params.set('page', String(newPage));
    if (newGenreId) params.set('genre', String(newGenreId));

    const qs = params.toString();
    router.push(qs ? `/tv/browse?${qs}` : '/tv/browse', { scroll: false });
  };

  const handleSortChange = (newSort: string) => {
    setSort(newSort);
    setPage(1);
    setSortOpen(false);
    updateUrl(1, newSort, genreId);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage === page || newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
    updateUrl(newPage, sort, genreId);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const currentSortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label || 'Sort';

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
        
        {/* ── Page Header: Title on Left, Sort Dropdown on Right ── */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center justify-between gap-3">
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
                Jelajahi <span className="text-pink-400 font-bold">{totalResults > 0 ? totalResults.toLocaleString() : '129'}</span> series untuk ditonton
              </p>
            </div>

            {/* Sort Dropdown - pinned to top right */}
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

        {/* ── Browse by Genre Filter ── */}
        {genres.length > 0 && (
          <div className="mb-8">
            <GenreFilter
              genres={genres}
              activeGenreId={genreId}
              type="tv"
              allHref="/tv/browse"
              hideTitle={true}
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
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="p-6 rounded-full" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <Tv size={48} style={{ color: '#475569' }} />
            </div>
            <p className="text-neo-text-secondary text-lg">No TV series found.</p>
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
