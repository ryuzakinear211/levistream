import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';
import { TVShowDetail } from '@/types/tmdb';
import { getTVShowDetails, getImageUrl, searchTVShows } from '@/lib/tmdb';
import { FeaturedItem } from '@/config';
import { cleanVideoUrl, getTVUrl } from '@/lib/urls';
import { getGitHubRawFile, listGitHubDir } from '@/lib/githubStorage';
import { getMongoTVShowBySlug, getMongoTVShows } from '@/lib/mongodb/service';

export interface CustomTVFrontmatter {
  title?: string;
  tmdb_id: number | string;
  rating?: number | string;
  deskripsi?: string;
  description?: string;
  image_url?: string;
  tagline?: string;
  featured?: boolean | string;
  [key: string]: any;
}

export interface CustomEpisodeFrontmatter {
  title?: string;
  videourl?: string;
  video_url?: string;
  image_url?: string;
  deskripsi?: string;
  description?: string;
  episode_number?: number | string;
  season_number?: number | string;
  rating?: number | string;
  duration?: string;
  subtitles?: any;
  subtitle?: string;
  subtitle_url?: string;
  sub_url?: string;
  caption_url?: string;
  [key: string]: any;
}

export interface CustomEpisode {
  slug: string; // e.g. "e1" or "s1/e1"
  filename: string; // e.g. "e1.md"
  seasonNumber: number | null;
  seasonFolder: string | null; // e.g. "s1" or null
  episodeNumber: number;
  episodeLabel: string; // e.g. "S1:E1" or "EP 01"
  title: string;
  videoUrl: string | null;
  imageUrl?: string | null;
  overview?: string;
  rating?: number | null;
  duration?: string | null;
  subtitles?: any;
  contentHtml?: string | null;
  rawContent?: string;
  urlPath?: string; // e.g. "/tv/lanterns/s1/e1"
  frontmatter?: CustomEpisodeFrontmatter;
}

export interface CustomSeason {
  seasonNumber: number | null;
  seasonName?: string;
  seasonFolder: string | null;
  seasonLabel?: string;
  episodes: CustomEpisode[];
}

export interface CustomTVShowData {
  slug: string;
  dirName: string;
  showSlug?: string;
  hasSeasons?: boolean;
  frontmatter: CustomTVFrontmatter;
  contentHtml: string | null;
  rawContent?: string;
  seasons: CustomSeason[];
  allEpisodes: CustomEpisode[];
}

export interface MergedTVShowDetail extends TVShowDetail {
  isCustomMarkdown?: boolean;
  isCustomTV?: boolean;
  customSlug?: string;
  customImageUrl?: string | null;
  customContentHtml?: string | null;
  hasSeasons?: boolean;
  seasonsList?: CustomSeason[];
  customSeasons?: CustomSeason[];
  allEpisodes?: CustomEpisode[];
  customEpisodes?: CustomEpisode[];
  activeEpisode?: CustomEpisode | null;
}

const TV_CONTENT_DIR = path.join(process.cwd(), 'tv');

/**
 * Ensures the tv/ content directory exists.
 */
function ensureTVDirExists(): void {
  if (!fs.existsSync(TV_CONTENT_DIR)) {
    fs.mkdirSync(TV_CONTENT_DIR, { recursive: true });
  }
}

/**
 * Parses episode number from filename or string (e.g. "e1.md", "episode-2.md", "03.md").
 */
function parseEpisodeNumber(filename: string, fallbackIndex: number): number {
  const clean = filename.replace(/\.(md|markdown)$/i, '');
  const match = clean.match(/(?:ep?|episode[-_]?)?(\d+)/i);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  return fallbackIndex + 1;
}

/**
 * Parses season number from folder name (e.g. "s1", "season-2", "season3").
 */
function parseSeasonNumber(folderName: string): number | null {
  const match = folderName.match(/(?:s|season[-_]?)?(\d+)/i);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  return null;
}

/**
 * Gets all TV show directory names from the `tv/` folder on local disk.
 */
export function getAllCustomTVShowDirs(): string[] {
  ensureTVDirExists();
  try {
    const entries = fs.readdirSync(TV_CONTENT_DIR, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch (error) {
    console.error('Error reading tv directories:', error);
    return [];
  }
}

export async function getAllCustomTVShowDirsAsync(): Promise<string[]> {
  try {
    const mongoShows = await getMongoTVShows();
    if (mongoShows && mongoShows.length > 0) {
      const mongoDirs = mongoShows.map((s) => s.showSlug);
      const localDirs = getAllCustomTVShowDirs();
      return Array.from(new Set([...mongoDirs, ...localDirs]));
    }
  } catch {}

  const localDirs = getAllCustomTVShowDirs();
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    try {
      const ghDirs = await listGitHubDir('tv');
      const combined = Array.from(new Set([...localDirs, ...ghDirs]));
      if (combined.length > 0) return combined;
    } catch {}
  }
  return localDirs;
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
 * Returns all possible slug paths for Next.js generateStaticParams().
 * E.g. [
 *   { slug: ['lanterns'] },
 *   { slug: ['lanterns-2026'] },
 *   { slug: ['lanterns-2026', 's1', 'e1'] },
 *   { slug: ['lanterns', 's1', 'e1'] },
 *   { slug: ['lanterns', 's1', 'e1.md'] },
 *   { slug: ['lanterns-95350', 's1', 'e1'] },
 *   { slug: ['95350', 's1', 'e1'] }
 * ]
 */
export async function getAllCustomTVSlugPaths(): Promise<{ slug: string[] }[]> {
  const dirs = getAllCustomTVShowDirs();
  const pathsMap = new Map<string, { slug: string[] }>();

  const addPath = (segments: string[]) => {
    const key = segments.join('/');
    if (!pathsMap.has(key)) {
      pathsMap.set(key, { slug: segments });
    }
  };

  for (const showSlug of dirs) {
    const showData = await getCustomTVShowBySlug(showSlug);
    if (!showData) continue;

    const possibleShowSlugs = [showSlug];
    const year = showData.frontmatter.year || showData.frontmatter.first_air_date?.slice(0, 4) || '2026';
    possibleShowSlugs.push(`${showSlug}-${year}`);

    if (showData.frontmatter.tmdb_id) {
      possibleShowSlugs.push(String(showData.frontmatter.tmdb_id));
      if (showData.frontmatter.title) {
        const tSlug = cleanSlug(showData.frontmatter.title);
        if (tSlug) {
          possibleShowSlugs.push(tSlug);
          possibleShowSlugs.push(`${tSlug}-${year}`);
          possibleShowSlugs.push(`${tSlug}-${showData.frontmatter.tmdb_id}`);
        }
      }
    }

    for (const sSlug of possibleShowSlugs) {
      addPath([sSlug]);

      for (const ep of showData.allEpisodes) {
        const baseEp = ep.filename.replace(/\.(md|markdown)$/i, '');
        if (ep.seasonFolder) {
          addPath([sSlug, ep.seasonFolder, baseEp]);
          addPath([sSlug, ep.seasonFolder, ep.filename]);
        } else {
          addPath([sSlug, baseEp]);
          addPath([sSlug, ep.filename]);
        }
      }
    }
  }

  return Array.from(pathsMap.values());
}

/**
 * Reads and parses a custom TV show and all its episodes from `tv/[showSlug]`.
 * Supports directory name, title-year (lanterns-2026), TMDB ID, title slug, and title-id slug.
 */
export async function getCustomTVShowBySlug(showSlugOrTmdbId: string | number): Promise<CustomTVShowData | null> {
  // 1. Check MongoDB first (Cloud Source of Truth)
  try {
    const searchStr = String(showSlugOrTmdbId).trim().toLowerCase();
    const cleanSearch = searchStr.replace(/-(19\d{2}|20\d{2}|\d+)$/, '');
    let mongoDoc = await getMongoTVShowBySlug(searchStr);
    if (!mongoDoc && cleanSearch !== searchStr) {
      mongoDoc = await getMongoTVShowBySlug(cleanSearch);
    }

    if (mongoDoc) {
      const episodes: CustomEpisode[] = (mongoDoc.episodes || []).map((ep) => {
        const epNum = Number(ep.episode.replace(/\D/g, '')) || 1;
        const seasonNum = ep.seasonFolder ? Number(ep.seasonFolder.replace(/\D/g, '')) || 1 : 1;
        const sFolder = ep.seasonFolder || 's1';
        const baseEp = ep.episode;
        const epLabel = `S${seasonNum}:E${epNum}`;
        const urlPath = `/tv/${mongoDoc!.showSlug}/${sFolder}/${baseEp}`;

        return {
          slug: `${sFolder}/${baseEp}`,
          filename: `${baseEp}.md`,
          seasonNumber: seasonNum,
          seasonFolder: sFolder,
          episodeNumber: epNum,
          episodeLabel: epLabel,
          title: ep.title,
          videoUrl: ep.videourl || null,
          imageUrl: ep.image_url || mongoDoc!.image_url || null,
          overview: ep.deskripsi || '',
          rating: ep.rating || null,
          duration: ep.duration || null,
          subtitles: ep.subtitles || null,
          contentHtml: ep.content ? (marked.parse(ep.content) as string) : null,
          rawContent: ep.content || '',
          urlPath,
          frontmatter: {
            title: ep.title,
            videourl: ep.videourl,
            image_url: ep.image_url,
            deskripsi: ep.deskripsi,
            rating: ep.rating,
            duration: ep.duration,
            subtitles: ep.subtitles,
          },
        };
      });

      // Group into seasons
      const seasonsMap = new Map<number, CustomEpisode[]>();
      episodes.forEach((ep) => {
        const sNum = ep.seasonNumber || 1;
        if (!seasonsMap.has(sNum)) {
          seasonsMap.set(sNum, []);
        }
        seasonsMap.get(sNum)!.push(ep);
      });

      const seasons: CustomSeason[] = Array.from(seasonsMap.entries())
        .map(([sNum, eps]) => ({
          seasonNumber: sNum,
          seasonName: `Season ${sNum}`,
          seasonFolder: eps[0]?.seasonFolder || `s${sNum}`,
          episodes: eps,
        }))
        .sort((a, b) => (a.seasonNumber || 0) - (b.seasonNumber || 0));

      const showHtml = mongoDoc.content ? (marked.parse(mongoDoc.content) as string) : null;

      return {
        slug: mongoDoc.showSlug,
        dirName: mongoDoc.showSlug,
        showSlug: mongoDoc.showSlug,
        hasSeasons: seasons.length > 0,
        frontmatter: {
          title: mongoDoc.title,
          tmdb_id: mongoDoc.tmdb_id,
          image_url: mongoDoc.image_url,
          deskripsi: mongoDoc.deskripsi,
          rating: mongoDoc.rating,
          featured: mongoDoc.featured,
        },
        contentHtml: showHtml,
        rawContent: mongoDoc.content || '',
        seasons,
        allEpisodes: episodes,
      };
    }
  } catch (mErr) {
    console.warn('[markdownTV] MongoDB getCustomTVShowBySlug notice:', mErr);
  }

  ensureTVDirExists();
  const searchKey = String(showSlugOrTmdbId).trim().toLowerCase();
  const showDirs = await getAllCustomTVShowDirsAsync();

  // Extract trailing ID (e.g. "lanterns-95350" -> "95350") or strip year/ID
  const idMatch = searchKey.match(/-(\d+)$/);
  const trailingId = idMatch ? idMatch[1] : null;
  const cleanWithoutSuffix = searchKey.replace(/-(19\d{2}|20\d{2}|\d+)$/, '');

  let matchedDir: string | null = null;
  let showDirFullPath = '';

  // 1. Direct directory match (e.g. "lanterns" or "lanterns-2026" matching "lanterns")
  for (const dir of showDirs) {
    const dirLower = dir.toLowerCase();
    if (dirLower === searchKey || dirLower === cleanWithoutSuffix) {
      matchedDir = dir;
      showDirFullPath = path.join(TV_CONTENT_DIR, dir);
      break;
    }
  }

  // 2. Search by tmdb_id, title slug, or trailing ID in _index.md
  if (!matchedDir) {
    for (const dir of showDirs) {
      const fullPath = path.join(TV_CONTENT_DIR, dir);
      const indexPath = fs.existsSync(path.join(fullPath, '_index.md'))
        ? path.join(fullPath, '_index.md')
        : fs.existsSync(path.join(fullPath, 'index.md'))
        ? path.join(fullPath, 'index.md')
        : null;

      if (indexPath) {
        try {
          const content = fs.readFileSync(indexPath, 'utf8');
          const { data } = matter(content);
          if (data) {
            const tmdbIdStr = String(data.tmdb_id || '').trim();
            const titleSlug = cleanSlug(data.title || data.name);

            // Direct TMDB ID or trailing ID match
            if (tmdbIdStr && (tmdbIdStr === searchKey || tmdbIdStr === trailingId)) {
              matchedDir = dir;
              showDirFullPath = fullPath;
              break;
            }

            // Title slug match (e.g. "lanterns" or "lanterns-2026")
            if (
              titleSlug &&
              (titleSlug === searchKey ||
                titleSlug === cleanWithoutSuffix ||
                searchKey.startsWith(titleSlug))
            ) {
              matchedDir = dir;
              showDirFullPath = fullPath;
              break;
            }
          }
        } catch (e) {
          console.error(`Error reading ${indexPath}:`, e);
        }
      }
    }
  }

  // 3. Fallback: Check GitHub Raw live if TV show was just created via CMS before Vercel build
  if (!matchedDir) {
    const candSlugs = [cleanWithoutSuffix, searchKey];
    for (const cSlug of candSlugs) {
      try {
        const liveIndex = await getGitHubRawFile(`tv/${cSlug}/_index.md`);
        if (liveIndex && liveIndex.includes('---')) {
          matchedDir = cSlug;
          break;
        }
      } catch {
        // ignore network error
      }
    }
  }

  if (!matchedDir) {
    return null;
  }

  // Read _index.md
  let indexFrontmatter: CustomTVFrontmatter = { tmdb_id: 0 };
  let indexContentHtml: string | null = null;

  const indexPath = fs.existsSync(path.join(showDirFullPath, '_index.md'))
    ? path.join(showDirFullPath, '_index.md')
    : fs.existsSync(path.join(showDirFullPath, 'index.md'))
    ? path.join(showDirFullPath, 'index.md')
    : null;

  if (indexPath) {
    try {
      let indexRaw = fs.readFileSync(indexPath, 'utf8');
      if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
        try {
          const liveIndex = await getGitHubRawFile(`tv/${matchedDir}/_index.md`);
          if (liveIndex && liveIndex.includes('---')) {
            indexRaw = liveIndex;
          }
        } catch {}
      }
      const { data, content } = matter(indexRaw);
      indexFrontmatter = data as CustomTVFrontmatter;
      if (content && content.trim()) {
        indexContentHtml = await marked.parse(content);
      }
    } catch (e) {
      console.error(`Error parsing ${indexPath}:`, e);
    }
  }

  // Scan for episodes and seasons
  const seasonsMap = new Map<number | null, CustomEpisode[]>();
  const allEpisodes: CustomEpisode[] = [];
  let hasSeasons = false;

  try {
    const entries = fs.readdirSync(showDirFullPath, { withFileTypes: true });

    // Check if subdirectories exist (Season folders like s1, s2, season-1)
    const subDirs = entries.filter((e) => e.isDirectory());

    if (subDirs.length > 0) {
      hasSeasons = true;

      // Sort season folders (e.g. s1, s2, s3)
      subDirs.sort((a, b) => {
        const sA = parseSeasonNumber(a.name) || 0;
        const sB = parseSeasonNumber(b.name) || 0;
        return sA - sB;
      });

      for (const sDir of subDirs) {
        const seasonNumber = parseSeasonNumber(sDir.name);
        const seasonDirPath = path.join(showDirFullPath, sDir.name);
        const epFiles = fs
          .readdirSync(seasonDirPath)
          .filter((f) => f.endsWith('.md') || f.endsWith('.markdown'));

        // Sort episode files (e.g. e1, e2, e3)
        epFiles.sort((a, b) => parseEpisodeNumber(a, 0) - parseEpisodeNumber(b, 0));

        const seasonEpisodes: CustomEpisode[] = [];

        for (let index = 0; index < epFiles.length; index++) {
          const file = epFiles[index];
          try {
            const filePath = path.join(seasonDirPath, file);
            let raw = fs.readFileSync(filePath, 'utf8');
            if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
              try {
                const liveEp = await getGitHubRawFile(`tv/${matchedDir}/${sDir.name}/${file}`);
                if (liveEp && liveEp.includes('---')) {
                  raw = liveEp;
                }
              } catch {}
            }
            const { data, content } = matter(raw);
            const frontmatter = data as CustomEpisodeFrontmatter;

            const epNum = frontmatter.episode_number !== undefined
              ? Number(frontmatter.episode_number)
              : parseEpisodeNumber(file, index);

            const seasonNum = frontmatter.season_number !== undefined
              ? Number(frontmatter.season_number)
              : seasonNumber;

            const baseName = file.replace(/\.(md|markdown)$/i, '');
            const epLabel = seasonNum !== null ? `S${seasonNum}:E${epNum}` : `EP ${epNum < 10 ? '0' + epNum : epNum}`;
            const title = frontmatter.title?.trim() || `Episode ${epNum}`;
            const videoUrl = cleanVideoUrl(frontmatter.videourl || frontmatter.video_url);
            const imageUrl = frontmatter.image_url || null;
            const subtitles = frontmatter.subtitles || frontmatter.subtitle || frontmatter.subtitle_url || frontmatter.sub_url || frontmatter.caption_url || null;
            const overview = (frontmatter.deskripsi || frontmatter.description || '').trim();
            const rating = frontmatter.rating !== undefined && frontmatter.rating !== null ? Number(frontmatter.rating) : null;
            const duration = frontmatter.duration || null;
            const contentHtml = content && content.trim() ? await marked.parse(content) : null;
            const urlPath = `/tv/${matchedDir}/${sDir.name}/${baseName}`;

            const customEp: CustomEpisode = {
              slug: `${sDir.name}/${baseName}`,
              filename: file,
              seasonNumber: seasonNum,
              seasonFolder: sDir.name,
              episodeNumber: epNum,
              episodeLabel: epLabel,
              title,
              videoUrl,
              imageUrl,
              overview,
              rating,
              duration,
              subtitles,
              contentHtml,
              rawContent: content,
              urlPath,
            };

            seasonEpisodes.push(customEp);
            allEpisodes.push(customEp);
          } catch (err) {
            console.error(`Error parsing episode file ${file}:`, err);
          }
        }

        seasonsMap.set(seasonNumber, seasonEpisodes);
      }
    } else {
      // Flat episodes directly inside show folder (no season folders)
      hasSeasons = false;
      const epFiles = entries
        .filter(
          (e) =>
            e.isFile() &&
            (e.name.endsWith('.md') || e.name.endsWith('.markdown')) &&
            e.name !== '_index.md' &&
            e.name !== 'index.md'
        )
        .map((e) => e.name);

      epFiles.sort((a, b) => parseEpisodeNumber(a, 0) - parseEpisodeNumber(b, 0));

      const flatEpisodes: CustomEpisode[] = [];

      for (let index = 0; index < epFiles.length; index++) {
        const file = epFiles[index];
        try {
          const filePath = path.join(showDirFullPath, file);
          let raw = fs.readFileSync(filePath, 'utf8');
          if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
            try {
              const liveEp = await getGitHubRawFile(`tv/${matchedDir}/${file}`);
              if (liveEp && liveEp.includes('---')) {
                raw = liveEp;
              }
            } catch {}
          }
          const { data, content } = matter(raw);
          const frontmatter = data as CustomEpisodeFrontmatter;

          const epNum = frontmatter.episode_number !== undefined
            ? Number(frontmatter.episode_number)
            : parseEpisodeNumber(file, index);

          const baseName = file.replace(/\.(md|markdown)$/i, '');
          const epLabel = `EP ${epNum < 10 ? '0' + epNum : epNum}`;
          const title = frontmatter.title?.trim() || `Episode ${epNum}`;
          const videoUrl = cleanVideoUrl(frontmatter.videourl || frontmatter.video_url);
          const imageUrl = frontmatter.image_url || null;
          const subtitles = frontmatter.subtitles || frontmatter.subtitle || frontmatter.subtitle_url || frontmatter.sub_url || frontmatter.caption_url || null;
          const overview = (frontmatter.deskripsi || frontmatter.description || '').trim();
          const rating = frontmatter.rating !== undefined && frontmatter.rating !== null ? Number(frontmatter.rating) : null;
          const duration = frontmatter.duration || null;
          const contentHtml = content && content.trim() ? await marked.parse(content) : null;
          const urlPath = `/tv/${matchedDir}/${baseName}`;

          const customEp: CustomEpisode = {
            slug: baseName,
            filename: file,
            seasonNumber: null,
            seasonFolder: null,
            episodeNumber: epNum,
            episodeLabel: epLabel,
            title,
            videoUrl,
            imageUrl,
            overview,
            rating,
            duration,
            subtitles,
            contentHtml,
            rawContent: content,
            urlPath,
          };

          flatEpisodes.push(customEp);
          allEpisodes.push(customEp);
        } catch (err) {
          console.error(`Error parsing flat episode ${file}:`, err);
        }
      }

      seasonsMap.set(null, flatEpisodes);
    }
  } catch (err) {
    console.error(`Error reading TV show directory ${showDirFullPath}:`, err);
  }

  // Format seasons array
  const seasons: CustomSeason[] = [];
  seasonsMap.forEach((eps, seasonNum) => {
    seasons.push({
      seasonNumber: seasonNum,
      seasonName: seasonNum !== null ? `Season ${seasonNum}` : 'Semua Episode',
      seasonFolder: eps[0]?.seasonFolder || null,
      episodes: eps,
    });
  });

  return {
    slug: matchedDir,
    dirName: matchedDir,
    showSlug: matchedDir,
    hasSeasons,
    frontmatter: indexFrontmatter,
    contentHtml: indexContentHtml,
    seasons,
    allEpisodes,
  };
}

/**
 * Fetches TMDB TV Show details and merges with custom markdown TV data and active episode.
 */
export async function getTVShowDetailsWithCustomOverride(
  slugArray: string[]
): Promise<MergedTVShowDetail | null> {
  if (!slugArray || slugArray.length === 0) return null;

  const showSlugOrId = slugArray[0];
  let customTV = await getCustomTVShowBySlug(showSlugOrId);

  let tmdbId: number | null = null;

  if (customTV) {
    tmdbId = Number(customTV.frontmatter.tmdb_id);
    if (!tmdbId || isNaN(tmdbId)) {
      tmdbId = 0;
    }
  } else {
    const str = String(showSlugOrId).trim();
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
          const searchRes = await searchTVShows(cleanSearch);
          if (searchRes.results && searchRes.results.length > 0) {
            const matched = searchYear
              ? searchRes.results.find((s) => s.first_air_date && s.first_air_date.startsWith(searchYear)) || searchRes.results[0]
              : searchRes.results[0];
            tmdbId = matched ? matched.id : null;
          }
        } catch (e) {
          console.warn(`Error searching TMDB for TV slug ${str}:`, e);
        }
      }
    }
  }

  // If customTV wasn't found by slug directly, but tmdbId was resolved,
  // check if there is an existing custom markdown TV show with this tmdb_id!
  if (!customTV && tmdbId && tmdbId > 0) {
    customTV = await getCustomTVShowBySlug(tmdbId);
  }

  if (tmdbId === null || isNaN(tmdbId)) {
    return null;
  }

  // Fetch baseline TMDB details
  const tmdbShow = tmdbId > 0 ? await getTVShowDetails(tmdbId) : null;
  if (!tmdbShow && !customTV) return null;

  if (!customTV) {
    if (!tmdbShow) return null;
    return {
      ...tmdbShow,
      isCustomTV: false,
      hasSeasons: Boolean(tmdbShow.number_of_seasons && tmdbShow.number_of_seasons > 0),
      seasonsList: [],
      allEpisodes: [],
      activeEpisode: null,
    };
  }

  const { frontmatter, contentHtml, seasons, allEpisodes, hasSeasons } = customTV;

  // Overrides from frontmatter
  const overriddenName = frontmatter.title && frontmatter.title.trim() !== ''
    ? frontmatter.title
    : (tmdbShow?.name || customTV.showSlug);

  const overriddenRating = frontmatter.rating !== undefined && frontmatter.rating !== null && frontmatter.rating !== ''
    ? Number(frontmatter.rating)
    : (tmdbShow?.vote_average || 0);

  const overriddenOverview = (frontmatter.deskripsi || frontmatter.description)?.trim() || tmdbShow?.overview || '';
  const overriddenTagline = frontmatter.tagline?.trim() || tmdbShow?.tagline || '';
  const customImageUrl = frontmatter.image_url || frontmatter.poster_path || frontmatter.backdrop_url || null;

  // Determine active episode
  let activeEpisode: CustomEpisode | null = null;

  if (slugArray.length > 1) {
    const episodePathSegments = slugArray.slice(1);
    const joinedEpisodePath = episodePathSegments.join('/').toLowerCase().replace(/\.(md|markdown)$/i, '');

    activeEpisode =
      allEpisodes.find(
        (ep) =>
          ep.slug.toLowerCase() === joinedEpisodePath ||
          ep.slug.toLowerCase().endsWith(joinedEpisodePath) ||
          ep.filename.toLowerCase().replace(/\.(md|markdown)$/i, '') === joinedEpisodePath
      ) || null;
  }

  const overriddenPoster = customImageUrl || tmdbShow?.poster_path || null;
  const overriddenBackdrop = customImageUrl || tmdbShow?.backdrop_path || null;

  return {
    ...(tmdbShow || {}),
    id: tmdbShow?.id || tmdbId || 0,
    name: overriddenName,
    vote_average: overriddenRating,
    vote_count: tmdbShow?.vote_count || 0,
    overview: overriddenOverview,
    tagline: overriddenTagline,
    first_air_date: tmdbShow?.first_air_date || (frontmatter.year ? `${frontmatter.year}-01-01` : '2026-01-01'),
    poster_path: overriddenPoster,
    backdrop_path: overriddenBackdrop,
    genres: tmdbShow?.genres || [],
    number_of_seasons: hasSeasons ? seasons.length : (tmdbShow?.number_of_seasons || 1),
    number_of_episodes: allEpisodes.length > 0 ? allEpisodes.length : (tmdbShow?.number_of_episodes || 0),
    isCustomTV: true,
    customSlug: customTV.showSlug,
    customImageUrl,
    customContentHtml: contentHtml,
    hasSeasons,
    seasonsList: seasons,
          allEpisodes,
    activeEpisode,
  } as any;
}

/**
 * Returns a mapping of tmdb_id -> custom TV show slug (e.g. { 95350: 'lanterns' }).
 */
export function getCustomTVTmdbMapping(): Record<string, string> {
  const dirs = getAllCustomTVShowDirs();
  const mapping: Record<string, string> = {};

  dirs.forEach((dir) => {
    try {
      const fullPath = path.join(TV_CONTENT_DIR, dir);
      const indexPath = fs.existsSync(path.join(fullPath, '_index.md'))
        ? path.join(fullPath, '_index.md')
        : fs.existsSync(path.join(fullPath, 'index.md'))
        ? path.join(fullPath, 'index.md')
        : null;

      if (indexPath) {
        const content = fs.readFileSync(indexPath, 'utf8');
        const { data } = matter(content);
        if (data && data.tmdb_id) {
          mapping[String(data.tmdb_id)] = dir;
        }
      }
    } catch (e) {
      console.error(`Error parsing TV mapping for ${dir}:`, e);
    }
  });

  return mapping;
}

/**
 * Returns all custom markdown TV shows that have `featured: true` in their _index.md.
 */
export async function getAllFeaturedCustomTV(): Promise<FeaturedItem[]> {
  const showSlugs = await getAllCustomTVShowDirsAsync();
  const results = await Promise.all(
    showSlugs.map(async (slug) => {
      try {
        const customData = await getCustomTVShowBySlug(slug);
        if (
          customData &&
          (customData.frontmatter.featured === true ||
            customData.frontmatter.featured === 'true' ||
            customData.frontmatter.featured === '1')
        ) {
          const detail = await getTVShowDetailsWithCustomOverride([slug]);
          if (detail) {
            const firstEp = detail.allEpisodes?.[0];
            const link = firstEp?.urlPath || getTVUrl(detail);
            const customImg =
              detail.customImageUrl ||
              customData.frontmatter.image_url ||
              customData.frontmatter.poster_path ||
              customData.frontmatter.backdrop_url;
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

            return {
              id: `tv-${detail.customSlug || detail.id}`,
              tmdbId: detail.id,
              title: detail.name,
              tagline: detail.tagline || undefined,
              overview: detail.overview,
              backdropUrl: backdrop,
              posterUrl: poster,
              rating: Math.round(detail.vote_average * 10) / 10,
              year: detail.first_air_date ? new Date(detail.first_air_date).getFullYear() : '2025',
              duration: detail.number_of_episodes
                ? `${detail.number_of_episodes} Episodes`
                : detail.episode_run_time?.[0]
                ? `${detail.episode_run_time[0]}m`
                : undefined,
              type: 'tv' as const,
              genres: detail.genres?.map((g) => g.name) || [],
              link,
              badge: 'Featured',
              featured: true,
              isCustom: true,
            } as FeaturedItem;
          }
        }
      } catch (err) {
        console.error(`Error loading featured custom TV for ${slug}:`, err);
      }
      return null;
    })
  );

  return results.filter((item): item is FeaturedItem => item !== null);
}
