'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { Movie, TVShow, Genre } from '@/types/tmdb';
import { getMoviesByGenre, getTVShowsByGenre } from '@/lib/tmdb';
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

const SORT_OPTIONS = [
  { value: 'popularity.desc', label: 'Most Popular' },
  { value: 'vote_average.desc', label: 'Top Rated' },
  { value: 'release_date.desc', label: 'Newest First' },
  { value: 'release_date.asc', label: 'Oldest First' },
  { value: 'revenue.desc', label: 'Highest Revenue' },
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
  const [items, setItems] = useState<(Movie | TVShow)[]>(initialItems);
  const [page, setPage] = useState(initialPage);
  const [sort, setSort] = useState(initialSort);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [totalResults, setTotalResults] = useState(initialTotalResults);
  const [loading, setLoading] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  useEffect(() => {
    if (page === initialPage && sort === initialSort) return;
    setLoading(true);
    const fetcher = isTV
      ? getTVShowsByGenre(genreId, page, sort)
      : getMoviesByGenre(genreId, page, sort);

    fetcher
      .then((data) => {
        setItems(data.results);
        setTotalPages(Math.min(data.total_pages, 20));
        setTotalResults(data.total_results);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [page, sort, genreId, initialPage, initialSort, isTV]);

  const handleSortChange = (newSort: string) => {
    setSort(newSort);
    setPage(1);
    setSortOpen(false);
    const query = isTV ? `type=tv&sort=${newSort}&page=1` : `sort=${newSort}&page=1`;
    router.push(`/genre/${genreId}?${query}`, { scroll: false });
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    const query = isTV ? `type=tv&sort=${sort}&page=${newPage}` : `sort=${sort}&page=${newPage}`;
    router.push(`/genre/${genreId}?${query}`, { scroll: false });
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

  const currentSortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label || 'Sort';

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
                <SlidersHorizontal size={14} className="sm:w-[15px] sm:h-[15px]" />
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
                  {SORT_OPTIONS.map((option) => (
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

        {/* Pagination */}
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
