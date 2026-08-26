'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { getMovieUrl, getTVUrl, slugify, cleanVideoUrl, extractTmdbIdAndType } from '@/lib/urls';
import { getImageUrl } from '@/lib/tmdb';
import {
  Film,
  Tv,
  Plus,
  Minus,
  Edit2,
  Trash2,
  ExternalLink,
  Search,
  Sparkles,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  X,
  Play,
  Star,
  Key,
  ShieldCheck,
  ShieldAlert,
  Layers,
  HelpCircle,
  ArrowUpDown,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  FolderPlus,
  ImageIcon,
  FileText,
  Copy,
  CheckSquare,
  Square,
  SlidersHorizontal,
  Settings,
  Eye,
  Calendar,
  Clock,
  Globe,
  Sliders,
  Check,
} from 'lucide-react';

interface MovieItem {
  filename: string;
  slug: string;
  relativePath: string;
  frontmatter: {
    tmdb_id?: number | string;
    title?: string;
    image_url?: string;
    poster_path?: string;
    rating?: number;
    featured?: boolean;
    videourl?: string;
    [key: string]: any;
  };
  content: string;
  posterUrl: string | null;
  displayTitle: string;
  year?: number | null;
  rating?: number | null;
  updatedAt?: number;
}

interface TVEpisodeItem {
  showSlug: string;
  seasonFolder: string | null;
  filename: string;
  slug: string;
  relativePath: string;
  frontmatter: {
    title?: string;
    videourl?: string;
    image_url?: string;
    rating?: number;
    duration?: string;
    subtitles?: string;
    deskripsi?: string;
    [key: string]: any;
  };
  content: string;
  displayTitle: string;
  posterUrl: string | null;
  updatedAt?: number;
}

interface TVShowItem {
  showSlug: string;
  relativePath: string;
  frontmatter: {
    tmdb_id?: number | string;
    title?: string;
    image_url?: string;
    rating?: number;
    featured?: boolean;
    deskripsi?: string;
    [key: string]: any;
  };
  content: string;
  posterUrl: string | null;
  displayTitle: string;
  year?: number | null;
  rating?: number | null;
  updatedAt?: number;
  episodes: TVEpisodeItem[];
}

interface TMDBBackdropItem {
  filePath: string;
  url: string;
  thumbUrl: string;
  originalUrl: string;
  width: number;
  height: number;
  aspectRatio: number;
  language: string;
  voteAverage: number | null;
  voteCount: number;
}

interface TMDBPreviewData {
  id: number;
  title: string;
  overview?: string;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  year?: number | null;
  rating?: number | null;
  runtime?: string | null;
  numberOfSeasons?: number;
  numberOfEpisodes?: number;
  genres?: string[];
  backdrops?: TMDBBackdropItem[];
  posters?: TMDBBackdropItem[];
}

interface EpisodeDraft {
  id: string;
  episode: string;
  videourl: string;
  title?: string;
  image_url?: string;
  rating?: string;
  duration?: string;
  subtitles?: string;
  desc?: string;
}

interface SeasonDraft {
  id: string;
  season: string; // e.g. "s1"
  name: string; // e.g. "Season 1"
  episodes: EpisodeDraft[];
}

type SortOption = 'newest' | 'oldest' | 'title_asc' | 'title_desc' | 'rating_desc';
type FilterOption = 'all' | 'featured' | 'non_featured';

const EPISODES_PER_SEASON_PAGE = 6;

/**
 * Safe Image Component that catches errors, unoptimizes external URLs to avoid server 404 logs, and provides placeholders.
 */
function SafeAdminImage({
  src,
  fallbackSrc,
  alt,
  className = 'object-cover',
  sizes,
  fill = true,
}: {
  src?: string | null;
  fallbackSrc?: string | null;
  alt: string;
  className?: string;
  sizes?: string;
  fill?: boolean;
}) {
  const resolveUrl = (raw?: string | null) => {
    if (!raw || typeof raw !== 'string') return '';
    const trimmed = raw.trim();
    if (!trimmed) return '';
    return getImageUrl(trimmed, 'w500');
  };

  const initial = resolveUrl(src) || resolveUrl(fallbackSrc);
  const [currentSrc, setCurrentSrc] = useState<string>(initial);
  const [hasError, setHasError] = useState(!initial || initial === '/placeholder-poster.svg');

  useEffect(() => {
    const resolved = resolveUrl(src) || resolveUrl(fallbackSrc);
    setCurrentSrc(resolved);
    setHasError(!resolved || resolved === '/placeholder-poster.svg');
  }, [src, fallbackSrc]);

  const isValid = Boolean(
    currentSrc &&
      currentSrc !== '/placeholder-poster.svg' &&
      (currentSrc.startsWith('http://') || currentSrc.startsWith('https://') || currentSrc.startsWith('/')) &&
      !hasError
  );

  if (!isValid) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900/80 text-slate-500 p-1 text-center">
        <Film size={18} className="text-slate-500 mb-0.5" />
        <span className="text-[8px] line-clamp-1 leading-tight text-slate-500">{alt}</span>
      </div>
    );
  }

  return (
    <Image
      src={currentSrc}
      alt={alt}
      fill={fill}
      className={className}
      sizes={sizes}
      unoptimized
      onError={() => {
        const fb = resolveUrl(fallbackSrc);
        if (fb && currentSrc !== fb && fb !== '/placeholder-poster.svg') {
          setCurrentSrc(fb);
        } else {
          setHasError(true);
        }
      }}
    />
  );
}

/**
 * Formats a season slug (e.g. "s1", "s02", "season-3") into a clean display label (e.g. "Season 1", "Season 2", "Season 3").
 */
function formatSeasonLabel(season?: string | null): string {
  if (!season) return 'Season 1';
  const num = season.replace(/\D/g, '');
  return num ? `Season ${parseInt(num, 10)}` : `Season ${season}`;
}

/**
 * Extracts numeric season number (defaults to 1).
 */
function getSeasonNumber(season?: string | null): number {
  if (!season) return 1;
  const num = season.replace(/\D/g, '');
  return num ? parseInt(num, 10) : 1;
}

/**
 * Parses episode number from filename or slug (e.g. "e1.md" -> 1, "e02" -> 2, "episode-3" -> 3).
 */
function parseEpisodeNumber(slugOrFilename?: string | null): number | null {
  if (!slugOrFilename) return null;
  const match = slugOrFilename.match(/(?:e|ep|episode|\b)(\d+)/i);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  const digits = slugOrFilename.replace(/\D/g, '');
  return digits ? parseInt(digits, 10) : null;
}

/**
 * Extracts numeric episode number (defaults to 1).
 */
function getEpisodeNumber(slugOrFilename?: string | null): number {
  return parseEpisodeNumber(slugOrFilename) || 1;
}

/**
 * Calculates the next episode number for a given show and season.
 */
function getNextEpisodeNumber(show: TVShowItem | undefined, seasonSlug: string): number {
  if (!show || !show.episodes || show.episodes.length === 0) return 1;
  const targetSeason = seasonSlug.toLowerCase().trim();
  const seasonEps = show.episodes.filter((ep) => {
    const epSeason = (ep.seasonFolder || 's1').toLowerCase().trim();
    return epSeason === targetSeason || epSeason.replace(/\D/g, '') === targetSeason.replace(/\D/g, '');
  });
  if (seasonEps.length === 0) return 1;

  let maxEp = 0;
  for (const ep of seasonEps) {
    const num = parseEpisodeNumber(ep.slug) || parseEpisodeNumber(ep.filename);
    if (num && num > maxEp) {
      maxEp = num;
    }
  }
  return maxEp + 1;
}

/**
 * Gets all unique season slugs for a given show (e.g. ["s1", "s2"]), sorted.
 */
function getShowSeasons(show: TVShowItem | undefined): string[] {
  if (!show || !show.episodes || show.episodes.length === 0) return ['s1'];
  const seasonsSet = new Set<string>();
  show.episodes.forEach((ep) => {
    if (ep.seasonFolder) {
      seasonsSet.add(ep.seasonFolder.toLowerCase());
    } else {
      seasonsSet.add('s1');
    }
  });
  const seasons = Array.from(seasonsSet);
  if (seasons.length === 0) return ['s1'];
  seasons.sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, '') || '0', 10);
    const numB = parseInt(b.replace(/\D/g, '') || '0', 10);
    return numA - numB;
  });
  return seasons;
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'movies' | 'tv'>('movies');
  const [movies, setMovies] = useState<MovieItem[]>([]);
  const [tvShows, setTvShows] = useState<TVShowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'warning' } | null>(null);

  // Pagination State for Main Lists
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;

  // Season Dropdown Accordion & Mini-Pagination State per Show
  const [expandedSeasons, setExpandedSeasons] = useState<Record<string, boolean>>({});
  const [seasonPages, setSeasonPages] = useState<Record<string, number>>({});

  // Edit Modal Mini-Pagination State
  const [editModalSeasonPage, setEditModalSeasonPage] = useState<number>(1);

  // GitHub Token & Repository Config State
  const [githubToken, setGithubToken] = useState<string>('');
  const [githubOwner, setGithubOwner] = useState<string>('');
  const [githubRepo, setGithubRepo] = useState<string>('');
  const [githubBranch, setGithubBranch] = useState<string>('');
  const isClientLocal = typeof window !== 'undefined'
    ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    : process.env.NODE_ENV !== 'production';
  const [isLocalMode, setIsLocalMode] = useState<boolean>(isClientLocal);
  const [tokenChecked, setTokenChecked] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [tempToken, setTempToken] = useState('');
  const [tempOwner, setTempOwner] = useState('');
  const [tempRepo, setTempRepo] = useState('');
  const [tempBranch, setTempBranch] = useState('');

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<{
    type: 'movie' | 'tv_show' | 'tv_episode';
    relativePath: string;
    frontmatter: Record<string, any>;
    content: string;
  } | null>(null);

  // Form State for Creation & Validation Errors
  const [contentType, setContentType] = useState<'movie' | 'tv_show'>('movie');
  const [formTmdbId, setFormTmdbId] = useState('');
  const [formVideoUrl, setFormVideoUrl] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPoster, setFormPoster] = useState('');
  const [formRating, setFormRating] = useState('');
  const [formFeatured, setFormFeatured] = useState(false);
  const [formSubtitles, setFormSubtitles] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formDuration, setFormDuration] = useState('');

  // Multi-Season & Multi-Episode State for TV Series (Create Form)
  const [formSeasons, setFormSeasons] = useState<SeasonDraft[]>([
    {
      id: 'season-1',
      season: 's1',
      name: 'Season 1',
      episodes: [{ id: 'ep-1-1', episode: '1', videourl: '', title: '', image_url: '' }],
    },
  ]);
  const [activeSeasonTab, setActiveSeasonTab] = useState<string>('s1');
  const [batchUrlsInput, setBatchUrlsInput] = useState('');
  const [showBatchUrlInput, setShowBatchUrlInput] = useState(false);
  const [selectedDraftEpIds, setSelectedDraftEpIds] = useState<string[]>([]);

  // Edit Modal State for TV Shows
  const [editShowTab, setEditShowTab] = useState<'info' | 'episodes'>('info');
  const [editActiveSeasonTab, setEditActiveSeasonTab] = useState<string>('s1');
  const [editBatchUrlsInput, setEditBatchUrlsInput] = useState('');
  const [showEditBatchUrlInput, setShowEditBatchUrlInput] = useState(false);
  const [selectedEditEpPaths, setSelectedEditEpPaths] = useState<string[]>([]);

  // Active episode image picker draft tracker (for Create / Edit)
  const [activeEpisodePickerDraftId, setActiveEpisodePickerDraftId] = useState<string | null>(null);

  // Form Validation Touched & Errors
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  // Live TMDB Preview & Backdrop Picker State for Create Modal
  const [tmdbPreview, setTmdbPreview] = useState<TMDBPreviewData | null>(null);
  const [fetchingTmdb, setFetchingTmdb] = useState(false);
  const [selectedBackdropLang, setSelectedBackdropLang] = useState<string>('all');
  const [showBackdropPicker, setShowBackdropPicker] = useState(false);

  // Live TMDB Preview & Backdrop Picker State for Edit Modal
  const [editTmdbPreview, setEditTmdbPreview] = useState<TMDBPreviewData | null>(null);
  const [fetchingEditTmdb, setFetchingEditTmdb] = useState(false);
  const [editSelectedBackdropLang, setEditSelectedBackdropLang] = useState<string>('all');
  const [showEditBackdropPicker, setShowEditBackdropPicker] = useState(false);

  // Accordion Toggle helper for TV Dashboard
  const toggleSeasonAccordion = (showSlug: string, seasonSlug: string) => {
    const key = `${showSlug}_${seasonSlug}`;
    setExpandedSeasons((prev) => ({
      ...prev,
      [key]: prev[key] === undefined ? false : !prev[key],
    }));
  };

  const isSeasonExpanded = (showSlug: string, seasonSlug: string, isFirst: boolean) => {
    const key = `${showSlug}_${seasonSlug}`;
    if (expandedSeasons[key] !== undefined) {
      return expandedSeasons[key];
    }
    return isFirst;
  };

  const getSeasonPagination = (showSlug: string, seasonSlug: string) => {
    const key = `${showSlug}_${seasonSlug}`;
    return seasonPages[key] || 1;
  };

  const setSeasonPagination = (showSlug: string, seasonSlug: string, page: number) => {
    const key = `${showSlug}_${seasonSlug}`;
    setSeasonPages((prev) => ({ ...prev, [key]: page }));
  };

  // Detect duplicate existing post when creating
  const existingDuplicate = useMemo(() => {
    if (contentType === 'movie') {
      const extracted = extractTmdbIdAndType(formTmdbId);
      const idNum = extracted.id ? Number(extracted.id) : null;
      if (!idNum && !formSlug.trim()) return null;
      return (
        movies.find((m) => {
          const matchId = idNum && Number(m.frontmatter.tmdb_id) === idNum;
          const matchSlug =
            formSlug.trim() && (m.slug === slugify(formSlug) || m.filename === `${slugify(formSlug)}.md`);
          return matchId || matchSlug;
        }) || null
      );
    }
    if (contentType === 'tv_show') {
      const extracted = extractTmdbIdAndType(formTmdbId);
      const idNum = extracted.id ? Number(extracted.id) : null;
      const cleanSlug = formSlug.trim() ? slugify(formSlug) : formTitle.trim() ? slugify(formTitle) : null;
      if (!idNum && !cleanSlug) return null;
      return (
        tvShows.find((s) => {
          const matchId = idNum && Number(s.frontmatter.tmdb_id) === idNum;
          const matchSlug = cleanSlug && s.showSlug === cleanSlug;
          return matchId || matchSlug;
        }) || null
      );
    }
    return null;
  }, [contentType, formTmdbId, formSlug, formTitle, movies, tvShows]);

  // Load saved token & optimistic cache from localStorage on mount
  useEffect(() => {
    try {
      const savedToken = localStorage.getItem('levistream_github_token') || '';
      const savedOwner = localStorage.getItem('levistream_github_owner') || '';
      const savedRepo = localStorage.getItem('levistream_github_repo') || '';
      const savedBranch = localStorage.getItem('levistream_github_branch') || '';
      setGithubToken(savedToken);
      setTempToken(savedToken);
      setGithubOwner(savedOwner);
      setTempOwner(savedOwner);
      setGithubRepo(savedRepo);
      setTempRepo(savedRepo);
      setGithubBranch(savedBranch);
      setTempBranch(savedBranch);

      const cachedMovies = localStorage.getItem('cms_cached_movies');
      const cachedTV = localStorage.getItem('cms_cached_tv');
      if (cachedMovies) setMovies(JSON.parse(cachedMovies));
      if (cachedTV) setTvShows(JSON.parse(cachedTV));
    } catch {
      // ignore
    } finally {
      setTokenChecked(true);
    }
  }, []);

  const saveSettings = () => {
    localStorage.setItem('levistream_github_token', tempToken.trim());
    localStorage.setItem('levistream_github_owner', tempOwner.trim());
    localStorage.setItem('levistream_github_repo', tempRepo.trim());
    localStorage.setItem('levistream_github_branch', tempBranch.trim());
    setGithubToken(tempToken.trim());
    setGithubOwner(tempOwner.trim());
    setGithubRepo(tempRepo.trim());
    setGithubBranch(tempBranch.trim());
    setIsSettingsOpen(false);
    showToast('Pengaturan GitHub & Repositori berhasil disimpan!');
  };

  const removeToken = () => {
    localStorage.removeItem('levistream_github_token');
    localStorage.removeItem('levistream_github_owner');
    localStorage.removeItem('levistream_github_repo');
    localStorage.removeItem('levistream_github_branch');
    setGithubToken('');
    setTempToken('');
    setGithubOwner('');
    setTempOwner('');
    setGithubRepo('');
    setTempRepo('');
    setGithubBranch('');
    setTempBranch('');
    showToast('Pengaturan GitHub telah direset ke default', 'warning');
  };

  const showToast = (text: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const getHeaders = useCallback(() => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (githubToken) headers['x-github-token'] = githubToken;
    if (githubOwner) headers['x-github-owner'] = githubOwner;
    if (githubRepo) headers['x-github-repo'] = githubRepo;
    if (githubBranch) headers['x-github-branch'] = githubBranch;
    return headers;
  }, [githubToken, githubOwner, githubRepo, githubBranch]);

  const requireToken = (actionName: string): boolean => {
    // In local development server / writable mode, token is NEVER required
    const isLocal = typeof window !== 'undefined'
      ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      : isLocalMode;
    if (isLocal) return true;
    if (!githubToken || !githubToken.trim()) {
      setIsSettingsOpen(true);
      showToast(`Token GitHub diperlukan untuk ${actionName} pada hosting cloud (Vercel). Masukkan token Anda di Pengaturan.`, 'warning');
      return false;
    }
    return true;
  };

  // Fetch content list from API (supports silent background reload without UI flicker)
  const fetchContent = useCallback(async (options: { silent?: boolean } = {}) => {
    try {
      if (!options?.silent) {
        setLoading(true);
      }
      const res = await fetch('/api/admin/content', {
        headers: getHeaders(),
        cache: 'no-store',
      });
      const data = await res.json();
      if (typeof data.isLocal === 'boolean') {
        setIsLocalMode(data.isLocal);
      }
      if (data.defaultOwner && !githubOwner && !tempOwner) {
        setTempOwner(data.defaultOwner);
      }
      if (data.defaultRepo && !githubRepo && !tempRepo) {
        setTempRepo(data.defaultRepo);
      }
      if (data.defaultBranch && !githubBranch && !tempBranch) {
        setTempBranch(data.defaultBranch);
      }
      if (data.movies) {
        setMovies(data.movies);
        try {
          localStorage.setItem('cms_cached_movies', JSON.stringify(data.movies));
        } catch {}
      }
      if (data.tvShows) {
        setTvShows(data.tvShows);
        try {
          localStorage.setItem('cms_cached_tv', JSON.stringify(data.tvShows));
        } catch {}
      }
    } catch (e) {
      showToast('Gagal memuat konten dari server', 'error');
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }, [getHeaders, githubOwner, tempOwner, githubRepo, tempRepo, githubBranch, tempBranch]);

  // TMDB Autofetch for Edit Modal
  const handleFetchEditTmdbPreview = async (idOrUrl: string, type: 'movie' | 'tv') => {
    const extracted = extractTmdbIdAndType(idOrUrl);
    if (!extracted.id) return;
    setFetchingEditTmdb(true);
    try {
      const res = await fetch(`/api/admin/tmdb-preview?id=${extracted.id}&type=${extracted.type || type}`);
      const data = await res.json();
      if (res.ok) {
        setEditTmdbPreview(data);
      }
    } catch (e) {
      console.warn('Error fetching TMDB preview for edit modal:', e);
    } finally {
      setFetchingEditTmdb(false);
    }
  };

  // Open Edit Modal with fresh state
  const openEditModal = (item: {
    type: 'movie' | 'tv_show' | 'tv_episode';
    relativePath: string;
    frontmatter: Record<string, any>;
    content: string;
  }) => {
    setEditingItem(item);
    setEditErrors({});
    setEditTmdbPreview(null);
    setShowEditBackdropPicker(false);
    setEditSelectedBackdropLang('all');
    setEditShowTab('info');
    setSelectedEditEpPaths([]);
    setEditModalSeasonPage(1);
    setIsEditModalOpen(true);

    let tmdbIdToFetch = item.frontmatter.tmdb_id;
    if (!tmdbIdToFetch && item.type === 'tv_episode') {
      const showSlug = item.relativePath.split('/')[1];
      const show = tvShows.find((s) => s.showSlug === showSlug);
      tmdbIdToFetch = show?.frontmatter.tmdb_id;
    }

    if (tmdbIdToFetch) {
      handleFetchEditTmdbPreview(String(tmdbIdToFetch), item.type === 'movie' ? 'movie' : 'tv');
    }
  };

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  // Reset page when tab, search, or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery, sortBy, filterBy]);

  // TMDB Autofetch preview with auto backdrop population
  const handleFetchTmdbPreview = async (idOrUrl: string, type: 'movie' | 'tv') => {
    const extracted = extractTmdbIdAndType(idOrUrl);
    if (!extracted.id) {
      setFormErrors((prev) => ({ ...prev, tmdb_id: 'Masukkan TMDB ID angka atau URL TMDB yang valid' }));
      return;
    }
    const cleanId = extracted.id;
    const targetType = extracted.type || type;
    if (extracted.type && extracted.type === 'tv' && contentType === 'movie') {
      setContentType('tv_show');
    } else if (extracted.type && extracted.type === 'movie' && contentType === 'tv_show') {
      setContentType('movie');
    }

    setFormTmdbId(cleanId);
    setFetchingTmdb(true);
    try {
      const res = await fetch(`/api/admin/tmdb-preview?id=${cleanId}&type=${targetType}`);
      const data: TMDBPreviewData = await res.json();
      if (res.ok) {
        setTmdbPreview(data);
        if (!formTitle || formTitle === formTmdbId) setFormTitle(data.title);
        if (!formDesc) setFormDesc(data.overview || '');
        if (!formPoster) setFormPoster(data.posterUrl || '');
        if (!formRating) setFormRating(String(data.rating || ''));
        if (data.title && !formSlug) {
          const autoSlug = slugify(data.title);
          if (data.year) setFormSlug(`${autoSlug}-${data.year}`);
          else setFormSlug(autoSlug);
        }

        // Auto-assign backdrop from TMDB to episode drafts if available
        const defaultBackdrop = data.backdrops?.[0]?.url || data.backdropUrl || data.posterUrl || '';

        if (targetType === 'tv' && data.numberOfSeasons && data.numberOfSeasons > 0) {
          const newSeasons: SeasonDraft[] = [];
          const seasonCount = Math.min(data.numberOfSeasons, 12);
          for (let sIdx = 1; sIdx <= seasonCount; sIdx++) {
            newSeasons.push({
              id: `season-${sIdx}-${Date.now()}`,
              season: `s${sIdx}`,
              name: `Season ${sIdx}`,
              episodes: [
                {
                  id: `ep-${sIdx}-1-${Date.now()}`,
                  episode: '1',
                  videourl: '',
                  title: '',
                  image_url: defaultBackdrop,
                },
              ],
            });
          }
          setFormSeasons(newSeasons);
          setActiveSeasonTab('s1');
        } else {
          setFormSeasons((prev) =>
            prev.map((s) => ({
              ...s,
              episodes: s.episodes.map((ep) => ({
                ...ep,
                image_url: ep.image_url || defaultBackdrop,
              })),
            }))
          );
        }

        setFormErrors((prev) => {
          const next = { ...prev };
          delete next.tmdb_id;
          return next;
        });
        showToast('Data TMDB berhasil dimuat & backdrop otomatis diterapkan!');
      } else {
        setFormErrors((prev) => ({ ...prev, tmdb_id: 'TMDB ID tidak ditemukan' }));
      }
    } catch (e) {
      setFormErrors((prev) => ({ ...prev, tmdb_id: 'Gagal mengambil data dari TMDB API' }));
    } finally {
      setFetchingTmdb(false);
    }
  };

  const handleTmdbIdInputChange = (val: string) => {
    if (val.includes('themoviedb.org') || val.includes('/movie/') || val.includes('/tv/')) {
      const extracted = extractTmdbIdAndType(val);
      if (extracted.id) {
        setFormTmdbId(extracted.id);
        const autoType = extracted.type || (contentType === 'movie' ? 'movie' : 'tv');
        handleFetchTmdbPreview(extracted.id, autoType);
        return;
      }
    }
    setFormTmdbId(val);
    if (val) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next.tmdb_id;
        return next;
      });
    }
  };

  const resetCreateForm = () => {
    setFormTmdbId('');
    setFormVideoUrl('');
    setFormTitle('');
    setFormDesc('');
    setFormPoster('');
    setFormRating('');
    setFormFeatured(false);
    setFormSubtitles('');
    setFormSlug('');
    setFormDuration('');
    setFormErrors({});
    setTmdbPreview(null);
    setShowBackdropPicker(false);
    setSelectedBackdropLang('all');
    setFormSeasons([
      {
        id: 'season-1',
        season: 's1',
        name: 'Season 1',
        episodes: [{ id: 'ep-1-1', episode: '1', videourl: '', title: '', image_url: '' }],
      },
    ]);
    setActiveSeasonTab('s1');
    setBatchUrlsInput('');
    setShowBatchUrlInput(false);
    setSelectedDraftEpIds([]);
    setActiveEpisodePickerDraftId(null);
  };

  // Season & Episode Draft Handlers for Create TV Series
  const addSeason = () => {
    setFormSeasons((prev) => {
      let maxNum = 0;
      prev.forEach((s) => {
        const num = parseInt(s.season.replace(/\D/g, '') || '0', 10);
        if (num > maxNum) maxNum = num;
      });
      const nextNum = maxNum + 1;
      const nextSeasonSlug = `s${nextNum}`;
      const defaultImg = prev[0]?.episodes[0]?.image_url || tmdbPreview?.backdropUrl || formPoster || '';
      const newSeason: SeasonDraft = {
        id: `season-${nextNum}-${Date.now()}`,
        season: nextSeasonSlug,
        name: `Season ${nextNum}`,
        episodes: [{ id: `ep-${nextNum}-1-${Date.now()}`, episode: '1', videourl: '', title: '', image_url: defaultImg }],
      };
      setActiveSeasonTab(nextSeasonSlug);
      return [...prev, newSeason];
    });
  };

  const removeSeason = (seasonSlug: string) => {
    if (formSeasons.length <= 1) {
      showToast('TV Series minimal harus memiliki 1 season', 'warning');
      return;
    }
    setFormSeasons((prev) => {
      const filtered = prev.filter((s) => s.season !== seasonSlug);
      if (activeSeasonTab === seasonSlug) {
        setActiveSeasonTab(filtered[0]?.season || 's1');
      }
      return filtered;
    });
  };

  // Add new episode to season draft inheriting config from Episode 1
  const addEpisodeToSeason = (seasonSlug: string) => {
    setFormSeasons((prev) =>
      prev.map((s) => {
        if (s.season !== seasonSlug) return s;
        let maxEp = 0;
        s.episodes.forEach((ep) => {
          const num = parseInt(ep.episode.replace(/\D/g, '') || '0', 10);
          if (num > maxEp) maxEp = num;
        });
        const nextEpNum = maxEp + 1;
        const ep1Image = s.episodes[0]?.image_url || tmdbPreview?.backdropUrl || formPoster || '';
        const newEp: EpisodeDraft = {
          id: `ep-${s.season}-${nextEpNum}-${Date.now()}`,
          episode: String(nextEpNum),
          videourl: '',
          title: '',
          image_url: ep1Image,
        };
        return {
          ...s,
          episodes: [...s.episodes, newEp],
        };
      })
    );
  };

  const removeEpisodeFromSeason = (seasonSlug: string, epId: string) => {
    setFormSeasons((prev) =>
      prev.map((s) => {
        if (s.season !== seasonSlug) return s;
        if (s.episodes.length <= 1) {
          showToast('Season minimal harus memiliki 1 episode', 'warning');
          return s;
        }
        return {
          ...s,
          episodes: s.episodes.filter((ep) => ep.id !== epId),
        };
      })
    );
    setSelectedDraftEpIds((prev) => prev.filter((id) => id !== epId));
  };

  const updateEpisodeInSeason = (
    seasonSlug: string,
    epId: string,
    field: keyof EpisodeDraft,
    value: string
  ) => {
    setFormSeasons((prev) =>
      prev.map((s) => {
        if (s.season !== seasonSlug) return s;
        return {
          ...s,
          episodes: s.episodes.map((ep) => (ep.id === epId ? { ...ep, [field]: value } : ep)),
        };
      })
    );
  };

  const handleQuickGenerateEpisodes = (seasonSlug: string, count: number) => {
    if (count <= 0) return;
    setFormSeasons((prev) =>
      prev.map((s) => {
        if (s.season !== seasonSlug) return s;
        let maxEp = 0;
        s.episodes.forEach((ep) => {
          const num = parseInt(ep.episode.replace(/\D/g, '') || '0', 10);
          if (num > maxEp) maxEp = num;
        });
        const ep1Image = s.episodes[0]?.image_url || tmdbPreview?.backdropUrl || formPoster || '';
        const newEpisodes: EpisodeDraft[] = [];
        for (let i = 1; i <= count; i++) {
          const epNum = maxEp + i;
          newEpisodes.push({
            id: `ep-${s.season}-${epNum}-${Date.now()}-${i}`,
            episode: String(epNum),
            videourl: '',
            title: '',
            image_url: ep1Image,
          });
        }
        return {
          ...s,
          episodes: [...s.episodes, ...newEpisodes],
        };
      })
    );
    showToast(`Berhasil menambahkan ${count} episode ke ${formatSeasonLabel(seasonSlug)}!`);
  };

  const handleBatchPasteUrls = (seasonSlug: string) => {
    const lines = batchUrlsInput
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      showToast('Masukkan minimal 1 URL video', 'warning');
      return;
    }

    setFormSeasons((prev) =>
      prev.map((s) => {
        if (s.season !== seasonSlug) return s;
        let maxEp = 0;
        s.episodes.forEach((ep) => {
          const num = parseInt(ep.episode.replace(/\D/g, '') || '0', 10);
          if (num > maxEp) maxEp = num;
        });

        const hasSingleEmpty = s.episodes.length === 1 && !s.episodes[0].videourl.trim();
        const baseEpisodes = hasSingleEmpty ? [] : [...s.episodes];
        const startNum = hasSingleEmpty ? 0 : maxEp;
        const ep1Image = s.episodes[0]?.image_url || tmdbPreview?.backdropUrl || formPoster || '';

        const generated: EpisodeDraft[] = lines.map((url, idx) => ({
          id: `ep-${s.season}-${startNum + idx + 1}-${Date.now()}-${idx}`,
          episode: String(startNum + idx + 1),
          videourl: cleanVideoUrl(url) || url,
          title: '',
          image_url: ep1Image,
        }));

        return {
          ...s,
          episodes: [...baseEpisodes, ...generated],
        };
      })
    );

    setBatchUrlsInput('');
    setShowBatchUrlInput(false);
    showToast(`Berhasil menambahkan ${lines.length} episode dari URL yang ditempel!`);
  };

  // Multi-select actions for Create Form Episode Drafts
  const toggleSelectDraftEp = (epId: string) => {
    setSelectedDraftEpIds((prev) =>
      prev.includes(epId) ? prev.filter((id) => id !== epId) : [...prev, epId]
    );
  };

  const toggleSelectAllDraftEps = (seasonSlug: string) => {
    const season = formSeasons.find((s) => s.season === seasonSlug);
    if (!season) return;
    const seasonEpIds = season.episodes.map((ep) => ep.id);
    const allSelected = seasonEpIds.length > 0 && seasonEpIds.every((id) => selectedDraftEpIds.includes(id));
    if (allSelected) {
      setSelectedDraftEpIds((prev) => prev.filter((id) => !seasonEpIds.includes(id)));
    } else {
      setSelectedDraftEpIds((prev) => Array.from(new Set([...prev, ...seasonEpIds])));
    }
  };

  const deleteSelectedDraftEps = (seasonSlug: string) => {
    if (selectedDraftEpIds.length === 0) return;
    setFormSeasons((prev) =>
      prev.map((s) => {
        if (s.season !== seasonSlug) return s;
        const remaining = s.episodes.filter((ep) => !selectedDraftEpIds.includes(ep.id));
        if (remaining.length === 0) {
          const ep1Image = tmdbPreview?.backdropUrl || formPoster || '';
          return {
            ...s,
            episodes: [{ id: `ep-${s.season}-1-${Date.now()}`, episode: '1', videourl: '', title: '', image_url: ep1Image }],
          };
        }
        return {
          ...s,
          episodes: remaining,
        };
      })
    );
    setSelectedDraftEpIds([]);
    showToast('Episode terpilih berhasil dihapus.');
  };

  const deleteAllDraftEps = (seasonSlug: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus semua episode di season ini?')) return;
    setFormSeasons((prev) =>
      prev.map((s) => {
        if (s.season !== seasonSlug) return s;
        const ep1Image = tmdbPreview?.backdropUrl || formPoster || '';
        return {
          ...s,
          episodes: [{ id: `ep-${s.season}-1-${Date.now()}`, episode: '1', videourl: '', title: '', image_url: ep1Image }],
        };
      })
    );
    setSelectedDraftEpIds([]);
    showToast('Semua episode di season ini telah direset.');
  };

  // Validate create form
  const validateCreateForm = (): boolean => {
    const errors: Record<string, string> = {};

    const extracted = extractTmdbIdAndType(formTmdbId);
    if (!formTmdbId.trim()) {
      errors.tmdb_id = 'TMDB ID wajib diisi!';
    } else if (!extracted.id) {
      errors.tmdb_id = 'TMDB ID harus berupa angka atau URL TMDB yang valid!';
    }

    if (contentType === 'movie') {
      if (!formVideoUrl.trim()) {
        errors.videourl = 'URL Video wajib diisi!';
      }
    }

    if (contentType === 'tv_show') {
      const validEpisodes = formSeasons.reduce(
        (acc, s) => acc + s.episodes.filter((ep) => ep.videourl.trim()).length,
        0
      );
      if (validEpisodes === 0) {
        errors.episodes = 'Masukkan minimal 1 URL Video untuk episode!';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit Create with Instant Optimistic Preview & Multi-Season Support
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateCreateForm()) {
      showToast('Mohon lengkapi semua field yang wajib diisi (bergaris merah)', 'error');
      return;
    }

    if (!requireToken('membuat konten')) return;

    const extracted = extractTmdbIdAndType(formTmdbId);
    const tmdbIdNum = extracted.id ? Number(extracted.id) : undefined;
    const cleanVideo = cleanVideoUrl(formVideoUrl) || formVideoUrl.trim();

    const payload: any = {
      contentType,
      tmdb_id: tmdbIdNum,
      videourl: cleanVideo,
      title: formTitle.trim() || undefined,
      desc: formDesc.trim() || undefined,
      poster: formPoster.trim() || undefined,
      rating: formRating ? Number(formRating) : undefined,
      featured: formFeatured,
      subtitles: formSubtitles.trim() || undefined,
      slug: formSlug.trim() || undefined,
      duration: formDuration.trim() || undefined,
      seasons: formSeasons,
    };

    // Instant optimistic update
    if (contentType === 'movie') {
      const posterImg = payload.poster || tmdbPreview?.posterUrl || null;
      const formattedPoster = posterImg ? (posterImg.startsWith('http') ? posterImg : `https://image.tmdb.org/t/p/w500${posterImg}`) : null;
      const optimisticMovie: MovieItem = {
        filename: `${payload.slug || formTitle.toLowerCase().replace(/\s+/g, '-') || `movie-${payload.tmdb_id}`}.md`,
        slug: payload.slug || formTitle.toLowerCase().replace(/\s+/g, '-') || `movie-${payload.tmdb_id}`,
        relativePath: `video/${payload.slug || formTitle.toLowerCase().replace(/\s+/g, '-') || `movie-${payload.tmdb_id}`}.md`,
        frontmatter: {
          tmdb_id: payload.tmdb_id,
          title: payload.title || tmdbPreview?.title,
          videourl: payload.videourl,
          image_url: payload.poster || tmdbPreview?.posterUrl || undefined,
          rating: payload.rating || tmdbPreview?.rating || undefined,
          featured: Boolean(payload.featured),
        },
        content: '',
        posterUrl: formattedPoster,
        displayTitle: payload.title || tmdbPreview?.title || `Movie ${payload.tmdb_id}`,
        year: tmdbPreview?.year || new Date().getFullYear(),
        rating: payload.rating || tmdbPreview?.rating || null,
        updatedAt: Date.now(),
      };
      setMovies((prev) => [optimisticMovie, ...prev.filter((m) => m.relativePath !== optimisticMovie.relativePath)]);
    } else if (contentType === 'tv_show') {
      const showSlugTarget = formSlug || slugify(formTitle || tmdbPreview?.title || `tv-${tmdbIdNum}`);
      const optimisticEpisodes: TVEpisodeItem[] = [];

      formSeasons.forEach((seasonDraft) => {
        const cleanSeason = seasonDraft.season.toLowerCase().startsWith('s')
          ? seasonDraft.season.toLowerCase()
          : `s${seasonDraft.season.replace(/\D/g, '') || '1'}`;

        seasonDraft.episodes.forEach((ep) => {
          const cleanEpNum = ep.episode.replace(/\D/g, '') || '1';
          const cleanEp = `e${cleanEpNum}`;
          const cleanEpVideo = cleanVideoUrl(ep.videourl) || ep.videourl.trim();

          if (cleanEpVideo) {
            optimisticEpisodes.push({
              showSlug: showSlugTarget,
              seasonFolder: cleanSeason,
              filename: `${cleanEp}.md`,
              slug: cleanEp,
              relativePath: `tv/${showSlugTarget}/${cleanSeason}/${cleanEp}.md`,
              frontmatter: {
                title: ep.title || undefined,
                videourl: cleanEpVideo,
                image_url: ep.image_url || undefined,
                rating: ep.rating ? Number(ep.rating) : undefined,
                duration: ep.duration || undefined,
                subtitles: ep.subtitles || undefined,
                deskripsi: ep.desc || undefined,
              },
              content: '',
              displayTitle: ep.title || `Episode ${cleanEpNum}`,
              posterUrl: ep.image_url || formPoster || tmdbPreview?.posterUrl || null,
              updatedAt: Date.now(),
            });
          }
        });
      });

      const posterImg = payload.poster || tmdbPreview?.posterUrl || null;
      const formattedPoster = posterImg ? (posterImg.startsWith('http') ? posterImg : `https://image.tmdb.org/t/p/w500${posterImg}`) : null;

      const optimisticTVShow: TVShowItem = {
        showSlug: showSlugTarget,
        relativePath: `tv/${showSlugTarget}/_index.md`,
        frontmatter: {
          tmdb_id: tmdbIdNum,
          title: payload.title || tmdbPreview?.title,
          image_url: payload.poster || tmdbPreview?.posterUrl || undefined,
          rating: payload.rating || tmdbPreview?.rating || undefined,
          featured: Boolean(payload.featured),
          deskripsi: payload.desc || tmdbPreview?.overview || undefined,
        },
        content: '',
        posterUrl: formattedPoster,
        displayTitle: payload.title || tmdbPreview?.title || `TV Show ${payload.tmdb_id}`,
        year: tmdbPreview?.year || new Date().getFullYear(),
        rating: payload.rating || tmdbPreview?.rating || null,
        episodes: optimisticEpisodes,
        updatedAt: Date.now(),
      };

      setTvShows((prev) => [optimisticTVShow, ...prev.filter((s) => s.showSlug !== showSlugTarget)]);
    }

    setIsCreateModalOpen(false);
    resetCreateForm();
    showToast('Menyimpan ke GitHub & memperbarui halaman...');

    try {
      const res = await fetch('/api/admin/content', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (res.ok) {
        if (result.isUpdate) {
          if (result.hasChanges && result.changedFields?.length > 0) {
            showToast(
              `Post sudah ada. Berhasil memperbarui: ${result.changedFields.join(', ')}!`,
              'success'
            );
          } else {
            showToast(`Post ini sudah ada (data tetap sama).`, 'warning');
          }
        } else {
          showToast(
            result.savedEpisodesCount
              ? `Berhasil membuat TV Series dan ${result.savedEpisodesCount} episode!`
              : `Berhasil membuat post baru: ${result.relativePath}`,
            'success'
          );
        }
        setTmdbPreview(null);
        fetchContent({ silent: true });
      } else {
        if (result.requiresToken) {
          setIsSettingsOpen(true);
        }
        showToast(result.error || 'Gagal membuat konten', 'error');
        fetchContent({ silent: true });
      }
    } catch (e: any) {
      showToast('Terjadi kesalahan jaringan', 'error');
    }
  };

  // Validate edit form
  const validateEditForm = (): boolean => {
    if (!editingItem) return false;
    const errors: Record<string, string> = {};

    if (editingItem.type !== 'tv_episode') {
      const id = String(editingItem.frontmatter.tmdb_id || '').trim();
      const ext = extractTmdbIdAndType(id);
      if (!id) {
        errors.tmdb_id = 'TMDB ID wajib diisi!';
      } else if (!ext.id) {
        errors.tmdb_id = 'TMDB ID harus berupa angka atau URL TMDB yang valid!';
      }
    }

    if (editingItem.type !== 'tv_show') {
      const video = (editingItem.frontmatter.videourl || editingItem.frontmatter.video_url || '').trim();
      if (!video) {
        errors.videourl = 'URL Video wajib diisi!';
      }
    }

    setEditErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit Edit with instant update
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    if (!validateEditForm()) {
      showToast('Mohon periksa field wajib (bergaris merah)', 'error');
      return;
    }

    if (!requireToken('mengedit konten')) return;

    const imgVal = editingItem.frontmatter.image_url || editingItem.frontmatter.poster_path || null;
    const formattedPoster = imgVal ? (imgVal.startsWith('http') ? imgVal : `https://image.tmdb.org/t/p/w500${imgVal}`) : null;

    if (editingItem.type === 'movie') {
      setMovies((prev) => {
        const existing = prev.find((m) => m.relativePath === editingItem.relativePath);
        const updatedMovie: MovieItem = {
          filename: existing ? existing.filename : editingItem.relativePath.replace(/^video\//, ''),
          slug: existing ? existing.slug : editingItem.relativePath.replace(/^video\//, '').replace(/\.(md|markdown)$/i, ''),
          relativePath: editingItem.relativePath,
          frontmatter: {
            ...editingItem.frontmatter,
            featured: Boolean(editingItem.frontmatter.featured),
          },
          content: editingItem.content || '',
          displayTitle: editingItem.frontmatter.title || existing?.displayTitle,
          posterUrl: formattedPoster || existing?.posterUrl,
          rating: editingItem.frontmatter.rating ? Number(editingItem.frontmatter.rating) : existing?.rating,
          year: existing?.year,
          updatedAt: existing?.updatedAt || Date.now(),
        };
        const exists = prev.some((m) => m.relativePath === editingItem.relativePath);
        if (exists) {
          return prev.map((m) => (m.relativePath === editingItem.relativePath ? updatedMovie : m));
        }
        return [updatedMovie, ...prev];
      });
    } else if (editingItem.type === 'tv_show') {
      setTvShows((prev) => {
        const existing = prev.find(
          (s) => s.relativePath === editingItem.relativePath || s.showSlug === editingItem.relativePath.split('/')[1]
        );
        const updatedShow: TVShowItem = {
          showSlug: existing ? existing.showSlug : editingItem.relativePath.split('/')[1],
          relativePath: editingItem.relativePath,
          frontmatter: {
            ...editingItem.frontmatter,
            featured: Boolean(editingItem.frontmatter.featured),
          },
          content: editingItem.content || '',
          displayTitle: editingItem.frontmatter.title || existing?.displayTitle,
          posterUrl: formattedPoster || existing?.posterUrl,
          rating: editingItem.frontmatter.rating ? Number(editingItem.frontmatter.rating) : existing?.rating,
          year: existing?.year,
          updatedAt: existing?.updatedAt || Date.now(),
          episodes: existing ? existing.episodes : [],
        };
        const exists = prev.some((s) => s.showSlug === updatedShow.showSlug);
        if (exists) {
          return prev.map((s) => (s.showSlug === updatedShow.showSlug ? updatedShow : s));
        }
        return [updatedShow, ...prev];
      });
    } else if (editingItem.type === 'tv_episode') {
      setTvShows((prev) => {
        const showSlug = editingItem.relativePath.split('/')[1];
        const targetShow = prev.find((s) => s.showSlug === showSlug);
        if (!targetShow) return prev;
        const updatedEpisodes = targetShow.episodes.map((ep) =>
          ep.relativePath === editingItem.relativePath
            ? {
                ...ep,
                frontmatter: { ...editingItem.frontmatter },
                displayTitle: editingItem.frontmatter.title || ep.displayTitle,
                posterUrl: formattedPoster || ep.posterUrl,
                updatedAt: Date.now(),
              }
            : ep
        );
        const updatedShow: TVShowItem = {
          ...targetShow,
          episodes: updatedEpisodes,
          updatedAt: Date.now(),
        };
        return prev.map((s) => (s.showSlug === targetShow.showSlug ? updatedShow : s));
      });
    }

    setIsEditModalOpen(false);
    setEditTmdbPreview(null);
    setShowEditBackdropPicker(false);
    showToast('Menyimpan perubahan...');

    try {
      const res = await fetch('/api/admin/content', {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          relativePath: editingItem.relativePath,
          frontmatter: editingItem.frontmatter,
          content: editingItem.content,
        }),
      });

      const result = await res.json();
      if (res.ok) {
        showToast(`Perubahan berhasil disimpan & live!`);
        setEditingItem(null);
        setEditErrors({});
        setEditTmdbPreview(null);
        fetchContent({ silent: true });
      } else {
        if (result.requiresToken) {
          setIsSettingsOpen(true);
        }
        showToast(result.error || 'Gagal menyimpan perubahan', 'error');
        fetchContent({ silent: true });
      }
    } catch (e) {
      showToast('Gagal menyimpan perubahan', 'error');
    }
  };

  // Delete Content (Single)
  const handleDelete = async (relativePath: string, label: string) => {
    if (!requireToken('menghapus konten')) return;

    if (!confirm(`Apakah Anda yakin ingin menghapus "${label}" (${relativePath})? Tindakan ini permanen.`)) return;

    setMovies((prev) => prev.filter((m) => m.relativePath !== relativePath));
    setTvShows((prev) =>
      prev
        .map((s) => ({
          ...s,
          episodes: s.episodes.filter((ep) => ep.relativePath !== relativePath),
        }))
        .filter((s) => s.relativePath !== relativePath && (relativePath.endsWith('_index.md') ? s.relativePath !== relativePath : true))
    );

    try {
      const res = await fetch(`/api/admin/content?path=${encodeURIComponent(relativePath)}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Berhasil menghapus: ${label}`);
        fetchContent({ silent: true });
      } else {
        if (data.requiresToken) setIsSettingsOpen(true);
        showToast(data.error || 'Gagal menghapus konten', 'error');
        fetchContent({ silent: true });
      }
    } catch (e) {
      showToast('Gagal menghapus konten', 'error');
    }
  };

  // Multi-Select for Existing TV Show Episodes
  const toggleSelectEditEp = (relativePath: string) => {
    setSelectedEditEpPaths((prev) =>
      prev.includes(relativePath) ? prev.filter((p) => p !== relativePath) : [...prev, relativePath]
    );
  };

  const toggleSelectAllEditEps = (show: TVShowItem, seasonSlug: string) => {
    const seasonEps = show.episodes.filter(
      (ep) => (ep.seasonFolder || 's1').toLowerCase() === seasonSlug.toLowerCase()
    );
    const seasonPaths = seasonEps.map((ep) => ep.relativePath);
    const allSelected = seasonPaths.length > 0 && seasonPaths.every((p) => selectedEditEpPaths.includes(p));

    if (allSelected) {
      setSelectedEditEpPaths((prev) => prev.filter((p) => !seasonPaths.includes(p)));
    } else {
      setSelectedEditEpPaths((prev) => Array.from(new Set([...prev, ...seasonPaths])));
    }
  };

  const deleteSelectedEditEps = async (show: TVShowItem, seasonSlug: string) => {
    if (selectedEditEpPaths.length === 0) return;
    if (!requireToken('menghapus episode terpilih')) return;

    if (!confirm(`Hapus ${selectedEditEpPaths.length} episode terpilih secara permanen?`)) return;

    const pathsToDelete = [...selectedEditEpPaths];

    setTvShows((prev) =>
      prev.map((s) =>
        s.showSlug === show.showSlug
          ? {
              ...s,
              episodes: s.episodes.filter((ep) => !pathsToDelete.includes(ep.relativePath)),
            }
          : s
      )
    );
    setSelectedEditEpPaths([]);

    try {
      const res = await fetch('/api/admin/content', {
        method: 'DELETE',
        headers: getHeaders(),
        body: JSON.stringify({ paths: pathsToDelete }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Berhasil menghapus ${pathsToDelete.length} episode!`);
        fetchContent({ silent: true });
      } else {
        showToast(data.error || 'Gagal menghapus episode terpilih', 'error');
        fetchContent({ silent: true });
      }
    } catch {
      showToast('Gagal menghapus episode terpilih', 'error');
    }
  };

  const deleteAllEditEpsInSeason = async (show: TVShowItem, seasonSlug: string) => {
    if (!requireToken('menghapus seluruh episode')) return;
    const seasonEps = show.episodes.filter(
      (ep) => (ep.seasonFolder || 's1').toLowerCase() === seasonSlug.toLowerCase()
    );
    if (seasonEps.length === 0) return;

    if (!confirm(`Apakah Anda yakin ingin menghapus SEMUA (${seasonEps.length}) episode di ${formatSeasonLabel(seasonSlug)}? Tindakan ini permanen.`)) return;

    const pathsToDelete = seasonEps.map((ep) => ep.relativePath);

    setTvShows((prev) =>
      prev.map((s) =>
        s.showSlug === show.showSlug
          ? {
              ...s,
              episodes: s.episodes.filter((ep) => !pathsToDelete.includes(ep.relativePath)),
            }
          : s
      )
    );
    setSelectedEditEpPaths([]);

    try {
      const res = await fetch('/api/admin/content', {
        method: 'DELETE',
        headers: getHeaders(),
        body: JSON.stringify({ paths: pathsToDelete }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Semua episode di ${formatSeasonLabel(seasonSlug)} berhasil dihapus!`);
        fetchContent({ silent: true });
      } else {
        showToast(data.error || 'Gagal menghapus semua episode', 'error');
        fetchContent({ silent: true });
      }
    } catch {
      showToast('Gagal menghapus episode', 'error');
    }
  };

  // Quick Add New Episode to existing show with Episode 1 Configuration Inheritance
  const handleQuickAddEpisodeToEditShow = (show: TVShowItem, seasonSlug: string) => {
    const nextEpNum = getNextEpisodeNumber(show, seasonSlug);
    const cleanSeason = seasonSlug.toLowerCase().startsWith('s') ? seasonSlug.toLowerCase() : `s${seasonSlug.replace(/\D/g, '') || '1'}`;
    const cleanEp = `e${nextEpNum}`;

    const ep1 = show.episodes.find(
      (ep) => (ep.seasonFolder || 's1').toLowerCase() === cleanSeason.toLowerCase() && (ep.slug === 'e1' || ep.filename === 'e1.md')
    ) || show.episodes[0];

    const inheritedImage = ep1?.frontmatter.image_url || show.posterUrl || show.frontmatter.image_url || '';
    const inheritedSubtitles = ep1?.frontmatter.subtitles || '';
    const inheritedDuration = ep1?.frontmatter.duration || '';

    openEditModal({
      type: 'tv_episode',
      relativePath: `tv/${show.showSlug}/${cleanSeason}/${cleanEp}.md`,
      frontmatter: {
        title: `Episode ${nextEpNum}`,
        videourl: '',
        image_url: inheritedImage,
        subtitles: inheritedSubtitles,
        duration: inheritedDuration,
      },
      content: '',
    });
  };

  // Batch paste URLs for existing show in Edit Modal inheriting backdrop
  const handleEditShowBatchPasteUrls = async (show: TVShowItem, seasonSlug: string) => {
    const lines = editBatchUrlsInput
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      showToast('Masukkan minimal 1 URL video', 'warning');
      return;
    }

    if (!requireToken('menambahkan batch episode')) return;

    const cleanSeason = seasonSlug.toLowerCase().startsWith('s') ? seasonSlug.toLowerCase() : `s${seasonSlug.replace(/\D/g, '') || '1'}`;
    const startNum = getNextEpisodeNumber(show, cleanSeason);

    const ep1 = show.episodes.find(
      (ep) => (ep.seasonFolder || 's1').toLowerCase() === cleanSeason.toLowerCase() && (ep.slug === 'e1' || ep.filename === 'e1.md')
    ) || show.episodes[0];
    const inheritedImage = ep1?.frontmatter.image_url || show.posterUrl || show.frontmatter.image_url || '';

    showToast(`Menyimpan ${lines.length} episode baru ke ${formatSeasonLabel(cleanSeason)}...`);

    const generatedEpisodes = lines.map((url, idx) => ({
      episode: String(startNum + idx),
      videourl: cleanVideoUrl(url) || url,
      title: `Episode ${startNum + idx}`,
      image_url: inheritedImage,
    }));

    try {
      const res = await fetch('/api/admin/content', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          contentType: 'tv_show',
          tmdb_id: show.frontmatter.tmdb_id,
          showSlug: show.showSlug,
          seasons: [
            {
              season: cleanSeason,
              episodes: generatedEpisodes,
            },
          ],
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast(`Berhasil menambahkan ${lines.length} episode baru!`);
        setEditBatchUrlsInput('');
        setShowEditBatchUrlInput(false);
        fetchContent();
      } else {
        showToast(data.error || 'Gagal menambahkan episode', 'error');
      }
    } catch {
      showToast('Gagal memproses penambahan episode', 'error');
    }
  };

  // Filter & Sort Logic for Movies
  const filteredMovies = useMemo(() => {
    let result = [...movies];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (m) =>
          (m.displayTitle && m.displayTitle.toLowerCase().includes(q)) ||
          (m.frontmatter.title && m.frontmatter.title.toLowerCase().includes(q)) ||
          (m.frontmatter.tmdb_id && String(m.frontmatter.tmdb_id).includes(q)) ||
          m.slug.toLowerCase().includes(q)
      );
    }

    if (filterBy === 'featured') {
      result = result.filter((m) => Boolean(m.frontmatter.featured));
    } else if (filterBy === 'non_featured') {
      result = result.filter((m) => !m.frontmatter.featured);
    }

    result.sort((a, b) => {
      if (sortBy === 'newest') return (b.updatedAt || 0) - (a.updatedAt || 0);
      if (sortBy === 'oldest') return (a.updatedAt || 0) - (b.updatedAt || 0);
      if (sortBy === 'title_asc') return (a.displayTitle || '').localeCompare(b.displayTitle || '');
      if (sortBy === 'title_desc') return (b.displayTitle || '').localeCompare(a.displayTitle || '');
      if (sortBy === 'rating_desc') return (b.rating || 0) - (a.rating || 0);
      return 0;
    });

    return result;
  }, [movies, searchQuery, filterBy, sortBy]);

  // Filter & Sort Logic for TV Shows
  const filteredTvShows = useMemo(() => {
    let result = [...tvShows];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          (s.displayTitle && s.displayTitle.toLowerCase().includes(q)) ||
          (s.frontmatter.title && s.frontmatter.title.toLowerCase().includes(q)) ||
          (s.frontmatter.tmdb_id && String(s.frontmatter.tmdb_id).includes(q)) ||
          s.showSlug.toLowerCase().includes(q) ||
          s.episodes.some((ep) => ep.displayTitle.toLowerCase().includes(q) || ep.slug.toLowerCase().includes(q))
      );
    }

    if (filterBy === 'featured') {
      result = result.filter((s) => Boolean(s.frontmatter.featured));
    } else if (filterBy === 'non_featured') {
      result = result.filter((s) => !s.frontmatter.featured);
    }

    result.sort((a, b) => {
      if (sortBy === 'newest') return (b.updatedAt || 0) - (a.updatedAt || 0);
      if (sortBy === 'oldest') return (a.updatedAt || 0) - (b.updatedAt || 0);
      if (sortBy === 'title_asc') return (a.displayTitle || '').localeCompare(b.displayTitle || '');
      if (sortBy === 'title_desc') return (b.displayTitle || '').localeCompare(a.displayTitle || '');
      if (sortBy === 'rating_desc') return (b.rating || 0) - (a.rating || 0);
      return 0;
    });

    return result;
  }, [tvShows, searchQuery, filterBy, sortBy]);

  // Pagination calculation for main list
  const totalItems = activeTab === 'movies' ? filteredMovies.length : filteredTvShows.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const paginatedMovies = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredMovies.slice(start, start + itemsPerPage);
  }, [filteredMovies, currentPage, itemsPerPage]);

  const paginatedTvShows = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredTvShows.slice(start, start + itemsPerPage);
  }, [filteredTvShows, currentPage, itemsPerPage]);

  // Active TV Show being edited
  const currentEditingShow = useMemo(() => {
    if (!editingItem) return null;
    if (editingItem.type === 'tv_show') {
      return (
        tvShows.find(
          (s) => s.relativePath === editingItem.relativePath || s.showSlug === editingItem.relativePath.split('/')[1]
        ) || null
      );
    }
    return null;
  }, [editingItem, tvShows]);

  return (
    <div className="min-h-screen bg-[#070913] text-slate-100 pb-20 selection:bg-cyan-500 selection:text-black font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-slide-up border ${
            toastMessage.type === 'error'
              ? 'bg-red-950/90 text-red-200 border-red-500/50'
              : toastMessage.type === 'warning'
              ? 'bg-amber-950/90 text-amber-200 border-amber-500/50'
              : 'bg-cyan-950/90 text-cyan-200 border-cyan-500/50'
          }`}
        >
          {toastMessage.type === 'error' ? (
            <AlertCircle size={18} className="text-red-400" />
          ) : toastMessage.type === 'warning' ? (
            <AlertCircle size={18} className="text-amber-400" />
          ) : (
            <CheckCircle size={18} className="text-cyan-400" />
          )}
          <span className="text-sm font-medium">{toastMessage.text}</span>
        </div>
      )}

      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-[#070913]/90 backdrop-blur-md border-b border-white/10 px-4 sm:px-8 py-3">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-md shadow-cyan-500/20">
              <Layers size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                Levi Panel
              </h1>
              <p className="text-[10px] text-slate-400 font-medium">Content Menagment</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {tokenChecked && (
              <>
                {isLocalMode ? (
                  <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Local Dev (FS Write)</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-blue-500/10 text-cyan-300 border border-cyan-500/30 flex items-center gap-1.5 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    <span>Cloud Mode</span>
                  </span>
                )}

                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1.5 border transition-all ${
                    githubToken
                      ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30 hover:border-emerald-400'
                      : isLocalMode
                      ? 'bg-white/5 text-slate-300 border-white/10 hover:border-white/20'
                      : 'bg-amber-950/40 text-amber-300 border-amber-500/30 hover:border-amber-400 animate-pulse'
                  }`}
                  title="Klik untuk konfigurasi GitHub & Repositori"
                >
                  <Key size={13} className={githubToken ? 'text-emerald-400' : 'text-slate-400'} />
                  <span>{githubToken ? 'GitHub Token' : 'Pengaturan Token'}</span>
                </button>
              </>
            )}

            <button
              onClick={() => {
                resetCreateForm();
                setIsCreateModalOpen(true);
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-md shadow-cyan-500/20 flex items-center gap-1.5 transition-all"
            >
              <Plus size={13} />
              <span>Tambah Post</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Admin Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-5">
        {/* Navigation Tabs (Movies / TV Series) */}
        <div className="flex items-center justify-between border-b border-white/10 pb-2.5 mb-4 flex-wrap gap-2.5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('movies')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                activeTab === 'movies'
                  ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/20'
                  : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <Film size={14} />
              <span>Movies ({movies.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('tv')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                activeTab === 'tv'
                  ? 'bg-pink-500 text-white shadow-md shadow-pink-500/20'
                  : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <Tv size={14} />
              <span>TV Series ({tvShows.length})</span>
            </button>
          </div>

          <button
            onClick={() => fetchContent()}
            className="p-1.5 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 flex items-center gap-1 text-xs font-semibold transition-all"
            title="Refresh Data"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Search, Filter & Sort Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 mb-4">
          <div className="sm:col-span-6 relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Cari ${activeTab === 'movies' ? 'Movie' : 'TV Series'}...`}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#0c1224] border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div className="sm:col-span-3">
            <div className="relative">
              <Filter size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={filterBy}
                onChange={(e) => setFilterBy(e.target.value as FilterOption)}
                className="w-full pl-7 pr-3 py-1.5 rounded-lg bg-[#0c1224] border border-white/10 text-[11px] font-semibold text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
              >
                <option value="all">Semua Konten</option>
                <option value="featured">Hanya Featured</option>
                <option value="non_featured">Bukan Featured</option>
              </select>
            </div>
          </div>

          <div className="sm:col-span-3">
            <div className="relative">
              <ArrowUpDown size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="w-full pl-7 pr-3 py-1.5 rounded-lg bg-[#0c1224] border border-white/10 text-[11px] font-semibold text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
              >
                <option value="newest">Paling Baru</option>
                <option value="oldest">Paling Lama</option>
                <option value="title_asc">Judul (A-Z)</option>
                <option value="title_desc">Judul (Z-A)</option>
                <option value="rating_desc">Rating Tertinggi</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content List: Movies Tab */}
        {activeTab === 'movies' && (
          loading ? (
            <div className="py-12 text-center text-slate-400">
              <RefreshCw size={22} className="animate-spin mx-auto mb-2 text-cyan-400" />
              <p className="text-xs">Memuat daftar movie...</p>
            </div>
          ) : paginatedMovies.length === 0 ? (
            <div className="py-12 text-center bg-[#0c1224] rounded-xl border border-white/5">
              <Film size={32} className="mx-auto mb-2 text-slate-600" />
              <h3 className="text-xs font-bold text-white mb-1">Belum Ada Movie Ditemukan</h3>
              <p className="text-[11px] text-slate-400 mb-3">
                {searchQuery ? 'Tidak ada hasil untuk pencarian Anda.' : 'Mulai tambahkan movie baru ke sistem.'}
              </p>
              <button
                onClick={() => {
                  resetCreateForm();
                  setContentType('movie');
                  setIsCreateModalOpen(true);
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-white transition-all"
              >
                <Plus size={13} />
                <span>Tambah Movie</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
              {paginatedMovies.map((movie) => {
                const title = movie.displayTitle || movie.frontmatter.title || movie.slug;
                const tmdbId = movie.frontmatter.tmdb_id;
                const poster = movie.posterUrl || movie.frontmatter.image_url || movie.frontmatter.poster_path;
                const isFeatured = Boolean(movie.frontmatter.featured);
                const rating = movie.rating || movie.frontmatter.rating;

                return (
                  <div
                    key={movie.relativePath}
                    className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-[#0c1224] border border-white/10 hover:border-cyan-500/40 transition-all flex flex-col justify-between shadow-sm"
                  >
                    <div>
                      <div className="flex items-start gap-3 mb-2.5">
                        <div className="relative w-16 sm:w-20 aspect-[2/3] min-h-[96px] sm:min-h-[120px] rounded-lg sm:rounded-xl overflow-hidden bg-slate-900 flex-shrink-0 border border-white/15 shadow-md">
                          <SafeAdminImage src={poster} alt={title} sizes="(max-width: 640px) 64px, 80px" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            <span className="px-2 py-0.5 rounded-md text-[9.5px] sm:text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                              TMDB {tmdbId || 'N/A'}
                            </span>
                            {isFeatured && (
                              <span className="px-2 py-0.5 rounded-md text-[9.5px] sm:text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                                <Star size={10} fill="currentColor" /> Featured
                              </span>
                            )}
                          </div>

                          <h3 className="font-extrabold text-white text-xs sm:text-sm leading-snug line-clamp-2" title={title}>
                            {title} {movie.year ? <span className="text-slate-400 font-normal text-xs">({movie.year})</span> : ''}
                          </h3>

                          {rating ? (
                            <p className="text-[11px] sm:text-xs text-amber-400 font-black mt-1 flex items-center gap-1">
                              <Star size={11} fill="currentColor" /> {rating}
                            </p>
                          ) : null}

                          <p className="text-[9.5px] sm:text-[10px] text-slate-400 font-mono truncate mt-1" title={movie.relativePath}>
                            {movie.relativePath}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2.5 border-t border-white/10">
                      <Link
                        href={getMovieUrl({
                          id: movie.frontmatter.tmdb_id,
                          tmdbId: movie.frontmatter.tmdb_id,
                          title: movie.displayTitle || movie.frontmatter.title,
                          year: movie.year,
                          customSlug: movie.slug,
                        })}
                        target="_blank"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-400 hover:text-cyan-300 hover:underline transition-colors"
                      >
                        <ExternalLink size={13} />
                        <span>Buka Halaman</span>
                      </Link>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            if (!requireToken('mengedit movie')) return;
                            openEditModal({
                              type: 'movie',
                              relativePath: movie.relativePath,
                              frontmatter: { ...movie.frontmatter },
                              content: movie.content,
                            });
                          }}
                          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white transition-all shadow-sm active:scale-95"
                          title="Edit Post"
                        >
                          <Edit2 size={13} />
                        </button>

                        <button
                          onClick={() => handleDelete(movie.relativePath, title)}
                          className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-all shadow-sm active:scale-95"
                          title="Hapus Post"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* Content List: TV Shows Tab */}
        {activeTab === 'tv' && (
          loading ? (
            <div className="py-12 text-center text-slate-400">
              <RefreshCw size={22} className="animate-spin mx-auto mb-2 text-pink-400" />
              <p className="text-xs">Memuat daftar TV Series...</p>
            </div>
          ) : paginatedTvShows.length === 0 ? (
            <div className="py-12 text-center bg-[#0c1224] rounded-xl border border-white/5">
              <Tv size={32} className="mx-auto mb-2 text-slate-600" />
              <h3 className="text-xs font-bold text-white mb-1">Belum Ada TV Series Ditemukan</h3>
              <p className="text-[11px] text-slate-400 mb-3">
                {searchQuery ? 'Tidak ada hasil untuk pencarian Anda.' : 'Mulai tambahkan TV Series baru ke sistem.'}
              </p>
              <button
                onClick={() => {
                  resetCreateForm();
                  setContentType('tv_show');
                  setIsCreateModalOpen(true);
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-pink-500 hover:bg-pink-400 text-white transition-all"
              >
                <Plus size={13} />
                <span>Tambah TV Series</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3.5 w-full">
              {paginatedTvShows.map((show) => {
                const title = show.displayTitle || show.frontmatter.title || show.showSlug;
                const tmdbId = show.frontmatter.tmdb_id;
                const poster = show.posterUrl || show.frontmatter.image_url;
                const year = show.year;
                const showSeasons = getShowSeasons(show);

                return (
                  <div
                    key={show.showSlug}
                    className="p-3.5 sm:p-4 rounded-xl bg-[#0c1224] border border-white/10 hover:border-pink-500/40 transition-all shadow-sm w-full"
                  >
                    {/* Show Main Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-white/10 w-full">
                      <div className="flex items-center gap-2.5">
                        <div className="relative w-12 sm:w-14 aspect-[2/3] min-h-[72px] sm:min-h-[84px] rounded-lg overflow-hidden bg-slate-900 flex-shrink-0 border border-white/10 shadow-sm">
                          <SafeAdminImage src={poster} alt={title} sizes="56px" />
                        </div>

                        <div>
                          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-pink-500/10 text-pink-400 border border-pink-500/30">
                              TMDB {tmdbId}
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30">
                              {show.episodes.length} Episode
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-white/5 text-slate-300 border border-white/10">
                              {showSeasons.length} Season
                            </span>
                          </div>
                          <h3 className="font-bold text-white text-xs sm:text-sm leading-snug">
                            {title} {year ? <span className="text-slate-400 font-normal text-xs">({year})</span> : ''}
                          </h3>
                          <p className="text-[10px] text-slate-500 font-mono">tv/{show.showSlug}/_index.md</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Link
                          href={getTVUrl({
                            id: show.frontmatter.tmdb_id,
                            tmdbId: show.frontmatter.tmdb_id,
                            name: show.displayTitle || show.frontmatter.title,
                            year: show.year,
                            customSlug: show.showSlug,
                          })}
                          target="_blank"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold bg-white/5 hover:bg-white/10 text-cyan-400 transition-all"
                        >
                          <ExternalLink size={11} />
                          <span>Show</span>
                        </Link>

                        <button
                          onClick={() => {
                            if (!requireToken('mengedit TV series')) return;
                            openEditModal({
                              type: 'tv_show',
                              relativePath: show.relativePath,
                              frontmatter: { ...show.frontmatter },
                              content: show.content,
                            });
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 border border-pink-500/40 transition-all"
                        >
                          <Edit2 size={11} />
                          <span>Kelola Series & Episode</span>
                        </button>

                        <button
                          onClick={() => handleDelete(`tv/${show.showSlug}`, title)}
                          className="p-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all"
                          title="Hapus Seluruh TV Series"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* ════════════════════════════════════════════════════ */}
                    {/* SEASON DROPDOWN ACCORDION & MINI-PAGINATION LIST */}
                    {/* ════════════════════════════════════════════════════ */}
                    <div className="mt-3 space-y-2 w-full">
                      {showSeasons.length === 0 || show.episodes.length === 0 ? (
                        <div className="p-3 text-center bg-black/20 rounded-lg border border-white/5">
                          <p className="text-[11px] text-slate-400 mb-1">Belum ada episode di series ini.</p>
                          <button
                            onClick={() => {
                              if (!requireToken('menambah episode')) return;
                              openEditModal({
                                type: 'tv_show',
                                relativePath: show.relativePath,
                                frontmatter: { ...show.frontmatter },
                                content: show.content,
                              });
                              setEditShowTab('episodes');
                            }}
                            className="text-[11px] font-bold text-pink-400 hover:text-pink-300 inline-flex items-center gap-1"
                          >
                            <Plus size={11} /> Tambah Episode
                          </button>
                        </div>
                      ) : (
                        showSeasons.map((seasonSlug, sIdx) => {
                          const isExpanded = isSeasonExpanded(show.showSlug, seasonSlug, sIdx === 0);
                          const seasonEps = show.episodes.filter(
                            (ep) => (ep.seasonFolder || 's1').toLowerCase() === seasonSlug.toLowerCase()
                          );
                          const seasonPage = getSeasonPagination(show.showSlug, seasonSlug);
                          const seasonTotalPages = Math.ceil(seasonEps.length / EPISODES_PER_SEASON_PAGE) || 1;
                          const pagedEpisodes = seasonEps.slice(
                            (seasonPage - 1) * EPISODES_PER_SEASON_PAGE,
                            seasonPage * EPISODES_PER_SEASON_PAGE
                          );

                          return (
                            <div
                              key={seasonSlug}
                              className="rounded-lg border border-white/10 bg-black/30 overflow-hidden transition-all shadow-sm"
                            >
                              {/* Season Dropdown Menu Header */}
                              <div
                                onClick={() => toggleSeasonAccordion(show.showSlug, seasonSlug)}
                                className="p-3 sm:p-3.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-white/10 active:bg-white/15 transition-all select-none min-h-[48px]"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center flex-shrink-0 text-slate-300">
                                    {isExpanded ? (
                                      <ChevronDown size={18} className="text-pink-400 transition-transform" />
                                    ) : (
                                      <ChevronRight size={18} className="text-slate-400 transition-transform" />
                                    )}
                                  </div>
                                  <span className="text-xs sm:text-sm font-extrabold text-white tracking-tight truncate">
                                    {formatSeasonLabel(seasonSlug)}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 whitespace-nowrap">
                                    {seasonEps.length} Episode
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={() => handleQuickAddEpisodeToEditShow(show, seasonSlug)}
                                    className="px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/40 flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                                  >
                                    <Plus size={13} className="text-purple-300" />
                                    <span className="text-xs font-bold">Tambah Ep</span>
                                  </button>
                                </div>
                              </div>

                              {/* Dropdown Content with Mini-Pagination */}
                              {isExpanded && (
                                <div className="p-3 pt-2 border-t border-white/5 space-y-2.5 bg-black/40">
                                  {seasonEps.length === 0 ? (
                                    <div className="p-3 text-center text-slate-500 text-[11px]">
                                      Belum ada episode di {formatSeasonLabel(seasonSlug)}.
                                    </div>
                                  ) : (
                                    <>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                        {pagedEpisodes.map((ep) => {
                                          const epTitle = ep.displayTitle || ep.frontmatter.title || ep.slug;
                                          const epVideo = ep.frontmatter.videourl || ep.frontmatter.video_url;
                                          const epPoster = ep.posterUrl || ep.frontmatter.image_url;
                                          const baseTVUrl = getTVUrl({
                                            id: show.frontmatter.tmdb_id,
                                            tmdbId: show.frontmatter.tmdb_id,
                                            name: show.displayTitle || show.frontmatter.title,
                                            year: show.year,
                                            customSlug: show.showSlug,
                                          });
                                          const linkPath = ep.seasonFolder
                                            ? `${baseTVUrl}/${ep.seasonFolder}/${ep.slug}`
                                            : `${baseTVUrl}/${ep.slug}`;

                                          const seasonNum = getSeasonNumber(ep.seasonFolder);
                                          const episodeNum = getEpisodeNumber(ep.slug || ep.filename);

                                          return (
                                            <div
                                              key={ep.relativePath}
                                              className="p-2.5 sm:p-3 rounded-xl bg-[#090e1e]/90 border border-white/10 flex items-start gap-3 w-full hover:border-purple-500/50 hover:bg-[#0c1328] transition-all shadow-sm group"
                                            >
                                              {/* Left: Compact 16:9 Thumbnail */}
                                              <div className="relative w-16 sm:w-20 aspect-video rounded-lg overflow-hidden bg-slate-900 border border-white/10 flex-shrink-0 shadow-sm mt-0.5">
                                                <SafeAdminImage src={epPoster} fallbackSrc={poster} alt={epTitle} sizes="80px" />
                                              </div>

                                              {/* Center: Info & Separated Badges */}
                                              <div className="flex-1 min-w-0">
                                                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                                  <span className="px-1.5 py-0.5 rounded text-[9.5px] sm:text-[10px] font-extrabold bg-pink-500/20 text-pink-300 border border-pink-500/30 whitespace-nowrap">
                                                    Season {seasonNum}
                                                  </span>
                                                  <span className="px-1.5 py-0.5 rounded text-[9.5px] sm:text-[10px] font-extrabold bg-purple-500/20 text-purple-300 border border-purple-500/30 whitespace-nowrap">
                                                    Episode {episodeNum}
                                                  </span>
                                                </div>

                                                <h5
                                                  className="font-bold text-white text-xs sm:text-[13px] leading-snug line-clamp-2 break-words group-hover:text-purple-300 transition-colors"
                                                  title={epTitle}
                                                >
                                                  {epTitle}
                                                </h5>

                                                <p className="text-[10px] text-slate-400 font-mono truncate mt-1" title={epVideo}>
                                                  {epVideo || <span className="text-red-400 font-semibold">Video belum diisi</span>}
                                                </p>
                                              </div>

                                              {/* Right: Actions */}
                                              <div className="flex flex-col sm:flex-row items-center gap-1 flex-shrink-0 self-center sm:self-start mt-0.5">
                                                <Link
                                                  href={linkPath}
                                                  target="_blank"
                                                  className="p-1.5 rounded-lg text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/15 transition-colors"
                                                  title="Tonton Episode"
                                                >
                                                  <Play size={13} />
                                                </Link>
                                                <button
                                                  onClick={() => {
                                                    if (!requireToken('mengedit episode')) return;
                                                    openEditModal({
                                                      type: 'tv_episode',
                                                      relativePath: ep.relativePath,
                                                      frontmatter: { ...ep.frontmatter },
                                                      content: ep.content,
                                                    });
                                                  }}
                                                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                                                  title="Edit Episode"
                                                >
                                                  <Edit2 size={13} />
                                                </button>
                                                <button
                                                  onClick={() => handleDelete(ep.relativePath, epTitle)}
                                                  className="p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/15 transition-colors"
                                                  title="Hapus Episode"
                                                >
                                                  <Trash2 size={13} />
                                                </button>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>

                                      {/* Mini Pagination Bar per Season */}
                                      {seasonTotalPages > 1 && (
                                        <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[10px] text-slate-400 px-1">
                                          <span>
                                            Menampilkan Episode{' '}
                                            <span className="font-bold text-white">
                                              {(seasonPage - 1) * EPISODES_PER_SEASON_PAGE + 1}
                                            </span>
                                            -
                                            <span className="font-bold text-white">
                                              {Math.min(seasonEps.length, seasonPage * EPISODES_PER_SEASON_PAGE)}
                                            </span>{' '}
                                            dari <span className="font-bold text-white">{seasonEps.length}</span>
                                          </span>

                                          <div className="flex items-center gap-1">
                                            <button
                                              disabled={seasonPage <= 1}
                                              onClick={() => setSeasonPagination(show.showSlug, seasonSlug, Math.max(1, seasonPage - 1))}
                                              className="p-1 rounded bg-white/5 border border-white/10 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                              title="Episode Sebelumnya"
                                            >
                                              <ChevronLeft size={12} />
                                            </button>
                                            <span className="px-2 py-0.2 rounded bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30 text-[9px]">
                                              {seasonPage} / {seasonTotalPages}
                                            </span>
                                            <button
                                              disabled={seasonPage >= seasonTotalPages}
                                              onClick={() => setSeasonPagination(show.showSlug, seasonSlug, Math.min(seasonTotalPages, seasonPage + 1))}
                                              className="p-1 rounded bg-white/5 border border-white/10 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                              title="Episode Selanjutnya"
                                            >
                                              <ChevronRight size={12} />
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* Main List Pagination Bar */}
        {totalItems > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 mt-5 pt-4 border-t border-white/10 w-full">
            <div className="text-[11px] text-slate-400 font-medium">
              Menampilkan{' '}
              <span className="font-bold text-white">
                {Math.min(totalItems, (currentPage - 1) * itemsPerPage + 1)}
              </span>{' '}
              -{' '}
              <span className="font-bold text-white">
                {Math.min(totalItems, currentPage * itemsPerPage)}
              </span>{' '}
              dari <span className="font-bold text-white">{totalItems}</span> konten
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="p-1 rounded bg-white/5 border border-white/10 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Halaman Pertama"
              >
                <ChevronsLeft size={13} />
              </button>

              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1 rounded bg-white/5 border border-white/10 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Sebelumnya"
              >
                <ChevronLeft size={13} />
              </button>

              <span className="px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[11px] font-bold">
                {currentPage} / {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1 rounded bg-white/5 border border-white/10 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Selanjutnya"
              >
                <ChevronRight size={13} />
              </button>

              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="p-1 rounded bg-white/5 border border-white/10 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Halaman Terakhir"
              >
                <ChevronsRight size={13} />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ────────────────────────────────────────── */}
      {/* Modal: GitHub Token & Repository Settings */}
      {/* ────────────────────────────────────────── */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-[#0c1224] border border-white/15 rounded-2xl shadow-2xl overflow-hidden animate-slide-up my-4">
            <div className="flex items-center justify-between p-3.5 border-b border-white/10 bg-white/5">
              <div className="flex items-center gap-1.5">
                <Key size={15} className="text-cyan-400" />
                <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight">Pengaturan GitHub & Repositori</h3>
              </div>
              <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <div className="p-3.5 sm:p-4 space-y-3.5 max-h-[80vh] overflow-y-auto">
              {/* Environment Banner */}
              {isLocalMode ? (
                <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl flex items-start gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse mt-1 flex-shrink-0" />
                  <div className="text-[11px] text-emerald-200 leading-relaxed">
                    <p className="font-bold text-emerald-300">Mode Local Development Aktif</p>
                    <p className="text-slate-300 mt-0.5">
                      Konten akan disimpan langsung ke disk lokal komputer Anda (<code className="text-emerald-300 font-mono">video/</code> dan <code className="text-emerald-300 font-mono">tv/</code>). GitHub Token bersifat <strong className="text-white">opsional</strong> di server lokal.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-blue-950/40 border border-cyan-500/30 rounded-xl flex items-start gap-2.5">
                  <ShieldCheck size={16} className="text-cyan-400 mt-0.5 flex-shrink-0" />
                  <div className="text-[11px] text-cyan-200 leading-relaxed">
                    <p className="font-bold text-cyan-300">Mode Cloud Serverless (Vercel) Aktif</p>
                    <p className="text-slate-300 mt-0.5">
                      Karena hosting Vercel bersifat Read-Only, token GitHub diperlukan untuk menyimpan dan mengedit file langsung ke repositori secara real-time.
                    </p>
                  </div>
                </div>
              )}

              {/* GitHub Token Input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-slate-200">
                    GitHub Personal Access Token (PAT) {!isLocalMode && <span className="text-red-400">*</span>}
                  </label>
                  {githubToken && (
                    <button onClick={removeToken} className="text-[10.5px] text-red-400 hover:text-red-300 font-bold underline">
                      Reset Pengaturan
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  value={tempToken}
                  onChange={(e) => setTempToken(e.target.value)}
                  placeholder="ghp_... atau github_pat_..."
                  className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Buka GitHub &gt; <em>Settings &gt; Developer Settings &gt; Personal Access Tokens</em>, beri izin <code className="text-cyan-300 font-bold">repo</code>.
                </p>
              </div>

              {/* Repository Target Configuration (Custom Fork / Owner / Repo / Branch) */}
              <div className="p-3 rounded-xl bg-black/30 border border-white/10 space-y-2.5">
                <p className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
                  <Layers size={13} className="text-purple-400" />
                  <span>Target Repositori GitHub (Opsional / Custom Fork)</span>
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">
                      Repository Owner / Username
                    </label>
                    <input
                      type="text"
                      value={tempOwner}
                      onChange={(e) => setTempOwner(e.target.value)}
                      placeholder="genstava789"
                      className="w-full px-2.5 py-1.5 bg-black/50 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-purple-400 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">
                      Repository Name
                    </label>
                    <input
                      type="text"
                      value={tempRepo}
                      onChange={(e) => setTempRepo(e.target.value)}
                      placeholder="filmes"
                      className="w-full px-2.5 py-1.5 bg-black/50 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-purple-400 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">
                    Branch Target
                  </label>
                  <input
                    type="text"
                    value={tempBranch}
                    onChange={(e) => setTempBranch(e.target.value)}
                    placeholder="main"
                    className="w-full px-2.5 py-1.5 bg-black/50 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-purple-400 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-300"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={saveSettings}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-white shadow-md transition-all"
                >
                  Simpan Pengaturan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────── */}
      {/* Modal: Buat Konten Baru (Movie / TV Series Multi-Season) */}
      {/* ────────────────────────────────────────── */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-[#0c1224] border border-white/15 rounded-2xl shadow-2xl overflow-hidden my-4">
            <div className="flex items-center justify-between p-3.5 border-b border-white/10 bg-white/5">
              <div className="flex items-center gap-1.5">
                <Plus size={15} className="text-cyan-400" />
                <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight">
                  Tambah {contentType === 'movie' ? 'Movie' : 'TV Series'} Baru
                </h3>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-3.5 sm:p-4 space-y-3 max-h-[82vh] overflow-y-auto">
              {/* Content Type Selector */}
              <div>
                <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Tipe Konten
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setContentType('movie');
                      setTmdbPreview(null);
                      setFormErrors({});
                    }}
                    className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      contentType === 'movie'
                        ? 'bg-cyan-500 text-white shadow-sm ring-1 ring-cyan-400'
                        : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Film size={13} />
                    <span>Movie</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setContentType('tv_show');
                      setTmdbPreview(null);
                      setFormErrors({});
                    }}
                    className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      contentType === 'tv_show'
                        ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-sm ring-1 ring-pink-400'
                        : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Tv size={13} />
                    <span>TV Series</span>
                  </button>
                </div>
              </div>

              {/* TMDB ID & Live Autofetch */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-300">
                    TMDB ID / URL <span className="text-red-400 font-extrabold">*</span>
                  </label>
                  {formErrors.tmdb_id && (
                    <span className="text-[10px] font-bold text-red-400 flex items-center gap-1">
                      <AlertCircle size={10} /> {formErrors.tmdb_id}
                    </span>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row gap-1.5 w-full">
                  <input
                    type="text"
                    value={formTmdbId}
                    onChange={(e) => handleTmdbIdInputChange(e.target.value)}
                    placeholder="Contoh: 1084244 atau URL TMDB"
                    className={`w-full flex-1 min-w-0 px-2.5 py-1.5 bg-black/40 rounded-lg text-xs text-white transition-all focus:outline-none ${
                      formErrors.tmdb_id
                        ? 'border border-red-500 ring-1 ring-red-500/20 bg-red-950/20'
                        : 'border border-white/10 focus:border-cyan-400'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => handleFetchTmdbPreview(formTmdbId, contentType === 'movie' ? 'movie' : 'tv')}
                    disabled={fetchingTmdb || !formTmdbId}
                    className="w-full sm:w-auto px-3 py-1.5 bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded-lg text-[11px] font-bold hover:bg-cyan-500/30 transition-all flex items-center justify-center gap-1 disabled:opacity-50 flex-shrink-0"
                  >
                    <Sparkles size={12} className={fetchingTmdb ? 'animate-spin' : ''} />
                    <span>{fetchingTmdb ? 'Mengambil...' : 'Auto-Fetch TMDB'}</span>
                  </button>
                </div>
              </div>

              {/* TMDB Live Preview Card */}
              {tmdbPreview && (
                <div className="p-2.5 rounded-lg bg-cyan-950/40 border border-cyan-500/30 flex items-center gap-2.5 animate-slide-up">
                  <div className="relative w-10 h-14 rounded overflow-hidden flex-shrink-0 border border-white/10 shadow-sm bg-slate-900">
                    <SafeAdminImage src={tmdbPreview.posterUrl} alt="Preview" sizes="40px" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-cyan-500/20 text-cyan-300">
                        TMDB {tmdbPreview.id}
                      </span>
                      {tmdbPreview.rating ? (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 flex items-center gap-0.5">
                          <Star size={8} fill="currentColor" /> {tmdbPreview.rating}
                        </span>
                      ) : null}
                      {tmdbPreview.numberOfSeasons ? (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-500/20 text-purple-300">
                          {tmdbPreview.numberOfSeasons} Seasons
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs font-extrabold text-white truncate">
                      {tmdbPreview.title} {tmdbPreview.year ? `(${tmdbPreview.year})` : ''}
                    </p>
                    <p className="text-[10px] text-slate-300 line-clamp-1 mt-0.5">{tmdbPreview.overview}</p>
                  </div>
                </div>
              )}

              {/* Duplicate Notice */}
              {existingDuplicate && (
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-2 animate-fade-in">
                  <AlertCircle size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
                  <div className="text-xs space-y-0.5">
                    <p className="font-bold text-amber-300 text-[11px]">
                      Konten sudah ada: {existingDuplicate.displayTitle || existingDuplicate.relativePath}
                    </p>
                    <p className="text-slate-300 text-[10px] leading-snug">
                      Menyimpan form ini akan otomatis mengedit file target (<code className="text-cyan-300 font-mono">{existingDuplicate.relativePath}</code>).
                    </p>
                  </div>
                </div>
              )}

              {/* Movie Specific Video URL */}
              {contentType === 'movie' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-300">
                      URL Video Movie <span className="text-red-400 font-extrabold">*</span>
                    </label>
                    {formErrors.videourl && (
                      <span className="text-[10px] font-bold text-red-400 flex items-center gap-1">
                        <AlertCircle size={10} /> {formErrors.videourl}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={formVideoUrl}
                    onChange={(e) => {
                      setFormVideoUrl(e.target.value);
                      if (e.target.value) {
                        setFormErrors((prev) => {
                          const next = { ...prev };
                          delete next.videourl;
                          return next;
                        });
                      }
                    }}
                    placeholder="https://.../video.mp4 atau link .mkv / .m3u8"
                    className={`w-full px-2.5 py-1.5 bg-black/40 rounded-lg text-xs text-white font-mono transition-all focus:outline-none ${
                      formErrors.videourl
                        ? 'border border-red-500 ring-1 ring-red-500/20 bg-red-950/20'
                        : 'border border-white/10 focus:border-cyan-400'
                    }`}
                  />
                </div>
              )}

              {/* Title Override */}
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Judul Custom (Opsional)
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Opsional, biarkan kosong untuk data TMDB"
                  className="w-full px-2.5 py-1.5 bg-black/40 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              {/* Poster / Backdrop Image URL */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-medium text-slate-400">
                    Poster / Backdrop URL (Opsional)
                  </label>
                  {formTmdbId && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!tmdbPreview) {
                          handleFetchTmdbPreview(formTmdbId, contentType === 'movie' ? 'movie' : 'tv');
                        }
                        setActiveEpisodePickerDraftId(null);
                        setShowBackdropPicker(!showBackdropPicker);
                      }}
                      className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-all"
                    >
                      <ImageIcon size={11} />
                      <span>
                        {tmdbPreview?.backdrops && tmdbPreview.backdrops.length > 0
                          ? `${showBackdropPicker && !activeEpisodePickerDraftId ? 'Tutup' : 'Pilih Backdrop'} (${tmdbPreview.backdrops.length})`
                          : fetchingTmdb
                          ? 'Mengambil...'
                          : 'Cari Backdrop'}
                      </span>
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={formPoster}
                  onChange={(e) => setFormPoster(e.target.value)}
                  placeholder="https://image.tmdb.org/... atau pilih dari galeri"
                  className="w-full px-2.5 py-1.5 bg-black/40 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-400"
                />

                {/* Backdrop Gallery Picker */}
                {tmdbPreview?.backdrops && tmdbPreview.backdrops.length > 0 && showBackdropPicker && (
                  <div className="mt-2 p-2.5 bg-[#090e1f] border border-cyan-500/30 rounded-lg space-y-2 animate-fade-in shadow-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-cyan-300 flex items-center gap-1">
                        <ImageIcon size={12} />
                        {activeEpisodePickerDraftId
                          ? 'Pilih Backdrop Episode'
                          : `Pilih Backdrop Utama (${tmdbPreview.backdrops.length})`}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowBackdropPicker(false)}
                        className="text-[10px] text-slate-400 hover:text-white"
                      >
                        Tutup
                      </button>
                    </div>

                    <div className="flex items-center gap-1 flex-wrap">
                      {(() => {
                        const availableLangs = Array.from(new Set(tmdbPreview.backdrops!.map((b) => b.language)));
                        return [
                          { code: 'all', label: `Semua (${tmdbPreview.backdrops!.length})` },
                          ...availableLangs.map((lang) => {
                            const count = tmdbPreview.backdrops!.filter((b) => b.language === lang).length;
                            const langLabel =
                              lang === 'xx' || lang === 'null'
                                ? `No Text (${count})`
                                : lang.toUpperCase() === 'ID'
                                ? `ID (${count})`
                                : lang.toUpperCase() === 'EN'
                                ? `EN (${count})`
                                : `${lang.toUpperCase()} (${count})`;
                            return { code: lang, label: langLabel };
                          }),
                        ].map((tab) => (
                          <button
                            key={tab.code}
                            type="button"
                            onClick={() => setSelectedBackdropLang(tab.code)}
                            className={`px-1.5 py-0.2 rounded text-[9px] font-bold transition-all ${
                              selectedBackdropLang === tab.code
                                ? 'bg-cyan-500 text-black'
                                : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10'
                            }`}
                          >
                            {tab.label}
                          </button>
                        ));
                      })()}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 max-h-48 overflow-y-auto pr-1">
                      {tmdbPreview.backdrops!
                        .filter((b) => selectedBackdropLang === 'all' || b.language === selectedBackdropLang)
                        .map((b, idx) => {
                          const isSelected = formPoster === b.url || formPoster === b.originalUrl;
                          return (
                            <div
                              key={`${b.filePath}-${idx}`}
                              onClick={() => {
                                if (activeEpisodePickerDraftId) {
                                  setFormSeasons((prev) =>
                                    prev.map((s) => ({
                                      ...s,
                                      episodes: s.episodes.map((ep) =>
                                        ep.id === activeEpisodePickerDraftId ? { ...ep, image_url: b.url } : ep
                                      ),
                                    }))
                                  );
                                  setActiveEpisodePickerDraftId(null);
                                  showToast('Backdrop episode diterapkan!');
                                } else {
                                  setFormPoster(b.url);
                                  showToast('Backdrop series dipilih!');
                                }
                                setShowBackdropPicker(false);
                              }}
                              className={`group relative rounded overflow-hidden border cursor-pointer transition-all aspect-video ${
                                isSelected
                                  ? 'ring-1 ring-cyan-400 border-cyan-400'
                                  : 'border-white/10 hover:border-cyan-500/50 bg-black/40'
                              }`}
                            >
                              <SafeAdminImage src={b.thumbUrl} alt="Backdrop" sizes="(max-width: 640px) 50vw, 25vw" />
                              <div className="absolute top-0.5 left-0.5">
                                <span className="px-1 py-0.2 rounded text-[7px] font-bold bg-black/80 text-cyan-300">
                                  {b.language === 'xx' || b.language === 'null' ? 'No Text' : b.language.toUpperCase()}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              {/* ════════════════════════════════════════════════════ */}
              {/* ULTRA-COMPACT TV SERIES SEASON & EPISODE BUILDER */}
              {/* ════════════════════════════════════════════════════ */}
              {contentType === 'tv_show' && (
                <div className="space-y-2 p-2 sm:p-2.5 bg-[#090e1f] border border-purple-500/30 rounded-lg">
                  <div className="flex items-center justify-between gap-1.5 pb-1 border-b border-white/10">
                    <div className="flex items-center gap-1.5">
                      <Layers size={13} className="text-purple-400" />
                      <h4 className="text-[11px] font-bold text-purple-300">
                        Season & Episode
                      </h4>
                    </div>

                    <button
                      type="button"
                      onClick={addSeason}
                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 flex items-center gap-1 transition-all"
                    >
                      <FolderPlus size={11} />
                      <span>Tambah Season</span>
                    </button>
                  </div>

                  {formErrors.episodes && (
                    <div className="p-1.5 bg-red-950/40 border border-red-500/40 rounded text-[10px] font-bold text-red-400 flex items-center gap-1">
                      <AlertCircle size={11} />
                      <span>{formErrors.episodes}</span>
                    </div>
                  )}

                  {/* Ultra-Compact Season Tabs with Clean Stacked Badges & Visible Delete Button */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1.5 px-1">
                    {formSeasons.map((s) => {
                      const isActive = activeSeasonTab === s.season;
                      return (
                        <div key={s.id} className="relative group flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => setActiveSeasonTab(s.season)}
                            className={`px-2.5 py-1 rounded-md text-center transition-all flex flex-col items-center justify-center min-w-[62px] sm:min-w-[68px] gap-0.5 ${
                              isActive
                                ? 'bg-purple-700 text-white shadow-sm ring-1 ring-purple-400 border border-purple-400/40'
                                : 'bg-black/40 text-slate-300 hover:text-white hover:bg-white/5 border border-white/10'
                            }`}
                          >
                            <span className="text-[10.5px] font-bold tracking-tight">{s.name}</span>
                            <span className={`text-[8.5px] font-semibold px-1.5 py-0.1 rounded-full border ${
                              isActive ? 'bg-black/50 text-purple-200 border-purple-400/30' : 'bg-white/5 text-slate-400 border-white/5'
                            }`}>
                              {s.episodes.length} Episode
                            </span>
                          </button>

                          {formSeasons.length > 1 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeSeason(s.season);
                              }}
                              className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center border border-white/40 shadow-md transition-all z-10"
                              title={`Hapus ${s.name}`}
                            >
                              <X size={10} strokeWidth={2.5} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Active Season Episodes Content */}
                  {(() => {
                    const currentSeason = formSeasons.find((s) => s.season === activeSeasonTab) || formSeasons[0];
                    if (!currentSeason) return null;

                    const seasonEpIds = currentSeason.episodes.map((ep) => ep.id);
                    const isAllSelected = seasonEpIds.length > 0 && seasonEpIds.every((id) => selectedDraftEpIds.includes(id));
                    const selectedCount = currentSeason.episodes.filter((ep) => selectedDraftEpIds.includes(ep.id)).length;

                    return (
                      <div className="space-y-1.5">
                        {/* Compact Toolbar */}
                        <div className="flex flex-wrap items-center justify-between gap-1 p-1.5 bg-black/50 rounded border border-white/10">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => toggleSelectAllDraftEps(currentSeason.season)}
                              className="flex items-center gap-1 text-[10px] font-semibold text-slate-300 hover:text-white select-none"
                            >
                              {isAllSelected ? (
                                <CheckSquare size={13} className="text-purple-400" />
                              ) : (
                                <Square size={13} className="text-slate-500" />
                              )}
                              <span>Pilih Semua</span>
                            </button>

                            {selectedCount > 0 && (
                              <button
                                type="button"
                                onClick={() => deleteSelectedDraftEps(currentSeason.season)}
                                className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30 flex items-center gap-0.5 transition-all"
                              >
                                <Trash2 size={10} />
                                <span>Hapus ({selectedCount})</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => deleteAllDraftEps(currentSeason.season)}
                              className="text-[9px] text-slate-500 hover:text-red-400 transition-colors"
                            >
                              Reset All
                            </button>
                          </div>

                          <div className="flex items-center gap-1 flex-wrap">
                            <button
                              type="button"
                              onClick={() => addEpisodeToSeason(currentSeason.season)}
                              className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 hover:bg-white/20 text-slate-200 flex items-center gap-0.5 transition-all"
                            >
                              <Plus size={10} />
                              <span>Tambah Ep</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleQuickGenerateEpisodes(currentSeason.season, 8)}
                              className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 flex items-center gap-0.5 transition-all"
                            >
                              <Sparkles size={10} />
                              <span>8 Ep</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setShowBatchUrlInput(!showBatchUrlInput)}
                              className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 flex items-center gap-0.5 transition-all"
                            >
                              <Copy size={10} />
                              <span>Paste URLs</span>
                            </button>
                          </div>
                        </div>

                        {/* Batch Paste Box */}
                        {showBatchUrlInput && (
                          <div className="p-2 bg-cyan-950/30 border border-cyan-500/30 rounded space-y-1.5 animate-fade-in">
                            <label className="block text-[10px] font-bold text-cyan-300">
                              Tempelkan URL Video (1 baris per episode):
                            </label>
                            <textarea
                              rows={3}
                              value={batchUrlsInput}
                              onChange={(e) => setBatchUrlsInput(e.target.value)}
                              placeholder={`https://example.com/s1e1.mp4\nhttps://example.com/s1e2.mp4`}
                              className="w-full p-1.5 bg-black/60 border border-white/10 rounded text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                            />
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => setShowBatchUrlInput(false)}
                                className="px-2 py-0.5 text-[11px] text-slate-400 hover:text-white"
                              >
                                Batal
                              </button>
                              <button
                                type="button"
                                onClick={() => handleBatchPasteUrls(currentSeason.season)}
                                className="px-2.5 py-0.5 bg-cyan-500 text-black font-bold rounded text-[11px] hover:bg-cyan-400"
                              >
                                Masukkan ke {currentSeason.name}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Episodes List in Active Season */}
                        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                          {currentSeason.episodes.map((ep) => {
                            const isSelected = selectedDraftEpIds.includes(ep.id);
                            return (
                              <div
                                key={ep.id}
                                className={`p-1.5 rounded flex flex-col sm:flex-row items-start sm:items-center gap-2 transition-all border ${
                                  isSelected
                                    ? 'bg-purple-950/30 border-purple-500/50'
                                    : 'bg-black/40 border-white/10 hover:border-white/20'
                                }`}
                              >
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => toggleSelectDraftEp(ep.id)}
                                    className="text-slate-400 hover:text-purple-300"
                                  >
                                    {isSelected ? (
                                      <CheckSquare size={13} className="text-purple-400" />
                                    ) : (
                                      <Square size={13} className="text-slate-500" />
                                    )}
                                  </button>

                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-purple-500/20 text-purple-300 border border-purple-500/30 whitespace-nowrap">
                                    Episode {ep.episode}
                                  </span>
                                </div>

                                {/* Thumbnail Preview with Safe Admin Image */}
                                <div
                                  onClick={() => {
                                    if (tmdbPreview?.backdrops && tmdbPreview.backdrops.length > 0) {
                                      setActiveEpisodePickerDraftId(ep.id);
                                      setShowBackdropPicker(true);
                                    }
                                  }}
                                  className="relative w-12 h-7 rounded overflow-hidden bg-slate-900 border border-white/10 flex-shrink-0 cursor-pointer group shadow-sm"
                                  title="Ganti backdrop"
                                >
                                  <SafeAdminImage src={ep.image_url} fallbackSrc={formPoster} alt="Ep Backdrop" sizes="48px" />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                    <Edit2 size={9} className="text-white" />
                                  </div>
                                </div>

                                <div className="flex-1 min-w-0 w-full">
                                  <input
                                    type="text"
                                    value={ep.videourl}
                                    onChange={(e) =>
                                      updateEpisodeInSeason(currentSeason.season, ep.id, 'videourl', e.target.value)
                                    }
                                    placeholder="URL Video (https://...)"
                                    className="w-full px-2 py-0.5 bg-black/50 border border-white/10 rounded text-[11px] font-mono text-white focus:outline-none focus:border-purple-400"
                                  />
                                </div>

                                <div className="w-full sm:w-32 flex-shrink-0">
                                  <input
                                    type="text"
                                    value={ep.title || ''}
                                    onChange={(e) =>
                                      updateEpisodeInSeason(currentSeason.season, ep.id, 'title', e.target.value)
                                    }
                                    placeholder="Judul (Opsional)"
                                    className="w-full px-2 py-0.5 bg-black/50 border border-white/10 rounded text-[11px] text-white focus:outline-none focus:border-purple-400"
                                  />
                                </div>

                                <div className="flex items-center gap-1 self-end sm:self-center">
                                  <button
                                    type="button"
                                    onClick={() => removeEpisodeFromSeason(currentSeason.season, ep.id)}
                                    className="p-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300"
                                    title="Hapus Baris"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Rating and Featured in Homepage */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">
                    Rating (Opsional)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={formRating}
                    onChange={(e) => setFormRating(e.target.value)}
                    placeholder="Contoh: 8.5"
                    className="w-full px-2 py-1 bg-black/40 border border-white/10 rounded-md text-xs text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div
                  onClick={() => setFormFeatured(!formFeatured)}
                  className="flex items-center justify-between px-2.5 py-1 rounded-md bg-white/5 border border-white/10 hover:border-cyan-500/40 transition-all cursor-pointer select-none self-end h-[34px]"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Star size={12} className={formFeatured ? 'text-amber-400 fill-amber-400' : 'text-slate-400'} />
                    <div>
                      <p className="text-[10.5px] font-bold text-white select-none leading-none">Featured</p>
                      <p className="text-[8px] text-slate-400 select-none leading-none mt-0.5">Hero banner utama</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={formFeatured}
                    onChange={(e) => setFormFeatured(e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-3.5 h-3.5 rounded bg-black/40 border-white/20 text-cyan-500 focus:ring-cyan-400 cursor-pointer"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-1.5 pt-2.5 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3 py-1 rounded-md text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-300 transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1 rounded-md text-xs font-bold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-sm transition-all"
                >
                  {existingDuplicate ? 'Update Konten' : contentType === 'tv_show' ? 'Simpan TV Series' : 'Simpan Post'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────── */}
      {/* Modal: Edit Konten (Unified Movie / TV Series / Episode) */}
      {/* ────────────────────────────────────────── */}
      {isEditModalOpen && editingItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-[#0c1224] border border-white/15 rounded-2xl shadow-2xl overflow-hidden my-4">
            <div className="flex items-center justify-between p-3.5 border-b border-white/10 bg-white/5">
              <div className="flex items-center gap-1.5">
                <Edit2 size={15} className="text-cyan-400" />
                <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight">
                  Edit {editingItem.type === 'movie' ? 'Movie' : editingItem.type === 'tv_show' ? 'TV Series' : 'Episode'} ({editingItem.relativePath})
                </h3>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            {/* Navigation Tabs if editing a TV Show */}
            {editingItem.type === 'tv_show' && (
              <div className="flex items-center gap-1.5 px-3.5 sm:px-4 pt-2.5 border-b border-white/10">
                <button
                  type="button"
                  onClick={() => setEditShowTab('info')}
                  className={`py-1 px-2.5 rounded-t-md text-[11px] font-bold transition-all flex items-center gap-1 ${
                    editShowTab === 'info'
                      ? 'bg-white/10 text-white border-b-2 border-cyan-400'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <FileText size={12} />
                  <span>Informasi Series</span>
                </button>

                <button
                  type="button"
                  onClick={() => setEditShowTab('episodes')}
                  className={`py-1 px-2.5 rounded-t-md text-[11px] font-bold transition-all flex items-center gap-1 ${
                    editShowTab === 'episodes'
                      ? 'bg-purple-950/40 text-purple-300 border-b-2 border-purple-400'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Layers size={12} />
                  <span>Kelola Episode ({currentEditingShow?.episodes.length || 0})</span>
                </button>
              </div>
            )}

            {/* TV Show Episodes Manager Tab */}
            {editingItem.type === 'tv_show' && editShowTab === 'episodes' && currentEditingShow && (
              <div className="p-3.5 sm:p-4 space-y-2.5 max-h-[75vh] overflow-y-auto">
                <div className="flex items-center justify-between gap-2 flex-wrap pb-1">
                  <div>
                    <h4 className="text-xs font-bold text-white tracking-tight">
                      Episode {currentEditingShow.displayTitle}
                    </h4>
                    <p className="text-[10px] text-slate-400">
                      Kelola episode series ini secara langsung per season.
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleQuickAddEpisodeToEditShow(currentEditingShow, editActiveSeasonTab)}
                      className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-500 hover:bg-purple-400 text-white flex items-center gap-1 shadow-sm transition-all"
                    >
                      <Plus size={11} />
                      <span>Tambah Episode</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowEditBatchUrlInput(!showEditBatchUrlInput)}
                      className="px-2 py-0.5 rounded text-[11px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1 hover:bg-cyan-500/30 transition-all"
                    >
                      <Copy size={11} />
                      <span>Batch URLs</span>
                    </button>
                  </div>
                </div>

                {/* Batch URL Box for Existing Show */}
                {showEditBatchUrlInput && (
                  <div className="p-2.5 bg-cyan-950/30 border border-cyan-500/30 rounded space-y-1.5 animate-fade-in">
                    <label className="block text-[10px] font-bold text-cyan-300">
                      Tempelkan URL Video ke {formatSeasonLabel(editActiveSeasonTab)} (1 baris per episode):
                    </label>
                    <textarea
                      rows={3}
                      value={editBatchUrlsInput}
                      onChange={(e) => setEditBatchUrlsInput(e.target.value)}
                      placeholder={`https://example.com/ep1.mp4\nhttps://example.com/ep2.mp4`}
                      className="w-full p-1.5 bg-black/60 border border-white/10 rounded text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                    />
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setShowEditBatchUrlInput(false)}
                        className="px-2 py-0.5 text-[11px] text-slate-400 hover:text-white"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEditShowBatchPasteUrls(currentEditingShow, editActiveSeasonTab)}
                        className="px-2.5 py-0.5 bg-cyan-500 text-black font-bold rounded text-[11px] hover:bg-cyan-400"
                      >
                        Simpan Episode Baru
                      </button>
                    </div>
                  </div>
                )}

                {/* Ultra-Compact Season Tabs in Edit Modal */}
                {(() => {
                  const seasons = getShowSeasons(currentEditingShow);
                  return (
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 px-0.5">
                      {seasons.map((s) => {
                        const count = currentEditingShow.episodes.filter(
                          (ep) => (ep.seasonFolder || 's1').toLowerCase() === s.toLowerCase()
                        ).length;
                        const isActive = editActiveSeasonTab === s;
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => {
                              setEditActiveSeasonTab(s);
                              setSelectedEditEpPaths([]);
                              setEditModalSeasonPage(1);
                            }}
                            className={`px-2.5 py-1 rounded-md text-center transition-all flex flex-col items-center justify-center min-w-[62px] sm:min-w-[68px] gap-0.5 ${
                              isActive
                                ? 'bg-purple-700 text-white shadow-sm ring-1 ring-purple-400 border border-purple-400/40'
                                : 'bg-black/40 text-slate-300 hover:text-white hover:bg-white/5 border border-white/10'
                            }`}
                          >
                            <span className="text-[10.5px] font-bold tracking-tight">{formatSeasonLabel(s)}</span>
                            <span className={`text-[8.5px] font-semibold px-1.5 py-0.1 rounded-full border ${
                              isActive ? 'bg-black/50 text-purple-200 border-purple-400/30' : 'bg-white/5 text-slate-400 border-white/5'
                            }`}>
                              {count} Episode
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Multi-Select Action Bar in Edit Modal */}
                {(() => {
                  const seasonEps = currentEditingShow.episodes.filter(
                    (ep) => (ep.seasonFolder || 's1').toLowerCase() === editActiveSeasonTab.toLowerCase()
                  );
                  const seasonPaths = seasonEps.map((ep) => ep.relativePath);
                  const isAllSelected = seasonPaths.length > 0 && seasonPaths.every((p) => selectedEditEpPaths.includes(p));
                  const selectedCount = seasonEps.filter((ep) => selectedEditEpPaths.includes(ep.relativePath)).length;

                  const totalEditModalPages = Math.ceil(seasonEps.length / EPISODES_PER_SEASON_PAGE) || 1;
                  const pagedEditEpisodes = seasonEps.slice(
                    (editModalSeasonPage - 1) * EPISODES_PER_SEASON_PAGE,
                    editModalSeasonPage * EPISODES_PER_SEASON_PAGE
                  );

                  return (
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-1 p-1.5 bg-black/50 rounded border border-white/10">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleSelectAllEditEps(currentEditingShow, editActiveSeasonTab)}
                            className="flex items-center gap-1 text-[10px] font-semibold text-slate-300 hover:text-white select-none"
                          >
                            {isAllSelected ? (
                              <CheckSquare size={13} className="text-purple-400" />
                            ) : (
                              <Square size={13} className="text-slate-500" />
                            )}
                            <span>Pilih Semua</span>
                          </button>

                          {selectedCount > 0 && (
                            <button
                              type="button"
                              onClick={() => deleteSelectedEditEps(currentEditingShow, editActiveSeasonTab)}
                              className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30 flex items-center gap-0.5 transition-all"
                            >
                              <Trash2 size={10} />
                              <span>Hapus ({selectedCount})</span>
                            </button>
                          )}

                          {seasonEps.length > 0 && (
                            <button
                              type="button"
                              onClick={() => deleteAllEditEpsInSeason(currentEditingShow, editActiveSeasonTab)}
                              className="text-[9px] text-slate-500 hover:text-red-400 transition-colors"
                            >
                              Delete All Season Ini
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Episodes List in Season with Mini Pagination */}
                      <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                        {seasonEps.length === 0 ? (
                          <div className="p-3 text-center bg-black/20 rounded border border-white/5">
                            <p className="text-[11px] text-slate-400">Belum ada episode di {formatSeasonLabel(editActiveSeasonTab)}.</p>
                          </div>
                        ) : (
                          pagedEditEpisodes.map((ep) => {
                            const isSelected = selectedEditEpPaths.includes(ep.relativePath);
                            const epPoster = ep.posterUrl || ep.frontmatter.image_url;

                            return (
                              <div
                                key={ep.relativePath}
                                className={`p-1.5 rounded flex items-center justify-between gap-2 transition-all border ${
                                  isSelected
                                    ? 'bg-purple-950/30 border-purple-500/50'
                                    : 'bg-black/30 border-white/10 hover:border-white/20'
                                }`}
                              >
                                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                  <button
                                    type="button"
                                    onClick={() => toggleSelectEditEp(ep.relativePath)}
                                    className="text-slate-400 hover:text-purple-300 flex-shrink-0"
                                  >
                                    {isSelected ? (
                                      <CheckSquare size={13} className="text-purple-400" />
                                    ) : (
                                      <Square size={13} className="text-slate-500" />
                                    )}
                                  </button>

                                  <div className="relative w-12 h-7 rounded overflow-hidden bg-slate-900 border border-white/10 flex-shrink-0 shadow-sm">
                                    <SafeAdminImage src={epPoster} fallbackSrc={currentEditingShow.posterUrl} alt="Thumbnail" sizes="48px" />
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                      <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-pink-500/20 text-pink-300 border border-pink-500/30 whitespace-nowrap">
                                        Season {getSeasonNumber(ep.seasonFolder)}
                                      </span>
                                      <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-purple-500/20 text-purple-300 border border-purple-500/30 whitespace-nowrap">
                                        Episode {getEpisodeNumber(ep.slug || ep.filename)}
                                      </span>
                                    </div>
                                    <h5 className="font-bold text-xs sm:text-[12.5px] text-white line-clamp-2 leading-snug break-words">
                                      {ep.displayTitle || ep.frontmatter.title || ep.slug}
                                    </h5>
                                    <p className="text-[9.5px] font-mono text-slate-400 truncate mt-0.5" title={ep.frontmatter.videourl || ep.frontmatter.video_url || 'Belum ada link video'}>
                                      {ep.frontmatter.videourl || ep.frontmatter.video_url || 'Belum ada link video'}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openEditModal({
                                        type: 'tv_episode',
                                        relativePath: ep.relativePath,
                                        frontmatter: { ...ep.frontmatter },
                                        content: ep.content,
                                      })
                                    }
                                    className="p-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all"
                                    title="Edit Episode"
                                  >
                                    <Edit2 size={11} />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleDelete(ep.relativePath, ep.displayTitle)}
                                    className="p-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all"
                                    title="Hapus Episode"
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Mini Pagination for Edit Modal Episodes */}
                      {totalEditModalPages > 1 && (
                        <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[10px] text-slate-400 px-1">
                          <span>
                            Episode {(editModalSeasonPage - 1) * EPISODES_PER_SEASON_PAGE + 1} -{' '}
                            {Math.min(seasonEps.length, editModalSeasonPage * EPISODES_PER_SEASON_PAGE)} dari{' '}
                            {seasonEps.length}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={editModalSeasonPage <= 1}
                              onClick={() => setEditModalSeasonPage((p) => Math.max(1, p - 1))}
                              className="p-1 rounded bg-white/5 border border-white/10 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <ChevronLeft size={11} />
                            </button>
                            <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30 text-[9px]">
                              {editModalSeasonPage} / {totalEditModalPages}
                            </span>
                            <button
                              type="button"
                              disabled={editModalSeasonPage >= totalEditModalPages}
                              onClick={() => setEditModalSeasonPage((p) => Math.min(totalEditModalPages, p + 1))}
                              className="p-1 rounded bg-white/5 border border-white/10 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <ChevronRight size={11} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Standard Edit Form (Movie, TV Series Info, TV Episode) */}
            {!(editingItem.type === 'tv_show' && editShowTab === 'episodes') && (
              <form onSubmit={handleEditSubmit} className="p-3.5 sm:p-4 space-y-3 max-h-[75vh] overflow-y-auto">
                {/* TMDB ID */}
                {editingItem.type !== 'tv_episode' && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-slate-300">
                        TMDB ID / URL <span className="text-red-400 font-extrabold">*</span>
                      </label>
                      {editErrors.tmdb_id && (
                        <span className="text-[10px] font-bold text-red-400 flex items-center gap-1">
                          <AlertCircle size={10} /> {editErrors.tmdb_id}
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={editingItem.frontmatter.tmdb_id || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        const ext = extractTmdbIdAndType(val);
                        const cleanId = (val.includes('themoviedb.org') || val.includes('/movie/') || val.includes('/tv/')) && ext.id ? ext.id : val;
                        setEditingItem({
                          ...editingItem,
                          frontmatter: { ...editingItem.frontmatter, tmdb_id: cleanId },
                        });
                        if (val) {
                          setEditErrors((prev) => {
                            const next = { ...prev };
                            delete next.tmdb_id;
                            return next;
                          });
                        }
                      }}
                      placeholder="Contoh: 1084244 atau URL TMDB"
                      className={`w-full px-2.5 py-1.5 bg-black/40 rounded-lg text-xs text-white transition-all focus:outline-none ${
                        editErrors.tmdb_id
                          ? 'border border-red-500 ring-1 ring-red-500/20 bg-red-950/20'
                          : 'border border-white/10 focus:border-cyan-400'
                      }`}
                    />
                  </div>
                )}

                {/* Video URL */}
                {editingItem.type !== 'tv_show' && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-slate-300">
                        URL Video (videourl) <span className="text-red-400 font-extrabold">*</span>
                      </label>
                      {editErrors.videourl && (
                        <span className="text-[10px] font-bold text-red-400 flex items-center gap-1">
                          <AlertCircle size={10} /> {editErrors.videourl}
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={editingItem.frontmatter.videourl || editingItem.frontmatter.video_url || ''}
                      onChange={(e) => {
                        setEditingItem({
                          ...editingItem,
                          frontmatter: { ...editingItem.frontmatter, videourl: e.target.value },
                        });
                        if (e.target.value) {
                          setEditErrors((prev) => {
                            const next = { ...prev };
                            delete next.videourl;
                            return next;
                          });
                        }
                      }}
                      className={`w-full px-2.5 py-1.5 bg-black/40 rounded-lg text-xs text-white font-mono transition-all focus:outline-none ${
                        editErrors.videourl
                          ? 'border border-red-500 ring-1 ring-red-500/20 bg-red-950/20'
                          : 'border border-white/10 focus:border-cyan-400'
                      }`}
                    />
                  </div>
                )}

                {/* Title */}
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Judul (Title)</label>
                  <input
                    type="text"
                    value={editingItem.frontmatter.title || ''}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        frontmatter: { ...editingItem.frontmatter, title: e.target.value },
                      })
                    }
                    className="w-full px-2.5 py-1.5 bg-black/40 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                {/* Deskripsi */}
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Deskripsi</label>
                  <textarea
                    rows={2}
                    value={editingItem.frontmatter.deskripsi || editingItem.frontmatter.description || ''}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        frontmatter: { ...editingItem.frontmatter, deskripsi: e.target.value },
                      })
                    }
                    className="w-full px-2.5 py-1.5 bg-black/40 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                {/* Image URL with Backdrop Picker */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-medium text-slate-400">Poster / Image URL</label>
                    {(() => {
                      let tmdbIdNum = editingItem.frontmatter.tmdb_id;
                      if (!tmdbIdNum && editingItem.type === 'tv_episode') {
                        const showSlug = editingItem.relativePath.split('/')[1];
                        const show = tvShows.find((s) => s.showSlug === showSlug);
                        tmdbIdNum = show?.frontmatter.tmdb_id;
                      }
                      if (!tmdbIdNum) return null;
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            if (!editTmdbPreview) {
                              handleFetchEditTmdbPreview(
                                String(tmdbIdNum),
                                editingItem.type === 'movie' ? 'movie' : 'tv'
                              );
                            }
                            setShowEditBackdropPicker(!showEditBackdropPicker);
                          }}
                          className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-all"
                        >
                          <ImageIcon size={11} />
                          <span>
                            {editTmdbPreview?.backdrops && editTmdbPreview.backdrops.length > 0
                              ? `${showEditBackdropPicker ? 'Tutup' : 'Pilih Backdrop'} (${editTmdbPreview.backdrops.length})`
                              : fetchingEditTmdb
                              ? 'Mengambil...'
                              : 'Cari Backdrop'}
                          </span>
                        </button>
                      );
                    })()}
                  </div>
                  <input
                    type="text"
                    value={editingItem.frontmatter.image_url || editingItem.frontmatter.poster_path || ''}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        frontmatter: { ...editingItem.frontmatter, image_url: e.target.value },
                      })
                    }
                    placeholder="https://image.tmdb.org/... atau pilih dari galeri"
                    className="w-full px-2.5 py-1.5 bg-black/40 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-400"
                  />

                  {/* Backdrop Gallery Picker in Edit Modal */}
                  {editTmdbPreview?.backdrops && editTmdbPreview.backdrops.length > 0 && showEditBackdropPicker && (
                    <div className="mt-2 p-2.5 bg-[#090e1f] border border-cyan-500/30 rounded-lg space-y-2 animate-fade-in shadow-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-cyan-300 flex items-center gap-1">
                          <ImageIcon size={12} /> Pilih Gambar Backdrop ({editTmdbPreview.backdrops.length})
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowEditBackdropPicker(false)}
                          className="text-[10px] text-slate-400 hover:text-white"
                        >
                          Tutup
                        </button>
                      </div>

                      <div className="flex items-center gap-1 flex-wrap">
                        {(() => {
                          const availableLangs = Array.from(new Set(editTmdbPreview.backdrops!.map((b) => b.language)));
                          return [
                            { code: 'all', label: `Semua (${editTmdbPreview.backdrops!.length})` },
                            ...availableLangs.map((lang) => {
                              const count = editTmdbPreview.backdrops!.filter((b) => b.language === lang).length;
                              const langLabel =
                                lang === 'xx' || lang === 'null'
                                  ? `No Text (${count})`
                                  : lang.toUpperCase() === 'ID'
                                  ? `ID (${count})`
                                  : lang.toUpperCase() === 'EN'
                                  ? `EN (${count})`
                                  : `${lang.toUpperCase()} (${count})`;
                              return { code: lang, label: langLabel };
                            }),
                          ].map((tab) => (
                            <button
                              key={tab.code}
                              type="button"
                              onClick={() => setEditSelectedBackdropLang(tab.code)}
                              className={`px-1.5 py-0.2 rounded text-[9px] font-bold transition-all ${
                                editSelectedBackdropLang === tab.code
                                  ? 'bg-cyan-500 text-black'
                                  : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10'
                              }`}
                            >
                              {tab.label}
                            </button>
                          ));
                        })()}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 max-h-48 overflow-y-auto pr-1">
                        {editTmdbPreview.backdrops!
                          .filter((b) => editSelectedBackdropLang === 'all' || b.language === editSelectedBackdropLang)
                          .map((b, idx) => {
                            const isSelected =
                              editingItem.frontmatter.image_url === b.url ||
                              editingItem.frontmatter.image_url === b.originalUrl;
                            return (
                              <div
                                key={`${b.filePath}-${idx}`}
                                onClick={() => {
                                  setEditingItem({
                                    ...editingItem,
                                    frontmatter: { ...editingItem.frontmatter, image_url: b.url },
                                  });
                                  setShowEditBackdropPicker(false);
                                  showToast('Backdrop berhasil dipilih!');
                                }}
                                className={`group relative rounded overflow-hidden border cursor-pointer transition-all aspect-video ${
                                  isSelected
                                    ? 'ring-1 ring-cyan-400 border-cyan-400'
                                    : 'border-white/10 hover:border-cyan-500/50 bg-black/40'
                                }`}
                              >
                                <SafeAdminImage src={b.thumbUrl} alt="Backdrop" sizes="(max-width: 640px) 50vw, 25vw" />
                                <div className="absolute top-0.5 left-0.5">
                                  <span className="px-1 py-0.2 rounded text-[7px] font-bold bg-black/80 text-cyan-300">
                                    {b.language === 'xx' || b.language === 'null' ? 'No Text' : b.language.toUpperCase()}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Rating & Featured */}
                {editingItem.type !== 'tv_episode' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">Rating</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="10"
                        value={editingItem.frontmatter.rating || ''}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            frontmatter: { ...editingItem.frontmatter, rating: e.target.value },
                          })
                        }
                        className="w-full px-2 py-1 bg-black/40 border border-white/10 rounded-md text-xs text-white focus:outline-none focus:border-cyan-400"
                      />
                    </div>

                    <div
                      onClick={() =>
                        setEditingItem({
                          ...editingItem,
                          frontmatter: { ...editingItem.frontmatter, featured: !editingItem.frontmatter.featured },
                        })
                      }
                      className="flex items-center justify-between px-2.5 py-1 rounded-md bg-white/5 border border-white/10 hover:border-cyan-500/40 transition-all cursor-pointer select-none self-end h-[34px]"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Star size={12} className={editingItem.frontmatter.featured ? 'text-amber-400 fill-amber-400' : 'text-slate-400'} />
                        <div>
                          <p className="text-[10.5px] font-bold text-white select-none leading-none">Featured</p>
                          <p className="text-[8px] text-slate-400 select-none leading-none mt-0.5">Hero banner</p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(editingItem.frontmatter.featured)}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            frontmatter: { ...editingItem.frontmatter, featured: e.target.checked },
                          })
                        }
                        onClick={(e) => e.stopPropagation()}
                        className="w-3.5 h-3.5 rounded bg-black/40 border-white/20 text-cyan-500 focus:ring-cyan-400 cursor-pointer"
                      />
                    </div>
                  </div>
                )}

                {/* Subtitles & Duration */}
                {editingItem.type !== 'tv_show' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">Durasi</label>
                      <input
                        type="text"
                        value={editingItem.frontmatter.duration || ''}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            frontmatter: { ...editingItem.frontmatter, duration: e.target.value },
                          })
                        }
                        placeholder="Contoh: 45m"
                        className="w-full px-2.5 py-1.5 bg-black/40 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">Subtitles URL</label>
                      <input
                        type="text"
                        value={editingItem.frontmatter.subtitles || ''}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            frontmatter: { ...editingItem.frontmatter, subtitles: e.target.value },
                          })
                        }
                        placeholder="https://.../sub.vtt"
                        className="w-full px-2.5 py-1.5 bg-black/40 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
                      />
                    </div>
                  </div>
                )}

                {/* Submit Buttons */}
                <div className="flex items-center justify-end gap-1.5 pt-2.5 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-3 py-1 rounded-md text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-300 transition-all"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1 rounded-md text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-white shadow-sm transition-all"
                  >
                    Simpan Perubahan
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
