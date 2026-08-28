import React from 'react';
import Hero from '@/components/Hero';
import MovieRow from '@/components/MovieRow';
import GenreFilter from '@/components/GenreFilter';
import { getGenres } from '@/lib/tmdb';
import { getEnrichedFeaturedMovies } from '@/lib/featured';
import { getResolvedSections } from '@/lib/sections';
import siteConfig from '@/config';

export const revalidate = 15;

export default async function HomePage() {
  const [genresData, featuredItems, sections] = await Promise.all([
    getGenres().catch(() => []),
    getEnrichedFeaturedMovies({ maxItems: siteConfig.featuredLimit || 7 }),
    getResolvedSections('home'),
  ]);

  const genreList = genresData || [];

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-clip overflow-x-hidden" style={{ background: '#050816' }}>
      {/* Hero with Enriched Custom Featured Items Carousel */}
      {featuredItems.length > 0 && (
        <Hero
          genres={genreList}
          customFeaturedItems={featuredItems}
        />
      )}

      {/* Content sections */}
      <div className="relative z-10 space-y-10 pb-6 sm:pb-8 pt-2 sm:pt-4">
        {/* Genre Filter */}
        {genreList.length > 0 && (
          <section className="w-full px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-14">
            <GenreFilter
              genres={genreList}
              title={siteConfig.homepageSections?.browseGenres || 'Browse by Genre'}
            />
          </section>
        )}

        {/* Dynamic Custom & Fallback Sections ordered by weight */}
        {sections.map((section) => (
          <MovieRow
            key={section.id}
            title={section.title}
            items={section.items}
            type={section.type}
            seeAllHref={section.seeAllHref}
          />
        ))}
      </div>
    </div>
  );
}

