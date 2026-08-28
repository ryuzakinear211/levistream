import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { Movie, TVShow } from '@/types/tmdb';
import { getImageUrl } from '@/lib/tmdb';
import { getAllFeaturedCustomMovies } from '@/lib/markdownMovies';
import { getAllFeaturedCustomTV } from '@/lib/markdownTV';
import siteConfig, { FeaturedItem } from '@/config';
import { getMovieUrl, getTVUrl } from '@/lib/urls';
import { memoryCache } from '@/lib/cache';
import { serializeTinaMovie, serializeTinaTVShow } from '@/lib/tina/schema';
import { isMongoConfigured } from '@/lib/mongodb/client';
import { saveMongoMovie, saveMongoTVShow, getMongoMovies, getMongoTVShows } from '@/lib/mongodb/service';

const VIDEO_DIR = path.join(process.cwd(), 'video');
const TV_DIR = path.join(process.cwd(), 'tv');

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
 * Automatically enforces the featured limit:
 * If the number of items with `featured: true` exceeds `limit` (default: 7),
 * the newest items are retained as featured, and older items are demoted to `featured: false`.
 * Updates both disk markdown files and MongoDB to keep data in sync.
 */
export async function enforceFeaturedLimit(type: 'movie' | 'tv', limit: number = siteConfig.featuredLimit || 7): Promise<void> {
  try {
    if (type === 'movie') {
      const featuredMovies = await getAllFeaturedCustomMovies().catch(() => []);
      if (featuredMovies.length > limit) {
        const excessItems = featuredMovies.slice(limit);
        for (const item of excessItems) {
          const slug = String(item.id || '').replace(/^movie-/, '');
          if (!slug) continue;

          // 1. Update file on disk if exists
          const filePath = path.join(VIDEO_DIR, `${slug}.md`);
          if (fs.existsSync(filePath)) {
            try {
              const raw = fs.readFileSync(filePath, 'utf8');
              const { data, content } = matter(raw);
              data.featured = false;
              const updatedContent = serializeTinaMovie(data, content);
              fs.writeFileSync(filePath, updatedContent, 'utf8');
            } catch (e) {
              console.warn(`[featured] Failed to demote disk movie ${slug}:`, e);
            }
          }

          // 2. Update MongoDB if configured
          if (isMongoConfigured()) {
            await saveMongoMovie({ slug, featured: false }).catch(() => {});
          }
        }
        memoryCache.invalidate('featured_');
        memoryCache.invalidate('custom_movies_');
      }
    } else if (type === 'tv') {
      const featuredTV = await getAllFeaturedCustomTV().catch(() => []);
      if (featuredTV.length > limit) {
        const excessItems = featuredTV.slice(limit);
        for (const item of excessItems) {
          const showSlug = String(item.id || '').replace(/^tv-/, '');
          if (!showSlug) continue;

          // 1. Update file on disk if exists
          const indexPath = path.join(TV_DIR, showSlug, '_index.md');
          if (fs.existsSync(indexPath)) {
            try {
              const raw = fs.readFileSync(indexPath, 'utf8');
              const { data, content } = matter(raw);
              data.featured = false;
              const updatedContent = serializeTinaTVShow(data, content);
              fs.writeFileSync(indexPath, updatedContent, 'utf8');
            } catch (e) {
              console.warn(`[featured] Failed to demote disk TV show ${showSlug}:`, e);
            }
          }

          // 2. Update MongoDB if configured
          if (isMongoConfigured()) {
            await saveMongoTVShow({ showSlug, featured: false }).catch(() => {});
          }
        }
        memoryCache.invalidate('featured_');
        memoryCache.invalidate('custom_tv_');
      }
    }
  } catch (err) {
    console.warn(`[featured] Error enforcing featured limit for ${type}:`, err);
  }
}

/**
 * Loads Featured Hero MOVIES for Home Page:
 * ONLY uses custom markdown movies that have frontmatter `featured: true`.
 * Automatically enforces featured limit from siteConfig.
 */
export async function getEnrichedFeaturedMovies(options: {
  maxItems?: number;
} = {}): Promise<FeaturedItem[]> {
  const limit = options.maxItems || siteConfig.featuredLimit || 7;
  const cacheKey = `featured_hero_movies_only_${limit}`;

  return memoryCache.getOrFetch<FeaturedItem[]>(
    cacheKey,
    async () => {
      // Enforce auto-eviction if count exceeds limit
      await enforceFeaturedLimit('movie', limit).catch(() => {});
      const customMovies = await getAllFeaturedCustomMovies().catch(() => []);
      return customMovies.slice(0, limit);
    },
    60_000,
    15_000
  );
}

/**
 * Loads Featured Hero TV SERIES for TV Page:
 * ONLY uses custom markdown TV shows that have `featured: true` in _index.md frontmatter.
 * Automatically enforces featured limit from siteConfig.
 */
export async function getEnrichedFeaturedTV(options: {
  maxItems?: number;
} = {}): Promise<FeaturedItem[]> {
  const limit = options.maxItems || siteConfig.featuredLimit || 7;
  const cacheKey = `featured_hero_tv_only_${limit}`;

  return memoryCache.getOrFetch<FeaturedItem[]>(
    cacheKey,
    async () => {
      // Enforce auto-eviction if count exceeds limit
      await enforceFeaturedLimit('tv', limit).catch(() => {});
      const customTV = await getAllFeaturedCustomTV().catch(() => []);
      return customTV.slice(0, limit);
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
    maxItems: options.maxItems || siteConfig.featuredLimit || 7,
  });
}


