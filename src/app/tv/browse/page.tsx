import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import TVBrowseClient from './TVBrowseClient';
import { getAllCustomTVShowsForList } from '@/lib/markdownTV';
import { getTVGenres, getGenres } from '@/lib/tmdb';
import siteConfig from '@/config';

export const revalidate = 15;

export const metadata: Metadata = {
  title: `Browse TV Series - ${siteConfig.name}`,
  description: `Explore thousands of TV series and episodes on ${siteConfig.name}.`,
};

export default async function TVBrowsePage() {
  const [customShows, genres] = await Promise.all([
    getAllCustomTVShowsForList().catch(() => []),
    getTVGenres().catch(() => getGenres()).catch(() => []),
  ]);

  return (
    <Suspense fallback={<div className="min-h-screen pt-24 px-4" style={{ background: '#050816' }} />}>
      <TVBrowseClient
        initialShows={customShows}
        totalResults={customShows.length}
        totalPages={Math.max(1, Math.ceil(customShows.length / 20))}
        allGenres={genres}
      />
    </Suspense>
  );
}
