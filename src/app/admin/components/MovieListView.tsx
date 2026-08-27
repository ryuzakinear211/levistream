import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Film, Plus, ExternalLink, Edit2, Trash2, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { MovieItem } from '../types';
import { getMovieUrl } from '@/lib/urls';

interface MovieListViewProps {
  movies: MovieItem[];
  totalMoviesCount: number;
  searchQuery: string;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onOpenCreate: () => void;
  onOpenEdit: (movie: MovieItem) => void;
  onDelete: (relativePath: string, title: string) => void;
  selectedPaths: string[];
  onToggleSelect: (path: string) => void;
}

function SafeAdminImage({ src, alt, sizes }: { src: string | null | undefined; alt: string; sizes?: string }) {
  const [error, setError] = React.useState(false);

  if (!src || error) {
    return (
      <div className="w-full h-full bg-slate-800 flex items-center justify-center text-slate-500">
        <Film size={20} />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes || '80px'}
      onError={() => setError(true)}
      className="object-cover"
    />
  );
}

export const MovieListView: React.FC<MovieListViewProps> = ({
  movies,
  totalMoviesCount,
  searchQuery,
  currentPage,
  totalPages,
  onPageChange,
  onOpenCreate,
  onOpenEdit,
  onDelete,
  selectedPaths,
  onToggleSelect,
}) => {
  if (movies.length === 0) {
    return (
      <div className="py-16 text-center bg-[#090e1f] rounded-2xl border border-white/5 p-6">
        <Film size={36} className="mx-auto mb-3 text-slate-600" />
        <h3 className="text-sm font-bold text-white mb-1">Belum Ada Movie Ditemukan</h3>
        <p className="text-xs text-slate-400 mb-4 max-w-sm mx-auto">
          {searchQuery
            ? 'Tidak ada film yang cocok dengan kata kunci pencarian Anda.'
            : 'Mulai tambahkan movie baru dengan TMDB ID atau judul.'}
        </p>
        <button
          onClick={onOpenCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-black transition-all shadow-lg shadow-cyan-500/20 active:scale-95"
        >
          <Plus size={14} />
          <span>Tambah Movie Baru</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
        {movies.map((movie) => {
          const title = movie.displayTitle || movie.frontmatter.title || movie.slug;
          const tmdbId = movie.frontmatter.tmdb_id;
          const poster = movie.posterUrl || movie.frontmatter.image_url || movie.frontmatter.poster_path;
          const isFeatured = Boolean(movie.frontmatter.featured);
          const rating = movie.rating || movie.frontmatter.rating;
          const isSelected = selectedPaths.includes(movie.relativePath);

          return (
            <div
              key={movie.relativePath}
              className={`p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-[#0c1224] border transition-all flex flex-col justify-between shadow-sm relative group ${
                isSelected
                  ? 'border-cyan-400 bg-[#0d1733]'
                  : 'border-white/10 hover:border-cyan-500/40'
              }`}
            >
              <div>
                <div className="flex items-start gap-3 mb-2.5">
                  <div
                    onClick={() => onToggleSelect(movie.relativePath)}
                    className="relative w-16 sm:w-20 aspect-[2/3] min-h-[96px] sm:min-h-[120px] rounded-lg sm:rounded-xl overflow-hidden bg-slate-900 flex-shrink-0 border border-white/15 shadow-md cursor-pointer"
                  >
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

                    <h3
                      className="font-extrabold text-white text-xs sm:text-sm leading-snug line-clamp-2 cursor-pointer hover:text-cyan-300 transition-colors"
                      title={title}
                      onClick={() => onOpenEdit(movie)}
                    >
                      {title}{' '}
                      {movie.year ? (
                        <span className="text-slate-400 font-normal text-xs">({movie.year})</span>
                      ) : (
                        ''
                      )}
                    </h3>

                    {rating ? (
                      <p className="text-[11px] sm:text-xs text-amber-400 font-black mt-1 flex items-center gap-1">
                        <Star size={11} fill="currentColor" /> {rating}
                      </p>
                    ) : null}

                    <p
                      className="text-[9.5px] sm:text-[10px] text-slate-500 font-mono truncate mt-1"
                      title={movie.relativePath}
                    >
                      {movie.relativePath}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2.5 border-t border-white/10 mt-1">
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
                    onClick={() => onOpenEdit(movie)}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white transition-all shadow-sm active:scale-95"
                    title="Edit Post"
                  >
                    <Edit2 size={13} />
                  </button>

                  <button
                    onClick={() => onDelete(movie.relativePath, title)}
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

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-white/10">
          <span className="text-xs text-slate-400">
            Halaman {currentPage} dari {totalPages} ({totalMoviesCount} total)
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={currentPage <= 1}
              onClick={() => onPageChange(currentPage - 1)}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-all"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="px-3 py-1 text-xs font-bold text-white bg-cyan-500/20 rounded-lg border border-cyan-500/30">
              {currentPage}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(currentPage + 1)}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-all"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
