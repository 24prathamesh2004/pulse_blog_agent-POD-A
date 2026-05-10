/**
 * External API Utilities
 * Developer: Developer A
 * 
 * Shared utilities for external API integrations:
 * - Google Trends
 * - Google News RSS
 * - RSS Parser
 * - Mozilla Readability (web scraping)
 */

/**
 * DuckDuckGo Search (fallback, not actively used)
 */
export async function ddgSearch(query: string, max = 10) {
  try {
    const DDG = await import('duck-duck-scrape');
    const r = await DDG.search(query, { safeSearch: DDG.SafeSearchType.MODERATE });
    return (r.results ?? []).slice(0, max).map((x) => ({ 
      title: x.title, 
      url: x.url, 
      description: x.description 
    }));
  } catch (e) {
    console.warn('ddgSearch failed', (e as Error).message);
    return [];
  }
}

/**
 * Google News RSS Search
 * Primary method for news discovery
 */
export async function ddgNews(query: string, max = 10) {
  try {
    const encoded = encodeURIComponent(query);
    const rssUrl = `https://news.google.com/rss/search?q=${encoded}&hl=en-US&gl=US&ceid=US:en`;
    const items = await fetchRss(rssUrl, max);
    return items.map((item) => ({
      title: item.title,
      url: item.url,
      excerpt: item.summary,
      date: item.published ?? undefined,
      source: 'Google News',
    }));
  } catch (e) {
    console.warn('Google News RSS failed for query:', query, (e as Error).message);
    return [];
  }
}

/**
 * Google Trends - Rising Queries
 * Fetches trending search terms related to a keyword
 */
export async function trendsRising(keyword: string, geo = '') {
  // Try Google Trends first, fall back to Google News RSS if blocked
  try {
    const googleTrends = await import('google-trends-api');
    const raw = await googleTrends.default.relatedQueries({ keyword, geo });
    const j = JSON.parse(raw);
    const rising = j?.default?.rankedList?.[1]?.rankedKeyword ?? [];
    if (rising.length > 0) {
      return rising.slice(0, 10).map((x: { query: string; value: number }) => ({ 
        term: x.query, 
        value: x.value 
      }));
    }
    throw new Error('empty results');
  } catch {
    // Fallback: pull Google News RSS for the keyword and extract titles as trend terms
    try {
      const encoded = encodeURIComponent(keyword);
      const rssUrl = `https://news.google.com/rss/search?q=${encoded}&hl=en-US&gl=US&ceid=US:en`;
      const items = await fetchRss(rssUrl, 10);
      return items.map((item, i) => ({ 
        term: item.title.slice(0, 80), 
        value: 100 - i * 8 
      }));
    } catch (e) {
      console.warn('trendsRising failed', keyword, (e as Error).message);
      return [] as Array<{ term: string; value: number }>;
    }
  }
}

/**
 * RSS Feed Parser
 * Fetches and parses RSS/Atom feeds
 */
export async function fetchRss(url: string, max = 20) {
  try {
    const Parser = await import('rss-parser');
    const rss = new Parser.default({ 
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PulseBot/1.0; +https://pulse.local)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*'
      }
    });
    const feed = await rss.parseURL(url);
    return (feed.items ?? []).slice(0, max).map((it) => ({
      title: it.title ?? '(untitled)',
      url: it.link ?? '',
      summary: (it.contentSnippet ?? it.content ?? '').slice(0, 400),
      published: it.isoDate ?? it.pubDate ?? null,
    })).filter((x) => x.url);
  } catch (e) {
    const err = e as Error;
    console.warn('fetchRss failed', url, err.message);
    return [];
  }
}

/**
 * Web Scraper with Mozilla Readability
 * Fetches webpage and extracts clean article content
 */
export async function fetchAndExtract(
  url: string
): Promise<{ title: string; text: string; html: string; hero: string | null } | null> {
  try {
    const [{ JSDOM }, { Readability }, cheerio] = await Promise.all([
      import('jsdom'),
      import('@mozilla/readability'),
      import('cheerio'),
    ]);
    
    // Fetch HTML with timeout
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PulseBot/1.0; +https://pulse.local)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(20000), // 20 second timeout
    });
    
    if (!res.ok) {
      console.warn(`fetchAndExtract: HTTP ${res.status} for ${url}`);
      return null;
    }
    
    const html = await res.text();
    
    // Parse with JSDOM
    const dom = new JSDOM(html, { url });
    
    // Extract with Readability
    const reader = new Readability(dom.window.document);
    const art = reader.parse();
    
    if (!art) {
      console.warn(`fetchAndExtract: Readability failed for ${url}`);
      return null;
    }
    
    // Extract hero image with Cheerio
    const $ = cheerio.load(html);
    const hero =
      $('meta[property="og:image"]').attr('content') ??
      $('meta[name="twitter:image"]').attr('content') ??
      $('article img').first().attr('src') ??
      null;
    
    // Clean text (remove extra whitespace)
    const text = (art.textContent ?? '').replace(/\s+/g, ' ').trim();
    
    return { 
      title: art.title ?? '', 
      text, 
      html: art.content ?? '', 
      hero 
    };
  } catch (e) {
    console.warn('fetchAndExtract failed', url, (e as Error).message);
    return null;
  }
}

/**
 * Utility: Normalize URL (remove tracking parameters)
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    
    // Remove common tracking parameters
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'fbclid', 'gclid', 'msclkid',
      'ref', 'source', 'campaign',
    ];
    
    trackingParams.forEach(param => {
      parsed.searchParams.delete(param);
    });
    
    return parsed.toString();
  } catch {
    return url; // Return original if parsing fails
  }
}

/**
 * Utility: Extract domain from URL
 */
export function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Utility: Validate URL
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
