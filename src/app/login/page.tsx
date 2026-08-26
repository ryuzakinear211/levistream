import React from 'react';
import type { Metadata } from 'next';
import LoginPageClient from './LoginPageClient';
import siteConfig from '@/config';

export const metadata: Metadata = {
  title: `Masuk atau Daftar - ${siteConfig.name}`,
  description: `Masuk ke akun ${siteConfig.name} Anda untuk menyimpan watchlist, melanjutkan tontonan, dan menikmati film serta serial favorit.`,
};

export default function LoginPage() {
  return <LoginPageClient />;
}
