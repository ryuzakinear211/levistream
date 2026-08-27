'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Menu,
  X,
  LogIn,
  Home,
  Film,
  Tv,
  Search,
  Sparkles,
  MessageSquarePlus,
  Heart,
  Flame,
  Clapperboard,
  Star,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { Genre } from '@/types/tmdb';
import { useAuth } from '@/context/AuthContext';
import siteConfig from '@/config';

interface MobileHeaderProps {
  genres?: Genre[];
}

export default function MobileHeader({ genres = [] }: MobileHeaderProps) {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const navCards = [
    {
      href: '/',
      icon: Home,
      title: 'Home',
      desc: 'Trending & curated',
      color: '#06b6d4',
      bg: 'rgba(6, 182, 212, 0.12)',
      border: 'rgba(6, 182, 212, 0.3)',
    },
    {
      href: '/movie',
      icon: Film,
      title: 'Movies',
      desc: 'Browse movie catalog',
      color: '#a78bfa',
      bg: 'rgba(167, 139, 250, 0.12)',
      border: 'rgba(167, 139, 250, 0.3)',
    },
    {
      href: '/tv',
      icon: Tv,
      title: 'TV Shows',
      desc: 'Series & episodes',
      color: '#ec4899',
      bg: 'rgba(236, 72, 153, 0.12)',
      border: 'rgba(236, 72, 153, 0.3)',
    },
    {
      href: '/search',
      icon: Search,
      title: 'Search',
      desc: 'Find movies & series',
      color: '#38bdf8',
      bg: 'rgba(56, 189, 248, 0.12)',
      border: 'rgba(56, 189, 248, 0.3)',
    },
  ];

  const quickGenres = [
    { href: '/genre/28', icon: Flame, label: 'Action' },
    { href: '/genre/35', icon: Clapperboard, label: 'Comedy' },
    { href: '/genre/18', icon: Star, label: 'Drama' },
    { href: '/genre/27', icon: Clock, label: 'Horror' },
    { href: '/genre/878', icon: TrendingUp, label: 'Sci-Fi' },
  ];

  return (
    <header className="lg:hidden relative w-full z-40" ref={menuRef}>
      {/* ── Frosted Glassmorphism Header Bar (Non-fixed) ── */}
      <div
        className="w-full h-16 px-4 sm:px-6 flex items-center justify-between transition-all duration-300"
        style={{
          background: 'rgba(6, 10, 26, 0.72)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
        }}
      >
        {/* Left: Site Title (No Logo) */}
        <Link href="/" className="flex items-center group">
          <span
            className="text-lg sm:text-xl font-black tracking-wider uppercase transition-opacity duration-200 group-hover:opacity-80"
            style={{
              background: 'linear-gradient(135deg, #06b6d4 0%, #a78bfa 50%, #ec4899 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {siteConfig.nameUpper || siteConfig.name}
          </span>
        </Link>

        {/* Right: Login Button FIRST, followed by Hamburger Menu at the far right */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Distinctive Glassmorphic Login / Profile Button */}
          <Link
            href={user ? '/profile' : '/login'}
            className="px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-bold text-cyan-300 transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-1.5"
            style={{
              background:
                'linear-gradient(135deg, rgba(6, 182, 212, 0.16) 0%, rgba(124, 58, 237, 0.22) 100%)',
              border: '1px solid rgba(6, 182, 212, 0.45)',
              boxShadow: '0 0 18px rgba(6, 182, 212, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
            }}
          >
            {user ? (
              <>
                <div className="w-4 h-4 rounded-full bg-cyan-400 text-black font-black text-[10px] flex items-center justify-center">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <span className="max-w-[70px] truncate">{user.username}</span>
              </>
            ) : (
              <>
                <LogIn size={13} className="text-cyan-400" />
                <span>Login</span>
              </>
            )}
          </Link>

          {/* Hamburger Menu Toggle Button (Far Right) */}
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95"
            style={{
              background: menuOpen ? 'rgba(6, 182, 212, 0.2)' : 'rgba(255, 255, 255, 0.06)',
              border: menuOpen
                ? '1px solid rgba(6, 182, 212, 0.5)'
                : '1px solid rgba(255, 255, 255, 0.1)',
              color: menuOpen ? '#06b6d4' : '#94a3b8',
              boxShadow: menuOpen ? '0 0 15px rgba(6, 182, 212, 0.3)' : 'none',
            }}
            aria-label="Toggle Navigation Menu"
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* ── Modern Floating Glassmorphism Mobile Menu ── */}
      {menuOpen && (
        <div
          className="absolute top-full left-0 right-0 p-4 sm:p-5 rounded-b-3xl border-b border-x transition-all duration-300 animate-in fade-in slide-in-from-top-4"
          style={{
            background: 'rgba(8, 12, 28, 0.96)',
            backdropFilter: 'blur(30px) saturate(190%)',
            WebkitBackdropFilter: 'blur(30px) saturate(190%)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            boxShadow:
              '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(6, 182, 212, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          }}
        >
          {/* Section 1: Primary Navigation Cards (2x2 Grid, Clean & Simple) */}
          <div className="grid grid-cols-2 gap-2.5 mb-4">
            {navCards.map((card) => {
              const active = isActive(card.href);
              const Icon = card.icon;
              return (
                <Link
                  key={card.href}
                  href={card.href}
                  onClick={() => setMenuOpen(false)}
                  className="p-3 sm:p-3.5 rounded-2xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex flex-col justify-between group"
                  style={{
                    background: active ? card.bg : 'rgba(255, 255, 255, 0.03)',
                    border: active ? `1px solid ${card.border}` : '1px solid rgba(255, 255, 255, 0.06)',
                  }}
                >
                  <div className="flex items-center mb-2">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
                      style={{
                        background: active ? card.bg : 'rgba(255, 255, 255, 0.06)',
                        color: active ? card.color : '#94a3b8',
                      }}
                    >
                      <Icon size={16} />
                    </div>
                  </div>
                  <div>
                    <h3
                      className="font-bold text-sm transition-colors"
                      style={{ color: active ? card.color : '#f1f5f9' }}
                    >
                      {card.title}
                    </h3>
                    <p className="text-[11px] font-medium text-slate-400">{card.desc}</p>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Section 2: Quick Popular Genres (Pill Row) */}
          <div className="pt-3 border-t border-white/[0.08]">
            <div className="flex items-center gap-1.5 mb-2.5 px-1">
              <Sparkles size={12} className="text-cyan-400" />
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                Popular Genres
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {quickGenres.map((genre) => {
                const active = pathname === genre.href;
                const Icon = genre.icon;
                return (
                  <Link
                    key={genre.href}
                    href={genre.href}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 hover:scale-105 active:scale-95"
                    style={{
                      background: active
                        ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.25), rgba(124, 58, 237, 0.25))'
                        : 'rgba(255, 255, 255, 0.05)',
                      border: active
                        ? '1px solid rgba(6, 182, 212, 0.5)'
                        : '1px solid rgba(255, 255, 255, 0.08)',
                      color: active ? '#06b6d4' : '#cbd5e1',
                    }}
                  >
                    <Icon size={12} className={active ? 'text-cyan-400' : 'text-slate-400'} />
                    <span>{genre.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Section 3: Action Buttons (Request Film & Donasi) */}
          <div className="pt-3 mt-3 border-t border-white/[0.08] flex items-center justify-between gap-2.5">
            {/* Request Film Button (No destination) */}
            <button
              type="button"
              className="flex-1 py-2.5 px-3.5 rounded-xl text-xs font-bold text-slate-200 hover:text-cyan-300 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(124, 58, 237, 0.15))',
                border: '1px solid rgba(6, 182, 212, 0.35)',
                boxShadow: '0 0 15px rgba(6, 182, 212, 0.15)',
              }}
            >
              <MessageSquarePlus size={14} className="text-cyan-400" />
              <span>Request</span>
            </button>

            {/* Donasi Button (No destination) */}
            <button
              type="button"
              className="flex-1 py-2.5 px-3.5 rounded-xl text-xs font-bold text-slate-200 hover:text-rose-300 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.15), rgba(236, 72, 153, 0.15))',
                border: '1px solid rgba(244, 63, 94, 0.35)',
                boxShadow: '0 0 15px rgba(244, 63, 94, 0.15)',
              }}
            >
              <Heart size={14} className="text-rose-400" />
              <span>Donasi</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
