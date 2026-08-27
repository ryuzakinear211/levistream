import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  MovieItem,
  TVShowItem,
  TVEpisodeItem,
  EditingItemState,
  ToastNotification,
} from '../types';

export function useAdminData() {
  const [movies, setMovies] = useState<MovieItem[]>([]);
  const [tvShows, setTvShows] = useState<TVShowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'movies' | 'tv'>('movies');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createContentType, setCreateContentType] = useState<'movie' | 'tv_show' | 'tv_episode'>('movie');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EditingItemState | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ path: string; title: string; isBatch?: boolean; count?: number } | null>(null);

  // Batch selection
  const [selectedBatchPaths, setSelectedBatchPaths] = useState<string[]>([]);

  // Pagination
  const [moviePage, setMoviePage] = useState(1);
  const [tvPage, setTvPage] = useState(1);
  const ITEMS_PER_PAGE = 12;

  // GitHub Settings
  const [ghToken, setGhToken] = useState('');
  const [ghOwner, setGhOwner] = useState('genstava789');
  const [ghRepo, setGhRepo] = useState('filmes');
  const [ghBranch, setGhBranch] = useState('main');

  // Toasts
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  // Load GitHub credentials from localStorage
  useEffect(() => {
    try {
      const savedToken = localStorage.getItem('gh_token') || '';
      const savedOwner = localStorage.getItem('gh_owner') || 'genstava789';
      const savedRepo = localStorage.getItem('gh_repo') || 'filmes';
      const savedBranch = localStorage.getItem('gh_branch') || 'main';
      if (savedToken) setGhToken(savedToken);
      if (savedOwner) setGhOwner(savedOwner);
      if (savedRepo) setGhRepo(savedRepo);
      if (savedBranch) setGhBranch(savedBranch);
    } catch {}
  }, []);

  const saveSettings = useCallback(() => {
    try {
      localStorage.setItem('gh_token', ghToken.trim());
      localStorage.setItem('gh_owner', ghOwner.trim());
      localStorage.setItem('gh_repo', ghRepo.trim());
      localStorage.setItem('gh_branch', ghBranch.trim());
      setIsSettingsOpen(false);
      showToast('Pengaturan GitHub berhasil disimpan!');
    } catch {
      showToast('Gagal menyimpan pengaturan ke localStorage', 'error');
    }
  }, [ghToken, ghOwner, ghRepo, ghBranch, showToast]);

  const getHeaders = useCallback((): Record<string, string> => {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (ghToken) h['x-github-token'] = ghToken.trim();
    if (ghOwner) h['x-github-owner'] = ghOwner.trim();
    if (ghRepo) h['x-github-repo'] = ghRepo.trim();
    if (ghBranch) h['x-github-branch'] = ghBranch.trim();
    return h;
  }, [ghToken, ghOwner, ghRepo, ghBranch]);

  // Fetch all admin content
  const fetchContent = useCallback(
    async (options: { silent?: boolean } = {}) => {
      if (!options.silent) setLoading(true);
      try {
        const res = await fetch('/api/admin/content', {
          headers: getHeaders(),
          cache: 'no-store',
        });
        if (res.ok) {
          const data = await res.json();
          setMovies(data.movies || []);
          setTvShows(data.tvShows || []);
        } else {
          showToast('Gagal memuat konten admin', 'error');
        }
      } catch (err: any) {
        showToast('Koneksi ke API admin gagal', 'error');
      } finally {
        setLoading(false);
      }
    },
    [getHeaders, showToast]
  );

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  // Filtered lists
  const filteredMovies = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return movies;
    return movies.filter((m) => {
      const title = (m.displayTitle || m.frontmatter.title || m.slug).toLowerCase();
      const tmdbId = String(m.frontmatter.tmdb_id || '');
      return title.includes(q) || tmdbId.includes(q) || m.slug.includes(q);
    });
  }, [movies, searchQuery]);

  const filteredTvShows = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return tvShows;
    return tvShows.filter((s) => {
      const title = (s.displayTitle || s.frontmatter.title || s.showSlug).toLowerCase();
      const tmdbId = String(s.frontmatter.tmdb_id || '');
      return title.includes(q) || tmdbId.includes(q) || s.showSlug.includes(q);
    });
  }, [tvShows, searchQuery]);

  // Paged lists
  const totalMoviePages = Math.ceil(filteredMovies.length / ITEMS_PER_PAGE) || 1;
  const paginatedMovies = useMemo(() => {
    const start = (moviePage - 1) * ITEMS_PER_PAGE;
    return filteredMovies.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredMovies, moviePage]);

  const totalTvPages = Math.ceil(filteredTvShows.length / ITEMS_PER_PAGE) || 1;
  const paginatedTvShows = useMemo(() => {
    const start = (tvPage - 1) * ITEMS_PER_PAGE;
    return filteredTvShows.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredTvShows, tvPage]);

  // Total Episode count across all shows
  const totalEpisodesCount = useMemo(() => {
    return tvShows.reduce((acc, s) => acc + (s.episodes?.length || 0), 0);
  }, [tvShows]);

  // CRUD Handlers
  const handleCreateSubmit = async (payload: any) => {
    showToast('Menyimpan konten baru...');
    const res = await fetch('/api/admin/content/create', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });

    const result = await res.json();
    if (!res.ok) {
      if (result.requiresToken) setIsSettingsOpen(true);
      throw new Error(result.error || 'Gagal membuat konten');
    }

    showToast('Konten berhasil dibuat & live!');
    fetchContent({ silent: true });
  };

  const handleEditSubmit = async (item: any) => {
    showToast('Menyimpan perubahan...');
    const res = await fetch('/api/admin/content/edit', {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({
        relativePath: item.relativePath,
        frontmatter: item.frontmatter,
        content: item.content,
        episodes: item.episodes,
      }),
    });

    const result = await res.json();
    if (!res.ok) {
      if (result.requiresToken) setIsSettingsOpen(true);
      throw new Error(result.error || 'Gagal menyimpan perubahan');
    }

    showToast('Perubahan berhasil disimpan & live!');
    fetchContent({ silent: true });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const { path, isBatch, count } = deleteTarget;
    setDeleteTarget(null);

    showToast(isBatch ? `Menghapus ${count} konten...` : 'Menghapus konten...');

    try {
      const res = await fetch('/api/admin/content/delete', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(isBatch ? { paths: selectedBatchPaths } : { path }),
      });

      const result = await res.json();
      if (res.ok) {
        showToast(isBatch ? `${count} konten berhasil dihapus!` : 'Konten berhasil dihapus!');
        if (isBatch) setSelectedBatchPaths([]);
        fetchContent({ silent: true });
      } else {
        if (result.requiresToken) setIsSettingsOpen(true);
        showToast(result.error || 'Gagal menghapus konten', 'error');
      }
    } catch {
      showToast('Gagal menghapus konten', 'error');
    }
  };

  const [syncingGitHub, setSyncingGitHub] = useState(false);

  const handleManualSyncToGitHub = async () => {
    setSyncingGitHub(true);
    showToast('Menyinkronkan semua konten ke GitHub...');

    try {
      const res = await fetch('/api/admin/github-sync', {
        method: 'POST',
        headers: getHeaders(),
      });

      const result = await res.json();
      if (res.ok) {
        showToast(
          `Sinkronisasi berhasil! ${result.syncedCount} file dipush ke GitHub.`,
          'success'
        );
      } else {
        if (result.requiresToken) setIsSettingsOpen(true);
        showToast(result.error || 'Gagal menyinkronkan ke GitHub', 'error');
      }
    } catch {
      showToast('Koneksi ke API sync gagal', 'error');
    } finally {
      setSyncingGitHub(false);
    }
  };

  const toggleBatchSelect = (path: string) => {
    setSelectedBatchPaths((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    );
  };

  return {
    movies,
    tvShows,
    loading,
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    filteredMovies,
    filteredTvShows,
    paginatedMovies,
    paginatedTvShows,
    moviePage,
    setMoviePage,
    totalMoviePages,
    tvPage,
    setTvPage,
    totalTvPages,
    totalEpisodesCount,
    isCreateModalOpen,
    setIsCreateModalOpen,
    createContentType,
    setCreateContentType,
    isEditModalOpen,
    setIsEditModalOpen,
    editingItem,
    setEditingItem,
    isSettingsOpen,
    setIsSettingsOpen,
    deleteTarget,
    setDeleteTarget,
    selectedBatchPaths,
    setSelectedBatchPaths,
    toggleBatchSelect,
    ghToken,
    setGhToken,
    ghOwner,
    setGhOwner,
    ghRepo,
    setGhRepo,
    ghBranch,
    setGhBranch,
    saveSettings,
    toasts,
    showToast,
    fetchContent,
    handleCreateSubmit,
    handleEditSubmit,
    handleDeleteConfirm,
    handleManualSyncToGitHub,
    syncingGitHub,
  };
}
