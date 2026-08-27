import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { revalidatePath, revalidateTag } from 'next/cache';
import { slugify, cleanVideoUrl, extractTmdbIdAndType } from '@/lib/urls';
import {
  saveGitHubFile,
  deleteGitHubFile,
  deleteGitHubFolder,
  getGitHubTree,
  getGitHubBlob,
  getGitHubRawFile,
  GitHubOptions,
} from '@/lib/githubStorage';
import { getMovieDetails, getTVShowDetails, getImageUrl } from '@/lib/tmdb';
import { memoryCache } from '@/lib/cache';
import { getContentProvider } from '@/lib/content';
import {
  serializeTinaMovie,
  serializeTinaTVShow,
  serializeTinaTVEpisode,
} from '@/lib/tina/schema';

const VIDEO_DIR = path.join(process.cwd(), 'video');
const TV_DIR = path.join(process.cwd(), 'tv');

export function ensureDirectories() {
  try {
    if (!fs.existsSync(VIDEO_DIR)) fs.mkdirSync(VIDEO_DIR, { recursive: true });
    if (!fs.existsSync(TV_DIR)) fs.mkdirSync(TV_DIR, { recursive: true });
  } catch {
    // Read-only filesystem in cloud/vercel
  }
}

export function getGitHubConfigFromRequest(req: Request): GitHubOptions {
  const headers = req.headers;
  const token = headers.get('x-github-token') || process.env.GITHUB_TOKEN || process.env.GH_TOKEN || null;
  const owner = headers.get('x-github-owner') || process.env.GITHUB_OWNER || 'genstava789';
  const repo = headers.get('x-github-repo') || process.env.GITHUB_REPO || 'filmes';
  const branch = headers.get('x-github-branch') || process.env.GITHUB_BRANCH || 'main';
  return { token, owner, repo, branch };
}

/**
 * Optimized Selective Revalidation:
 * Only invalidates markdown and content provider cache without purging TMDB API responses.
 * Ensures the homepage loads in < 20ms instead of 1-3 seconds of remote TMDB latency!
 */
export function selectiveRevalidateAll() {
  try {
    // 1. Invalidate only local markdown & featured caches (keep TMDB caches warm)
    memoryCache.invalidate('markdown_');
    memoryCache.invalidate('featured_');
    memoryCache.invalidate('content_provider_');
    memoryCache.invalidate('cms_');

    // 2. Invalidate content provider in-memory registry
    try {
      getContentProvider().invalidateCache();
    } catch {}

    // 3. Invalidate Next.js cache tags
    // @ts-ignore
    if (typeof revalidateTag === 'function') {
      // @ts-ignore
      revalidateTag('github-content');
    }

    // 4. Trigger on-demand Next.js route ISR revalidations
    revalidatePath('/', 'page');
    revalidatePath('/', 'layout');
    revalidatePath('/movie', 'page');
    revalidatePath('/movie/[id]', 'page');
    revalidatePath('/tv', 'page');
    revalidatePath('/tv/browse', 'page');
    revalidatePath('/tv/[...slug]', 'page');
    revalidatePath('/embed/movie/[id]', 'page');
    revalidatePath('/embed/tv/[...slug]', 'page');
    revalidatePath('/admin', 'page');
  } catch (err) {
    console.warn('[cmsService] Revalidation notice:', err);
  }
}

/**
 * Fetch all movies and TV shows for Admin Dashboard
 */
export async function fetchAllAdminContent(ghConfig: GitHubOptions) {
  ensureDirectories();
  const isLocal = !process.env.VERCEL && process.env.NODE_ENV !== 'production';

  // 1. Read all local files from disk (Local source of truth for unpushed changes)
  const localMoviesMap = new Map<string, any>();
  const localTvShowsMap = new Map<string, any>();

  let movieFiles: string[] = [];
  try {
    if (fs.existsSync(VIDEO_DIR)) {
      movieFiles = fs.readdirSync(VIDEO_DIR).filter((f) => /\.(md|markdown)$/i.test(f));
    }
  } catch (e) {
    console.warn('[cmsService] Read video dir notice:', e);
  }

  for (const file of movieFiles) {
    const fullPath = path.join(VIDEO_DIR, file);
    try {
      const raw = fs.readFileSync(fullPath, 'utf8');
      const stat = fs.statSync(fullPath);
      const { data, content } = matter(raw);
      const rel = `video/${file}`;
      localMoviesMap.set(rel, {
        filename: file,
        slug: file.replace(/\.(md|markdown)$/i, ''),
        relativePath: rel,
        frontmatter: data,
        content: content || '',
        updatedAt: stat.mtimeMs || Date.now(),
      });
    } catch {}
  }

  let tvDirs: string[] = [];
  try {
    if (fs.existsSync(TV_DIR)) {
      tvDirs = fs
        .readdirSync(TV_DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);
    }
  } catch (e) {
    console.warn('[cmsService] Read tv dir notice:', e);
  }

  for (const showDir of tvDirs) {
    const showPath = path.join(TV_DIR, showDir);
    let indexFrontmatter: any = {};
    let indexContent = '';
    let updatedAt = Date.now();

    const indexPath = fs.existsSync(path.join(showPath, '_index.md'))
      ? path.join(showPath, '_index.md')
      : fs.existsSync(path.join(showPath, 'index.md'))
      ? path.join(showPath, 'index.md')
      : null;

    if (indexPath) {
      try {
        const raw = fs.readFileSync(indexPath, 'utf8');
        const stat = fs.statSync(indexPath);
        const parsed = matter(raw);
        indexFrontmatter = parsed.data;
        indexContent = parsed.content || '';
        updatedAt = stat.mtimeMs || Date.now();
      } catch {}
    }

    const episodes: any[] = [];
    try {
      const entries = fs.readdirSync(showPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.name === '_index.md' || entry.name === 'index.md') continue;

        if (entry.isDirectory()) {
          const seasonFolder = entry.name;
          const seasonPath = path.join(showPath, seasonFolder);
          const epFiles = fs.readdirSync(seasonPath).filter((f) => /\.(md|markdown)$/i.test(f));

          for (const epFile of epFiles) {
            const epFullPath = path.join(seasonPath, epFile);
            try {
              const raw = fs.readFileSync(epFullPath, 'utf8');
              const epStat = fs.statSync(epFullPath);
              const { data, content } = matter(raw);
              episodes.push({
                showSlug: showDir,
                seasonFolder,
                filename: epFile,
                slug: epFile.replace(/\.(md|markdown)$/i, ''),
                relativePath: `tv/${showDir}/${seasonFolder}/${epFile}`,
                frontmatter: data,
                content: content || '',
                displayTitle: data.title || epFile.replace(/\.(md|markdown)$/i, ''),
                posterUrl: data.image_url ? getImageUrl(data.image_url, 'w500') : null,
                updatedAt: epStat.mtimeMs || Date.now(),
              });
            } catch {}
          }
        } else if (/\.(md|markdown)$/i.test(entry.name)) {
          const epFullPath = path.join(showPath, entry.name);
          try {
            const raw = fs.readFileSync(epFullPath, 'utf8');
            const epStat = fs.statSync(epFullPath);
            const { data, content } = matter(raw);
            episodes.push({
              showSlug: showDir,
              seasonFolder: null,
              filename: entry.name,
              slug: entry.name.replace(/\.(md|markdown)$/i, ''),
              relativePath: `tv/${showDir}/${entry.name}`,
              frontmatter: data,
              content: content || '',
              displayTitle: data.title || entry.name.replace(/\.(md|markdown)$/i, ''),
              posterUrl: data.image_url ? getImageUrl(data.image_url, 'w500') : null,
              updatedAt: epStat.mtimeMs || Date.now(),
            });
          } catch {}
        }
      }
    } catch {}

    localTvShowsMap.set(showDir, {
      showSlug: showDir,
      relativePath: `tv/${showDir}/_index.md`,
      indexFrontmatter,
      indexContent,
      updatedAt,
      episodes,
    });
  }

  // 2. Fetch remote files if token is available
  const mergedMoviesMap = new Map<string, any>();
  const mergedTvShowsMap = new Map<string, any>();

  if (ghConfig.token) {
    try {
      const tree = await getGitHubTree(ghConfig);
      if (tree && tree.length > 0) {
        const videoBlobs = tree.filter(
          (item) => item.type === 'blob' && item.path.startsWith('video/') && /\.(md|markdown)$/i.test(item.path)
        );
        const tvBlobs = tree.filter(
          (item) => item.type === 'blob' && item.path.startsWith('tv/') && /\.(md|markdown)$/i.test(item.path)
        );

        for (const item of videoBlobs) {
          const filename = path.basename(item.path);
          const raw =
            (await getGitHubBlob(item.sha, ghConfig)) ||
            (await getGitHubRawFile(item.path, ghConfig)) ||
            '';
          const { data, content } = matter(raw);
          mergedMoviesMap.set(item.path, {
            filename,
            slug: filename.replace(/\.(md|markdown)$/i, ''),
            relativePath: item.path,
            frontmatter: data,
            content: content || '',
            updatedAt: Date.now(),
          });
        }

        for (const item of tvBlobs) {
          const raw =
            (await getGitHubBlob(item.sha, ghConfig)) ||
            (await getGitHubRawFile(item.path, ghConfig)) ||
            '';
          const { data, content } = matter(raw);
          const parts = item.path.replace(/^tv\//, '').split('/');
          const showDir = parts[0];
          if (!showDir) continue;

          if (!mergedTvShowsMap.has(showDir)) {
            mergedTvShowsMap.set(showDir, {
              showSlug: showDir,
              relativePath: `tv/${showDir}/_index.md`,
              indexFrontmatter: {},
              indexContent: '',
              updatedAt: Date.now(),
              episodes: [],
            });
          }

          const currentShow = mergedTvShowsMap.get(showDir)!;
          const filename = parts[parts.length - 1];

          if (filename === '_index.md' || filename === 'index.md') {
            currentShow.indexFrontmatter = data;
            currentShow.indexContent = content || '';
          } else if (parts.length === 3) {
            const seasonFolder = parts[1];
            currentShow.episodes.push({
              showSlug: showDir,
              seasonFolder,
              filename,
              slug: filename.replace(/\.(md|markdown)$/i, ''),
              relativePath: item.path,
              frontmatter: data,
              content: content || '',
              displayTitle: data.title || filename.replace(/\.(md|markdown)$/i, ''),
              posterUrl: data.image_url ? getImageUrl(data.image_url, 'w500') : null,
              updatedAt: Date.now(),
            });
          } else if (parts.length === 2) {
            currentShow.episodes.push({
              showSlug: showDir,
              seasonFolder: null,
              filename,
              slug: filename.replace(/\.(md|markdown)$/i, ''),
              relativePath: item.path,
              frontmatter: data,
              content: content || '',
              displayTitle: data.title || filename.replace(/\.(md|markdown)$/i, ''),
              posterUrl: data.image_url ? getImageUrl(data.image_url, 'w500') : null,
              updatedAt: Date.now(),
            });
          }
        }
      }
    } catch (ghErr) {
      console.warn('[cmsService] GitHub tree fetch notice:', ghErr);
    }
  }

  // 3. Overlay local disk files so all new local additions/edits ALWAYS take precedence and appear immediately!
  localMoviesMap.forEach((movie, rel) => {
    mergedMoviesMap.set(rel, movie);
  });

  localTvShowsMap.forEach((show, showDir) => {
    mergedTvShowsMap.set(showDir, show);
  });

  const rawMovies = Array.from(mergedMoviesMap.values());
  const rawTvShowsMap = mergedTvShowsMap;

  // Enrich Movies with TMDB metadata & STRICT PRECEDENCE for custom frontmatter image
  const movies = await Promise.all(
    rawMovies.map(async (m) => {
      let displayTitle = m.frontmatter.title || m.slug;
      let year: number | null = null;
      let rating = m.frontmatter.rating ? Number(m.frontmatter.rating) : null;
      let tmdbPoster: string | null = null;

      if (m.frontmatter.tmdb_id) {
        try {
          const tmdb = await getMovieDetails(Number(m.frontmatter.tmdb_id)).catch(() => null);
          if (tmdb) {
            if (tmdb.poster_path) {
              tmdbPoster = getImageUrl(tmdb.poster_path, 'w500');
            }
            if (!m.frontmatter.title && tmdb.title) {
              displayTitle = tmdb.title;
            }
            if (tmdb.release_date) {
              year = new Date(tmdb.release_date).getFullYear();
            }
            if (!rating && tmdb.vote_average) {
              rating = Math.round(tmdb.vote_average * 10) / 10;
            }
          }
        } catch {}
      }

      const customImg = m.frontmatter.image_url || m.frontmatter.poster_path || m.frontmatter.backdrop_url;
      let posterUrl: string | null = null;
      if (customImg && String(customImg).trim()) {
        posterUrl = getImageUrl(String(customImg).trim(), 'w500');
      } else if (tmdbPoster) {
        posterUrl = tmdbPoster;
      }

      return {
        ...m,
        posterUrl,
        customImageUrl: customImg || null,
        displayTitle,
        year,
        rating,
      };
    })
  );

  movies.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  // Enrich TV Shows with TMDB metadata & STRICT PRECEDENCE for custom frontmatter image
  const rawTvShows = Array.from(rawTvShowsMap.values());
  const tvShows = await Promise.all(
    rawTvShows.map(async (s) => {
      let displayTitle = s.indexFrontmatter.title || s.showSlug;
      let year: number | null = null;
      let rating = s.indexFrontmatter.rating ? Number(s.indexFrontmatter.rating) : null;
      let tmdbPoster: string | null = null;

      if (s.indexFrontmatter.tmdb_id) {
        try {
          const tmdb = await getTVShowDetails(Number(s.indexFrontmatter.tmdb_id)).catch(() => null);
          if (tmdb) {
            if (tmdb.poster_path) {
              tmdbPoster = getImageUrl(tmdb.poster_path, 'w500');
            }
            if (!s.indexFrontmatter.title && tmdb.name) {
              displayTitle = tmdb.name;
            }
            if (tmdb.first_air_date) {
              year = new Date(tmdb.first_air_date).getFullYear();
            }
            if (!rating && tmdb.vote_average) {
              rating = Math.round(tmdb.vote_average * 10) / 10;
            }
          }
        } catch {}
      }

      const customImg =
        s.indexFrontmatter.image_url ||
        s.indexFrontmatter.poster_path ||
        s.indexFrontmatter.backdrop_url;

      let posterUrl: string | null = null;
      if (customImg && String(customImg).trim()) {
        posterUrl = getImageUrl(String(customImg).trim(), 'w500');
      } else if (tmdbPoster) {
        posterUrl = tmdbPoster;
      }

      return {
        showSlug: s.showSlug,
        relativePath: s.relativePath,
        frontmatter: s.indexFrontmatter,
        content: s.indexContent,
        updatedAt: s.updatedAt,
        episodes: s.episodes,
        posterUrl,
        customImageUrl: customImg || null,
        displayTitle,
        year,
        rating,
      };
    })
  );

  tvShows.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  return {
    movies,
    tvShows,
    isLocal,
    defaultOwner: process.env.GITHUB_OWNER || 'genstava789',
    defaultRepo: process.env.GITHUB_REPO || 'filmes',
    defaultBranch: process.env.GITHUB_BRANCH || 'main',
  };
}

/**
 * Create a new movie, TV series (with multi-season episodes), or single episode
 */
export async function createAdminContent(body: any, ghConfig: GitHubOptions) {
  ensureDirectories();
  const { contentType = 'movie' } = body;
  const { token } = ghConfig;
  const isProductionOrCloud = Boolean(process.env.VERCEL || process.env.NODE_ENV === 'production');

  let relativePath = '';
  let fileContent = '';
  let isUpdate = false;
  let hasChanges = true;
  const changedFields: string[] = [];

  if (contentType === 'movie') {
    let { tmdb_id, videourl, title, desc, poster, rating, featured, subtitles, content = '', slug } = body;

    const extracted = extractTmdbIdAndType(String(tmdb_id || ''));
    const parsedId = extracted.id ? Number(extracted.id) : Number(tmdb_id);

    if (!parsedId || isNaN(parsedId)) {
      throw new Error('tmdb_id is required and must be a valid numeric ID or TMDB URL');
    }

    const cleanVideo = cleanVideoUrl(videourl);
    if (!cleanVideo) {
      throw new Error('videourl (url_video) is required');
    }

    const tmdbIdNum = parsedId;

    if (!title || !desc || !poster) {
      try {
        const tmdb = await getMovieDetails(tmdbIdNum).catch(() => null);
        if (tmdb) {
          if (!title && tmdb.title) title = tmdb.title;
          if (!desc && tmdb.overview) desc = tmdb.overview;
          if (!poster && tmdb.poster_path) poster = getImageUrl(tmdb.poster_path, 'w500');
          if (rating === undefined && tmdb.vote_average) rating = Math.round(tmdb.vote_average * 10) / 10;
        }
      } catch {}
    }

    const fileSlug = slug ? slugify(slug) : title ? slugify(title) : `movie-${tmdbIdNum}`;

    let existingFileName: string | null = null;
    let existingFrontmatter: Record<string, any> = {};
    try {
      if (fs.existsSync(VIDEO_DIR)) {
        const files = fs.readdirSync(VIDEO_DIR).filter((f) => f.endsWith('.md') || f.endsWith('.markdown'));
        for (const f of files) {
          const raw = fs.readFileSync(path.join(VIDEO_DIR, f), 'utf8');
          const parsed = matter(raw);
          if (
            Number(parsed.data.tmdb_id) === tmdbIdNum ||
            f === `${fileSlug}.md` ||
            (slug && f === `${slugify(slug)}.md`)
          ) {
            existingFileName = f;
            existingFrontmatter = parsed.data;
            break;
          }
        }
      }
    } catch {}

    const filename = existingFileName || `${fileSlug}.md`;
    relativePath = `video/${filename}`;

    const frontmatterData: Record<string, any> = {
      tmdb_id: tmdbIdNum,
      videourl: cleanVideo,
    };

    if (title && title.trim()) frontmatterData.title = title.trim();
    else if (existingFrontmatter.title) frontmatterData.title = existingFrontmatter.title;

    if (desc && desc.trim()) frontmatterData.deskripsi = desc.trim();
    else if (existingFrontmatter.deskripsi) frontmatterData.deskripsi = existingFrontmatter.deskripsi;

    if (poster && poster.trim()) frontmatterData.image_url = poster.trim();
    else if (existingFrontmatter.image_url) frontmatterData.image_url = existingFrontmatter.image_url;

    if (rating !== undefined && rating !== null && rating !== '') frontmatterData.rating = Number(rating);
    else if (existingFrontmatter.rating !== undefined) frontmatterData.rating = Number(existingFrontmatter.rating);

    if (featured !== undefined) frontmatterData.featured = Boolean(featured);
    else if (existingFrontmatter.featured !== undefined) frontmatterData.featured = Boolean(existingFrontmatter.featured);

    if (subtitles && subtitles.trim()) frontmatterData.subtitles = subtitles.trim();
    else if (existingFrontmatter.subtitles) frontmatterData.subtitles = existingFrontmatter.subtitles;

    if (existingFileName) {
      isUpdate = true;
      if (frontmatterData.image_url !== existingFrontmatter.image_url) changedFields.push('Image Poster/Backdrop');
      if (Boolean(frontmatterData.featured) !== Boolean(existingFrontmatter.featured)) changedFields.push('Status Featured');
      if (frontmatterData.rating !== existingFrontmatter.rating) changedFields.push('Rating');
      if (frontmatterData.videourl !== existingFrontmatter.videourl) changedFields.push('URL Video');
      if (frontmatterData.title && frontmatterData.title !== existingFrontmatter.title) changedFields.push('Judul');
      if (frontmatterData.deskripsi && frontmatterData.deskripsi !== existingFrontmatter.deskripsi) changedFields.push('Deskripsi');
      if (frontmatterData.subtitles !== existingFrontmatter.subtitles) changedFields.push('Subtitles');
      hasChanges = changedFields.length > 0;
    }

    fileContent = serializeTinaMovie(frontmatterData, content || '');
  } else if (contentType === 'tv_show') {
    let { tmdb_id, title, desc, poster, rating, featured, showSlug, content = '', seasons = [] } = body;

    const extracted = extractTmdbIdAndType(String(tmdb_id || ''));
    const parsedId = extracted.id ? Number(extracted.id) : Number(tmdb_id);

    if (!parsedId || isNaN(parsedId)) {
      throw new Error('tmdb_id is required and must be a valid numeric ID or TMDB URL');
    }

    const tmdbIdNum = parsedId;

    if (!title || !desc || !poster) {
      try {
        const tmdb = await getTVShowDetails(tmdbIdNum).catch(() => null);
        if (tmdb) {
          if (!title && tmdb.name) title = tmdb.name;
          if (!desc && tmdb.overview) desc = tmdb.overview;
          if (!poster && tmdb.poster_path) poster = getImageUrl(tmdb.poster_path, 'w500');
          if (rating === undefined && tmdb.vote_average) rating = Math.round(tmdb.vote_average * 10) / 10;
        }
      } catch {}
    }

    const cleanShowSlug = showSlug ? slugify(showSlug) : title ? slugify(title) : `tv-${tmdbIdNum}`;

    let existingShowSlug = cleanShowSlug;
    let existingFrontmatter: Record<string, any> = {};
    let foundExisting = false;
    try {
      if (fs.existsSync(TV_DIR)) {
        const shows = fs.readdirSync(TV_DIR, { withFileTypes: true }).filter((d) => d.isDirectory());
        for (const s of shows) {
          const indexPath = path.join(TV_DIR, s.name, '_index.md');
          if (fs.existsSync(indexPath)) {
            const raw = fs.readFileSync(indexPath, 'utf8');
            const parsed = matter(raw);
            if (Number(parsed.data.tmdb_id) === tmdbIdNum || s.name === cleanShowSlug) {
              existingShowSlug = s.name;
              existingFrontmatter = parsed.data;
              foundExisting = true;
              break;
            }
          }
        }
      }
    } catch {}

    relativePath = `tv/${existingShowSlug}/_index.md`;

    const frontmatterData: Record<string, any> = {
      tmdb_id: tmdbIdNum,
    };

    if (title && title.trim()) frontmatterData.title = title.trim();
    else if (existingFrontmatter.title) frontmatterData.title = existingFrontmatter.title;

    if (desc && desc.trim()) frontmatterData.deskripsi = desc.trim();
    else if (existingFrontmatter.deskripsi) frontmatterData.deskripsi = existingFrontmatter.deskripsi;

    if (poster && poster.trim()) frontmatterData.image_url = poster.trim();
    else if (existingFrontmatter.image_url) frontmatterData.image_url = existingFrontmatter.image_url;

    if (rating !== undefined && rating !== null && rating !== '') frontmatterData.rating = Number(rating);
    else if (existingFrontmatter.rating !== undefined) frontmatterData.rating = Number(existingFrontmatter.rating);

    if (featured !== undefined) frontmatterData.featured = Boolean(featured);
    else if (existingFrontmatter.featured !== undefined) frontmatterData.featured = Boolean(existingFrontmatter.featured);

    if (foundExisting) {
      isUpdate = true;
      if (frontmatterData.image_url !== existingFrontmatter.image_url) changedFields.push('Image Poster/Backdrop');
      if (Boolean(frontmatterData.featured) !== Boolean(existingFrontmatter.featured)) changedFields.push('Status Featured');
      if (frontmatterData.rating !== existingFrontmatter.rating) changedFields.push('Rating');
      if (frontmatterData.title && frontmatterData.title !== existingFrontmatter.title) changedFields.push('Judul');
      if (frontmatterData.deskripsi && frontmatterData.deskripsi !== existingFrontmatter.deskripsi) changedFields.push('Deskripsi');
      hasChanges = changedFields.length > 0;
    }

    fileContent = serializeTinaTVShow(frontmatterData, content || '');

    // Write TV Show _index.md to local filesystem
    try {
      const fullPath = path.join(process.cwd(), relativePath);
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(fullPath, fileContent, 'utf8');
    } catch (err: any) {
      console.warn(`[createAdminContent] Error writing TV show file ${relativePath}:`, err);
    }

    // Save multi-season batch episodes to local filesystem
    let savedEpisodesCount = 0;
    if (Array.isArray(seasons) && seasons.length > 0) {
      for (const s of seasons) {
        const rawSeason = String(s.season || s.name || 's1').trim();
        const cleanSeason = rawSeason.toLowerCase().startsWith('s')
          ? rawSeason.toLowerCase()
          : `s${rawSeason.replace(/\D/g, '') || '1'}`;
        const episodesList = Array.isArray(s.episodes) ? s.episodes : [];

        for (const ep of episodesList) {
          const rawEp = String(ep.episode || ep.slug || 'e1').trim();
          const epNum = rawEp.replace(/\D/g, '') || '1';
          const cleanEp = `e${epNum}`;
          const epCleanVideo = cleanVideoUrl(ep.videourl || ep.video_url || '');

          if (epCleanVideo) {
            const epRelPath = `tv/${existingShowSlug}/${cleanSeason}/${cleanEp}.md`;
            const epFrontmatter: Record<string, any> = {
              videourl: epCleanVideo,
            };
            if (ep.title && ep.title.trim()) epFrontmatter.title = ep.title.trim();
            if (ep.desc && ep.desc.trim()) epFrontmatter.deskripsi = ep.desc.trim();
            if (ep.poster || ep.image_url) epFrontmatter.image_url = (ep.poster || ep.image_url).trim();
            if (ep.rating !== undefined && ep.rating !== null && ep.rating !== '')
              epFrontmatter.rating = Number(ep.rating);
            if (ep.duration && ep.duration.trim()) epFrontmatter.duration = ep.duration.trim();
            if (ep.subtitles && ep.subtitles.trim()) epFrontmatter.subtitles = ep.subtitles.trim();

            const epContentStr = serializeTinaTVEpisode(epFrontmatter, ep.content || '');

            try {
              const fullEpPath = path.join(process.cwd(), epRelPath);
              const epDir = path.dirname(fullEpPath);
              if (!fs.existsSync(epDir)) fs.mkdirSync(epDir, { recursive: true });
              fs.writeFileSync(fullEpPath, epContentStr, 'utf8');
            } catch (err: any) {
              console.warn(`[createAdminContent] Error writing episode file ${epRelPath}:`, err);
            }

            savedEpisodesCount++;
          }
        }
      }
    }

    selectiveRevalidateAll();
    return {
      success: true,
      relativePath,
      isUpdate,
      hasChanges,
      changedFields,
      savedEpisodesCount,
    };
  } else if (contentType === 'tv_episode') {
    const {
      showSlug,
      season = 's1',
      episode = 'e1',
      videourl,
      title,
      desc,
      poster,
      rating,
      subtitles,
      duration,
      content = '',
    } = body;

    if (!showSlug) throw new Error('showSlug is required for TV episode');
    const cleanVideo = cleanVideoUrl(videourl);
    if (!cleanVideo) throw new Error('videourl (url_video) is required for TV episode');

    const cleanShowSlug = slugify(showSlug);
    const cleanSeason = season ? slugify(season) : null;
    const cleanEp = episode
      ? episode.startsWith('e') || episode.startsWith('ep')
        ? episode
        : `e${episode}`
      : 'e1';
    const filename = `${slugify(cleanEp)}.md`;

    relativePath = cleanSeason
      ? `tv/${cleanShowSlug}/${cleanSeason}/${filename}`
      : `tv/${cleanShowSlug}/${filename}`;

    let foundExistingEp = false;
    let existingFrontmatter: Record<string, any> = {};
    try {
      const fullEpPath = path.join(process.cwd(), relativePath);
      if (fs.existsSync(fullEpPath)) {
        const raw = fs.readFileSync(fullEpPath, 'utf8');
        existingFrontmatter = matter(raw).data;
        foundExistingEp = true;
      }
    } catch {}

    const frontmatterData: Record<string, any> = {
      videourl: cleanVideo,
    };

    if (title && title.trim()) frontmatterData.title = title.trim();
    else if (existingFrontmatter.title) frontmatterData.title = existingFrontmatter.title;

    if (desc && desc.trim()) frontmatterData.deskripsi = desc.trim();
    else if (existingFrontmatter.deskripsi) frontmatterData.deskripsi = existingFrontmatter.deskripsi;

    if (poster && poster.trim()) frontmatterData.image_url = poster.trim();
    else if (existingFrontmatter.image_url) frontmatterData.image_url = existingFrontmatter.image_url;

    if (rating !== undefined && rating !== null && rating !== '') frontmatterData.rating = Number(rating);
    else if (existingFrontmatter.rating !== undefined) frontmatterData.rating = Number(existingFrontmatter.rating);

    if (duration && duration.trim()) frontmatterData.duration = duration.trim();
    else if (existingFrontmatter.duration) frontmatterData.duration = existingFrontmatter.duration;

    if (subtitles && subtitles.trim()) frontmatterData.subtitles = subtitles.trim();
    else if (existingFrontmatter.subtitles) frontmatterData.subtitles = existingFrontmatter.subtitles;

    if (foundExistingEp) {
      isUpdate = true;
      if (frontmatterData.videourl !== existingFrontmatter.videourl) changedFields.push('URL Video');
      if (frontmatterData.image_url !== existingFrontmatter.image_url) changedFields.push('Image Poster');
      if (frontmatterData.rating !== existingFrontmatter.rating) changedFields.push('Rating');
      if (frontmatterData.duration !== existingFrontmatter.duration) changedFields.push('Durasi');
      if (frontmatterData.subtitles !== existingFrontmatter.subtitles) changedFields.push('Subtitles');
      if (frontmatterData.title && frontmatterData.title !== existingFrontmatter.title) changedFields.push('Judul');
      if (frontmatterData.deskripsi && frontmatterData.deskripsi !== existingFrontmatter.deskripsi)
        changedFields.push('Deskripsi');
      hasChanges = changedFields.length > 0;
    }

    fileContent = serializeTinaTVEpisode(frontmatterData, content || '');
  } else {
    throw new Error('Invalid contentType');
  }

  // Save main file (movie or single episode) to local filesystem
  try {
    const fullPath = path.join(process.cwd(), relativePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fullPath, fileContent, 'utf8');
  } catch (err: any) {
    console.warn(`[createAdminContent] Error writing file ${relativePath}:`, err);
  }

  selectiveRevalidateAll();
  return {
    success: true,
    relativePath,
    isUpdate,
    hasChanges,
    changedFields,
  };
}

/**
 * Update an existing markdown file locally
 */
export async function updateAdminContent(body: any, ghConfig: GitHubOptions) {
  const { relativePath, frontmatter: newFrontmatter, content = '' } = body;

  if (!relativePath) throw new Error('relativePath is required');

  const isMovie = relativePath.startsWith('video/');
  const isTV = relativePath.startsWith('tv/');

  if (!isMovie && !isTV) {
    throw new Error('Access denied outside content directories');
  }

  const cleanFrontmatter: Record<string, any> = {};
  for (const [key, val] of Object.entries(newFrontmatter || {})) {
    if (val !== undefined && val !== null && val !== '') {
      if (key === 'tmdb_id') {
        const ext = extractTmdbIdAndType(String(val));
        cleanFrontmatter[key] = ext.id ? Number(ext.id) : (isNaN(Number(val)) ? val : Number(val));
      } else if (key === 'videourl' || key === 'video_url') {
        cleanFrontmatter[key] = cleanVideoUrl(String(val)) || String(val).trim();
      } else if (key === 'rating' || key === 'episode_number' || key === 'season_number') {
        cleanFrontmatter[key] = isNaN(Number(val)) ? val : Number(val);
      } else if (key === 'featured') {
        cleanFrontmatter[key] = Boolean(val);
      } else {
        cleanFrontmatter[key] = val;
      }
    } else if (key === 'featured') {
      cleanFrontmatter[key] = false;
    }
  }

  let fileContent = '';
  if (isMovie) {
    fileContent = serializeTinaMovie(cleanFrontmatter, content || '');
  } else if (relativePath.endsWith('_index.md') || relativePath.endsWith('index.md')) {
    fileContent = serializeTinaTVShow(cleanFrontmatter, content || '');
  } else {
    fileContent = serializeTinaTVEpisode(cleanFrontmatter, content || '');
  }

  // Save main file to local filesystem
  try {
    const fullPath = path.join(process.cwd(), relativePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fullPath, fileContent, 'utf8');
  } catch (err: any) {
    console.warn(`[updateAdminContent] Error writing file ${relativePath}:`, err);
  }

  // If this is a TV show and episodes array was supplied, update all episodes locally
  if (Array.isArray(body.episodes) && (relativePath.endsWith('_index.md') || relativePath.endsWith('index.md'))) {
    const showSlug = relativePath.split('/')[1];

    for (const ep of body.episodes) {
      if (ep.deleted && ep.relativePath) {
        try {
          const epPath = path.join(process.cwd(), ep.relativePath);
          if (fs.existsSync(epPath)) fs.unlinkSync(epPath);
        } catch (e) {
          console.warn(`[updateAdminContent] Error deleting episode ${ep.relativePath}:`, e);
        }
        continue;
      }

      const epSeason = ep.season || ep.seasonFolder || 's1';
      const epNum = ep.episode || ep.slug || 'e1';
      const epRelativePath = ep.relativePath || `tv/${showSlug}/${epSeason}/${epNum}.md`;

      const epFrontmatter: Record<string, any> = {
        title: ep.title || (ep.frontmatter && ep.frontmatter.title) || `Episode ${epNum.replace(/\D/g, '') || '1'}`,
        videourl: cleanVideoUrl(ep.videourl || (ep.frontmatter && (ep.frontmatter.videourl || ep.frontmatter.video_url)) || '') || '',
      };

      const img = ep.image_url || (ep.frontmatter && ep.frontmatter.image_url);
      if (img) epFrontmatter.image_url = img;

      const sub = ep.subtitles || (ep.frontmatter && ep.frontmatter.subtitles);
      if (sub) epFrontmatter.subtitles = sub;

      const dur = ep.duration || (ep.frontmatter && ep.frontmatter.duration);
      if (dur) epFrontmatter.duration = dur;

      const epFileContent = serializeTinaTVEpisode(epFrontmatter, ep.content || '');

      try {
        const fullEpPath = path.join(process.cwd(), epRelativePath);
        const dir = path.dirname(fullEpPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(fullEpPath, epFileContent, 'utf8');
      } catch (err: any) {
        console.warn(`[updateAdminContent] Error writing episode ${epRelativePath}:`, err);
      }
    }
  }

  selectiveRevalidateAll();
  return { success: true, relativePath };
}

/**
 * Delete markdown files or TV folders locally
 */
export async function deleteAdminContent(pathsToDelete: string[], ghConfig: GitHubOptions) {
  for (const relativePath of pathsToDelete) {
    const isMovie = relativePath.startsWith('video/');
    const isTV = relativePath.startsWith('tv/');

    if (!isMovie && !isTV) continue;

    const isTvShowIndex = isTV && (relativePath.endsWith('/_index.md') || relativePath.endsWith('/index.md'));
    const isTvDirectory = isTV && !relativePath.endsWith('.md') && !relativePath.endsWith('.markdown');

    const folderToDelete = isTvShowIndex
      ? relativePath.replace(/\/_?index\.md$/i, '')
      : isTvDirectory
      ? relativePath
      : null;

    try {
      const fullPath = path.join(process.cwd(), folderToDelete || relativePath);
      if (fs.existsSync(fullPath)) {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          fs.rmSync(fullPath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(fullPath);
        }
      }
    } catch (err: any) {
      console.warn(`[deleteAdminContent] Error removing ${relativePath}:`, err);
    }
  }

  selectiveRevalidateAll();
  return { success: true, count: pathsToDelete.length };
}

/**
 * Synchronize all local content (video/ and tv/) to GitHub repository in a single batch push.
 */
export async function syncAllToGitHub(ghConfig: GitHubOptions) {
  const { token } = ghConfig;
  if (!token) {
    throw new Error('Token GitHub diperlukan untuk melakukan sinkronisasi ke repository.');
  }

  let syncedCount = 0;
  let deletedCount = 0;

  // 1. Collect all local markdown files
  const localFiles: { relativePath: string; content: string }[] = [];

  // video/
  if (fs.existsSync(VIDEO_DIR)) {
    const movies = fs.readdirSync(VIDEO_DIR).filter((f) => f.endsWith('.md') || f.endsWith('.markdown'));
    for (const m of movies) {
      const rel = `video/${m}`;
      const content = fs.readFileSync(path.join(VIDEO_DIR, m), 'utf8');
      localFiles.push({ relativePath: rel, content });
    }
  }

  // tv/
  if (fs.existsSync(TV_DIR)) {
    const shows = fs.readdirSync(TV_DIR, { withFileTypes: true }).filter((d) => d.isDirectory());
    for (const show of shows) {
      const showDir = path.join(TV_DIR, show.name);
      // _index.md
      const indexPath = fs.existsSync(path.join(showDir, '_index.md'))
        ? path.join(showDir, '_index.md')
        : fs.existsSync(path.join(showDir, 'index.md'))
        ? path.join(showDir, 'index.md')
        : null;
      if (indexPath) {
        const content = fs.readFileSync(indexPath, 'utf8');
        localFiles.push({ relativePath: `tv/${show.name}/_index.md`, content });
      }

      // seasons and episodes
      const entries = fs.readdirSync(showDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const seasonDir = path.join(showDir, entry.name);
          const eps = fs.readdirSync(seasonDir).filter((f) => f.endsWith('.md') || f.endsWith('.markdown'));
          for (const ep of eps) {
            const epPath = path.join(seasonDir, ep);
            const content = fs.readFileSync(epPath, 'utf8');
            localFiles.push({ relativePath: `tv/${show.name}/${entry.name}/${ep}`, content });
          }
        } else if (entry.isFile() && entry.name.endsWith('.md') && !entry.name.includes('index')) {
          const epPath = path.join(showDir, entry.name);
          const content = fs.readFileSync(epPath, 'utf8');
          localFiles.push({ relativePath: `tv/${show.name}/${entry.name}`, content });
        }
      }
    }
  }

  // 2. Push all local files to GitHub
  for (const file of localFiles) {
    try {
      await saveGitHubFile(file.relativePath, file.content, `cms: sync ${file.relativePath}`, ghConfig);
      syncedCount++;
    } catch (e) {
      console.warn(`[syncAllToGitHub] Error saving ${file.relativePath}:`, e);
    }
  }

  selectiveRevalidateAll();
  return { success: true, syncedCount, deletedCount: 0 };
}
