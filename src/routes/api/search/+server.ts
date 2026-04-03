import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { SearchArtist, SearchResponse, SearchPost } from '$lib/types';

const ACAS_SEARCH_ENDPOINT = 'https://www.accordiespartiti.it/wp-json/acas/v1/search/';

function normalizePosts(posts: SearchPost[]): SearchPost[] {
  const deduped = new Map<string, SearchPost>();

  for (const post of posts) {
    if (!post?.ln || !post?.n) {
      continue;
    }

    deduped.set(post.ln, post);
  }

  return [...deduped.values()].slice(0, 60);
}

function normalizeArtists(cats: SearchArtist[]): SearchArtist[] {
  const deduped = new Map<string, SearchArtist>();

  for (const cat of cats) {
    if (!cat?.ln || !cat?.n) {
      continue;
    }

    deduped.set(cat.ln, cat);
  }

  return [...deduped.values()].slice(0, 24);
}

export const GET: RequestHandler = async ({ url, fetch }) => {
  const query = url.searchParams.get('q')?.trim() ?? '';

  if (query.length < 2) {
    return json({ success: true, data: { posts: [], cats: [] } });
  }

  const upstream = new URL(ACAS_SEARCH_ENDPOINT);
  upstream.searchParams.set('query', query);

  let response: Response;
  try {
    response = await fetch(upstream.toString(), {
      headers: {
        accept: 'application/json',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0'
      }
    });
  } catch {
    return json({ success: false, error: 'Errore di rete verso ACAS.' }, { status: 502 });
  }

  if (!response.ok) {
    return json(
      {
        success: false,
        error: `ACAS ha risposto con status ${response.status}.`
      },
      { status: 502 }
    );
  }

  let payload: SearchResponse;
  try {
    payload = (await response.json()) as SearchResponse;
  } catch {
    return json({ success: false, error: 'Risposta ACAS non valida.' }, { status: 502 });
  }

  const posts = normalizePosts(payload?.data?.posts ?? []);
  const cats = normalizeArtists(payload?.data?.cats ?? []);

  return json(
    {
      success: true,
      data: {
        posts,
        cats
      }
    },
    {
      headers: {
        'cache-control': 'public, max-age=60'
      }
    }
  );
};
