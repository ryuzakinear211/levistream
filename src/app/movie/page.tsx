import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import MoviePageClient from './MoviePageClient';
import { getAllCustomMoviesForList } from '@/lib/markdownMovies';
import { getGenres } from '@/lib/tmdb';
import siteConfig from '@/config';

export const revalidate = 15;

export const metadata: Metadata = {
  title: `Browse Movies - ${siteConfig.name}`,
  description: `Discover and browse movies on ${siteConfig.name}. Search and filter by genre and popularity.`,
};

export default async function MoviePage() {
  const [customMovies, genres] = await Promise.all([
    getAllCustomMoviesForList().catch(() => []),
    getGenres().catch(() => []),
  ]);

  return (
    <Suspense fallback={<div className="min-h-screen pt-24 px-4" style={{ background: '#050816' }} />}>
      <MoviePageClient
        initialMovies={customMovies}
        totalResults={customMovies.length}
        totalPages={Math.max(1, Math.ceil(customMovies.length / 20))}
        allGenres={genres}
      />
    </Suspense>
  );
}
