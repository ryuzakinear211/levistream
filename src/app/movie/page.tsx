import React from 'react';
import type { Metadata } from 'next';
import { discoverMovies, searchMovies, getGenres, getGenreById } from '@/lib/tmdb';
import MoviePageClient from './MoviePageClient';
import siteConfig from '@/config';

interface MoviePageProps {
  searchParams: { page?: string; sort?: string; genre?: string; q?: string };
}

export async function generateMetadata({ searchParams }: MoviePageProps): Promise<Metadata> {
  const genreId = searchParams.genre ? Number(searchParams.genre) : undefined;
  const genre = genreId ? await getGenreById(genreId).catch(() => null) : null;
  const query = searchParams.q?.trim();

  let title = `Browse Movies - ${siteConfig.name}`;
  if (query) {
    title = `Search "${query}" - Movies - ${siteConfig.name}`;
  } else if (genre) {
    title = `${genre.name} Movies - ${siteConfig.name}`;
  }

  return {
    title,
    description: `Discover and browse movies on ${siteConfig.name}. Search and filter by genre and popularity.`,
  };
}

export const revalidate = 60;

export default async function MoviePage({ searchParams }: MoviePageProps) {
  const page = Number(searchParams.page) || 1;
  const sort = searchParams.sort || 'popularity.desc';
  const genreId = searchParams.genre ? Number(searchParams.genre) : undefined;
  const query = searchParams.q?.trim() || '';

  const [moviesData, genresData] = await Promise.allSettled([
    query ? searchMovies(query, page) : discoverMovies(page, sort, genreId),
    getGenres(),
  ]);

  const movies =
    moviesData.status === 'fulfilled'
      ? moviesData.value
      : { results: [], total_pages: 0, total_results: 0, page: 1 };
  const allGenres = genresData.status === 'fulfilled' ? genresData.value : [];

  return (
    <MoviePageClient
      initialMovies={movies.results}
      totalPages={Math.min(movies.total_pages, 20)}
      totalResults={movies.total_results}
      initialPage={page}
      initialSort={sort}
      initialGenreId={genreId}
      allGenres={allGenres}
    />
  );
}
