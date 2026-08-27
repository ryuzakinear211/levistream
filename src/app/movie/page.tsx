import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import MoviePageClient from './MoviePageClient';
import siteConfig from '@/config';

export const metadata: Metadata = {
  title: `Browse Movies - ${siteConfig.name}`,
  description: `Discover and browse movies on ${siteConfig.name}. Search and filter by genre and popularity.`,
};

export default function MoviePage() {
  return (
    <Suspense fallback={<div className="min-h-screen pt-24 px-4" style={{ background: '#050816' }} />}>
      <MoviePageClient />
    </Suspense>
  );
}
