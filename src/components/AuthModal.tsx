'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  LogIn,
  UserPlus,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  Bookmark,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import siteConfig from '@/config';

export default function AuthModal() {
  const {
    isAuthModalOpen,
    authModalTab,
    authModalMessage,
    closeAuthModal,
    login,
  } = useAuth();

  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [forgotPasswordView, setForgotPasswordView] = useState(false);
  const [forgotSubmitted, setForgotSubmitted] = useState(false);

  // Form states
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  const [forgotEmail, setForgotEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Sync tab with context when modal opens
  useEffect(() => {
    if (isAuthModalOpen) {
      setTab(authModalTab);
      setForgotPasswordView(false);
      setForgotSubmitted(false);
      setErrorMsg('');
      setShowPassword(false);
    }
  }, [isAuthModalOpen, authModalTab]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isAuthModalOpen) {
        closeAuthModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthModalOpen, closeAuthModal]);

  if (!isAuthModalOpen) return null;

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!loginIdentifier.trim()) {
      setErrorMsg('Username atau Email wajib diisi');
      return;
    }
    if (!loginPassword) {
      setErrorMsg('Password wajib diisi');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      login({
        username: loginIdentifier.includes('@')
          ? loginIdentifier.split('@')[0]
          : loginIdentifier,
        email: loginIdentifier.includes('@')
          ? loginIdentifier
          : `${loginIdentifier}@gmail.com`,
        createdAt: new Date().toISOString(),
      });
    }, 400);
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!regUsername.trim()) {
      setErrorMsg('Username wajib diisi');
      return;
    }
    if (!regEmail.trim() || !regEmail.includes('@')) {
      setErrorMsg('Alamat Email yang valid wajib diisi');
      return;
    }
    if (!regPassword || regPassword.length < 6) {
      setErrorMsg('Password minimal 6 karakter');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setErrorMsg('Konfirmasi password tidak cocok');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      login({
        username: regUsername.trim(),
        email: regEmail.trim(),
        createdAt: new Date().toISOString(),
      });
    }, 400);
  };

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!forgotEmail.trim() || !forgotEmail.includes('@')) {
      setErrorMsg('Masukkan email terdaftar Anda');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setForgotSubmitted(true);
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* ── Ambient Backdrop ── */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity duration-300"
        onClick={closeAuthModal}
      />

      {/* ── Modal Card ── */}
      <div
        className="relative w-full max-w-[440px] rounded-3xl p-6 sm:p-8 z-10 transition-all duration-300 animate-in fade-in zoom-in-95"
        style={{
          background: 'rgba(9, 14, 32, 0.95)',
          backdropFilter: 'blur(30px) saturate(190%)',
          WebkitBackdropFilter: 'blur(30px) saturate(190%)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow:
            '0 25px 70px rgba(0, 0, 0, 0.85), 0 0 40px rgba(6, 182, 212, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
        }}
      >
        {/* Close Button */}
        <button
          onClick={closeAuthModal}
          className="absolute top-5 right-5 w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all duration-150"
          aria-label="Tutup"
        >
          <X size={18} />
        </button>

        {/* ── Top Header / Brand ── */}
        <div className="text-center mb-6">
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-3"
            style={{
              background: 'linear-gradient(135deg, #06b6d4, #7c3aed)',
              boxShadow: '0 0 20px rgba(6, 182, 212, 0.4)',
            }}
          >
            <Sparkles size={22} className="text-white" />
          </div>

          <h2
            className="text-xl sm:text-2xl font-black uppercase tracking-wider"
            style={{
              background: 'linear-gradient(135deg, #06b6d4 0%, #a78bfa 50%, #ec4899 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {siteConfig.name}
          </h2>

          {/* Contextual Message (e.g. Watchlist requirement notice) */}
          {authModalMessage ? (
            <div className="mt-3 flex items-center justify-center gap-2 p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold">
              <Bookmark size={14} className="flex-shrink-0 text-cyan-400" />
              <span>{authModalMessage}</span>
            </div>
          ) : (
            <p className="text-xs text-slate-400 mt-1">
              Streaming film & serial favorit tanpa batas
            </p>
          )}
        </div>

        {/* ── FORGOT PASSWORD VIEW ── */}
        {forgotPasswordView ? (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <button
                type="button"
                onClick={() => {
                  setForgotPasswordView(false);
                  setForgotSubmitted(false);
                  setErrorMsg('');
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <ArrowLeft size={16} />
              </button>
              <h3 className="text-base font-bold text-white">Reset Password</h3>
            </div>

            {forgotSubmitted ? (
              <div className="text-center py-4 space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 size={24} />
                </div>
                <h4 className="text-sm font-bold text-white">Email Terkirim!</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Tautan instruksi untuk mereset password telah dikirim ke{' '}
                  <span className="text-cyan-400 font-semibold">{forgotEmail}</span>.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setForgotPasswordView(false);
                    setForgotSubmitted(false);
                    setTab('login');
                  }}
                  className="w-full mt-4 py-2.5 rounded-xl text-xs font-bold text-white bg-white/10 hover:bg-white/20 transition-colors"
                >
                  Kembali ke Halaman Masuk
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <p className="text-xs text-slate-300 leading-relaxed">
                  Masukkan alamat email akun Anda. Kami akan mengirimkan tautan untuk membuat password baru.
                </p>

                {errorMsg && (
                  <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-medium">
                    {errorMsg}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Email</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="nama@email.com"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.06] border border-white/15 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg flex items-center justify-center gap-2"
                  style={{
                    background: 'linear-gradient(135deg, #06b6d4, #7c3aed)',
                    boxShadow: '0 0 20px rgba(6, 182, 212, 0.35)',
                  }}
                >
                  {loading ? 'Mengirim...' : 'Kirim Tautan Reset'}
                </button>
              </form>
            )}
          </div>
        ) : (
          /* ── LOGIN / REGISTER TABS VIEW ── */
          <>
            {/* Tab Buttons */}
            <div className="flex rounded-2xl p-1 bg-white/[0.05] border border-white/10 mb-5">
              <button
                type="button"
                onClick={() => {
                  setTab('login');
                  setErrorMsg('');
                }}
                className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all duration-200 ${
                  tab === 'login'
                    ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <LogIn size={14} />
                <span>Masuk</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTab('register');
                  setErrorMsg('');
                }}
                className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all duration-200 ${
                  tab === 'register'
                    ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <UserPlus size={14} />
                <span>Daftar</span>
              </button>
            </div>

            {/* Error Notification */}
            {errorMsg && (
              <div className="mb-4 p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-medium">
                {errorMsg}
              </div>
            )}

            {/* ── TAB 1: LOGIN FORM ── */}
            {tab === 'login' && (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Username atau Email
                  </label>
                  <div className="relative">
                    <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      placeholder="Username atau nama@email.com"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.06] border border-white/15 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Password
                  </label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white/[0.06] border border-white/15 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-0.5">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded bg-white/10 border-white/20 text-cyan-500 focus:ring-0"
                    />
                    <span>Ingat saya</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      setForgotPasswordView(true);
                      setErrorMsg('');
                    }}
                    className="text-cyan-400 hover:underline font-medium"
                  >
                    Lupa Password?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg flex items-center justify-center gap-2 mt-2"
                  style={{
                    background: 'linear-gradient(135deg, #06b6d4, #7c3aed)',
                    boxShadow: '0 0 20px rgba(6, 182, 212, 0.35)',
                  }}
                >
                  <LogIn size={16} />
                  <span>{loading ? 'Memproses...' : 'Masuk Sekarang'}</span>
                </button>
              </form>
            )}

            {/* ── TAB 2: REGISTER FORM ── */}
            {tab === 'register' && (
              <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Username</label>
                  <div className="relative">
                    <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value)}
                      placeholder="Username unik"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.06] border border-white/15 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Email</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="nama@email.com"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.06] border border-white/15 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Minimal 6 karakter"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white/[0.06] border border-white/15 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Konfirmasi Password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      placeholder="Ulangi password"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white/[0.06] border border-white/15 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg flex items-center justify-center gap-2 mt-3"
                  style={{
                    background: 'linear-gradient(135deg, #06b6d4, #7c3aed)',
                    boxShadow: '0 0 20px rgba(6, 182, 212, 0.35)',
                  }}
                >
                  <UserPlus size={16} />
                  <span>{loading ? 'Mendaftarkan...' : 'Daftar Akun Baru'}</span>
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
