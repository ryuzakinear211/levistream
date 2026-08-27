import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';
import { MovieDetail } from '@/types/tmdb';
import { getMovieDetails, getImageUrl, searchMovies } from '@/lib/tmdb';
import siteConfig, { FeaturedItem } from '@/config';
import { cleanVideoUrl, getMovieUrl } from '@/lib/urls';
import { getMongoMovieBySlug, getMongoMovies } from '@/lib/mongodb/service';
import { memoryCache } from '@/lib/cache';

export interface CustomMovieFrontmatter {
  title?: string;
  tmdb_id: number | string;
  rating?: number | string;
  deskripsi?: string;
  description?: string;
  videourl?: string;
  video_url?: string;
  image_url?: string;
  tagline?: string;
  featured?: boolean | string;
  subtitle?: string;
  subtitles?: any;
  subtitle_url?: string;
  sub_url?: string;
  caption_url?: string;
  [key: string]: any;
}

export interface CustomMovieData {
  slug: string; // e.g. "movie" or "movie.md"
  filename: string;
  frontmatter: CustomMovieFrontmatter;
  contentHtml: string;
  rawContent?: string;
}

export interface MergedMovieDetail extends MovieDetail {
  isCustomMarkdown?: boolean;
  customSlug?: string;
  customVideoUrl?: string | null;
  customImageUrl?: string | null;
  customSubtitles?: any;
  customContentHtml?: string | null;
}

const CONTENT_DIR = path.join(process.cwd(), 'video');

/**
 * Ensures the video/ content directory exists.
 */
function ensureContentDirExists(): void {
  if (!fs.existsSync(CONTENT_DIR)) {
    fs.mkdirSync(CONTENT_DIR, { recursive: true });
  }
}

/**
 * Gets all markdown files from the `video/` directory on local disk.
 */
export function getAllCustomMovieFiles(): string[] {
  ensureContentDirExists();
  try {
    const files = fs.readdirSync(CONTENT_DIR);
    return files.filter((file) => file.endsWith('.md') || file.endsWith('.markdown'));
  } catch (error) {
    console.error('Error reading custom movie files:', error);
    return [];
  }
}

export async function getAllCustomMovieFilesAsync(): Promise<string[]> {
  try {
    const mongoDocs = await getMongoMovies();
    if (mongoDocs && mongoDocs.length > 0) {
      const mongoFiles = mongoDocs.map((m) => `${m.slug}.md`);
      const localFiles = getAllCustomMovieFiles();
      return Array.from(new Set([...mongoFiles, ...localFiles]));
    }
  } catch {}

  return getAllCustomMovieFiles();
}

/**
 * Converts text into URL slug for route matching.
 */
function cleanSlug(text?: string | null): string {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/&/g, '-and-')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Returns all possible slugs for static path generation.
 * Generates combinations of: filename, filename.md, tmdb_id, title slug, title-year slug, and title-id slug.
 */
export function getAllCustomMovieSlugs(): string[] {
  const files = getAllCustomMovieFiles();
  const slugs: string[] = [];

  files.forEach((file) => {
    const baseSlug = file.replace(/\.(md|markdown)$/i, '');
    slugs.push(baseSlug);
    slugs.push(file);

    try {
      const filePath = path.join(CONTENT_DIR, file);
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const { data } = matter(fileContent);
      if (data) {
        if (data.tmdb_id) {
          slugs.push(String(data.tmdb_id));
        }
        if (data.title) {
          const titleSlug = cleanSlug(data.title);
          if (titleSlug) {
            slugs.push(titleSlug);
            const year = data.year || (data.release_date ? data.release_date.slice(0, 4) : undefined);
            if (year) {
              slugs.push(`${titleSlug}-${year}`);
            }
            if (data.tmdb_id) {
              slugs.push(`${titleSlug}-${data.tmdb_id}`);
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error reading ${file} for slugs:`, error);
    }
  });

  // Include featured items from siteConfig to ensure instant static/ISR generation
  if (siteConfig.featuredItems && Array.isArray(siteConfig.featuredItems)) {
    siteConfig.featuredItems.forEach((item) => {
      if (item.type === 'movie' || !item.type) {
        if (item.tmdbId) slugs.push(String(item.tmdbId));
        if (item.title) {
          const tSlug = cleanSlug(item.title);
          if (tSlug) {
            slugs.push(tSlug);
            const year = item.year || '2026';
            slugs.push(`${tSlug}-${year}`);
            if (item.tmdbId) slugs.push(`${tSlug}-${item.tmdbId}`);
          }
        }
      }
    });
  }

  return Array.from(new Set(slugs));
}

/**
 * Gets a mapping of TMDB IDs to their custom markdown movie slugs.
 */
export function getCustomMovieTmdbMapping(): Record<string, string> {
  const files = getAllCustomMovieFiles();
  const mapping: Record<string, string> = {};

  files.forEach((file) => {
    try {
      const filePath = path.join(CONTENT_DIR, file);
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const { data } = matter(fileContent);
      if (data && data.tmdb_id) {
        mapping[String(data.tmdb_id)] = file;
      }
    } catch (e) {
      console.error(`Error parsing mapping for ${file}:`, e);
    }
  });

  return mapping;
}

export function getCustomMovieSlugsByTmdbId(): Record<number, string> {
  const files = getAllCustomMovieFiles();
  const mapping: Record<number, string> = {};

  files.forEach((file) => {
    try {
      const filePath = path.join(CONTENT_DIR, file);
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const { data } = matter(fileContent);
      if (data && data.tmdb_id) {
        const baseSlug = file.replace(/\.(md|markdown)$/i, '');
        mapping[Number(data.tmdb_id)] = baseSlug;
      }
    } catch (error) {
      console.error(`Error reading ${file} for TMDB ID mapping:`, error);
    }
  });

  return mapping;
}

/**
 * Finds and parses a custom markdown movie by its slug, title slug, title-year, trailing ID, or tmdb_id.
 */
export async function getCustomMovieBySlug(slugOrId: string | number): Promise<CustomMovieData | null> {
  // 1. Check MongoDB first (Persistent Cloud Source of Truth)
  try {
    const mongoDoc = await getMongoMovieBySlug(slugOrId);
    if (mongoDoc) {
      const frontmatter: CustomMovieFrontmatter = {
        title: mongoDoc.title,
        tmdb_id: mongoDoc.tmdb_id,
        rating: mongoDoc.rating,
        deskripsi: mongoDoc.deskripsi,
        videourl: mongoDoc.videourl,
        image_url: mongoDoc.image_url,
        featured: mongoDoc.featured,
        subtitles: mongoDoc.subtitles,
        duration: mongoDoc.duration,
      };
      const contentHtml = mongoDoc.content ? (marked.parse(mongoDoc.content) as string) : '';
      return {
        slug: mongoDoc.slug,
        filename: `${mongoDoc.slug}.md`,
        frontmatter,
        contentHtml,
        rawContent: mongoDoc.content || '',
      };
    }
  } catch (mErr) {
    console.warn('[markdownMovies] MongoDB getCustomMovieBySlug notice:', mErr);
  }

  ensureContentDirExists();
  const searchKey = String(slugOrId).trim().toLowerCase();
  const cleanKey = searchKey.replace(/\.(md|markdown)$/i, '');
  const isNumeric = /^\d+$/.test(cleanKey);

  // Check if searchKey has trailing ID or 4-digit year (e.g. "mutiny-2026" or "mutiny-1288445")
  const idMatch = cleanKey.match(/-(\d{4,})$/);
  const trailingId = idMatch ? idMatch[1] : null;
  const cleanWithoutSuffix = cleanKey.replace(/-(19\d{2}|20\d{2}|\d{4,})$/, '');

  const files = await getAllCustomMovieFilesAsync();
  let matchedFile: string | null = null;
  let fileContent = '';

  // 1. Direct filename exact match (e.g. "toy-story-5-2026.md", "movie.md")
  for (const file of files) {
    const fileWithoutExt = file.replace(/\.(md|markdown)$/i, '').toLowerCase();
    const fullFileName = file.toLowerCase();

    if (fullFileName === searchKey || fileWithoutExt === cleanKey) {
      if (isNumeric && fileWithoutExt !== cleanKey) {
        continue;
      }
      matchedFile = file;
      break;
    }
  }

  // 2. Fetch file content for matched file
  if (matchedFile) {
    try {
      const filePath = path.join(CONTENT_DIR, matchedFile);
      if (fs.existsSync(filePath)) {
        fileContent = fs.readFileSync(filePath, 'utf8');
      }
    } catch (err) {
      console.error(`Error reading ${matchedFile}:`, err);
    }
  }

  // 3. Match by frontmatter tmdb_id, exact title slug, or title-year slug across files
  if (!matchedFile || !fileContent) {
    for (const file of files) {
      try {
        let rawContent = '';
        const filePath = path.join(CONTENT_DIR, file);
        if (fs.existsSync(filePath)) {
          rawContent = fs.readFileSync(filePath, 'utf8');
        }
        if (!rawContent) continue;

        const parsed = matter(rawContent);
        const data = parsed.data as CustomMovieFrontmatter;

        if (data) {
          const tmdbIdStr = String(data.tmdb_id || '').trim();
          const titleSlug = cleanSlug(data.title);

          // If searchKey is a numeric TMDB ID (e.g. "533535" or "94")
          if (isNumeric) {
            if (tmdbIdStr === cleanKey) {
              matchedFile = file;
              fileContent = rawContent;
              break;
            }
            continue;
          }

          // Direct TMDB ID match or trailing ID match (e.g. "mutiny-1288445" -> tmdb_id 1288445)
          if (tmdbIdStr && (tmdbIdStr === cleanKey || (trailingId && tmdbIdStr === trailingId))) {
            matchedFile = file;
            fileContent = rawContent;
            break;
          }

          // Exact title slug match (e.g. "mutiny" === "mutiny" or "mutiny-2026" === "mutiny-2026")
          if (titleSlug) {
            const year = data.year || (data.release_date ? data.release_date.slice(0, 4) : undefined);
            if (
              titleSlug === cleanKey ||
              titleSlug === cleanWithoutSuffix ||
              (year && cleanKey === `${titleSlug}-${year}`) ||
              (tmdbIdStr && cleanKey === `${titleSlug}-${tmdbIdStr}`)
            ) {
              matchedFile = file;
              fileContent = rawContent;
              break;
            }
          }
        }
      } catch (err) {
        console.error(`Error reading ${file}:`, err);
      }
    }
  }

  if (!matchedFile || !fileContent) {
    return null;
  }

  const { data, content } = matter(fileContent);
  const frontmatter = data as CustomMovieFrontmatter;

  // Convert markdown body to HTML
  const contentHtml = await marked.parse(content || '');

  return {
    slug: matchedFile.replace(/\.(md|markdown)$/i, ''),
    filename: matchedFile,
    frontmatter,
    contentHtml,
    rawContent: content,
  };
}

/**
 * Fetches movie details and merges TMDB API baseline data with custom markdown overrides.
 * Supports dual-routing: ID (1288445), title-year (mutiny-2026), and title-id slug (mutiny-1288445).
 */
export async function getMovieDetailsWithCustomOverride(
  slugOrId: string | number
): Promise<MergedMovieDetail | null> {
  const cacheKey = `movie_detail_override_${String(slugOrId).trim().toLowerCase()}`;
  return memoryCache.getOrFetch<MergedMovieDetail | null>(
    cacheKey,
    async () => {
      let customMovie = await getCustomMovieBySlug(slugOrId);

  let tmdbId: number | null = null;

  if (customMovie && customMovie.frontmatter.tmdb_id) {
    const parsedId = Number(customMovie.frontmatter.tmdb_id);
    if (!isNaN(parsedId) && parsedId > 0) {
      tmdbId = parsedId;
    }
  }

  // If no tmdbId from direct custom movie match, resolve tmdbId from slugOrId
  if (!tmdbId || isNaN(tmdbId)) {
    const str = String(slugOrId).trim();
    if (/^\d+$/.test(str)) {
      tmdbId = Number(str);
    } else {
      const yearMatch = str.match(/-(19\d{2}|20\d{2})$/);
      const explicitIdMatch = str.match(/-tmdb-(\d+)$/i) || str.match(/-(\d{5,})$/);

      if (explicitIdMatch && !yearMatch) {
        tmdbId = Number(explicitIdMatch[1]);
      } else {
        const cleanSearch = (yearMatch ? str.slice(0, yearMatch.index) : str).replace(/-/g, ' ');
        const searchYear = yearMatch ? yearMatch[1] : undefined;
        try {
          const searchRes = await searchMovies(cleanSearch);
          if (searchRes.results && searchRes.results.length > 0) {
            const matched = searchYear
              ? searchRes.results.find((m) => m.release_date && m.release_date.startsWith(searchYear)) || searchRes.results[0]
              : searchRes.results[0];
            tmdbId = matched ? matched.id : null;
          }
        } catch (e) {
          console.warn(`Error searching TMDB for movie slug ${str}:`, e);
        }
      }
    }
  }

  // If customMovie wasn't found by slug directly, but tmdbId was resolved,
  // check if there is an existing custom markdown movie with this tmdb_id!
  if (!customMovie && tmdbId) {
    customMovie = await getCustomMovieBySlug(tmdbId);
  }

  if (!tmdbId || isNaN(tmdbId)) {
    if (customMovie) {
      const { frontmatter, contentHtml } = customMovie;
      return {
        id: 0,
        title: frontmatter.title || customMovie.slug,
        tagline: frontmatter.tagline || '',
        overview: (frontmatter.deskripsi || frontmatter.description || '').trim(),
        poster_path: frontmatter.poster_path || null,
        backdrop_path: frontmatter.backdrop_url || null,
        release_date: frontmatter.year ? `${frontmatter.year}-01-01` : '2026-01-01',
        vote_average: frontmatter.rating ? Number(frontmatter.rating) : 0,
        vote_count: 0,
        genres: [],
        runtime: 120,
        credits: { cast: [], crew: [] },
        videos: { results: [] },
        similar: { page: 1, results: [], total_pages: 0, total_results: 0 },
        isCustomMarkdown: true,
        customSlug: customMovie.slug,
        customVideoUrl: cleanVideoUrl(frontmatter.videourl || frontmatter.video_url),
        customImageUrl: frontmatter.image_url || null,
        customSubtitles: frontmatter.subtitles || null,
        customContentHtml: contentHtml && contentHtml.trim().length > 0 ? contentHtml : null,
      } as any;
    }
    return null;
  }

  // Fetch full baseline data from TMDB API
  const tmdbMovie = await getMovieDetails(tmdbId);
  if (!tmdbMovie) {
    if (customMovie) {
      const { frontmatter, contentHtml } = customMovie;
      return {
        id: tmdbId,
        title: frontmatter.title || customMovie.slug,
        tagline: frontmatter.tagline || '',
        overview: (frontmatter.deskripsi || frontmatter.description || '').trim(),
        poster_path: frontmatter.poster_path || null,
        backdrop_path: frontmatter.backdrop_url || null,
        release_date: frontmatter.year ? `${frontmatter.year}-01-01` : '2026-01-01',
        vote_average: frontmatter.rating ? Number(frontmatter.rating) : 0,
        vote_count: 0,
        genres: [],
        runtime: 120,
        credits: { cast: [], crew: [] },
        videos: { results: [] },
        similar: { page: 1, results: [], total_pages: 0, total_results: 0 },
        isCustomMarkdown: true,
        customSlug: customMovie.slug,
        customVideoUrl: cleanVideoUrl(frontmatter.videourl || frontmatter.video_url),
        customImageUrl: frontmatter.image_url || null,
        customSubtitles: frontmatter.subtitles || null,
        customContentHtml: contentHtml && contentHtml.trim().length > 0 ? contentHtml : null,
      } as any;
    }
    return null;
  }

  // If no custom markdown file is associated, return baseline TMDB details
  if (!customMovie) {
    return {
      ...tmdbMovie,
      isCustomMarkdown: false,
      customVideoUrl: null,
      customContentHtml: null,
    };
  }

  const { frontmatter, contentHtml } = customMovie;

  // Merge overrides from markdown frontmatter
  const overriddenTitle = frontmatter.title && frontmatter.title.trim() !== ''
    ? frontmatter.title
    : tmdbMovie.title;

  const overriddenRating = frontmatter.rating !== undefined && frontmatter.rating !== null && frontmatter.rating !== ''
    ? Number(frontmatter.rating)
    : tmdbMovie.vote_average;

  const overriddenOverview = (frontmatter.deskripsi || frontmatter.description)?.trim() || tmdbMovie.overview;

  const overriddenTagline = frontmatter.tagline?.trim() || tmdbMovie.tagline;

  const videoUrl = cleanVideoUrl(frontmatter.videourl || frontmatter.video_url);
  const imageUrl = frontmatter.image_url || null;
  const subtitles = frontmatter.subtitles || frontmatter.subtitle || frontmatter.subtitle_url || frontmatter.sub_url || frontmatter.caption_url || null;

  // Poster and backdrop strictly use TMDB or explicit custom poster fields, NOT image_url (which is reserved for player/generic content)
  const overriddenPoster = (frontmatter.poster_path ? frontmatter.poster_path : tmdbMovie.poster_path) || null;
  const overriddenBackdrop = (frontmatter.backdrop_url ? frontmatter.backdrop_url : tmdbMovie.backdrop_path) || null;
  const overriddenReleaseDate = frontmatter.year ? `${frontmatter.year}-01-01` : (frontmatter.release_date || tmdbMovie.release_date);
  const overriddenRuntime = frontmatter.duration ? (typeof frontmatter.duration === 'number' ? frontmatter.duration : tmdbMovie.runtime) : tmdbMovie.runtime;

  return {
    ...tmdbMovie,
    title: overriddenTitle,
    vote_average: overriddenRating,
    overview: overriddenOverview,
    tagline: overriddenTagline,
    release_date: overriddenReleaseDate,
    runtime: overriddenRuntime,
    poster_path: overriddenPoster,
    backdrop_path: overriddenBackdrop,
    isCustomMarkdown: true,
    customSlug: customMovie.slug,
    customVideoUrl: videoUrl,
    customImageUrl: imageUrl,
    customSubtitles: subtitles,
    customContentHtml: contentHtml && contentHtml.trim().length > 0 ? contentHtml : null,
  };
    },
    60_000,
    15_000
  );
}

/**
 * Returns all custom markdown movies that have `featured: true` in their frontmatter.
 */
export async function getAllFeaturedCustomMovies(): Promise<FeaturedItem[]> {
  try {
    const mongoMovies = await getMongoMovies();
    const featured = mongoMovies.filter((m) => Boolean(m.featured));
    return await Promise.all(
      featured.map(async (m) => {
        let overview = (m.deskripsi || (m as any).description || (m as any).overview || '').trim();
        let rating = m.rating || 0;
        let genres: string[] = [];
        let posterUrl = '/placeholder-poster.svg';
        let backdropUrl = '/placeholder-poster.svg';

        if (m.tmdb_id) {
          try {
            const tmdb = await getMovieDetails(Number(m.tmdb_id));
            if (tmdb) {
              if (tmdb.poster_path) posterUrl = getImageUrl(tmdb.poster_path, 'w500');
              if (tmdb.backdrop_path) backdropUrl = getImageUrl(tmdb.backdrop_path, 'w1280');
              if (!overview && tmdb.overview) overview = tmdb.overview;
              if (!rating && tmdb.vote_average) rating = Math.round(tmdb.vote_average * 10) / 10;
              if (tmdb.genres) genres = tmdb.genres.map((g) => g.name);
            }
          } catch {}
        }

        if (posterUrl === '/placeholder-poster.svg' && m.image_url) {
          posterUrl = getImageUrl(m.image_url, 'w500');
          backdropUrl = getImageUrl(m.image_url, 'w1280');
        }

        return {
          id: `movie-${m.slug}`,
          tmdbId: m.tmdb_id || 0,
          title: m.title || m.slug,
          tagline: undefined,
          overview: overview || 'Tonton film ini dengan kualitas terbaik di LeviStream.',
          backdropUrl,
          posterUrl,
          rating: rating || 8.5,
          year: '2026',
          duration: m.duration || undefined,
          type: 'movie' as const,
          genres,
          link: `/movie/${m.slug}`,
          badge: 'Featured',
          featured: true,
          isCustom: true,
        } as FeaturedItem;
      })
    );
  } catch (err) {
    console.warn('[markdownMovies] getAllFeaturedCustomMovies error:', err);
    return [];
  }
}

/**
 * Returns all custom movies formatted as Movie objects for display in homepage rows and grids.
 */
export async function getAllCustomMoviesForList(): Promise<any[]> {
  try {
    const mongoMovies = await getMongoMovies();
    return await Promise.all(
      mongoMovies.map(async (m) => {
        let poster: string | null = null;
        let backdrop: string | null = null;
        let rating = m.rating || 0;
        let overview = m.deskripsi || '';

        if (m.tmdb_id) {
          try {
            const tmdb = await getMovieDetails(Number(m.tmdb_id));
            if (tmdb) {
              poster = tmdb.poster_path || null;
              backdrop = tmdb.backdrop_path || null;
              if (!overview && tmdb.overview) overview = tmdb.overview;
              if (!rating && tmdb.vote_average) rating = Math.round(tmdb.vote_average * 10) / 10;
            }
          } catch {}
        }

        return {
          id: m.tmdb_id || m.slug,
          title: m.title || m.slug,
          overview,
          poster_path: poster,
          backdrop_path: backdrop,
          release_date: '2026-01-01',
          vote_average: rating,
          vote_count: 0,
          genre_ids: [],
          popularity: 100,
          adult: false,
          video: false,
          isCustomMarkdown: true,
          customSlug: m.slug,
          customVideoUrl: m.videourl,
          customImageUrl: m.image_url || null,
        };
      })
    );
  } catch (err) {
    console.warn('[markdownMovies] getAllCustomMoviesForList error:', err);
    return [];
  }
}
