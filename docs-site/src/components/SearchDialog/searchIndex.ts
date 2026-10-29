import lunr from 'lunr';

export interface RawDoc {
  i: number;
  t: string;
  u?: string;
  h?: string;
  b?: string[];
  p?: number;
}

export interface SearchHit {
  id: string;
  url: string;
  title: string;
  pageTitle: string;
  breadcrumb: string[];
  kind: 'page' | 'heading' | 'content';
  score: number;
}

interface RawContext {
  documents: RawDoc[];
  index: object;
}

interface LoadedContext {
  documents: Map<number, RawDoc>;
  index: lunr.Index;
}

const PAGES = 0;
const HEADINGS = 1;
const CONTENT = 4;

const KIND_BY_CONTEXT: Record<number, SearchHit['kind']> = {
  [PAGES]: 'page',
  [HEADINGS]: 'heading',
  [CONTENT]: 'content',
};

const SCORE_WEIGHT: Record<SearchHit['kind'], number> = {
  page: 3,
  heading: 2,
  content: 1,
};

let loaded: LoadedContext[] | null = null;
let inFlight: Promise<LoadedContext[]> | null = null;

export function resetSearchIndex(): void {
  loaded = null;
  inFlight = null;
}

export async function loadSearchIndex(url: string): Promise<LoadedContext[]> {
  if (loaded) return loaded;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const response = await fetch(url);
    const body = response.ok ? await response.text() : '';
    if (!response.ok || !body.trimStart().startsWith('[')) {
      throw new Error(
        'Search is only available in a production build — run "npm run build && npm run serve".'
      );
    }
    const raw: RawContext[] = JSON.parse(body);
    loaded = raw.map((ctx) => ({
      documents: new Map(ctx.documents.map((d) => [d.i, d])),
      index: lunr.Index.load(ctx.index as never),
    }));
    return loaded;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

function buildQuery(term: string): string {
  return term
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const safe = word.replace(/[~^:*+\-]/g, '');
      if (!safe) return '';
      return `${safe}^2 ${safe}*`;
    })
    .filter(Boolean)
    .join(' ');
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, '');
}

export function searchIndex(contexts: LoadedContext[], term: string, limit = 12): SearchHit[] {
  const query = buildQuery(term);
  if (!query) return [];

  const pages = contexts[PAGES];
  const byUrl = new Map<string, SearchHit>();

  for (const ctxId of [PAGES, HEADINGS, CONTENT]) {
    const ctx = contexts[ctxId];
    if (!ctx) continue;

    let matches: lunr.Index.Result[];
    try {
      matches = ctx.index.search(query);
    } catch {
      continue;
    }

    for (const match of matches) {
      const doc = ctx.documents.get(Number(match.ref));
      if (!doc) continue;

      const parent = doc.p !== undefined ? pages?.documents.get(doc.p) : undefined;
      const base = doc.u ?? parent?.u;
      if (!base) continue;

      const kind = KIND_BY_CONTEXT[ctxId];
      const url = `${base}${doc.h ?? ''}`;
      const pageTitle = stripHtml(parent?.t ?? doc.t);
      const title = kind === 'page' ? pageTitle : stripHtml(doc.t);
      const score = match.score * SCORE_WEIGHT[kind];

      const existing = byUrl.get(url);
      if (existing && existing.score >= score) continue;

      byUrl.set(url, {
        id: url,
        url,
        title: title.length > 180 ? `${title.slice(0, 180)}…` : title,
        pageTitle,
        breadcrumb: parent?.b ?? doc.b ?? [],
        kind,
        score,
      });
    }
  }

  return [...byUrl.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}
