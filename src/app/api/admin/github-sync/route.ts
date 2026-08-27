import { NextRequest, NextResponse } from 'next/server';
import { getGitHubConfigFromRequest, syncAllToGitHub } from '@/lib/admin/cmsService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const ghConfig = getGitHubConfigFromRequest(request);
    const result = await syncAllToGitHub(ghConfig);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API github-sync] Error:', error);
    const requiresToken = error.message?.includes('Token GitHub diperlukan');
    return NextResponse.json(
      { error: error.message || 'Failed to sync with GitHub', requiresToken },
      { status: requiresToken ? 401 : 500 }
    );
  }
}
