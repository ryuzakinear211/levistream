import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import MoviePageClient from './MoviePageClient';
import BrowseGridSkeleton from '@/components/skeletons/BrowseGridSkeleton';
import siteConfig from '@/config';

export const metadata: Metadata = {
  title: `Browse Movies - ${siteConfig.name}`,
  description: `Discover and browse movies on ${siteConfig.name}. Search and filter by genre and popularity.`,
};

export default function MoviePage() {
  return (
    <Suspense fallback={<BrowseGridSkeleton title="Browse Movies" />}>
      <MoviePageClient />
    </Suspense>
  );
}
