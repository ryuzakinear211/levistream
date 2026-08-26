import React from 'react';
import type { Metadata } from 'next';
import Hero from '@/components/Hero';
import MovieRow from '@/components/MovieRow';
import GenreFilter from '@/components/GenreFilter';
import {
  getTrendingTV,
  getPopularTV,
  getTopRatedTV,
  getAiringTodayTV,
  getTVGenres,
  getGenres,
} from '@/lib/tmdb';
import { getAllFeaturedCustomTV } from '@/lib/markdownTV';
import siteConfig from '@/config';

export const metadata: Metadata = {
  title: `TV Shows - ${siteConfig.name}`,
  description: `Discover trending and popular TV shows on ${siteConfig.name}.`,
};

export const revalidate = 3600;

export default async function TVPage() {
  const [
    trendingData,
    popularData,
    topRatedData,
    airingData,
    genresData,
    customFeaturedData,
  ] = await Promise.allSettled([
    getTrendingTV('week'),
    getPopularTV(1),
    getTopRatedTV(1),
    getAiringTodayTV(1),
    getTVGenres().catch(() => getGenres()),
    getAllFeaturedCustomTV(),
  ]);

  const trending = trendingData.status === 'fulfilled' ? trendingData.value.results : [];
  const popular = popularData.status === 'fulfilled' ? popularData.value.results : [];
  const topRated = topRatedData.status === 'fulfilled' ? topRatedData.value.results : [];
  const airingToday = airingData.status === 'fulfilled' ? airingData.value.results : [];
  const genreList = genresData.status === 'fulfilled' ? genresData.value : [];
  const customFeaturedShows = customFeaturedData.status === 'fulfilled' ? customFeaturedData.value : [];

  const featuredShow = trending[0] || popular[0];

  return (
    <div className="min-h-screen" style={{ background: '#050816' }}>
      {/* Featured TV Carousel Hero matching desktop fluid layout */}
      {featuredShow && (
        <Hero
          tvShow={featuredShow}
          tvShows={trending}
          genres={genreList}
          customFeaturedItems={customFeaturedShows.length > 0 ? customFeaturedShows : undefined}
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

        {/* Trending TV (no see all) */}
        {trending.length > 0 && (
          <MovieRow
            title={siteConfig.tvSections?.trending || 'Trending This Week'}
            items={trending}
            type="tv"
          />
        )}

        {/* Recently Added Series */}
        {airingToday.length > 0 && (
          <MovieRow
            title={siteConfig.tvSections?.recentlyAdded || 'Recently Added'}
            items={airingToday}
            seeAllHref="/tv/browse?sort=first_air_date.desc"
            type="tv"
          />
        )}

        {/* Popular TV */}
        {popular.length > 0 && (
          <MovieRow
            title={siteConfig.tvSections?.popular || 'Popular TV Shows'}
            items={popular}
            seeAllHref="/tv/browse?sort=popularity.desc"
            type="tv"
          />
        )}

        {/* Top Rated TV */}
        {topRated.length > 0 && (
          <MovieRow
            title={siteConfig.tvSections?.topRated || 'Top Rated Series'}
            items={topRated}
            seeAllHref="/tv/browse?sort=vote_average.desc"
            type="tv"
          />
        )}
      </div>
    </div>
  );
}
