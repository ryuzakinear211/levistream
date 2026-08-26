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
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Home,
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

  // Field-specific validation errors for outline coloring
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const clearFieldError = (fieldName: string) => {
    if (errors[fieldName]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[fieldName];
        return next;
      });
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    const newErrors: Record<string, string> = {};

    if (!loginIdentifier.trim()) {
      newErrors.loginIdentifier = 'Username atau Email wajib diisi';
    }
    if (!loginPassword) {
      newErrors.loginPassword = 'Password wajib diisi';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
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
      }, 600);
    }, 400);
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    const newErrors: Record<string, string> = {};

    if (!regUsername.trim()) {
      newErrors.regUsername = 'Username wajib diisi';
    } else if (regUsername.trim().length < 3) {
      newErrors.regUsername = 'Username minimal 3 karakter';
    }

    if (!regEmail.trim()) {
      newErrors.regEmail = 'Email wajib diisi';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail.trim())) {
      newErrors.regEmail = 'Format email tidak valid';
    }

    if (!regPassword) {
      newErrors.regPassword = 'Password wajib diisi';
    } else if (regPassword.length < 6) {
      newErrors.regPassword = 'Password minimal 6 karakter';
    }

    if (!regConfirmPassword) {
      newErrors.regConfirmPassword = 'Ulangi password Anda';
    } else if (regPassword && regPassword !== regConfirmPassword) {
      newErrors.regConfirmPassword = 'Password tidak sama';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      login({
        username: regUsername.trim(),
        email: regEmail.trim(),
        createdAt: new Date().toISOString(),
      });

      setSuccessMsg(`Akun berhasil dibuat!`);
      setTimeout(() => {
        router.push('/');
      }, 600);
    }, 400);
  };

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!forgotEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotEmail.trim())) {
      newErrors.forgotEmail = 'Masukkan format email yang valid';
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setForgotSubmitted(true);
    }, 400);
  };

  // If user is already logged in, show profile card with logout option
  if (user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6" style={{ background: '#050816' }}>
        <div
          className="w-full max-w-[380px] rounded-3xl p-6 sm:p-8 text-center"
          style={{
            background: 'rgba(9, 14, 32, 0.92)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.7), 0 0 30px rgba(6,182,212,0.15)',
          }}
        >
          <div
            className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center text-lg font-black text-white"
            style={{
              background: 'linear-gradient(135deg, #06b6d4, #7c3aed)',
              boxShadow: '0 0 16px rgba(6,182,212,0.35)',
            }}
          >
            {user.username.charAt(0).toUpperCase()}
          </div>

          <h2 className="text-lg font-bold text-white mb-0.5">{user.username}</h2>
          <p className="text-xs text-slate-400 mb-5">{user.email}</p>

          <div className="flex flex-col gap-2.5">
            <Link
              href="/"
              className="w-full py-2.5 rounded-xl font-bold text-xs text-white flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(135deg, #06b6d4, #7c3aed)',
                boxShadow: '0 0 16px rgba(6,182,212,0.3)',
              }}
            >
              <Home size={14} />
              <span>Kembali ke Beranda</span>
            </Link>

            <button
              onClick={logout}
              className="w-full py-2.5 rounded-xl font-semibold text-xs text-slate-400 hover:text-rose-400 bg-white/5 hover:bg-rose-500/10 border border-white/10 hover:border-rose-500/30 transition-colors"
            >
              Keluar Akun
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 sm:p-6" style={{ background: '#050816' }}>
      {/* ── Ambient Background Glows ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div
          className="absolute top-1/4 -left-20 w-80 h-80 rounded-full blur-[120px] opacity-20"
          style={{ background: '#06b6d4' }}
        />
        <div
          className="absolute bottom-1/4 -right-20 w-80 h-80 rounded-full blur-[120px] opacity-20"
          style={{ background: '#7c3aed' }}
        />
      </div>

      {/* ── Main Form Card ── */}
      <div className="relative z-10 w-full max-w-[400px]">
        <div
          className="rounded-3xl p-6 sm:p-7 transition-all duration-300"
          style={{
            background: 'rgba(9, 14, 32, 0.94)',
            backdropFilter: 'blur(30px) saturate(190%)',
            WebkitBackdropFilter: 'blur(30px) saturate(190%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow:
              '0 25px 70px rgba(0, 0, 0, 0.85), 0 0 35px rgba(6, 182, 212, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
          }}
        >
          {/* Success Message Banner */}
          {successMsg && (
            <div className="mb-4 p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 size={15} className="text-emerald-400 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ── FORGOT PASSWORD VIEW ── */}
          {forgotPasswordView ? (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setForgotPasswordView(false);
                    setForgotSubmitted(false);
                    setErrors({});
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <ArrowLeft size={16} />
                </button>
                <h3 className="text-sm font-bold text-white">Lupa Password</h3>
              </div>

              {forgotSubmitted ? (
                <div className="text-center py-3 space-y-2.5">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 size={20} />
                  </div>
                  <h4 className="text-xs font-bold text-white">Email Terkirim</h4>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Tautan reset password dikirim ke <span className="text-cyan-400 font-semibold">{forgotEmail}</span>.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotPasswordView(false);
                      setForgotSubmitted(false);
                      setTab('login');
                    }}
                    className="w-full mt-3 py-2.5 rounded-xl text-xs font-bold text-white bg-white/10 hover:bg-white/20 transition-colors"
                  >
                    Kembali Masuk
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotSubmit} className="space-y-3.5">
                  <div className="space-y-1">
                    <div className="relative">
                      <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => {
                          setForgotEmail(e.target.value);
                          clearFieldError('forgotEmail');
                        }}
                        placeholder="Masukkan Email Anda"
                        className={`w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/[0.06] text-white text-xs placeholder-slate-500 focus:outline-none transition-colors ${
                          errors.forgotEmail
                            ? 'border border-rose-500 ring-1 ring-rose-500/40 bg-rose-500/5'
                            : 'border border-white/15 focus:border-cyan-400'
                        }`}
                      />
                    </div>
                    {errors.forgotEmail && (
                      <p className="text-[11px] text-rose-400 font-medium pl-1 flex items-center gap-1">
                        <AlertCircle size={11} />
                        {errors.forgotEmail}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 rounded-xl font-bold text-xs text-white transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] shadow-lg flex items-center justify-center gap-2"
                    style={{
                      background: 'linear-gradient(135deg, #06b6d4, #7c3aed)',
                      boxShadow: '0 0 16px rgba(6, 182, 212, 0.3)',
                    }}
                  >
                    {loading ? 'Mengirim...' : 'Kirim Tautan'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setForgotPasswordView(false);
                      setErrors({});
                    }}
                    className="w-full text-center text-xs font-semibold text-slate-400 hover:text-white pt-1"
                  >
                    Batal
                  </button>
                </form>
              )}
            </div>
          ) : (
            /* ── TABS: LOGIN & REGISTER ── */
            <>
              {/* Tab Selector */}
              <div className="flex rounded-2xl p-1 bg-white/[0.05] border border-white/10 mb-5">
                <button
                  type="button"
                  onClick={() => {
                    setTab('login');
                    setErrors({});
                  }}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all duration-200 ${
                    tab === 'login'
                      ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <LogIn size={13} />
                  <span>Masuk</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTab('register');
                    setErrors({});
                  }}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all duration-200 ${
                    tab === 'register'
                      ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <UserPlus size={13} />
                  <span>Daftar</span>
                </button>
              </div>

              {/* ── TAB 1: LOGIN ── */}
              {tab === 'login' && (
                <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                  <div className="space-y-1">
                    <div className="relative">
                      <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={loginIdentifier}
                        onChange={(e) => {
                          setLoginIdentifier(e.target.value);
                          clearFieldError('loginIdentifier');
                        }}
                        placeholder="Username/Email"
                        className={`w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/[0.06] text-white text-xs placeholder-slate-500 focus:outline-none transition-colors ${
                          errors.loginIdentifier
                            ? 'border border-rose-500 ring-1 ring-rose-500/40 bg-rose-500/5'
                            : 'border border-white/15 focus:border-cyan-400'
                        }`}
                      />
                    </div>
                    {errors.loginIdentifier && (
                      <p className="text-[11px] text-rose-400 font-medium pl-1 flex items-center gap-1">
                        <AlertCircle size={11} />
                        {errors.loginIdentifier}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="relative">
                      <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={loginPassword}
                        onChange={(e) => {
                          setLoginPassword(e.target.value);
                          clearFieldError('loginPassword');
                        }}
                        placeholder="Password"
                        className={`w-full pl-9 pr-9 py-2.5 rounded-xl bg-white/[0.06] text-white text-xs placeholder-slate-500 focus:outline-none transition-colors ${
                          errors.loginPassword
                            ? 'border border-rose-500 ring-1 ring-rose-500/40 bg-rose-500/5'
                            : 'border border-white/15 focus:border-cyan-400'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {errors.loginPassword && (
                      <p className="text-[11px] text-rose-400 font-medium pl-1 flex items-center gap-1">
                        <AlertCircle size={11} />
                        {errors.loginPassword}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs pt-0.5">
                    <label className="flex items-center gap-2 cursor-pointer text-slate-300 text-[11px]">
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
                        setErrors({});
                      }}
                      className="text-cyan-400 hover:underline font-medium text-[11px]"
                    >
                      Lupa Password?
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 rounded-xl font-bold text-xs text-white transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] shadow-lg flex items-center justify-center gap-2 mt-1"
                    style={{
                      background: 'linear-gradient(135deg, #06b6d4, #7c3aed)',
                      boxShadow: '0 0 16px rgba(6, 182, 212, 0.3)',
                    }}
                  >
                    <LogIn size={14} />
                    <span>{loading ? 'Memproses...' : 'Masuk'}</span>
                  </button>
                </form>
              )}

              {/* ── TAB 2: REGISTER ── */}
              {tab === 'register' && (
                <form onSubmit={handleRegisterSubmit} className="space-y-3">
                  <div className="space-y-1">
                    <div className="relative">
                      <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={regUsername}
                        onChange={(e) => {
                          setRegUsername(e.target.value);
                          clearFieldError('regUsername');
                        }}
                        placeholder="Username"
                        className={`w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/[0.06] text-white text-xs placeholder-slate-500 focus:outline-none transition-colors ${
                          errors.regUsername
                            ? 'border border-rose-500 ring-1 ring-rose-500/40 bg-rose-500/5'
                            : 'border border-white/15 focus:border-cyan-400'
                        }`}
                      />
                    </div>
                    {errors.regUsername && (
                      <p className="text-[11px] text-rose-400 font-medium pl-1 flex items-center gap-1">
                        <AlertCircle size={11} />
                        {errors.regUsername}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="relative">
                      <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="email"
                        value={regEmail}
                        onChange={(e) => {
                          setRegEmail(e.target.value);
                          clearFieldError('regEmail');
                        }}
                        placeholder="Email"
                        className={`w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/[0.06] text-white text-xs placeholder-slate-500 focus:outline-none transition-colors ${
                          errors.regEmail
                            ? 'border border-rose-500 ring-1 ring-rose-500/40 bg-rose-500/5'
                            : 'border border-white/15 focus:border-cyan-400'
                        }`}
                      />
                    </div>
                    {errors.regEmail && (
                      <p className="text-[11px] text-rose-400 font-medium pl-1 flex items-center gap-1">
                        <AlertCircle size={11} />
                        {errors.regEmail}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="relative">
                      <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={regPassword}
                        onChange={(e) => {
                          setRegPassword(e.target.value);
                          clearFieldError('regPassword');
                        }}
                        placeholder="Password"
                        className={`w-full pl-9 pr-9 py-2.5 rounded-xl bg-white/[0.06] text-white text-xs placeholder-slate-500 focus:outline-none transition-colors ${
                          errors.regPassword
                            ? 'border border-rose-500 ring-1 ring-rose-500/40 bg-rose-500/5'
                            : 'border border-white/15 focus:border-cyan-400'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {errors.regPassword && (
                      <p className="text-[11px] text-rose-400 font-medium pl-1 flex items-center gap-1">
                        <AlertCircle size={11} />
                        {errors.regPassword}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="relative">
                      <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={regConfirmPassword}
                        onChange={(e) => {
                          setRegConfirmPassword(e.target.value);
                          clearFieldError('regConfirmPassword');
                        }}
                        placeholder="Konfirmasi Password"
                        className={`w-full pl-9 pr-9 py-2.5 rounded-xl bg-white/[0.06] text-white text-xs placeholder-slate-500 focus:outline-none transition-colors ${
                          errors.regConfirmPassword
                            ? 'border border-rose-500 ring-1 ring-rose-500/40 bg-rose-500/5'
                            : 'border border-white/15 focus:border-cyan-400'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                      >
                        {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {errors.regConfirmPassword && (
                      <p className="text-[11px] text-rose-400 font-medium pl-1 flex items-center gap-1">
                        <AlertCircle size={11} />
                        {errors.regConfirmPassword}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 rounded-xl font-bold text-xs text-white transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] shadow-lg flex items-center justify-center gap-2 mt-2"
                    style={{
                      background: 'linear-gradient(135deg, #06b6d4, #7c3aed)',
                      boxShadow: '0 0 16px rgba(6, 182, 212, 0.3)',
                    }}
                  >
                    <UserPlus size={14} />
                    <span>{loading ? 'Mendaftarkan...' : 'Daftar Akun'}</span>
                  </button>
                </form>
              )}
            </>
          )}

          {/* Minimal Bottom Home Link */}
          <div className="mt-4 pt-3 border-t border-white/[0.08] text-center">
            <Link
              href="/"
              className="text-[11px] text-slate-400 hover:text-cyan-400 transition-colors inline-flex items-center gap-1"
            >
              <Home size={12} />
              <span>Kembali ke Beranda</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
