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
 * Loads Featured Hero items following strict consistency rules:
 * 1. ONLY use custom content (movies and TV shows) that have frontmatter `featured: true`.
 * 2. If custom featured content exists, return ONLY custom featured content (NO TMDB items mixed).
 * 3. If and only if NO custom content has `featured: true` (empty), fallback to dynamic TMDB items.
 */
export async function getEnrichedFeaturedItems(options: GetFeaturedOptions = {}): Promise<FeaturedItem[]> {
  const { dynamicFallbackMovies = [], dynamicFallbackTV = [], maxItems = 6 } = options;
  const cacheKey = `featured_hero_strict_${maxItems}`;

  return memoryCache.getOrFetch<FeaturedItem[]>(
    cacheKey,
    async () => {
      // 1. Fetch custom featured movies & TV shows from MongoDB/markdown
      const [customMoviesRes, customTVRes] = await Promise.allSettled([
        getAllFeaturedCustomMovies(),
        getAllFeaturedCustomTV(),
      ]);

      const customMovies = customMoviesRes.status === 'fulfilled' ? customMoviesRes.value : [];
      const customTV = customTVRes.status === 'fulfilled' ? customTVRes.value : [];

      const customFeaturedList: FeaturedItem[] = [];
      const seenKeys = new Set<string>();

      // Interleave movies and TV shows for balanced presentation
      const maxLen = Math.max(customMovies.length, customTV.length);
      for (let i = 0; i < maxLen; i++) {
        if (i < customMovies.length) {
          const item = customMovies[i];
          const key = `movie-${item.id || item.tmdbId || item.title}`.toLowerCase();
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            customFeaturedList.push(item);
          }
        }
        if (i < customTV.length) {
          const item = customTV[i];
          const key = `tv-${item.id || item.tmdbId || item.title}`.toLowerCase();
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            customFeaturedList.push(item);
          }
        }
      }

      // If there is custom content with `featured: true`, USE ONLY THAT!
      if (customFeaturedList.length > 0) {
        return customFeaturedList.slice(0, maxItems);
      }

      // 2. FALLBACK ONLY: If no custom featured content exists at all, use TMDB API
      const fallbackList: FeaturedItem[] = [];
      const fallbackSources = [...dynamicFallbackMovies, ...dynamicFallbackTV];

      for (const m of fallbackSources) {
        if (fallbackList.length >= maxItems) break;

        const isTV = 'name' in m || 'first_air_date' in m;
        const key = `${isTV ? 'tv' : 'movie'}-${m.id}`;

        if (!seenKeys.has(key)) {
          seenKeys.add(key);

          const backdrop = (m as any).backdrop_path
            ? getImageUrl((m as any).backdrop_path, 'w1280')
            : (m as any).poster_path
            ? getImageUrl((m as any).poster_path, 'w780')
            : '/placeholder-poster.svg';

          const poster = (m as any).poster_path
            ? getImageUrl((m as any).poster_path, 'w500')
            : (m as any).backdrop_path
            ? getImageUrl((m as any).backdrop_path, 'w780')
            : '/placeholder-poster.svg';

          const title = (m as any).title || (m as any).name || 'Featured';
          const releaseDate = (m as any).release_date || (m as any).first_air_date;
          const year = releaseDate ? new Date(releaseDate).getFullYear() : '2026';

          fallbackList.push({
            id: `dynamic-${(m as any).id}`,
            tmdbId: (m as any).id,
            title,
            overview: (m as any).overview || '',
            backdropUrl: backdrop,
            posterUrl: poster,
            rating: Math.round(((m as any).vote_average || 8) * 10) / 10,
            year,
            type: isTV ? 'tv' : 'movie',
            link: isTV ? getTVUrl(m as TVShow) : getMovieUrl(m as Movie),
            badge: 'Featured',
          });
        }
      }

      return fallbackList.slice(0, maxItems);
    },
    60_000, // 60s hard TTL
    15_000  // 15s SWR
  );
}
