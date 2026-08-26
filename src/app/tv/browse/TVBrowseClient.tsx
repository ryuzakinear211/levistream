'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SlidersHorizontal, ChevronLeft, ChevronRight, Tv } from 'lucide-react';
import { TVShow, Genre } from '@/types/tmdb';
import { discoverTVShows, getTVGenres, getGenres } from '@/lib/tmdb';
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
  const [totalPages, setTotalPages] = useState(initialTotalPages);
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
      setTotalPages(Math.min(cached.total_pages, 20));
      setTotalResults(cached.total_results);
      setLoading(false);
      return;
    }

    setLoading(true);
    discoverTVShows(page, sort, genreId)
      .then((data) => {
        tvClientCache.set(cacheKey, data);
        setShows(data.results);
        setTotalPages(Math.min(data.total_pages, 20));
        setTotalResults(data.total_results);
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
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    updateUrl(newPage, sort, genreId);
  };

  const currentSortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label || 'Sort';

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
            {shows.map((show) => (
              <MovieCard key={show.id} item={show} type="tv" />
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

        {/* ── Pagination ── */}
        {totalPages > 1 && !loading && (
          <div className="flex items-center justify-center gap-2 mt-8 sm:mt-10 mb-2">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1}
              className="p-2 rounded-xl transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#94a3b8',
              }}
            >
              <ChevronLeft size={20} />
            </button>

            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 7) {
                pageNum = i + 1;
              } else if (page <= 4) {
                pageNum = i + 1;
              } else if (page >= totalPages - 3) {
                pageNum = totalPages - 6 + i;
              } else {
                pageNum = page - 3 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => handlePageChange(pageNum)}
                  className="w-10 h-10 rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-105"
                  style={
                    page === pageNum
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

            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page === totalPages}
              className="p-2 rounded-xl transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#94a3b8',
              }}
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
