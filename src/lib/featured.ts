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
  maxItems?: number;
}

/**
 * Loads Featured Hero MOVIES for Home Page:
 * ONLY uses custom markdown movies that have frontmatter `featured: true`.
 * Under no circumstances does it mix in unconfigured TMDB trending items.
 */
export async function getEnrichedFeaturedMovies(options: {
  maxItems?: number;
} = {}): Promise<FeaturedItem[]> {
  const { maxItems = 6 } = options;
  const cacheKey = `featured_hero_movies_only_${maxItems}`;

  return memoryCache.getOrFetch<FeaturedItem[]>(
    cacheKey,
    async () => {
      // Fetch custom featured movies ONLY from custom markdown frontmatter / CMS
      const customMovies = await getAllFeaturedCustomMovies().catch(() => []);
      return customMovies.slice(0, maxItems);
    },
    60_000,
    15_000
  );
}

/**
 * Loads Featured Hero TV SERIES for TV Page:
 * ONLY uses custom markdown TV shows that have `featured: true` in _index.md frontmatter.
 * Under no circumstances does it mix in unconfigured TMDB trending items.
 */
export async function getEnrichedFeaturedTV(options: {
  maxItems?: number;
} = {}): Promise<FeaturedItem[]> {
  const { maxItems = 6 } = options;
  const cacheKey = `featured_hero_tv_only_${maxItems}`;

  return memoryCache.getOrFetch<FeaturedItem[]>(
    cacheKey,
    async () => {
      // Fetch custom featured TV shows ONLY from custom markdown frontmatter / CMS
      const customTV = await getAllFeaturedCustomTV().catch(() => []);
      return customTV.slice(0, maxItems);
    },
    60_000,
    15_000
  );
}

/**
 * Enriched featured items strictly sourced from custom frontmatter
 */
export async function getEnrichedFeaturedItems(options: GetFeaturedOptions = {}): Promise<FeaturedItem[]> {
  return getEnrichedFeaturedMovies({
    maxItems: options.maxItems,
  });
}

