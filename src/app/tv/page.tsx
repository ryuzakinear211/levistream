import React from 'react';
import type { Metadata } from 'next';
import Hero from '@/components/Hero';
import MovieRow from '@/components/MovieRow';
import GenreFilter from '@/components/GenreFilter';
import { getTVGenres, getGenres } from '@/lib/tmdb';
import { getEnrichedFeaturedTV } from '@/lib/featured';
import { getResolvedSections } from '@/lib/sections';
import siteConfig from '@/config';

export const metadata: Metadata = {
  title: `TV Shows - ${siteConfig.name}`,
  description: `Discover trending and popular TV shows on ${siteConfig.name}.`,
};

export const revalidate = 60;

export default async function TVPage() {
  const [genresData, customFeaturedShows, sections] = await Promise.all([
    getTVGenres().catch(() => getGenres()).catch(() => []),
    getEnrichedFeaturedTV({ maxItems: siteConfig.featuredLimit || 7 }),
    getResolvedSections('tv'),
  ]);

  const genreList = genresData || [];

  return (
    <div className="min-h-screen" style={{ background: '#050816' }}>
      {/* Featured TV Carousel Hero matching desktop fluid layout */}
      {customFeaturedShows.length > 0 && (
        <Hero
          genres={genreList}
          customFeaturedItems={customFeaturedShows}
          type="tv"
          badgeText="Featured Series"
        />
      )}

      {/* Content sections */}
      <div className="relative z-10 space-y-10 pb-6 sm:pb-8 pt-2 sm:pt-4">
        {/* Browse TV Series by Genre Filter */}
        {genreList.length > 0 && (
          <section className="w-full px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-14">
            <GenreFilter
              genres={genreList}
              title={siteConfig.tvSections?.browseGenres || 'Browse Series by Genre'}
              type="tv"
              allHref="/tv"
            />
          </section>
        )}

        {/* Dynamic TV Sections ordered by weight */}
        {sections.map((section) => (
          <MovieRow
            key={section.id}
            title={section.title}
            items={section.items}
            type="tv"
            seeAllHref={section.seeAllHref}
          />
        ))}
      </div>
    </div>
  );
}

