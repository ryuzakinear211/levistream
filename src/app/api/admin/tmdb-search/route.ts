import { NextRequest, NextResponse } from 'next/server';
import { searchMovies, searchTVShows, getImageUrl } from '@/lib/tmdb';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query') || '';
  const type = searchParams.get('type') || 'movie'; // 'movie' or 'tv'

  if (!query.trim()) {
    return NextResponse.json({ results: [] });
  }

  try {
    if (type === 'tv') {
      const data = await searchTVShows(query.trim(), 1);
      const results = (data.results || []).slice(0, 10).map((item) => ({
        id: item.id,
        title: item.name,
        overview: item.overview || '',
        posterUrl: item.poster_path ? getImageUrl(item.poster_path, 'w300') : null,
        backdropUrl: item.backdrop_path ? getImageUrl(item.backdrop_path, 'w780') : null,
        year: item.first_air_date ? item.first_air_date.slice(0, 4) : null,
        rating: item.vote_average ? Math.round(item.vote_average * 10) / 10 : null,
        mediaType: 'tv',
      }));
      return NextResponse.json({ results });
    } else {
      const data = await searchMovies(query.trim(), 1);
      const results = (data.results || []).slice(0, 10).map((item) => ({
        id: item.id,
        title: item.title,
        overview: item.overview || '',
        posterUrl: item.poster_path ? getImageUrl(item.poster_path, 'w300') : null,
        backdropUrl: item.backdrop_path ? getImageUrl(item.backdrop_path, 'w780') : null,
        year: item.release_date ? item.release_date.slice(0, 4) : null,
        rating: item.vote_average ? Math.round(item.vote_average * 10) / 10 : null,
        mediaType: 'movie',
      }));
      return NextResponse.json({ results });
    }
  } catch (error: any) {
    console.error('[API tmdb-search] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to search TMDB' }, { status: 500 });
  }
}
