import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({
        success: false,
        user: null,
        message: 'Belum login (Guest)',
      });
    }

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (err: any) {
    console.error('[API auth/me] error:', err);
    return NextResponse.json(
      { success: false, user: null, message: err.message },
      { status: 500 }
    );
  }
}
