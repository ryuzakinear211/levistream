import React from 'react';
import type { Metadata } from 'next';
import { discoverTVShows, getTVGenres, getTVGenreById } from '@/lib/tmdb';
import TVBrowseClient from './TVBrowseClient';
import siteConfig from '@/config';

interface TVBrowsePageProps {
  searchParams: { page?: string; sort?: string; genre?: string };
}

export async function generateMetadata({ searchParams }: TVBrowsePageProps): Promise<Metadata> {
  const genreId = searchParams.genre ? Number(searchParams.genre) : undefined;
  const genre = genreId ? await getTVGenreById(genreId).catch(() => null) : null;

  return {
    title: genre ? `${genre.name} TV Series - ${siteConfig.name}` : `Browse TV Series - ${siteConfig.name}`,
    description: genre
      ? `Browse ${genre.name} TV series on ${siteConfig.name}. Stream online in HD quality.`
      : `Explore thousands of TV series and episodes on ${siteConfig.name}.`,
  };
}

export const revalidate = 60;

export default async function TVBrowsePage({ searchParams }: TVBrowsePageProps) {
  const page = Number(searchParams.page) || 1;
  const sort = searchParams.sort || 'popularity.desc';
  const genreId = searchParams.genre ? Number(searchParams.genre) : undefined;

  const [showsData, genresData] = await Promise.allSettled([
    discoverTVShows(page, sort, genreId),
    getTVGenres(),
  ]);

  const shows =
    showsData.status === 'fulfilled'
      ? showsData.value
      : { results: [], total_pages: 0, total_results: 0, page: 1 };
  const allGenres = genresData.status === 'fulfilled' ? genresData.value : [];

  return (
    <TVBrowseClient
      initialShows={shows.results}
      totalPages={Math.min(shows.total_pages, 20)}
      totalResults={shows.total_results}
      initialPage={page}
      initialSort={sort}
      initialGenreId={genreId}
      allGenres={allGenres}
    />
  );
}
