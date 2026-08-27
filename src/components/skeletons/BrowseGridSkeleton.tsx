import React from 'react';
import { MovieCardSkeleton } from '@/components/MovieCard';
import GenreFilterSkeleton from './GenreFilterSkeleton';

interface BrowseGridSkeletonProps {
  title?: string;
}

export default function BrowseGridSkeleton({ title = 'Browse Content' }: BrowseGridSkeletonProps) {
  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-16 px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-14 select-none" style={{ background: '#050816' }}>
      {/* Title & Filter Controls Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-7 rounded-full bg-gradient-to-b from-cyan-400 to-pink-500 opacity-70" />
          <div className="h-7 sm:h-8 w-48 sm:w-60 rounded-xl skeleton" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-36 sm:w-44 rounded-xl skeleton" />
        </div>
      </div>

      {/* Genre Filter Skeleton */}
      <div className="mb-8">
        <GenreFilterSkeleton />
      </div>

      {/* Grid Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 lg:gap-5">
        {Array.from({ length: 18 }).map((_, idx) => (
          <MovieCardSkeleton key={idx} />
        ))}
      </div>
    </div>
  );
}
