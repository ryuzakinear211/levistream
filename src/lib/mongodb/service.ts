import { getDatabase } from './client';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { slugify, cleanVideoUrl } from '@/lib/urls';
import { getImageUrl } from '@/lib/tmdb';
import { serializeTinaMovie, serializeTinaTVShow, serializeTinaTVEpisode } from '@/lib/tina/schema';
import { saveGitHubFile, deleteGitHubFile, GitHubOptions } from '@/lib/githubStorage';

export interface MongoMovie {
  _id?: any;
  slug: string;
  tmdb_id: number;
  title: string;
  videourl: string;
  image_url: string;
  deskripsi: string;
  rating: number;
  featured: boolean;
  subtitles?: string;
  duration?: string;
  content?: string;
  createdAt: number;
  updatedAt: number;
}

export interface MongoTVShow {
  _id?: any;
  showSlug: string;
  tmdb_id: number;
  title: string;
  image_url: string;
  deskripsi: string;
  rating: number;
  featured: boolean;
  content?: string;
  createdAt: number;
  updatedAt: number;
}

export interface MongoTVEpisode {
  _id?: any;
  showSlug: string;
  seasonFolder: string; // e.g. "s1", "s2"
  episode: string; // e.g. "e1", "e2"
  slug: string;
  title: string;
  videourl: string;
  image_url: string;
  deskripsi?: string;
  rating?: number;
  duration?: string;
  subtitles?: string;
  content?: string;
  deleted?: boolean;
  createdAt: number;
  updatedAt: number;
}

const MOVIES_COLLECTION = 'movies';
const TV_SHOWS_COLLECTION = 'tv_shows';
const EPISODES_COLLECTION = 'tv_episodes';

/**
 * Ensure MongoDB collections and indexes are ready
 */
async function getCollections() {
  const db = await getDatabase();
  const movies = db.collection<MongoMovie>(MOVIES_COLLECTION);
  const tvShows = db.collection<MongoTVShow>(TV_SHOWS_COLLECTION);
  const episodes = db.collection<MongoTVEpisode>(EPISODES_COLLECTION);

  // Setup unique indexes
  try {
    await movies.createIndex({ slug: 1 }, { unique: true });
    await movies.createIndex({ tmdb_id: 1 });
    await tvShows.createIndex({ showSlug: 1 }, { unique: true });
    await tvShows.createIndex({ tmdb_id: 1 });
    await episodes.createIndex(
      { showSlug: 1, seasonFolder: 1, episode: 1 },
      { unique: true }
    );
  } catch {}

  return { movies, tvShows, episodes };
}

/**
 * Auto-seeds MongoDB from local markdown files on startup if MongoDB is empty
 */
export async function autoSeedMongoDBIfEmpty() {
  try {
    const { movies, tvShows, episodes } = await getCollections();
    const movieCount = await movies.countDocuments();
    const showCount = await tvShows.countDocuments();

    if (movieCount > 0 || showCount > 0) {
      return; // Already populated
    }

    console.log('[MongoDB] Database is empty. Seeding initial data from markdown files...');

    const VIDEO_DIR = path.join(process.cwd(), 'video');
    const TV_DIR = path.join(process.cwd(), 'tv');

    // Seed Movies
    if (fs.existsSync(VIDEO_DIR)) {
      const files = fs
        .readdirSync(VIDEO_DIR)
        .filter((f) => f.endsWith('.md') || f.endsWith('.markdown'));
      for (const file of files) {
        try {
          const raw = fs.readFileSync(path.join(VIDEO_DIR, file), 'utf8');
          const { data, content } = matter(raw);
          const slug = file.replace(/\.(md|markdown)$/i, '');
          const movieDoc: MongoMovie = {
            slug,
            tmdb_id: Number(data.tmdb_id) || 0,
            title: data.title || slug,
            videourl: cleanVideoUrl(data.videourl || data.video_url || '') || '',
            image_url: data.image_url || data.poster_path || '',
            deskripsi: data.deskripsi || data.overview || '',
            rating: Number(data.rating) || 0,
            featured: Boolean(data.featured),
            subtitles: data.subtitles || '',
            duration: data.duration || '',
            content: content || '',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          await movies.updateOne({ slug }, { $set: movieDoc }, { upsert: true });
        } catch {}
      }
    }

    // Seed TV Shows & Episodes
    if (fs.existsSync(TV_DIR)) {
      const showDirs = fs
        .readdirSync(TV_DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);

      for (const showDir of showDirs) {
        const showPath = path.join(TV_DIR, showDir);
        let indexData: any = {};
        let indexContent = '';

        const indexPath = fs.existsSync(path.join(showPath, '_index.md'))
          ? path.join(showPath, '_index.md')
          : fs.existsSync(path.join(showPath, 'index.md'))
          ? path.join(showPath, 'index.md')
          : null;

        if (indexPath) {
          const raw = fs.readFileSync(indexPath, 'utf8');
          const parsed = matter(raw);
          indexData = parsed.data;
          indexContent = parsed.content || '';
        }

        const showDoc: MongoTVShow = {
          showSlug: showDir,
          tmdb_id: Number(indexData.tmdb_id) || 0,
          title: indexData.title || showDir,
          image_url: indexData.image_url || '',
          deskripsi: indexData.deskripsi || '',
          rating: Number(indexData.rating) || 0,
          featured: Boolean(indexData.featured),
          content: indexContent || '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await tvShows.updateOne({ showSlug: showDir }, { $set: showDoc }, { upsert: true });

        // Episodes
        const entries = fs.readdirSync(showPath, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name === '_index.md' || entry.name === 'index.md') continue;

          if (entry.isDirectory()) {
            const seasonFolder = entry.name;
            const seasonPath = path.join(showPath, seasonFolder);
            const epFiles = fs
              .readdirSync(seasonPath)
              .filter((f) => f.endsWith('.md') || f.endsWith('.markdown'));

            for (const epFile of epFiles) {
              const raw = fs.readFileSync(path.join(seasonPath, epFile), 'utf8');
              const { data, content } = matter(raw);
              const epSlug = epFile.replace(/\.(md|markdown)$/i, '');
              const epDoc: MongoTVEpisode = {
                showSlug: showDir,
                seasonFolder,
                episode: epSlug,
                slug: epSlug,
                title: data.title || `Episode ${epSlug.replace(/\D/g, '') || '1'}`,
                videourl: cleanVideoUrl(data.videourl || data.video_url || '') || '',
                image_url: data.image_url || '',
                deskripsi: data.deskripsi || '',
                rating: Number(data.rating) || 0,
                duration: data.duration || '',
                subtitles: data.subtitles || '',
                content: content || '',
                createdAt: Date.now(),
                updatedAt: Date.now(),
              };
              await episodes.updateOne(
                { showSlug: showDir, seasonFolder, episode: epSlug },
                { $set: epDoc },
                { upsert: true }
              );
            }
          } else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.markdown'))) {
            const raw = fs.readFileSync(path.join(showPath, entry.name), 'utf8');
            const { data, content } = matter(raw);
            const epSlug = entry.name.replace(/\.(md|markdown)$/i, '');
            const epDoc: MongoTVEpisode = {
              showSlug: showDir,
              seasonFolder: 's1',
              episode: epSlug,
              slug: epSlug,
              title: data.title || `Episode ${epSlug.replace(/\D/g, '') || '1'}`,
              videourl: cleanVideoUrl(data.videourl || data.video_url || '') || '',
              image_url: data.image_url || '',
              deskripsi: data.deskripsi || '',
              rating: Number(data.rating) || 0,
              duration: data.duration || '',
              subtitles: data.subtitles || '',
              content: content || '',
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
            await episodes.updateOne(
              { showSlug: showDir, seasonFolder: 's1', episode: epSlug },
              { $set: epDoc },
              { upsert: true }
            );
          }
        }
      }
    }
    console.log('[MongoDB] Seeding complete.');
  } catch (err) {
    console.warn('[MongoDB] Auto-seed warning:', err);
  }
}

// ──────────────────────────────────────────
// MOVIE CRUD OPERATIONS
// ──────────────────────────────────────────

export async function getMongoMovies(): Promise<MongoMovie[]> {
  try {
    await autoSeedMongoDBIfEmpty();
    const { movies } = await getCollections();
    return await movies.find({}).sort({ updatedAt: -1 }).toArray();
  } catch (err) {
    console.warn('[MongoDB] getMongoMovies error:', err);
    return [];
  }
}

export async function getMongoMovieBySlug(slugOrId: string | number): Promise<MongoMovie | null> {
  try {
    await autoSeedMongoDBIfEmpty();
    const { movies } = await getCollections();
    const query = isNaN(Number(slugOrId))
      ? { slug: String(slugOrId).toLowerCase() }
      : { $or: [{ slug: String(slugOrId).toLowerCase() }, { tmdb_id: Number(slugOrId) }] };
    return await movies.findOne(query as any);
  } catch (err) {
    console.warn('[MongoDB] getMongoMovieBySlug error:', err);
    return null;
  }
}

export async function saveMongoMovie(data: Partial<MongoMovie>): Promise<MongoMovie> {
  const { movies } = await getCollections();
  const slug = data.slug || (data.title ? slugify(data.title) : `movie-${data.tmdb_id}`);
  const now = Date.now();

  const doc: MongoMovie = {
    slug,
    tmdb_id: Number(data.tmdb_id) || 0,
    title: data.title || slug,
    videourl: cleanVideoUrl(data.videourl || '') || '',
    image_url: data.image_url || '',
    deskripsi: data.deskripsi || '',
    rating: Number(data.rating) || 0,
    featured: Boolean(data.featured),
    subtitles: data.subtitles || '',
    duration: data.duration || '',
    content: data.content || '',
    createdAt: data.createdAt || now,
    updatedAt: now,
  };

  await movies.updateOne({ slug }, { $set: doc }, { upsert: true });
  return doc;
}

export async function deleteMongoMovie(slug: string): Promise<boolean> {
  const { movies } = await getCollections();
  const res = await movies.deleteOne({ slug });
  return res.deletedCount > 0;
}

// ──────────────────────────────────────────
// TV SHOW & EPISODE CRUD OPERATIONS
// ──────────────────────────────────────────

export async function getMongoTVShows(): Promise<(MongoTVShow & { episodes: MongoTVEpisode[] })[]> {
  try {
    await autoSeedMongoDBIfEmpty();
    const { tvShows, episodes } = await getCollections();
    const shows = await tvShows.find({}).sort({ updatedAt: -1 }).toArray();
    const allEpisodes = await episodes.find({}).toArray();

    return shows.map((s) => ({
      ...s,
      episodes: allEpisodes.filter((ep) => ep.showSlug === s.showSlug),
    }));
  } catch (err) {
    console.warn('[MongoDB] getMongoTVShows error:', err);
    return [];
  }
}

export async function getMongoTVShowBySlug(
  showSlug: string
): Promise<(MongoTVShow & { episodes: MongoTVEpisode[] }) | null> {
  try {
    await autoSeedMongoDBIfEmpty();
    const { tvShows, episodes } = await getCollections();
    const show = await tvShows.findOne({ showSlug: showSlug.toLowerCase() });
    if (!show) return null;

    const eps = await episodes.find({ showSlug: showSlug.toLowerCase() }).toArray();
    return {
      ...show,
      episodes: eps,
    };
  } catch (err) {
    console.warn('[MongoDB] getMongoTVShowBySlug error:', err);
    return null;
  }
}

export async function saveMongoTVShow(
  data: Partial<MongoTVShow>,
  episodesList: Partial<MongoTVEpisode>[] = []
): Promise<MongoTVShow> {
  const { tvShows, episodes } = await getCollections();
  const showSlug = data.showSlug || (data.title ? slugify(data.title) : `tv-${data.tmdb_id}`);
  const now = Date.now();

  const showDoc: MongoTVShow = {
    showSlug,
    tmdb_id: Number(data.tmdb_id) || 0,
    title: data.title || showSlug,
    image_url: data.image_url || '',
    deskripsi: data.deskripsi || '',
    rating: Number(data.rating) || 0,
    featured: Boolean(data.featured),
    content: data.content || '',
    createdAt: data.createdAt || now,
    updatedAt: now,
  };

  await tvShows.updateOne({ showSlug }, { $set: showDoc }, { upsert: true });

  // Save/Update episodes
  for (const ep of episodesList) {
    if (ep.deleted) {
      if (ep.episode && ep.seasonFolder) {
        await episodes.deleteOne({
          showSlug,
          seasonFolder: ep.seasonFolder,
          episode: ep.episode,
        });
      }
      continue;
    }

    const cleanEp = ep.episode || ep.slug || 'e1';
    const seasonFolder = (ep.seasonFolder || 's1').toLowerCase();
    const epDoc: MongoTVEpisode = {
      showSlug,
      seasonFolder,
      episode: cleanEp,
      slug: cleanEp,
      title: ep.title || `Episode ${cleanEp.replace(/\D/g, '') || '1'}`,
      videourl: cleanVideoUrl(ep.videourl || '') || '',
      image_url: ep.image_url || showDoc.image_url || '',
      deskripsi: ep.deskripsi || '',
      rating: Number(ep.rating) || 0,
      duration: ep.duration || '',
      subtitles: ep.subtitles || '',
      content: ep.content || '',
      createdAt: ep.createdAt || now,
      updatedAt: now,
    };

    await episodes.updateOne(
      { showSlug, seasonFolder, episode: cleanEp },
      { $set: epDoc },
      { upsert: true }
    );
  }

  return showDoc;
}

export async function deleteMongoTVShow(showSlug: string): Promise<boolean> {
  const { tvShows, episodes } = await getCollections();
  await episodes.deleteMany({ showSlug });
  const res = await tvShows.deleteOne({ showSlug });
  return res.deletedCount > 0;
}

// ──────────────────────────────────────────
// SYNC MONGODB TO GITHUB
// ──────────────────────────────────────────

export async function syncMongoDBToGitHub(ghConfig: GitHubOptions) {
  const { token } = ghConfig;
  if (!token) {
    throw new Error('Token GitHub diperlukan untuk melakukan sinkronisasi ke repository.');
  }

  let syncedCount = 0;

  // 1. Sync all movies
  const movies = await getMongoMovies();
  for (const m of movies) {
    const relPath = `video/${m.slug}.md`;
    const frontmatter = {
      tmdb_id: m.tmdb_id,
      title: m.title,
      videourl: m.videourl,
      image_url: m.image_url,
      deskripsi: m.deskripsi,
      rating: m.rating,
      featured: m.featured,
      subtitles: m.subtitles,
      duration: m.duration,
    };
    const content = serializeTinaMovie(frontmatter, m.content || '');
    try {
      await saveGitHubFile(relPath, content, `cms: sync ${relPath}`, ghConfig);
      syncedCount++;
    } catch (e) {
      console.warn(`[syncMongoDBToGitHub] Error saving ${relPath}:`, e);
    }
  }

  // 2. Sync all TV shows and episodes
  const shows = await getMongoTVShows();
  for (const s of shows) {
    const indexPath = `tv/${s.showSlug}/_index.md`;
    const indexFrontmatter = {
      tmdb_id: s.tmdb_id,
      title: s.title,
      image_url: s.image_url,
      deskripsi: s.deskripsi,
      rating: s.rating,
      featured: s.featured,
    };
    const indexContent = serializeTinaTVShow(indexFrontmatter, s.content || '');
    try {
      await saveGitHubFile(indexPath, indexContent, `cms: sync ${indexPath}`, ghConfig);
      syncedCount++;
    } catch {}

    for (const ep of s.episodes || []) {
      const epPath = `tv/${s.showSlug}/${ep.seasonFolder}/${ep.episode}.md`;
      const epFrontmatter = {
        title: ep.title,
        videourl: ep.videourl,
        image_url: ep.image_url,
        deskripsi: ep.deskripsi,
        rating: ep.rating,
        duration: ep.duration,
        subtitles: ep.subtitles,
      };
      const epContent = serializeTinaTVEpisode(epFrontmatter, ep.content || '');
      try {
        await saveGitHubFile(epPath, epContent, `cms: sync ${epPath}`, ghConfig);
        syncedCount++;
      } catch {}
    }
  }

  return { success: true, syncedCount };
}
