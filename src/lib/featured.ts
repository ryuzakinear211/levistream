import { Movie, TVShow } from '@/types/tmdb';
import { getImageUrl } from '@/lib/tmdb';
import { getAllFeaturedCustomMovies } from '@/lib/markdownMovies';
import { getAllFeaturedCustomTV } from '@/lib/markdownTV';
import { FeaturedItem } from '@/config';
import { getMovieUrl, getTVUrl } from '@/lib/urls';
import { memoryCache } from '@/lib/cache';

export function normalizeTitle(title?: string): string {
  if (!title) return '';
  return title
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export interface GetFeaturedOptions {
  dynamicFallbackMovies?: Movie[];
  dynamicFallbackTV?: TVShow[];
  maxItems?: number;
}

/**
 * Loads Featured Hero MOVIES for Home Page:
 * 1. ONLY uses custom markdown movies that have frontmatter `featured: true`.
 * 2. If no custom featured movies exist, falls back to dynamic TMDB trending movies.
 */
export async function getEnrichedFeaturedMovies(options: {
  dynamicFallbackMovies?: Movie[];
  maxItems?: number;
} = {}): Promise<FeaturedItem[]> {
  const { dynamicFallbackMovies = [], maxItems = 6 } = options;
  const cacheKey = `featured_hero_movies_only_${maxItems}`;

  return memoryCache.getOrFetch<FeaturedItem[]>(
    cacheKey,
    async () => {
      // 1. Fetch custom featured movies
      const customMovies = await getAllFeaturedCustomMovies().catch(() => []);

      if (customMovies.length > 0) {
        return customMovies.slice(0, maxItems);
      }

      // 2. Fallback to TMDB trending movies
      const fallbackList: FeaturedItem[] = [];
      const seenIds = new Set<string | number>();

      for (const m of dynamicFallbackMovies) {
        if (fallbackList.length >= maxItems) break;
        if (!seenIds.has(m.id)) {
          seenIds.add(m.id);

          const backdrop = m.backdrop_path
            ? getImageUrl(m.backdrop_path, 'w1280')
            : m.poster_path
            ? getImageUrl(m.poster_path, 'w780')
            : '/placeholder-poster.svg';

          const poster = m.poster_path
            ? getImageUrl(m.poster_path, 'w500')
            : m.backdrop_path
            ? getImageUrl(m.backdrop_path, 'w780')
            : '/placeholder-poster.svg';

          const releaseDate = m.release_date;
          const year = releaseDate ? new Date(releaseDate).getFullYear() : '2026';

          fallbackList.push({
            id: `dynamic-${m.id}`,
            tmdbId: m.id,
            title: m.title || 'Featured Movie',
            overview: m.overview || '',
            backdropUrl: backdrop,
            posterUrl: poster,
            rating: Math.round((m.vote_average || 8) * 10) / 10,
            year,
            type: 'movie',
            link: getMovieUrl(m),
            badge: 'Featured Movie',
          });
        }
      }

      return fallbackList.slice(0, maxItems);
    },
    60_000,
    15_000
  );
}

/**
 * Loads Featured Hero TV SERIES for TV Page:
 * 1. ONLY uses custom markdown TV shows that have `featured: true` in _index.md.
 * 2. If no custom featured TV shows exist, falls back to dynamic TMDB trending TV shows.
 */
export async function getEnrichedFeaturedTV(options: {
  dynamicFallbackTV?: TVShow[];
  maxItems?: number;
} = {}): Promise<FeaturedItem[]> {
  const { dynamicFallbackTV = [], maxItems = 6 } = options;
  const cacheKey = `featured_hero_tv_only_${maxItems}`;

  return memoryCache.getOrFetch<FeaturedItem[]>(
    cacheKey,
    async () => {
      // 1. Fetch custom featured TV shows
      const customTV = await getAllFeaturedCustomTV().catch(() => []);

      if (customTV.length > 0) {
        return customTV.slice(0, maxItems);
      }

      // 2. Fallback to TMDB trending TV series
      const fallbackList: FeaturedItem[] = [];
      const seenIds = new Set<string | number>();

      for (const t of dynamicFallbackTV) {
        if (fallbackList.length >= maxItems) break;
        if (!seenIds.has(t.id)) {
          seenIds.add(t.id);

          const backdrop = t.backdrop_path
            ? getImageUrl(t.backdrop_path, 'w1280')
            : t.poster_path
            ? getImageUrl(t.poster_path, 'w780')
            : '/placeholder-poster.svg';

          const poster = t.poster_path
            ? getImageUrl(t.poster_path, 'w500')
            : t.backdrop_path
            ? getImageUrl(t.backdrop_path, 'w780')
            : '/placeholder-poster.svg';

          const releaseDate = t.first_air_date;
          const year = releaseDate ? new Date(releaseDate).getFullYear() : '2026';

          fallbackList.push({
            id: `dynamic-${t.id}`,
            tmdbId: t.id,
            title: t.name || 'Featured Series',
            overview: t.overview || '',
            backdropUrl: backdrop,
            posterUrl: poster,
            rating: Math.round((t.vote_average || 8) * 10) / 10,
            year,
            type: 'tv',
            link: getTVUrl(t),
            badge: 'Featured Series',
          });
        }
      }

      return fallbackList.slice(0, maxItems);
    },
    60_000,
    15_000
  );
}

/**
 * Legacy general enriched featured items (interleaved if both passed)
 */
export async function getEnrichedFeaturedItems(options: GetFeaturedOptions = {}): Promise<FeaturedItem[]> {
  return getEnrichedFeaturedMovies({
    dynamicFallbackMovies: options.dynamicFallbackMovies,
    maxItems: options.maxItems,
  });
}
