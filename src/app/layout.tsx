import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import AppLayout from '@/components/AppLayout';
import BackToTop from '@/components/BackToTop';
import { getGenres } from '@/lib/tmdb';

import siteConfig from '@/config';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: `${siteConfig.name} - ${siteConfig.tagline}`,
  description: siteConfig.description,
  keywords: siteConfig.keywords.join(', '),
  applicationName: siteConfig.name,
  authors: [{ name: siteConfig.name, url: siteConfig.url }],
  creator: siteConfig.name,
  publisher: siteConfig.name,
  openGraph: {
    siteName: siteConfig.name,
    title: `${siteConfig.name} - ${siteConfig.tagline}`,
    description: siteConfig.description,
    type: 'website',
    url: siteConfig.url,
  },
  other: {
    'og:site_name': siteConfig.name,
    'application-name': siteConfig.name,
    'apple-mobile-web-app-title': siteConfig.name,
    'twitter:site': `@${siteConfig.name}`,
    'twitter:creator': `@${siteConfig.name}`,
  },
};

import TopProgressBar from '@/components/TopProgressBar';

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let genres: import('@/types/tmdb').Genre[] = [];
  try {
    genres = await getGenres();
  } catch {
    genres = [];
  }

  return (
    <html lang="en" className={`${plusJakartaSans.variable} ${plusJakartaSans.className}`}>
      <body
        style={{
          backgroundColor: '#050816',
          color: '#f1f5f9',
          minHeight: '100vh',
        }}
      >
        <TopProgressBar />
        <AppLayout genres={genres}>
          {children}
        </AppLayout>
        <BackToTop />
      </body>
    </html>
  );
}
