'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Play, Star, Tv, Film } from 'lucide-react';
import { Movie, TVShow } from '@/types/tmdb';
import { getImageUrl } from '@/lib/tmdb';
import { getMovieUrl, getTVUrl } from '@/lib/urls';

interface MovieCardProps {
  item: Movie | TVShow;
  type?: 'movie' | 'tv';
}

function isMovie(item: Movie | TVShow): item is Movie {
  return 'title' in item;
}

export default function MovieCard({ item, type = 'movie' }: MovieCardProps) {
  const [imgError, setImgError] = useState(false);

  const title = isMovie(item) ? item.title : item.name;
  const date = isMovie(item) ? item.release_date : item.first_air_date;
  const year = date ? new Date(date).getFullYear() : null;
  const rating = Math.round((item.vote_average || 0) * 10) / 10;
  const href = type === 'tv' ? getTVUrl(item) : getMovieUrl(item);

  const imagePath = item.poster_path || item.backdrop_path;

  return (
    <Link
      href={href}
      className="group block w-full select-none"
    >
      {/* ── Poster Wrapper ── */}
      <div className="relative aspect-[2/3] w-full rounded-xl sm:rounded-2xl overflow-hidden bg-[#0c1224] border border-white/10 shadow-md group-hover:shadow-xl transition-all duration-300 transform group-hover:-translate-y-1.5">
        {/* Poster Image */}
        {imagePath && !imgError ? (
          <Image
            src={getImageUrl(imagePath, 'w500')}
            alt={title || 'Movie Poster'}
            fill
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-3 bg-gradient-to-br from-[#0f1a2e] to-[#1a2540] text-slate-500">
            {type === 'tv' ? <Tv size={32} /> : <Film size={32} />}
            <span className="text-xs text-center line-clamp-2 text-slate-400 font-medium">{title}</span>
          </div>
        )}

        {/* ── IMDb-Style Yellow Rating Badge (Top-Right) ── */}
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1 px-1.5 py-0.5 sm:px-2 sm:py-0.5 rounded-md bg-[#f5c518] text-black font-black text-[10px] sm:text-[11.5px] shadow-lg shadow-black/50 tracking-tight">
          <Star size={11} fill="currentColor" stroke="none" className="text-black" />
          <span>{rating > 0 ? rating.toFixed(1) : 'NR'}</span>
        </div>

        {/* ── Media Type Badge (Top-Left: Series / Movie) ── */}
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/75 backdrop-blur-md border border-white/15 text-slate-200 font-bold text-[9px] sm:text-[10px] uppercase tracking-wider shadow-md">
          {type === 'tv' ? (
            <>
              <Tv size={10} className="text-cyan-400" />
              <span>Series</span>
            </>
          ) : (
            <>
              <Film size={10} className="text-cyan-400" />
              <span>Movie</span>
            </>
          )}
        </div>
      </div>

      {/* ── Info Outside Below Poster ── */}
      <div className="pt-2 sm:pt-2.5 px-0.5 space-y-1">
        <h3
          title={title}
          className="font-bold text-white text-xs sm:text-[13.5px] leading-snug line-clamp-2 transition-colors duration-200 group-hover:text-cyan-400"
        >
          {title}
        </h3>
        <div className="flex items-center text-[11px] sm:text-xs text-slate-400 font-medium">
          <span>{year || '2025'}</span>
        </div>
      </div>
    </Link>
  );
}

export function MovieCardSkeleton() {
  return (
    <div className="w-full space-y-2">
      <div className="aspect-[2/3] w-full rounded-xl sm:rounded-2xl overflow-hidden skeleton border border-white/5" />
      <div className="space-y-1 px-0.5">
        <div className="h-3.5 w-3/4 rounded skeleton" />
        <div className="h-3 w-1/2 rounded skeleton" />
      </div>
    </div>
  );
}
