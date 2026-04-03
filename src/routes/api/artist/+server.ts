import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { load } from 'cheerio';
import type { ArtistData, ArtistSong } from '$lib/types';

const DEFAULT_BASE_URL = 'https://www.accordiespartiti.it/';
const ALLOWED_HOSTS = new Set(['accordiespartiti.it', 'www.accordiespartiti.it']);

function cleanInline(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
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

function extractArtistSongs(html: string, pageUrl: URL): ArtistSong[] {
  const $ = load(html);
  const deduped = new Map<string, ArtistSong>();

  const selectors = ['.search-results2 .archives > a[href]', '#content .search-results2 a[href]'];

  for (const selector of selectors) {
    $(selector).each((_, element) => {
      const href = $(element).attr('href')?.trim();
      if (!href) {
        return;
      }

      let resolvedUrl: string;
      try {
        resolvedUrl = new URL(href, pageUrl).toString();
      } catch {
        return;
      }

      const title =
        cleanInline($(element).find('.left-side > div').first().text()) ||
        cleanInline($(element).find('.left-side').first().text()) ||
        cleanInline($(element).text());

      if (!title) {
        return;
      }

      deduped.set(resolvedUrl, {
        title,
        url: resolvedUrl
      });
    });
  }

  return [...deduped.values()];
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
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        accept: 'text/html,application/xhtml+xml'
      }
    });
  } catch {
    return json({ success: false, error: 'Errore di rete nel fetch artista.' }, { status: 502 });
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

  const titleRaw = cleanInline($('title').first().text());
  const fallbackName = titleRaw.replace(/\s*-\s*Tutti gli Accordi.*$/i, '').trim();

  const name =
    cleanInline($('#artist-name').first().text()) ||
    cleanInline($('#title-box h1.archivio').first().text()) ||
    fallbackName ||
    'Artista';

  const imageCandidate = $('#title-box img.category-thumb').first().attr('src')?.trim();
  const imageUrl = imageCandidate ? new URL(imageCandidate, target).toString() : undefined;

  const description = cleanInline($('.content.category-description').first().text()) || undefined;
  const songs = extractArtistSongs(html, target);

  if (!songs.length) {
    return json(
      {
        success: false,
        error: 'Nessuna canzone trovata nella pagina artista.'
      },
      { status: 422 }
    );
  }

  const artist: ArtistData = {
    url: target.toString(),
    canonicalUrl,
    name,
    songs,
    description,
    imageUrl,
    extractedAt: new Date().toISOString()
  };

  return json(
    {
      success: true,
      data: artist
    },
    {
      headers: {
        'cache-control': 'public, max-age=300'
      }
    }
  );
};