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
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createContentType, setCreateContentType] = useState<'movie' | 'tv_show' | 'tv_episode'>('movie');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EditingItemState | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ path: string; title: string; isBatch?: boolean; count?: number } | null>(null);

  // Batch selection
  const [selectedBatchPaths, setSelectedBatchPaths] = useState<string[]>([]);

  // Server-side Pagination (7 items per page)
  const ITEMS_PER_PAGE = 7;
  const [moviePage, setMoviePage] = useState(1);
  const [tvPage, setTvPage] = useState(1);
  const [totalMovies, setTotalMovies] = useState(0);
  const [totalTvShows, setTotalTvShows] = useState(0);
  const [totalMoviePages, setTotalMoviePages] = useState(1);
  const [totalTvPages, setTotalTvPages] = useState(1);
  const [totalAllMoviesCount, setTotalAllMoviesCount] = useState(0);
  const [totalAllTvShowsCount, setTotalAllTvShowsCount] = useState(0);
  const [totalEpisodesCount, setTotalEpisodesCount] = useState(0);

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

  // Debounce search query changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setMoviePage(1);
      setTvPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

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

  // Fetch paginated admin content
  const fetchContent = useCallback(
    async (options: { silent?: boolean; customMoviePage?: number; customTvPage?: number } = {}) => {
      if (!options.silent) setLoading(true);
      const mPage = options.customMoviePage !== undefined ? options.customMoviePage : moviePage;
      const tPage = options.customTvPage !== undefined ? options.customTvPage : tvPage;

      try {
        const queryParams = new URLSearchParams({
          tab: activeTab,
          moviePage: String(mPage),
          tvPage: String(tPage),
          search: debouncedSearch,
          limit: String(ITEMS_PER_PAGE),
        });

        const res = await fetch(`/api/admin/content?${queryParams.toString()}`, {
          headers: getHeaders(),
          cache: 'no-store',
        });

        if (res.ok) {
          const data = await res.json();
          setMovies(data.movies || []);
          setTvShows(data.tvShows || []);
          setTotalMovies(data.totalMovies || 0);
          setTotalTvShows(data.totalTvShows || 0);
          setTotalMoviePages(data.totalMoviePages || 1);
          setTotalTvPages(data.totalTvPages || 1);
          setTotalAllMoviesCount(data.totalAllMoviesCount !== undefined ? data.totalAllMoviesCount : (data.totalMovies || 0));
          setTotalAllTvShowsCount(data.totalAllTvShowsCount !== undefined ? data.totalAllTvShowsCount : (data.totalTvShows || 0));
          setTotalEpisodesCount(data.totalEpisodesCount || 0);
        } else {
          showToast('Gagal memuat konten admin', 'error');
        }
      } catch (err: any) {
        showToast('Koneksi ke API admin gagal', 'error');
      } finally {
        setLoading(false);
      }
    },
    [getHeaders, activeTab, moviePage, tvPage, debouncedSearch, showToast]
  );

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  // For backward compatibility and simplicity in components
  const paginatedMovies = movies;
  const paginatedTvShows = tvShows;
  const filteredMovies = movies;
  const filteredTvShows = tvShows;

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
    setMoviePage(1);
    setTvPage(1);
    fetchContent({ silent: true, customMoviePage: 1, customTvPage: 1 });
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

  // Check sync status on server and poll if in progress
  const pollSyncStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/github-sync', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();

      if (data.status === 'in_progress') {
        setSyncingGitHub(true);
        setTimeout(pollSyncStatus, 1500);
      } else if (data.status === 'completed') {
        setSyncingGitHub(false);
        const lastFinished = data.finishedAt ? Number(data.finishedAt) : 0;
        const lastNotified = Number(sessionStorage.getItem('last_notified_sync') || '0');
        if (lastFinished > lastNotified) {
          sessionStorage.setItem('last_notified_sync', String(lastFinished));
          showToast(data.message || `Sinkronisasi berhasil! ${data.syncedCount || 0} file dipush ke GitHub.`, 'success');
          fetchContent({ silent: true });
        }
      } else if (data.status === 'error') {
        setSyncingGitHub(false);
        const lastFinished = data.finishedAt ? Number(data.finishedAt) : 0;
        const lastNotified = Number(sessionStorage.getItem('last_notified_sync') || '0');
        if (lastFinished > lastNotified) {
          sessionStorage.setItem('last_notified_sync', String(lastFinished));
          showToast(data.error || 'Gagal menyinkronkan ke GitHub', 'error');
        }
      }
    } catch {}
  }, [fetchContent, showToast]);

  // Initial check on mount / refresh
  useEffect(() => {
    pollSyncStatus();
  }, [pollSyncStatus]);

  const handleManualSyncToGitHub = async () => {
    setSyncingGitHub(true);
    showToast('Menyinkronkan konten ke GitHub di background server...');

    try {
      const res = await fetch('/api/admin/github-sync', {
        method: 'POST',
        headers: getHeaders(),
      });

      const result = await res.json();
      if (res.ok) {
        // Start polling server-side progress
        setTimeout(pollSyncStatus, 1000);
      } else {
        setSyncingGitHub(false);
        if (result.requiresToken) setIsSettingsOpen(true);
        showToast(result.error || 'Gagal memulai sinkronisasi ke GitHub', 'error');
      }
    } catch {
      setSyncingGitHub(false);
      showToast('Koneksi ke API sync gagal', 'error');
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
    totalMovies,
    totalTvShows,
    totalAllMoviesCount,
    totalAllTvShowsCount,
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
