import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import TVBrowseClient from './TVBrowseClient';
import siteConfig from '@/config';

export const metadata: Metadata = {
  title: `Browse TV Series - ${siteConfig.name}`,
  description: `Explore thousands of TV series and episodes on ${siteConfig.name}.`,
};

export default function TVBrowsePage() {
  return (
    <Suspense fallback={<div className="min-h-screen pt-24 px-4" style={{ background: '#050816' }} />}>
      <TVBrowseClient />
    </Suspense>
  );
}
