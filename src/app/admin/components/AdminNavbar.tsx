import React from 'react';
import {
  Film,
  Tv,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Trash2,
  CheckCircle2,
  AlertCircle,
  CloudUpload,
  ArrowUpDown,
  Globe,
  Flame,
  XCircle,
  ChevronDown,
} from 'lucide-react';

interface AdminNavbarProps {
  activeTab: 'movies' | 'tv';
  setActiveTab: (tab: 'movies' | 'tv') => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  sortOrder: 'newest' | 'oldest' | 'rating' | 'title' | 'weight';
  setSortOrder: (s: 'newest' | 'oldest' | 'rating' | 'title' | 'weight') => void;
  filterLanguage: 'all' | 'ID' | 'KR' | 'EN' | 'JP' | 'TH' | 'CN';
  setFilterLanguage: (l: 'all' | 'ID' | 'KR' | 'EN' | 'JP' | 'TH' | 'CN') => void;
  filterStatus: 'all' | 'trending' | 'featured';
  setFilterStatus: (st: 'all' | 'trending' | 'featured') => void;
  moviesCount: number;
  tvShowsCount: number;
  totalEpisodesCount?: number;
  loading: boolean;
  onRefresh: () => void;
  onOpenCreateMovie: () => void;
  onOpenCreateTV: () => void;
  onOpenSettings: () => void;
  hasToken: boolean;
  selectedBatchCount: number;
  onBatchDelete: () => void;
  onClearSelection?: () => void;
  onManualSyncGitHub: () => void;
  syncingGitHub: boolean;
}

export const AdminNavbar: React.FC<AdminNavbarProps> = ({
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery,
  sortOrder,
  setSortOrder,
  filterLanguage,
  setFilterLanguage,
  filterStatus,
  setFilterStatus,
  moviesCount,
  tvShowsCount,
  loading,
  onRefresh,
  onOpenCreateMovie,
  onOpenCreateTV,
  onOpenSettings,
  hasToken,
  selectedBatchCount,
  onBatchDelete,
  onClearSelection,
  onManualSyncGitHub,
  syncingGitHub,
}) => {
  return (
    <div className="space-y-3.5">
      {/* Top Main Bar */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-[#090e1f] border border-white/10 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Heading */}
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg sm:text-xl font-black text-white tracking-tight">
              CMS Dashboard
            </h1>
            {selectedBatchCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                {selectedBatchCount} Terpilih
              </span>
            )}
          </div>

          {/* Action & Utility Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            {selectedBatchCount > 0 && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={onBatchDelete}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-red-500 hover:bg-red-400 text-white flex items-center gap-1.5 transition-all shadow-md shadow-red-500/20 active:scale-95 animate-pulse"
                >
                  <Trash2 size={13} />
                  <span>Hapus Terpilih ({selectedBatchCount})</span>
                </button>
                {onClearSelection && (
                  <button
                    onClick={onClearSelection}
                    className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                    title="Batalkan Seleksi"
                  >
                    <XCircle size={15} />
                  </button>
                )}
              </div>
            )}

            {/* Manual Push to GitHub Button */}
            <button
              onClick={onManualSyncGitHub}
              disabled={syncingGitHub}
              className={`px-3.5 py-2 rounded-xl border text-xs font-extrabold transition-all active:scale-95 flex items-center gap-1.5 shadow-md ${
                syncingGitHub
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white border-purple-400/40 shadow-purple-900/30'
              }`}
              title="Push seluruh perubahan lokal & CMS ke GitHub Repository"
            >
              <CloudUpload size={15} className={syncingGitHub ? 'animate-bounce' : ''} />
              <span>{syncingGitHub ? 'Memproses Push...' : 'Push to GitHub'}</span>
            </button>

            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-all active:scale-95 disabled:opacity-50"
              title="Refresh Data"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin text-cyan-400' : ''} />
            </button>

            <button
              onClick={onOpenSettings}
              className={`px-2.5 py-1.5 rounded-xl border transition-all active:scale-95 flex items-center gap-1.5 ${
                hasToken
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
              }`}
              title="Pengaturan GitHub"
            >
              {hasToken ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
              <span className="text-xs font-semibold hidden xs:inline">
                {hasToken ? 'GitHub' : 'Token'}
              </span>
            </button>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="grid grid-cols-2 sm:flex sm:items-center sm:justify-end gap-2 pt-1 border-t border-white/5">
          <button
            onClick={onOpenCreateMovie}
            className="w-full sm:w-auto px-4 py-2.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold bg-cyan-500 hover:bg-cyan-400 text-black flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-cyan-500/20 active:scale-95 min-h-[40px]"
          >
            <Plus size={15} />
            <span>Tambah Movie</span>
          </button>

          <button
            onClick={onOpenCreateTV}
            className="w-full sm:w-auto px-4 py-2.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold bg-pink-500 hover:bg-pink-400 text-white flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-pink-500/20 active:scale-95 min-h-[40px]"
          >
            <Plus size={15} />
            <span>Tambah TV Series</span>
          </button>
        </div>
      </div>

      {/* Tabs & Search & Filter Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 p-3 bg-[#090e1f] rounded-2xl border border-white/10 shadow-md">
        {/* Left: Tabs & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 min-w-0">
          {/* Tabs */}
          <div className="flex items-center gap-1 p-1 bg-black/40 rounded-xl border border-white/10 w-full sm:w-auto flex-shrink-0">
            <button
              onClick={() => setActiveTab('movies')}
              className={`flex-1 sm:flex-none px-3.5 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'movies'
                  ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Film size={14} />
              <span>Movies ({moviesCount})</span>
            </button>

            <button
              onClick={() => setActiveTab('tv')}
              className={`flex-1 sm:flex-none px-3.5 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'tv'
                  ? 'bg-pink-500 text-white shadow-md shadow-pink-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Tv size={14} />
              <span>TV Series ({tvShowsCount})</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 min-w-[180px]">
            <Search
              size={14}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Cari ${activeTab === 'movies' ? 'film' : 'series'}...`}
              className="w-full pl-9 pr-3.5 py-2 bg-black/40 border border-white/10 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-all min-h-[40px]"
            />
          </div>
        </div>

        {/* Right: Filter & Sort Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:flex items-center gap-2 w-full lg:w-auto">
          {/* Sort Dropdown */}
          <div className="relative flex items-center bg-black/50 border border-white/10 hover:border-white/20 focus-within:border-cyan-500 rounded-xl px-3 py-1.5 transition-all min-h-[40px]">
            <ArrowUpDown size={14} className="text-cyan-400 flex-shrink-0 mr-2 pointer-events-none" />
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="bg-transparent text-xs font-semibold text-slate-200 focus:outline-none cursor-pointer w-full appearance-none pr-6 truncate"
              aria-label="Urutkan Konten"
            >
              <option value="newest" className="bg-[#090e1f] text-white">Terbaru</option>
              <option value="oldest" className="bg-[#090e1f] text-white">Terlama</option>
              <option value="weight" className="bg-[#090e1f] text-white">Weight Terkecil</option>
              <option value="rating" className="bg-[#090e1f] text-white">Rating Tertinggi</option>
              <option value="title" className="bg-[#090e1f] text-white">Judul A-Z</option>
            </select>
            <ChevronDown size={13} className="text-slate-400 absolute right-2.5 pointer-events-none flex-shrink-0" />
          </div>

          {/* Language Filter */}
          <div className="relative flex items-center bg-black/50 border border-white/10 hover:border-white/20 focus-within:border-blue-500 rounded-xl px-3 py-1.5 transition-all min-h-[40px]">
            <Globe size={14} className="text-blue-400 flex-shrink-0 mr-2 pointer-events-none" />
            <select
              value={filterLanguage}
              onChange={(e) => setFilterLanguage(e.target.value as any)}
              className="bg-transparent text-xs font-semibold text-slate-200 focus:outline-none cursor-pointer w-full appearance-none pr-6 truncate"
              aria-label="Filter Bahasa"
            >
              <option value="all" className="bg-[#090e1f] text-white">Semua Bahasa</option>
              <option value="ID" className="bg-[#090e1f] text-white">ID - Indonesia</option>
              <option value="KR" className="bg-[#090e1f] text-white">KR - Korea</option>
              <option value="EN" className="bg-[#090e1f] text-white">EN - English</option>
              <option value="JP" className="bg-[#090e1f] text-white">JP - Jepang</option>
              <option value="TH" className="bg-[#090e1f] text-white">TH - Thailand</option>
              <option value="CN" className="bg-[#090e1f] text-white">CN - China</option>
            </select>
            <ChevronDown size={13} className="text-slate-400 absolute right-2.5 pointer-events-none flex-shrink-0" />
          </div>

          {/* Status Filter */}
          <div className="relative flex items-center bg-black/50 border border-white/10 hover:border-white/20 focus-within:border-rose-500 rounded-xl px-3 py-1.5 transition-all min-h-[40px]">
            <Flame size={14} className="text-rose-400 flex-shrink-0 mr-2 pointer-events-none" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="bg-transparent text-xs font-semibold text-slate-200 focus:outline-none cursor-pointer w-full appearance-none pr-6 truncate"
              aria-label="Filter Status"
            >
              <option value="all" className="bg-[#090e1f] text-white">Semua Status</option>
              <option value="trending" className="bg-[#090e1f] text-white">Trending</option>
              <option value="featured" className="bg-[#090e1f] text-white">Featured Hero</option>
            </select>
            <ChevronDown size={13} className="text-slate-400 absolute right-2.5 pointer-events-none flex-shrink-0" />
          </div>
        </div>
      </div>
    </div>
  );
};


