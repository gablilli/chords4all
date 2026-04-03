import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { load } from 'cheerio';
import type { SongData } from '$lib/types';

const DEFAULT_BASE_URL = 'https://www.accordiespartiti.it/';
const ALLOWED_HOSTS = new Set(['accordiespartiti.it', 'www.accordiespartiti.it']);

function cleanInline(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function cleanMultiline(value: string): string {
  return value
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.replace(/\u00a0/g, ' ').replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseInputUrl(input: string): URL | null {
  try {
    return new URL(input);
  } catch {
    try {
      return new URL(input, DEFAULT_BASE_URL);
    } catch {
      return null;
    }
  }
}

function normalizeTargetUrl(target: URL): URL {
  if (target.hostname === 'accordiespartiti.it') {
    target.hostname = 'www.accordiespartiti.it';
  }

  return target;
}

function normalizeSameHostUrl(rawUrl: string | undefined, base: URL): string | undefined {
  if (!rawUrl) {
    return undefined;
  }

  try {
    const parsed = normalizeTargetUrl(new URL(rawUrl, base));
    if (!ALLOWED_HOSTS.has(parsed.hostname)) {
      return undefined;
    }

    return parsed.toString();
  } catch {
    return undefined;
  }
}

function deriveArtistUrlFromSongPath(songUrl: URL): string | undefined {
  const match = songUrl.pathname.match(/^\/accordi\/([^/]+)\/([^/]+)\/[^/]+\/?$/i);
  if (!match) {
    return undefined;
  }

  const [, genre, artistSlug] = match;
  const derived = new URL(`/cat/accordi/${genre}/${artistSlug}/`, DEFAULT_BASE_URL);
  return normalizeTargetUrl(derived).toString();
}

export const GET: RequestHandler = async ({ url, fetch }) => {
  const sourceUrl = url.searchParams.get('url')?.trim() ?? '';

  if (!sourceUrl) {
    return json({ success: false, error: 'Parametro url mancante.' }, { status: 400 });
  }

  const parsed = parseInputUrl(sourceUrl);
  if (!parsed) {
    return json({ success: false, error: 'URL non valido.' }, { status: 400 });
  }

  const target = normalizeTargetUrl(parsed);
  if (!ALLOWED_HOSTS.has(target.hostname)) {
    return json({ success: false, error: 'Host non consentito.' }, { status: 400 });
  }

  let response: Response;
  try {
    response = await fetch(target.toString(), {
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0',
        accept: 'text/html,application/xhtml+xml'
      }
    });
  } catch {
    return json({ success: false, error: 'Errore di rete nel fetch del brano.' }, { status: 502 });
  }

  if (!response.ok) {
    return json(
      {
        success: false,
        error: `Il sito remoto ha risposto con status ${response.status}.`
      },
      { status: 502 }
    );
  }

  const html = await response.text();
  const $ = load(html);

  const canonicalUrl =
    $('link[rel="canonical"]').first().attr('href')?.trim() || target.toString();

  let canonicalParsed: URL;
  try {
    canonicalParsed = new URL(canonicalUrl, target);
  } catch {
    canonicalParsed = target;
  }

  const titleNode = $('#post-title').first().clone();
  titleNode.find('span,script,style').remove();
  const titleFromPost = cleanInline(titleNode.text());

  const fallbackTitle = cleanInline($('title').first().text()).replace(/\s+Accordi.*$/i, '').trim();
  const title = titleFromPost || fallbackTitle || 'Brano senza titolo';

  const artistLink = $('#category-name a').first();
  const artistFromLink = cleanInline(artistLink.text());
  const artist = artistFromLink || cleanInline($('#category-name').first().text()) || 'Artista sconosciuto';
  const artistUrl =
    normalizeSameHostUrl(artistLink.attr('href')?.trim(), target) ||
    normalizeSameHostUrl($('#title-box a').first().attr('href')?.trim(), target) ||
    deriveArtistUrlFromSongPath(target) ||
    deriveArtistUrlFromSongPath(canonicalParsed);

  const chordContainer = $('.post-content pre .chiave').first();
  const chordsRaw = chordContainer.length ? chordContainer.text() : $('.post-content pre').first().text();
  const chordsText = cleanMultiline(chordsRaw || '');

  if (!chordsText) {
    return json(
      {
        success: false,
        error: 'Non sono riuscito a trovare il blocco accordi/testo.'
      },
      { status: 422 }
    );
  }

  const song: SongData = {
    url: target.toString(),
    canonicalUrl,
    title,
    artist,
    artistUrl,
    key: chordContainer.attr('name')?.trim() || undefined,
    chordsText,
    description: cleanInline($('#song-description').first().text()) || undefined,
    youtubeUrl: $('#video-wrapper iframe').first().attr('src')?.trim() || undefined,
    credits: cleanInline($('#credits').first().text()) || undefined,
    extractedAt: new Date().toISOString()
  };

  return json(
    {
      success: true,
      data: song
    },
    {
      headers: {
        'cache-control': 'public, max-age=120'
      }
    }
  );
};
