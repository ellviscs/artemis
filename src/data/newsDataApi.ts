export interface DisasterNewsArticle {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  publishedAt: string;
  link: string;
  sourceName: string;
  /** Outlet homepage host (e.g. "abc.net.au"), shown so readers can check the source. */
  sourceDomain: string;
  language: string;
}

interface NewsDataResponse {
  status?: unknown;
  results?: Array<{
    article_id?: unknown;
    title?: unknown;
    description?: unknown;
    image_url?: unknown;
    pubDate?: unknown;
    link?: unknown;
    source_name?: unknown;
    source_id?: unknown;
    source_url?: unknown;
    language?: unknown;
    duplicate?: unknown;
  }>;
}

// Server-side proxy holds the NewsData.io key (see server/handlers.ts).
const NEWS_PROXY_URL = '/api/news';
const CACHE_KEY = 'artemis-newsdata-wildfire:v3';
const CACHE_TTL_MS = 30 * 60 * 1000;
const ARTICLE_LIMIT = 10;
/** Older stories are dropped: the section is for what is burning now. */
const MAX_AGE_DAYS = 45;
/** Aggregators re-host other outlets' stories; only original publishers are shown. */
const AGGREGATOR_SOURCES = /^(google|yahoo|msn|newsbreak|flipboard|ground_news)/i;

function hostOf(url: unknown): string {
  if (typeof url !== 'string') return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

interface CachedArticles {
  savedAt: number;
  articles: DisasterNewsArticle[];
}

function readCache(): DisasterNewsArticle[] | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(CACHE_KEY);
  if (!raw) return null;

  try {
    const cached = JSON.parse(raw) as CachedArticles;
    if (
      !Number.isFinite(cached.savedAt) ||
      Date.now() - cached.savedAt > CACHE_TTL_MS ||
      !Array.isArray(cached.articles)
    ) {
      window.localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return cached.articles;
  } catch {
    window.localStorage.removeItem(CACHE_KEY);
    return null;
  }
}

function writeCache(articles: DisasterNewsArticle[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CACHE_KEY, JSON.stringify({
    savedAt: Date.now(),
    articles,
  } satisfies CachedArticles));
}

function mapArticles(response: NewsDataResponse): DisasterNewsArticle[] {
  return (response.results ?? []).flatMap((item, index) => {
    if (
      typeof item.title !== 'string' ||
      !item.title.trim() ||
      typeof item.link !== 'string' ||
      typeof item.pubDate !== 'string'
    ) {
      return [];
    }

    // English only, original publishers only, no syndicated duplicates, nothing stale.
    if (typeof item.language === 'string' && item.language.toLowerCase() !== 'english') return [];
    if (item.duplicate === true) return [];
    if (typeof item.source_id === 'string' && AGGREGATOR_SOURCES.test(item.source_id)) return [];
    const published = new Date(item.pubDate.replace(' ', 'T') + (/[zZ]|[+-]\d\d:?\d\d$/.test(item.pubDate) ? '' : 'Z'));
    if (Number.isNaN(published.getTime()) || Date.now() - published.getTime() > MAX_AGE_DAYS * 86400000) return [];

    const description = typeof item.description === 'string' ? item.description : '';
    const searchableText = `${item.title} ${description}`.toLowerCase();
    const isWildfireRelated = /(wildfire|wild fire|forest fire|bushfire|brush fire|peat fire|grass fire|haze)/i.test(searchableText);
    if (!isWildfireRelated) return [];

    return [{
      id: typeof item.article_id === 'string' ? item.article_id : `${item.link}-${index}`,
      title: item.title,
      description,
      imageUrl: typeof item.image_url === 'string' && item.image_url
        ? item.image_url
        : '',
      publishedAt: published.toISOString(),
      link: item.link,
      sourceName: typeof item.source_name === 'string' && item.source_name
        ? item.source_name
        : 'NewsData.io',
      sourceDomain: hostOf(item.source_url) || hostOf(item.link),
      language: typeof item.language === 'string' ? item.language.toUpperCase() : '—',
    }];
  });
}

export async function fetchDisasterNews(signal?: AbortSignal): Promise<DisasterNewsArticle[]> {
  const cached = readCache();
  if (cached) return cached;
  const response = await fetch(NEWS_PROXY_URL, { signal });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 120);
    throw new Error(`NewsData.io request failed (${response.status})${response.status === 500 && detail ? `: ${detail}` : '.'}`);
  }
  const data = await response.json() as NewsDataResponse & { results?: unknown };
  if (data.status === 'error') throw new Error('NewsData.io returned an error.');

  const articles = mapArticles(data)
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, ARTICLE_LIMIT);
  writeCache(articles);
  return articles;
}
