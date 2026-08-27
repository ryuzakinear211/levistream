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
} from 'lucide-react';

interface AdminNavbarProps {
  activeTab: 'movies' | 'tv';
  setActiveTab: (tab: 'movies' | 'tv') => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
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
  onManualSyncGitHub: () => void;
  syncingGitHub: boolean;
}

export const AdminNavbar: React.FC<AdminNavbarProps> = ({
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery,
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
  onManualSyncGitHub,
  syncingGitHub,
}) => {
  return (
    <div className="space-y-3.5">
      {/* Top Main Bar */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-[#090e1f] border border-white/10 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Heading - Clean 'CMS Dashboard' */}
          <h1 className="text-lg sm:text-xl font-black text-white tracking-tight">
            CMS Dashboard
          </h1>

          {/* Action & Utility Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            {selectedBatchCount > 0 && (
              <button
                onClick={onBatchDelete}
                className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 flex items-center gap-1 transition-all shadow-sm active:scale-95"
              >
                <Trash2 size={13} />
                <span>Hapus ({selectedBatchCount})</span>
              </button>
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

        {/* Primary Action Buttons - Responsive 2-column grid on mobile, inline on desktop */}
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

      {/* Tabs & Search Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 bg-[#090e1f] rounded-xl border border-white/10 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('movies')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
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
            className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
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
        <div className="relative w-full sm:max-w-xs">
          <Search
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Cari ${activeTab === 'movies' ? 'film' : 'series'}...`}
            className="w-full pl-10 pr-3.5 py-2.5 bg-[#090e1f] border border-white/10 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-all min-h-[40px]"
          />
        </div>
      </div>
    </div>
  );
};
