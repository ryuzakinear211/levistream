import React from 'react';
import Hero from '@/components/Hero';
import MovieRow from '@/components/MovieRow';
import GenreFilter from '@/components/GenreFilter';
import {
  getTrending,
  getPopularMovies,
  getNowPlayingMovies,
  getTopRatedMovies,
  getTrendingTV,
  getGenres,
} from '@/lib/tmdb';
import { getEnrichedFeaturedMovies } from '@/lib/featured';
import { getAllCustomMoviesForList } from '@/lib/markdownMovies';
import { getAllCustomTVShowsForList } from '@/lib/markdownTV';
import siteConfig from '@/config';

export const revalidate = 15;

export default async function HomePage() {
  const [
    trendingData,
    popularData,
    nowPlayingData,
    topRatedData,
    trendingTVData,
    genres,
    customMoviesData,
    customTVData,
  ] = await Promise.allSettled([
    getTrending('movie', 'week'),
    getPopularMovies(1),
    getNowPlayingMovies(1),
    getTopRatedMovies(1),
    getTrendingTV('week'),
    getGenres(),
    getAllCustomMoviesForList(),
    getAllCustomTVShowsForList(),
  ]);

  const trending = trendingData.status === 'fulfilled' ? trendingData.value.results : [];
  const popular = popularData.status === 'fulfilled' ? popularData.value.results : [];
  const nowPlaying = nowPlayingData.status === 'fulfilled' ? nowPlayingData.value.results : [];
  const topRated = topRatedData.status === 'fulfilled' ? topRatedData.value.results : [];
  const trendingTV = trendingTVData.status === 'fulfilled' ? trendingTVData.value.results : [];
  const genreList = genres.status === 'fulfilled' ? genres.value : [];
  const customMovies = customMoviesData.status === 'fulfilled' ? customMoviesData.value : [];
  const customTV = customTVData.status === 'fulfilled' ? customTVData.value : [];

  // Merge custom CMS content at the beginning so newly added items show up instantly
  const mergedNowPlaying = [
    ...customMovies,
    ...nowPlaying.filter((m: any) => !customMovies.some((cm: any) => cm.id === m.id || cm.customSlug === String(m.id))),
  ];
  const mergedTrendingTV = [
    ...customTV,
    ...trendingTV.filter((t: any) => !customTV.some((ct: any) => ct.id === t.id || ct.customSlug === String(t.id))),
  ];

  // Enriched custom featured movies only for Home Page Hero
  const featuredItems = await getEnrichedFeaturedMovies({
    maxItems: 6,
  });

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

        {/* Trending Movies (no see all) */}
        {trending.length > 0 && (
          <MovieRow
            title={siteConfig.homepageSections?.trending || 'Trending This Week'}
            items={trending}
            type="movie"
          />
        )}

        {/* Recently Added Movies (with Custom Movies prepended) */}
        {mergedNowPlaying.length > 0 && (
          <MovieRow
            title={siteConfig.homepageSections?.recentlyAdded || 'Recently Added'}
            items={mergedNowPlaying}
            seeAllHref="/movie?sort=release_date.desc"
            type="movie"
          />
        )}

        {/* Popular Movies */}
        {popular.length > 0 && (
          <MovieRow
            title={siteConfig.homepageSections?.popularMovies || 'Popular Movies'}
            items={popular}
            seeAllHref="/movie?sort=popularity.desc"
            type="movie"
          />
        )}

        {/* Top Rated */}
        {topRated.length > 0 && (
          <MovieRow
            title={siteConfig.homepageSections?.topRated || 'Top Rated'}
            items={topRated}
            seeAllHref="/movie?sort=vote_average.desc"
            type="movie"
          />
        )}

        {/* Trending TV (no see all) */}
        {mergedTrendingTV.length > 0 && (
          <MovieRow
            title={siteConfig.homepageSections?.trendingTV || 'Trending TV Shows'}
            items={mergedTrendingTV}
            type="tv"
          />
        )}
      </div>
    </div>
  );
}
