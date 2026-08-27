'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { Movie, TVShow, Genre } from '@/types/tmdb';
import { getMoviesByGenre, getTVShowsByGenre, prefetchImages } from '@/lib/tmdb';
import MovieCard, { MovieCardSkeleton } from '@/components/MovieCard';
import GenreFilter from '@/components/GenreFilter';

interface GenrePageClientProps {
  genre: Genre;
  initialItems: (Movie | TVShow)[];
  totalPages: number;
  totalResults: number;
  initialPage: number;
  initialSort: string;
  genreId: number;
  allGenres: Genre[];
  type?: 'movie' | 'tv';
}

const genreClientCache = new Map<string, any>();

const MOVIE_SORT_OPTIONS = [
  { value: 'popularity.desc', label: 'Most Popular' },
  { value: 'vote_average.desc', label: 'Top Rated' },
  { value: 'release_date.desc', label: 'Newest First' },
  { value: 'release_date.asc', label: 'Oldest First' },
  { value: 'revenue.desc', label: 'Highest Revenue' },
];

const TV_SORT_OPTIONS = [
  { value: 'popularity.desc', label: 'Most Popular' },
  { value: 'vote_average.desc', label: 'Top Rated' },
  { value: 'first_air_date.desc', label: 'Newest First' },
  { value: 'first_air_date.asc', label: 'Oldest First' },
];

export default function GenrePageClient({
  genre,
  initialItems,
  totalPages: initialTotalPages,
  totalResults: initialTotalResults,
  initialPage,
  initialSort,
  genreId,
  allGenres,
  type = 'movie',
}: GenrePageClientProps) {
  const router = useRouter();
  const isTV = type === 'tv';
  const sortOptions = isTV ? TV_SORT_OPTIONS : MOVIE_SORT_OPTIONS;

  // Normalize initial sort based on media type
  const normalizedInitialSort = React.useMemo(() => {
    if (isTV && (initialSort === 'release_date.desc' || initialSort === 'revenue.desc')) {
      return 'first_air_date.desc';
    }
    if (!isTV && initialSort === 'first_air_date.desc') {
      return 'release_date.desc';
    }
    return initialSort;
  }, [isTV, initialSort]);

  const [items, setItems] = useState<(Movie | TVShow)[]>(initialItems);
  const [page, setPage] = useState(initialPage);
  const [sort, setSort] = useState(normalizedInitialSort);
  const [totalPages, setTotalPages] = useState(Math.min(initialTotalPages, 500));
  const [totalResults, setTotalResults] = useState(initialTotalResults);
  const [loading, setLoading] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  useEffect(() => {
    if (page === initialPage && sort === normalizedInitialSort && items.length > 0) return;
    
    const cacheKey = `${type}_${genreId}_${page}_${sort}`;
    if (genreClientCache.has(cacheKey)) {
      const cached = genreClientCache.get(cacheKey);
      setItems(cached.results);
      setTotalPages(Math.min(cached.total_pages, 500));
      setTotalResults(cached.total_results);
      setLoading(false);

      // Background prefetch next page
      const nextPage = page + 1;
      if (nextPage <= Math.min(cached.total_pages, 500)) {
        const nextKey = `${type}_${genreId}_${nextPage}_${sort}`;
        if (!genreClientCache.has(nextKey)) {
          const fetcher = isTV
            ? getTVShowsByGenre(genreId, nextPage, sort)
            : getMoviesByGenre(genreId, nextPage, sort);
          fetcher.then((nextData) => {
            genreClientCache.set(nextKey, nextData);
            prefetchImages(nextData.results);
          }).catch(() => {});
        }
      }
      return;
    }

    setLoading(true);
    const fetcher = isTV
      ? getTVShowsByGenre(genreId, page, sort)
      : getMoviesByGenre(genreId, page, sort);

    fetcher
      .then((data) => {
        genreClientCache.set(cacheKey, data);
        setItems(data.results);
        const maxPages = Math.min(data.total_pages, 500);
        setTotalPages(maxPages);
        setTotalResults(data.total_results);
        prefetchImages(data.results);

        // Background prefetch next page for instant click
        const nextPage = page + 1;
        if (nextPage <= maxPages) {
          const nextKey = `${type}_${genreId}_${nextPage}_${sort}`;
          if (!genreClientCache.has(nextKey)) {
            const nextFetcher = isTV
              ? getTVShowsByGenre(genreId, nextPage, sort)
              : getMoviesByGenre(genreId, nextPage, sort);
            nextFetcher.then((nextData) => {
              genreClientCache.set(nextKey, nextData);
              prefetchImages(nextData.results);
            }).catch(() => {});
          }
        }
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [page, sort, genreId, initialPage, normalizedInitialSort, isTV, type, items.length]);

  const handleSortChange = (newSort: string) => {
    setSort(newSort);
    setPage(1);
    setSortOpen(false);
    const query = isTV ? `type=tv&sort=${newSort}&page=1` : `sort=${newSort}&page=1`;
    router.push(`/genre/${genreId}?${query}`, { scroll: false });
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage === page || newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
    const query = isTV ? `type=tv&sort=${sort}&page=${newPage}` : `sort=${sort}&page=${newPage}`;
    router.push(`/genre/${genreId}?${query}`, { scroll: false });
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const sortRef = useRef<HTMLDivElement>(null);

  // Close sort dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
        setSortOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentSortLabel = sortOptions.find((o) => o.value === sort)?.label || 'Sort';

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
        {/* Header with rock-solid responsive layout (Title on Left, Sort on Right on all screen sizes) */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-3xl md:text-4xl font-black truncate sm:whitespace-normal mb-1">
                <span
                  style={{
                    background: isTV
                      ? 'linear-gradient(135deg, #ec4899, #7c3aed)'
                      : 'linear-gradient(135deg, #06b6d4, #7c3aed)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  {genre.name}
                </span>{' '}
                <span style={{ color: '#f1f5f9' }}>{isTV ? 'TV Series' : 'Movies'}</span>
              </h1>
              <p className="text-xs sm:text-sm font-medium" style={{ color: '#94a3b8' }}>
                {totalResults.toLocaleString()} {isTV ? 'series' : 'movies'} found
              </p>
            </div>

            {/* Sort dropdown - pinned to top right */}
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
                <SlidersHorizontal size={14} className={`sm:w-[15px] sm:h-[15px] ${isTV ? 'text-pink-400' : 'text-cyan-400'}`} />
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
                    border: isTV
                      ? '1px solid rgba(236,72,153,0.3)'
                      : '1px solid rgba(6,182,212,0.3)',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
                  }}
                >
                  {sortOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleSortChange(option.value)}
                      className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 text-left text-xs sm:text-sm transition-colors duration-150 hover:bg-white/5"
                      style={{
                        color:
                          sort === option.value
                            ? isTV
                              ? '#ec4899'
                              : '#06b6d4'
                            : '#94a3b8',
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

        {/* Genre filter */}
        {allGenres.length > 0 && (
          <div className="mb-8">
            <GenreFilter
              genres={allGenres}
              activeGenreId={genreId}
              type={isTV ? 'tv' : 'movie'}
              allHref={isTV ? '/tv/browse' : '/movie'}
              hideTitle={true}
            />
          </div>
        )}

        {/* Items grid */}
        {loading ? (
          <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4.5 md:gap-5">
            {Array.from({ length: 18 }).map((_, i) => (
              <MovieCardSkeleton key={i} />
            ))}
          </div>
        ) : items.length > 0 ? (
          <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4.5 md:gap-5">
            {items.map((item, i) => (
              <MovieCard key={item.id} item={item} type={isTV ? 'tv' : 'movie'} priority={i < 6} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <p className="text-neo-text-secondary text-lg">
              {isTV
                ? 'No TV shows found for this genre.'
                : 'No movies found for this genre.'}
            </p>
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
                          background: isTV
                            ? 'linear-gradient(135deg, #ec4899, #7c3aed)'
                            : 'linear-gradient(135deg, #06b6d4, #7c3aed)',
                          color: 'white',
                          boxShadow: isTV
                            ? '0 0 15px rgba(236,72,153,0.4)'
                            : '0 0 15px rgba(6,182,212,0.3)',
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
