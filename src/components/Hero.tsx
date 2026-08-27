'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Play, Star, Calendar, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { Movie, TVShow, Genre } from '@/types/tmdb';
import { getImageUrl } from '@/lib/tmdb';
import siteConfig, { FeaturedItem } from '@/config';
import { getMovieUrl, getTVUrl } from '@/lib/urls';

interface HeroProps {
  movie?: Movie;
  movies?: Movie[];
  tvShow?: TVShow;
  tvShows?: TVShow[];
  genres?: Genre[];
  customFeaturedItems?: FeaturedItem[];
  type?: 'movie' | 'tv';
  buttonGradient?: string;
  badgeText?: string;
}

export default function Hero({
  movie,
  movies = [],
  tvShow,
  tvShows = [],
  genres = [],
  customFeaturedItems,
  type = 'movie',
  buttonGradient,
  badgeText,
}: HeroProps) {
  const isTV = type === 'tv' || (tvShows && tvShows.length > 0) || Boolean(tvShow);

  // Build items list: strictly prioritize customFeaturedItems if passed
  const items: FeaturedItem[] = React.useMemo(() => {
    if (customFeaturedItems !== undefined) {
      return customFeaturedItems;
    }

    if (siteConfig.featuredItems && siteConfig.featuredItems.length > 0 && !isTV) {
      return siteConfig.featuredItems;
    }

    // Fallback using incoming movies or tv shows (only if customFeaturedItems was not provided)
    const sourceItems = isTV
      ? (tvShows && tvShows.length > 0 ? tvShows.slice(0, 5) : tvShow ? [tvShow] : [])
      : (movies && movies.length > 0 ? movies.slice(0, 5) : movie ? [movie] : []);

    return (sourceItems as any[]).map((m) => {
      const itemGenres = genres.filter((g) => m.genre_ids?.includes(g.id)).map((g) => g.name);
      const backdrop = m.backdrop_path
        ? getImageUrl(m.backdrop_path, 'w1280')
        : m.poster_path
        ? getImageUrl(m.poster_path, 'w780')
        : '/placeholder-poster.svg';
      const poster = m.poster_path
        ? getImageUrl(m.poster_path, 'w500')
        : m.backdrop_path
        ? getImageUrl(m.backdrop_path, 'w780')
        : '/placeholder-poster.svg';

      const itemTitle = m.title || m.name || 'Featured';
      const itemYear = m.release_date
        ? new Date(m.release_date).getFullYear()
        : m.first_air_date
        ? new Date(m.first_air_date).getFullYear()
        : '2025';
      const itemLink = isTV ? getTVUrl(m) : getMovieUrl(m);

      return {
        id: m.id,
        tmdbId: m.id,
        title: itemTitle,
        overview: m.overview,
        backdropUrl: backdrop,
        posterUrl: poster,
        rating: Math.round((m.vote_average || 8) * 10) / 10,
        year: itemYear,
        type: isTV ? ('tv' as const) : ('movie' as const),
        genres: itemGenres.slice(0, 3),
        link: itemLink,
        badge: badgeText || (isTV ? 'Featured Series' : 'Featured'),
      };
    });
  }, [customFeaturedItems, movies, movie, tvShows, tvShow, genres, isTV, badgeText]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Touch Swipe Gesture Tracking
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  const total = items.length;
  const currentItem = items[currentIndex] || items[0];

  const nextSlide = useCallback(() => {
    if (total <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % total);
  }, [total]);

  const prevSlide = useCallback(() => {
    if (total <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  // Touch handlers for mobile swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const diff = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 45; // Min swipe distance in px

    if (diff > minSwipeDistance) {
      nextSlide(); // Swiped left -> next
    } else if (diff < -minSwipeDistance) {
      prevSlide(); // Swiped right -> prev
    }

    touchStartX.current = 0;
    touchEndX.current = 0;
  };

  // Auto-slide effect
  useEffect(() => {
    if (total <= 1 || isHovered) return;
    const intervalMs = (siteConfig.heroIntervalSeconds || 6) * 1000;
    timerRef.current = setInterval(() => {
      nextSlide();
    }, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [total, isHovered, nextSlide]);

  if (!currentItem) return null;

  const btnBg =
    buttonGradient ||
    (isTV
      ? 'linear-gradient(135deg, #ec4899, #7c3aed)'
      : 'linear-gradient(135deg, #06b6d4, #7c3aed)');
  const btnShadow = isTV
    ? '0 0 25px rgba(236,72,153,0.45)'
    : '0 0 25px rgba(6,182,212,0.45)';

  const badgeBg = isTV
    ? 'linear-gradient(135deg, rgba(236,72,153,0.25), rgba(124,58,237,0.25))'
    : 'linear-gradient(135deg, rgba(6,182,212,0.25), rgba(124,58,237,0.25))';
  const badgeBorder = isTV
    ? '1px solid rgba(236,72,153,0.45)'
    : '1px solid rgba(6,182,212,0.45)';
  const badgeColor = isTV ? '#ec4899' : '#06b6d4';
  const badgeShadow = isTV
    ? '0 0 16px rgba(236,72,153,0.3)'
    : '0 0 16px rgba(6,182,212,0.3)';

  return (
    <section
      className="relative w-full max-w-full overflow-hidden select-none touch-pan-y aspect-[16/10] xs:aspect-[16/9] sm:aspect-auto sm:h-[460px] md:h-[540px] lg:h-[620px] xl:h-[680px] 2xl:h-[740px]"
      style={{ overscrollBehaviorX: 'none' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── Background Slides with Zero Zoom & Clean Crossfade ── */}
      {items.map((item, idx) => {
        const isCurrent = idx === currentIndex;
        const bgImage = item.backdropUrl || item.posterUrl || '/placeholder-poster.svg';
        return (
          <div
            key={item.id || idx}
            className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
              isCurrent ? 'opacity-100 z-0' : 'opacity-0 pointer-events-none -z-10'
            }`}
          >
            {bgImage && (
              <div className="relative w-full h-full">
                <Image
                  src={bgImage}
                  alt={item.title || 'Featured item'}
                  fill
                  priority={idx === 0}
                  quality={95}
                  className="object-cover object-center"
                  sizes="100vw"
                />
              </div>
            )}
          </div>
        );
      })}

      {/* ── Gradient Overlays (Cinematic Seamless Blend into Body Background #050816) ── */}
      <div
        className="absolute inset-0 z-10 pointer-events-none"
        style={{
          background:
            'linear-gradient(to top, rgba(5,8,22,1) 0%, rgba(5,8,22,0.85) 18%, rgba(5,8,22,0.45) 45%, rgba(5,8,22,0.05) 75%, transparent 100%)',
        }}
      />
      <div
        className="absolute inset-0 z-10 pointer-events-none hidden sm:block"
        style={{
          background:
            'linear-gradient(to right, rgba(5,8,22,0.98) 0%, rgba(5,8,22,0.75) 30%, rgba(5,8,22,0.3) 60%, transparent 100%)',
        }}
      />
      <div
        className="absolute inset-0 z-10 pointer-events-none"
        style={{
          background:
            'linear-gradient(to bottom, rgba(5,8,22,0.5) 0%, transparent 25%)',
        }}
      />

      {/* ── Hero Content (Fluid Edge-to-Edge Desktop Alignment) ── */}
      <div className="relative z-20 h-full flex items-end pb-4 xs:pb-6 sm:pb-12 md:pb-16 lg:pb-20">
        <div className="w-full px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-14">
          <div className="max-w-xl md:max-w-2xl lg:max-w-3xl">

            {/* Title (Scaled responsively for small mobile screen) */}
            <h1
              className="text-xl xs:text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-black leading-tight mb-2 sm:mb-3 text-white tracking-tight line-clamp-2"
              style={{
                textShadow: '0 2px 24px rgba(0,0,0,0.9)',
              }}
            >
              {currentItem.title}
            </h1>

            {/* Meta row with Designed Badges: Featured badge placed side-by-side with HD badge */}
            <div className="flex flex-wrap items-center gap-1.5 xs:gap-2 sm:gap-3 mb-3 sm:mb-5 text-xs sm:text-sm">
              {/* Featured Badge */}
              <span
                className="inline-flex items-center gap-1 px-2.5 py-1 sm:px-3 sm:py-1 rounded-lg text-[10px] sm:text-xs font-extrabold uppercase tracking-wider"
                style={{
                  background: badgeBg,
                  border: badgeBorder,
                  color: badgeColor,
                  boxShadow: badgeShadow,
                }}
              >
                <Sparkles size={11} className="flex-shrink-0" />
                <span>{currentItem.badge || (isTV ? 'Featured Series' : 'Featured')}</span>
              </span>

              {/* HD Badge */}
              <span
                className="px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-[11px] font-black tracking-wider"
                style={{
                  background: isTV ? 'rgba(236,72,153,0.15)' : 'rgba(6, 182, 212, 0.15)',
                  border: isTV ? '1px solid rgba(236,72,153,0.4)' : '1px solid rgba(6, 182, 212, 0.4)',
                  color: isTV ? '#ec4899' : '#06b6d4',
                }}
              >
                HD
              </span>

              {/* Rating */}
              <div
                className="flex items-center gap-1 px-2.5 py-0.5 sm:py-1 rounded-lg text-[11px] sm:text-xs font-bold"
                style={{
                  background: 'rgba(34,197,94,0.15)',
                  border: '1px solid rgba(34,197,94,0.4)',
                  color: '#22c55e',
                }}
              >
                <Star size={11} fill="currentColor" className="flex-shrink-0" />
                {(currentItem.rating ?? 8.5).toFixed(1)}
              </div>

              {/* Styled Year Label Badge */}
              {currentItem.year && (
                <div
                  className="flex items-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-xs font-semibold"
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.18)',
                    color: '#e2e8f0',
                    backdropFilter: 'blur(6px)',
                  }}
                >
                  <Calendar size={11} className={isTV ? 'text-pink-400' : 'text-cyan-400'} />
                  <span>{currentItem.year}</span>
                </div>
              )}

              {/* Genres */}
              {currentItem.genres && currentItem.genres.length > 0 && (
                <div className="hidden sm:flex items-center gap-1.5">
                  {currentItem.genres.slice(0, 3).map((g) => (
                    <span
                      key={g}
                      className="px-2.5 py-0.5 rounded-full text-[11px] font-medium"
                      style={{
                        background: 'rgba(124,58,237,0.15)',
                        border: '1px solid rgba(124,58,237,0.35)',
                        color: '#a78bfa',
                      }}
                    >
                      {g}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Overview / Deskripsi */}
            {currentItem.overview && (
              <p className="text-xs sm:text-sm leading-relaxed text-slate-300 mb-3 sm:mb-5 line-clamp-2 sm:line-clamp-3 md:line-clamp-4 max-w-xl">
                {currentItem.overview}
              </p>
            )}

            {/* Action Buttons: Clean & Direct "Tonton" button */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              <Link
                href={currentItem.link || '/'}
                className="inline-flex items-center gap-2.5 px-5 py-2 xs:px-6 xs:py-2.5 sm:px-8 sm:py-3.5 rounded-xl font-bold text-xs sm:text-sm transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg"
                style={{
                  background: btnBg,
                  color: 'white',
                  boxShadow: btnShadow,
                }}
              >
                <Play size={15} fill="white" className="sm:w-[18px] sm:h-[18px]" />
                <span>Tonton Sekarang</span>
              </Link>
            </div>

          </div>
        </div>
      </div>

      {/* ── Slide Navigation: Arrows & Minimalist Dots ── */}
      {total > 1 && (
        <>
          {/* Left Arrow */}
          <button
            onClick={prevSlide}
            title="Previous Slide"
            className="hidden sm:flex absolute left-4 md:left-6 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-xl items-center justify-center transition-all duration-200 opacity-60 hover:opacity-100 hover:scale-110 active:scale-95 cursor-pointer"
            style={{
              background: 'rgba(11, 16, 32, 0.85)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#f1f5f9',
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            }}
          >
            <ChevronLeft size={20} />
          </button>

          {/* Right Arrow */}
          <button
            onClick={nextSlide}
            title="Next Slide"
            className="hidden sm:flex absolute right-4 md:right-6 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-xl items-center justify-center transition-all duration-200 opacity-60 hover:opacity-100 hover:scale-110 active:scale-95 cursor-pointer"
            style={{
              background: 'rgba(11, 16, 32, 0.85)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#f1f5f9',
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            }}
          >
            <ChevronRight size={20} />
          </button>

          {/* Minimalist & Sleek Indicator Dots */}
          <div className="absolute right-4 sm:right-6 md:right-8 lg:right-10 xl:right-12 2xl:right-14 bottom-4 sm:bottom-6 z-30 flex items-center gap-1.5">
            {items.map((_, idx) => {
              const isCurrent = idx === currentIndex;
              return (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  title={`Slide ${idx + 1}`}
                  className={`transition-all duration-300 cursor-pointer focus:outline-none rounded-full ${
                    isCurrent
                      ? `w-5 sm:w-6 h-1.5 sm:h-2 opacity-100 ${isTV ? 'shadow-[0_0_10px_rgba(236,72,153,0.8)]' : 'shadow-[0_0_10px_rgba(6,182,212,0.8)]'}`
                      : 'w-1.5 sm:w-2 h-1.5 sm:h-2 bg-white/30 hover:bg-white/60'
                  }`}
                  style={{
                    background: isCurrent ? btnBg : undefined,
                  }}
                />
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
