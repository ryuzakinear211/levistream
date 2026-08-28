import { NextRequest, NextResponse } from 'next/server';
import siteConfig from '@/config';

export const dynamic = 'force-dynamic';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      mediaType = 'movie',
      title,
      tmdbId,
      year,
      posterUrl,
      genres = [],
      season,
      message,
      userContact,
    } = body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json(
        { error: 'Judul film atau serial TV wajib diisi.' },
        { status: 400 }
      );
    }

    const cleanTitle = title.trim();
    const cleanMediaType = mediaType === 'tv' ? 'tv' : 'movie';
    const isTV = cleanMediaType === 'tv';

    const botToken =
      process.env.TELEGRAM_BOT_TOKEN ||
      siteConfig.telegram?.botToken ||
      '6673058749:AAH0X2vdpEgWNxeDhsZJy77_pXIG-_YCpRU';
    const chatId =
      process.env.TELEGRAM_CHAT_ID || siteConfig.telegram?.chatId || '';

    // Format local Indonesian timestamp (WIB / GMT+7)
    const now = new Date();
    const timeFormatted = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(now);

    // Build Telegram HTML Message
    const formattedGenres = Array.isArray(genres) && genres.length > 0 ? genres.join(', ') : 'N/A';
    const tmdbLink = tmdbId
      ? `<a href="https://www.themoviedb.org/${cleanMediaType}/${tmdbId}">${tmdbId}</a>`
      : '<i>Manual Entry</i>';

    const captionText = [
      `🎬 <b>PERMINTAAN KONTEN BARU (${siteConfig.name})</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━`,
      `📌 <b>Judul:</b> <b>${escapeHtml(cleanTitle)}</b> ${year ? `(${escapeHtml(String(year))})` : ''}`,
      `📺 <b>Tipe:</b> ${isTV ? '📺 TV Series / Drama' : '🎬 Movie / Film'}`,
      `🆔 <b>TMDB ID:</b> ${tmdbLink}`,
      `🎭 <b>Genre:</b> ${escapeHtml(formattedGenres)}`,
      season ? `📦 <b>Musim / Episode:</b> ${escapeHtml(String(season))}` : null,
      userContact ? `👤 <b>Pengirim:</b> ${escapeHtml(String(userContact))}` : null,
      ``,
      `📝 <b>Pesan / Catatan:</b>`,
      `<blockquote>${escapeHtml(message ? message.trim() : 'Tidak ada catatan tambahan.')}</blockquote>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━`,
      `⏰ <i>${escapeHtml(timeFormatted)} WIB</i>`,
    ]
      .filter((line) => line !== null)
      .join('\n');

    let telegramSent = false;
    let telegramError: string | null = null;

    if (botToken && chatId) {
      try {
        // Try sending with photo if available
        if (posterUrl && typeof posterUrl === 'string' && posterUrl.startsWith('http')) {
          const photoRes = await fetch(
            `https://api.telegram.org/bot${botToken}/sendPhoto`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                photo: posterUrl,
                caption: captionText,
                parse_mode: 'HTML',
              }),
            }
          );
          const photoData = await photoRes.json();
          if (photoData.ok) {
            telegramSent = true;
          } else {
            console.warn('[Telegram sendPhoto failed, falling back to sendMessage]:', photoData);
            // Fallback to text sendMessage
            const textRes = await fetch(
              `https://api.telegram.org/bot${botToken}/sendMessage`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: chatId,
                  text: captionText,
                  parse_mode: 'HTML',
                  disable_web_page_preview: false,
                }),
              }
            );
            const textData = await textRes.json();
            if (textData.ok) telegramSent = true;
            else telegramError = textData.description || 'Gagal mengirim pesan telegram.';
          }
        } else {
          const textRes = await fetch(
            `https://api.telegram.org/bot${botToken}/sendMessage`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                text: captionText,
                parse_mode: 'HTML',
                disable_web_page_preview: false,
              }),
            }
          );
          const textData = await textRes.json();
          if (textData.ok) telegramSent = true;
          else telegramError = textData.description || 'Gagal mengirim pesan telegram.';
        }
      } catch (err: any) {
        console.error('[Telegram API Network Error]:', err);
        telegramError = err.message || 'Network error sending to Telegram';
      }
    } else {
      console.log('[Content Request Received without Telegram Chat ID]:', {
        title: cleanTitle,
        mediaType: cleanMediaType,
        tmdbId,
        year,
        genres,
        message,
        userContact,
      });
    }

    return NextResponse.json({
      success: true,
      telegramSent,
      telegramError,
      message: 'Permintaan konten berhasil dikirim.',
    });
  } catch (error: any) {
    console.error('[API /api/request error]:', error);
    return NextResponse.json(
      { error: error.message || 'Terjadi kesalahan saat memproses permintaan.' },
      { status: 500 }
    );
  }
}
