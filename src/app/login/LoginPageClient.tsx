'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
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
  Film,
  ShieldCheck,
  Tv,
  Bookmark,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import siteConfig from '@/config';

export default function LoginPageClient() {
  const router = useRouter();
  const { login, user, logout } = useAuth();

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
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

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
      const username = loginIdentifier.includes('@')
        ? loginIdentifier.split('@')[0]
        : loginIdentifier;
      const email = loginIdentifier.includes('@')
        ? loginIdentifier
        : `${loginIdentifier}@gmail.com`;

      login({
        username,
        email,
        createdAt: new Date().toISOString(),
      });

      setSuccessMsg(`Selamat datang kembali, ${username}!`);
      setTimeout(() => {
        router.push('/');
      }, 700);
    }, 500);
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

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

      setSuccessMsg(`Akun berhasil dibuat! Selamat datang, ${regUsername}!`);
      setTimeout(() => {
        router.push('/');
      }, 700);
    }, 500);
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

  // If user is already logged in, show profile card with option to logout
  if (user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6" style={{ background: '#050816' }}>
        <div
          className="w-full max-w-md rounded-3xl p-6 sm:p-8 text-center"
          style={{
            background: 'rgba(9, 14, 32, 0.85)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.7), 0 0 30px rgba(6,182,212,0.15)',
          }}
        >
          <div
            className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center text-xl font-black text-white"
            style={{
              background: 'linear-gradient(135deg, #06b6d4, #7c3aed)',
              boxShadow: '0 0 20px rgba(6,182,212,0.4)',
            }}
          >
            {user.username.charAt(0).toUpperCase()}
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white mb-1">{user.username}</h2>
          <p className="text-xs text-slate-400 mb-6">{user.email}</p>

          <div className="flex flex-col gap-3">
            <Link
              href="/"
              className="w-full py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(135deg, #06b6d4, #7c3aed)',
                boxShadow: '0 0 18px rgba(6,182,212,0.35)',
              }}
            >
              <Film size={16} />
              <span>Mulai Menonton Film</span>
            </Link>

            <button
              onClick={logout}
              className="w-full py-2.5 rounded-xl font-bold text-xs text-slate-400 hover:text-rose-400 bg-white/5 hover:bg-rose-500/10 border border-white/10 hover:border-rose-500/30 transition-colors"
            >
              Keluar dari Akun (Logout)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative flex flex-col justify-between p-4 sm:p-6 lg:p-8" style={{ background: '#050816' }}>
      {/* ── Ambient Background Glows ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div
          className="absolute -top-40 -left-40 w-96 h-96 rounded-full blur-[140px] opacity-25"
          style={{ background: '#06b6d4' }}
        />
        <div
          className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full blur-[140px] opacity-25"
          style={{ background: '#7c3aed' }}
        />
      </div>

      {/* ── Top Bar with Back Button ── */}
      <div className="relative z-10 w-full max-w-5xl mx-auto flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold text-slate-300 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 transition-all duration-200"
        >
          <ArrowLeft size={16} />
          <span>Kembali ke Beranda</span>
        </Link>

        <Link href="/" className="flex items-center gap-2.5 group">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #06b6d4, #7c3aed)',
              boxShadow: '0 0 14px rgba(6,182,212,0.35)',
            }}
          >
            <Film size={18} className="text-white" />
          </div>
          <span
            className="text-base sm:text-lg font-black uppercase tracking-wider hidden xs:inline"
            style={{
              background: 'linear-gradient(135deg, #06b6d4 0%, #a78bfa 50%, #ec4899 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {siteConfig.name}
          </span>
        </Link>
      </div>

      {/* ── Main Form Container ── */}
      <div className="relative z-10 w-full max-w-[460px] mx-auto my-8">
        <div
          className="rounded-3xl p-6 sm:p-8 transition-all duration-300"
          style={{
            background: 'rgba(9, 14, 32, 0.88)',
            backdropFilter: 'blur(30px) saturate(190%)',
            WebkitBackdropFilter: 'blur(30px) saturate(190%)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow:
              '0 30px 80px rgba(0, 0, 0, 0.85), 0 0 40px rgba(6, 182, 212, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
          }}
        >
          {/* Header Title */}
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

            <h1 className="text-2xl font-black text-white tracking-tight">
              {forgotPasswordView
                ? 'Lupa Password'
                : tab === 'login'
                ? 'Masuk ke Akun Anda'
                : 'Daftar Akun Baru'}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              {forgotPasswordView
                ? 'Pulihkan akses akun Anda dengan mudah'
                : tab === 'login'
                ? 'Lanjutkan menonton dan kelola watchlist favorit'
                : 'Bergabung sekarang untuk pengalaman streaming lengkap'}
            </p>
          </div>

          {/* Success Message */}
          {successMsg && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {/* ── FORGOT PASSWORD VIEW ── */}
          {forgotPasswordView ? (
            <div>
              {forgotSubmitted ? (
                <div className="text-center py-4 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 size={24} />
                  </div>
                  <h3 className="text-sm font-bold text-white">Email Terkirim!</h3>
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
                    Masukkan alamat email yang terhubung dengan akun Anda. Kami akan mengirimkan tautan untuk membuat kata sandi baru.
                  </p>

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

                  <button
                    type="button"
                    onClick={() => {
                      setForgotPasswordView(false);
                      setErrorMsg('');
                    }}
                    className="w-full text-center text-xs font-bold text-slate-400 hover:text-white pt-2"
                  >
                    Batal dan Kembali
                  </button>
                </form>
              )}
            </div>
          ) : (
            /* ── TABS: LOGIN & REGISTER ── */
            <>
              {/* Tab Selector */}
              <div className="flex rounded-2xl p-1 bg-white/[0.05] border border-white/10 mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setTab('login');
                    setErrorMsg('');
                  }}
                  className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all duration-200 ${
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
                  className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all duration-200 ${
                    tab === 'register'
                      ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <UserPlus size={14} />
                  <span>Daftar</span>
                </button>
              </div>

              {/* ── TAB 1: LOGIN ── */}
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

                  <div className="flex items-center justify-between text-xs pt-1">
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

              {/* ── TAB 2: REGISTER ── */}
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
                        placeholder="Pilih username unik"
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

      {/* ── Footer ── */}
      <div className="relative z-10 text-center py-2 text-xs text-slate-500">
        &copy; {new Date().getFullYear()} {siteConfig.name}. Hak cipta dilindungi.
      </div>
    </div>
  );
}
