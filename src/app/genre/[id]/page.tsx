import React from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  getMoviesByGenre,
  getTVShowsByGenre,
  getGenres,
  getTVGenres,
  getGenreById,
  getTVGenreById,
} from '@/lib/tmdb';
import GenrePageClient from './GenrePageClient';
import siteConfig from '@/config';

interface PageProps {
  params: { id: string };
  searchParams: { page?: string; sort?: string; type?: string };
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const isTV = searchParams.type === 'tv';
  const genreId = Number(params.id);
  const genre = isTV
    ? await getTVGenreById(genreId).catch(() => null)
    : await getGenreById(genreId).catch(() => null);

  const mediaLabel = isTV ? 'TV Shows' : 'Movies';

  return {
    title: genre ? `${genre.name} ${mediaLabel} - ${siteConfig.name}` : `Genre - ${siteConfig.name}`,
    description: genre
      ? `Browse ${genre.name} ${mediaLabel.toLowerCase()} on ${siteConfig.name}.`
      : `Browse ${mediaLabel.toLowerCase()} by genre.`,
  };
}

export const revalidate = 60;

export default async function GenrePage({ params, searchParams }: PageProps) {
  const genreId = Number(params.id);
  if (isNaN(genreId)) notFound();

  const isTV = searchParams.type === 'tv';
  const page = Number(searchParams.page) || 1;
  const sort = searchParams.sort || 'popularity.desc';

  const [genreData, itemsData, allGenres] = await Promise.allSettled([
    isTV ? getTVGenreById(genreId) : getGenreById(genreId),
    isTV ? getTVShowsByGenre(genreId, page, sort) : getMoviesByGenre(genreId, page, sort),
    isTV ? getTVGenres().catch(() => getGenres()) : getGenres(),
  ]);

  const genre =
    genreData.status === 'fulfilled' && genreData.value
      ? genreData.value
      : isTV
      ? await getGenreById(genreId).catch(() => null)
      : null;

  const items =
    itemsData.status === 'fulfilled'
      ? itemsData.value
      : { results: [], total_pages: 0, total_results: 0, page: 1 };
  const genres = allGenres.status === 'fulfilled' ? allGenres.value : [];

  if (!genre) notFound();

  return (
    <GenrePageClient
      genre={genre}
      initialItems={items.results as any}
      totalPages={Math.min(items.total_pages, 20)}
      totalResults={items.total_results}
      initialPage={page}
      initialSort={sort}
      genreId={genreId}
      allGenres={genres}
      type={isTV ? 'tv' : 'movie'}
    />
  );
}
