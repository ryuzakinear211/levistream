import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import TVBrowseClient from './TVBrowseClient';
import BrowseGridSkeleton from '@/components/skeletons/BrowseGridSkeleton';
import siteConfig from '@/config';

export const metadata: Metadata = {
  title: `Browse TV Series - ${siteConfig.name}`,
  description: `Explore thousands of TV series and episodes on ${siteConfig.name}.`,
};

export default function TVBrowsePage() {
  return (
    <Suspense fallback={<BrowseGridSkeleton title="Browse TV Series" />}>
      <TVBrowseClient />
    </Suspense>
  );
}
