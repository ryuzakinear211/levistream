'use client';

import React from 'react';
import { useAdminData } from './hooks/useAdminData';
import { AdminNavbar } from './components/AdminNavbar';
import { MovieListView } from './components/MovieListView';
import { TVListView } from './components/TVListView';
import { CreateModal } from './components/CreateModal';
import { EditModal } from './components/EditModal';
import { SettingsModal } from './components/SettingsModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';

export default function AdminPage() {
  const admin = useAdminData();

  return (
    <div className="min-h-screen bg-[#050816] text-white p-3 sm:p-6 lg:p-8 space-y-6">
      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {admin.toasts.map((toast) => (
          <div
            key={toast.id}
            className={`p-3.5 rounded-xl shadow-2xl border flex items-center gap-2.5 text-xs font-semibold backdrop-blur-md pointer-events-auto animate-slide-in ${
              toast.type === 'error'
                ? 'bg-red-950/90 border-red-500/50 text-red-200'
                : 'bg-[#09152b]/95 border-cyan-500/40 text-cyan-200'
            }`}
          >
            {toast.type === 'error' ? (
              <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
            ) : (
              <CheckCircle size={16} className="text-cyan-400 flex-shrink-0" />
            )}
            <span className="flex-1">{toast.message}</span>
          </div>
        ))}
      </div>

      {/* Main Admin Navbar */}
      <AdminNavbar
        activeTab={admin.activeTab}
        setActiveTab={admin.setActiveTab}
        searchQuery={admin.searchQuery}
        setSearchQuery={admin.setSearchQuery}
        moviesCount={admin.totalAllMoviesCount}
        tvShowsCount={admin.totalAllTvShowsCount}
        totalEpisodesCount={admin.totalEpisodesCount}
        loading={admin.loading}
        onRefresh={() => admin.fetchContent()}
        onOpenCreateMovie={() => {
          admin.setCreateContentType('movie');
          admin.setIsCreateModalOpen(true);
        }}
        onOpenCreateTV={() => {
          admin.setCreateContentType('tv_show');
          admin.setIsCreateModalOpen(true);
        }}
        onOpenSettings={() => admin.setIsSettingsOpen(true)}
        hasToken={Boolean(admin.ghToken)}
        selectedBatchCount={admin.selectedBatchPaths.length}
        onBatchDelete={() => {
          admin.setDeleteTarget({
            path: `${admin.selectedBatchPaths.length} file terpilih`,
            title: `${admin.selectedBatchPaths.length} Konten`,
            isBatch: true,
            count: admin.selectedBatchPaths.length,
          });
        }}
        onManualSyncGitHub={admin.handleManualSyncToGitHub}
        syncingGitHub={admin.syncingGitHub}
      />

      {/* Content Area */}
      {admin.loading ? (
        <div className="py-24 text-center text-slate-400">
          <RefreshCw size={28} className="animate-spin mx-auto mb-3 text-cyan-400" />
          <p className="text-xs font-semibold">Memuat data CMS...</p>
        </div>
      ) : admin.activeTab === 'movies' ? (
        <MovieListView
          movies={admin.paginatedMovies}
          totalMoviesCount={admin.totalMovies}
          searchQuery={admin.searchQuery}
          currentPage={admin.moviePage}
          totalPages={admin.totalMoviePages}
          onPageChange={admin.setMoviePage}
          onOpenCreate={() => {
            admin.setCreateContentType('movie');
            admin.setIsCreateModalOpen(true);
          }}
          onOpenEdit={(movie) => {
            admin.setEditingItem({
              type: 'movie',
              relativePath: movie.relativePath,
              frontmatter: { ...movie.frontmatter },
              content: movie.content,
            });
            admin.setIsEditModalOpen(true);
          }}
          onDelete={(relativePath, title) => {
            admin.setDeleteTarget({ path: relativePath, title });
          }}
          selectedPaths={admin.selectedBatchPaths}
          onToggleSelect={admin.toggleBatchSelect}
        />
      ) : (
        <TVListView
          tvShows={admin.paginatedTvShows}
          totalShowsCount={admin.totalTvShows}
          searchQuery={admin.searchQuery}
          currentPage={admin.tvPage}
          totalPages={admin.totalTvPages}
          onPageChange={admin.setTvPage}
          onOpenCreate={() => {
            admin.setCreateContentType('tv_show');
            admin.setIsCreateModalOpen(true);
          }}
          onOpenEdit={(show) => {
            admin.setEditingItem({
              type: 'tv_show',
              relativePath: show.relativePath,
              frontmatter: { ...show.frontmatter },
              content: show.content,
            });
            admin.setIsEditModalOpen(true);
          }}
          onOpenEditEpisode={(ep) => {
            admin.setEditingItem({
              type: 'tv_episode',
              relativePath: ep.relativePath,
              frontmatter: { ...ep.frontmatter },
              content: ep.content,
            });
            admin.setIsEditModalOpen(true);
          }}
          onDeleteShow={(path, title) => {
            admin.setDeleteTarget({ path, title });
          }}
          onDeleteEpisode={(path, title) => {
            admin.setDeleteTarget({ path, title });
          }}
          onQuickAddEpisode={(show, seasonSlug) => {
            admin.setCreateContentType('tv_episode');
            admin.setIsCreateModalOpen(true);
          }}
        />
      )}

      {/* Create Modal */}
      <CreateModal
        isOpen={admin.isCreateModalOpen}
        onClose={() => admin.setIsCreateModalOpen(false)}
        contentType={admin.createContentType}
        setContentType={admin.setCreateContentType}
        onSubmit={admin.handleCreateSubmit}
        movies={admin.movies}
        tvShows={admin.tvShows}
        showToast={admin.showToast}
      />

      {/* Edit Modal */}
      <EditModal
        isOpen={admin.isEditModalOpen}
        onClose={() => {
          admin.setIsEditModalOpen(false);
          admin.setEditingItem(null);
        }}
        editingItem={admin.editingItem}
        setEditingItem={admin.setEditingItem}
        onSubmit={admin.handleEditSubmit}
        tvShows={admin.tvShows}
        showToast={admin.showToast}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={admin.isSettingsOpen}
        onClose={() => admin.setIsSettingsOpen(false)}
        ghToken={admin.ghToken}
        setGhToken={admin.setGhToken}
        ghOwner={admin.ghOwner}
        setGhOwner={admin.setGhOwner}
        ghRepo={admin.ghRepo}
        setGhRepo={admin.setGhRepo}
        ghBranch={admin.ghBranch}
        setGhBranch={admin.setGhBranch}
        onSave={admin.saveSettings}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={Boolean(admin.deleteTarget)}
        onClose={() => admin.setDeleteTarget(null)}
        onConfirm={admin.handleDeleteConfirm}
        title={admin.deleteTarget?.title || ''}
        path={admin.deleteTarget?.path || ''}
        isBatch={admin.deleteTarget?.isBatch}
        count={admin.deleteTarget?.count}
      />
    </div>
  );
}
