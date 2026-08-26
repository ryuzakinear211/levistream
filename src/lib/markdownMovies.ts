import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';
import { MovieDetail } from '@/types/tmdb';
import { getMovieDetails, getImageUrl, searchMovies } from '@/lib/tmdb';
import siteConfig, { FeaturedItem } from '@/config';
import { cleanVideoUrl, getMovieUrl } from '@/lib/urls';
import { getGitHubRawFile, listGitHubDir } from '@/lib/githubStorage';

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

/**
 * Gets all markdown files asynchronously, discovering live files from GitHub API in production/Vercel.
 */
export async function getAllCustomMovieFilesAsync(): Promise<string[]> {
  const localFiles = getAllCustomMovieFiles();
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    try {
      const ghFiles = await listGitHubDir('video');
      const mdFiles = ghFiles.filter((file) => file.endsWith('.md') || file.endsWith('.markdown'));
      if (mdFiles.length > 0) {
        return Array.from(new Set([...mdFiles, ...localFiles]));
      }
    } catch {}
  }
  return localFiles;
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
          const tSlug = cleanSlug(data.title);
          if (tSlug) {
            slugs.push(tSlug);
            if (data.tmdb_id) {
              slugs.push(`${tSlug}-${data.tmdb_id}`);
            }
            const year = data.year || data.release_date?.slice(0, 4) || '2026';
            if (year) {
              slugs.push(`${tSlug}-${year}`);
            }
          }
        }
      }
    } catch (e) {
      console.error(`Error reading slugs for ${file}:`, e);
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
 * Returns a mapping of tmdb_id -> custom slug (e.g. { 1288445: 'movie.md' }).
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

/**
 * Finds and parses a custom markdown movie by its slug, title slug, title-year, trailing ID, or tmdb_id.
 */
export async function getCustomMovieBySlug(slugOrId: string | number): Promise<CustomMovieData | null> {
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

  // 2. Fetch live file content for matched file
  if (matchedFile) {
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
      try {
        const liveText = await getGitHubRawFile(`video/${matchedFile}`);
        if (liveText && liveText.includes('---')) {
          fileContent = liveText;
        }
      } catch {}
    }
    if (!fileContent) {
      try {
        const filePath = path.join(CONTENT_DIR, matchedFile);
        if (fs.existsSync(filePath)) {
          fileContent = fs.readFileSync(filePath, 'utf8');
        }
      } catch (err) {
        console.error(`Error reading ${matchedFile}:`, err);
      }
    }
  }

  // 3. Match by frontmatter tmdb_id, exact title slug, or title-year slug across files
  if (!matchedFile || !fileContent) {
    for (const file of files) {
      try {
        let rawContent = '';
        if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
          try {
            const liveText = await getGitHubRawFile(`video/${file}`);
            if (liveText && liveText.includes('---')) {
              rawContent = liveText;
            }
          } catch {}
        }
        if (!rawContent) {
          const filePath = path.join(CONTENT_DIR, file);
          if (fs.existsSync(filePath)) {
            rawContent = fs.readFileSync(filePath, 'utf8');
          }
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

  // 4. Fallback: Check GitHub Raw live if file was just created/updated via CMS before Vercel build
  if (!matchedFile || !fileContent) {
    const candidates = [
      `${cleanKey}.md`,
      `${cleanWithoutSuffix}.md`,
      `${searchKey}.md`,
    ];

    for (const cand of candidates) {
      try {
        const liveText = await getGitHubRawFile(`video/${cand}`);
        if (liveText && liveText.includes('---')) {
          matchedFile = cand;
          fileContent = liveText;
          break;
        }
      } catch {
        // ignore network error
      }
    }
  }

  // 5. If running on Vercel / serverless runtime, fetch live raw markdown from GitHub to always get the latest edits live without waiting for rebuild!
  if (matchedFile && (process.env.VERCEL || process.env.NODE_ENV === 'production')) {
    try {
      const liveText = await getGitHubRawFile(`video/${matchedFile}`);
      if (liveText && liveText.includes('---')) {
        fileContent = liveText;
      }
    } catch {
      // ignore network error and use local fileContent fallback
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
        poster_path: frontmatter.image_url || frontmatter.poster_path || null,
        backdrop_path: frontmatter.backdrop_url || frontmatter.image_url || null,
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
        poster_path: frontmatter.image_url || frontmatter.poster_path || null,
        backdrop_path: frontmatter.backdrop_url || frontmatter.image_url || null,
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
  const imageUrl = frontmatter.image_url || frontmatter.poster_path || frontmatter.backdrop_url || null;
  const subtitles = frontmatter.subtitles || frontmatter.subtitle || frontmatter.subtitle_url || frontmatter.sub_url || frontmatter.caption_url || null;

  const overriddenPoster = imageUrl || tmdbMovie.poster_path;
  const overriddenBackdrop = frontmatter.backdrop_url || imageUrl || tmdbMovie.backdrop_path;
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
}

/**
 * Returns all custom markdown movies that have `featured: true` in their frontmatter.
 */
export async function getAllFeaturedCustomMovies(): Promise<FeaturedItem[]> {
  const files = await getAllCustomMovieFilesAsync();
  const featuredMovies: FeaturedItem[] = [];

  for (const file of files) {
    try {
      const baseSlug = file.replace(/\.(md|markdown)$/i, '');
      const customData = await getCustomMovieBySlug(baseSlug);

      if (
        customData &&
        (customData.frontmatter.featured === true ||
          customData.frontmatter.featured === 'true' ||
          customData.frontmatter.featured === '1')
      ) {
        const detail = await getMovieDetailsWithCustomOverride(baseSlug);
        if (detail) {
          const customImg = detail.customImageUrl || customData.frontmatter.image_url || customData.frontmatter.poster_path || customData.frontmatter.backdrop_url;
          const backdrop = customImg
            ? getImageUrl(customImg, 'w1280')
            : detail.backdrop_path
            ? getImageUrl(detail.backdrop_path, 'w1280')
            : detail.poster_path
            ? getImageUrl(detail.poster_path, 'w780')
            : '/placeholder-poster.svg';
          const poster = customImg
            ? getImageUrl(customImg, 'w500')
            : detail.poster_path
            ? getImageUrl(detail.poster_path, 'w500')
            : detail.backdrop_path
            ? getImageUrl(detail.backdrop_path, 'w780')
            : '/placeholder-poster.svg';

          featuredMovies.push({
            id: `movie-${detail.customSlug || detail.id}`,
            tmdbId: detail.id,
            title: detail.title,
            tagline: detail.tagline || undefined,
            overview: detail.overview,
            backdropUrl: backdrop,
            posterUrl: poster,
            rating: Math.round(detail.vote_average * 10) / 10,
            year: detail.release_date ? new Date(detail.release_date).getFullYear() : '2026',
            duration: detail.runtime ? `${Math.floor(detail.runtime / 60)}h ${detail.runtime % 60}m` : undefined,
            type: 'movie' as const,
            genres: detail.genres?.map((g) => g.name) || [],
            link: getMovieUrl(detail),
            badge: 'Featured',
            featured: true,
            isCustom: true,
          });
        }
      }
    } catch (err) {
      console.error(`Error loading featured custom movie for ${file}:`, err);
    }
  }

  return featuredMovies;
}
