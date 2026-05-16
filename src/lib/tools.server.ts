// External tools used by agents: DuckDuckGo, Google Trends, RSS, readability.
// Using dynamic imports to prevent Node.js modules from leaking into browser bundle

export async function ddgSearch(query: string, max = 10) {
  try {
    const DDG = await import("duck-duck-scrape");
    const r = await DDG.search(query, { safeSearch: DDG.SafeSearchType.MODERATE });
    return (r.results ?? []).slice(0, max).map((x) => ({ title: x.title, url: x.url, description: x.description }));
  } catch (e) {
    console.warn("ddgSearch failed", (e as Error).message);
    return [];
  }
}

export async function ddgNews(query: string, max = 10) {
  // Skip DDG entirely - it's unreliable. Use Google News RSS directly.
  try {
    const encoded = encodeURIComponent(query);
    const rssUrl = `https://news.google.com/rss/search?q=${encoded}&hl=en-US&gl=US&ceid=US:en`;
    const items = await fetchRss(rssUrl, max);
    return items.map((item) => ({
      title: item.title,
      url: item.url,
      excerpt: item.summary,
      date: item.published ?? undefined,
      source: "Google News",
    }));
  } catch (e) {
    console.warn("Google News RSS failed for query:", query, (e as Error).message);
    return [];
  }
}

export async function trendsRising(keyword: string, geo = "") {
  // Try Google Trends first, fall back to Google News RSS if blocked
  try {
    const googleTrends = await import("google-trends-api");
    const raw = await googleTrends.default.relatedQueries({ keyword, geo });
    const j = JSON.parse(raw);
    const rising = j?.default?.rankedList?.[1]?.rankedKeyword ?? [];
    if (rising.length > 0) {
      return rising.slice(0, 10).map((x: { query: string; value: number }) => ({ term: x.query, value: x.value }));
    }
    throw new Error("empty results");
  } catch {
    // Fallback: pull Google News RSS for the keyword and extract titles as trend terms
    try {
      const encoded = encodeURIComponent(keyword);
      const rssUrl = `https://news.google.com/rss/search?q=${encoded}&hl=en-US&gl=US&ceid=US:en`;
      const items = await fetchRss(rssUrl, 10);
      return items.map((item, i) => ({ term: item.title.slice(0, 80), value: 100 - i * 8 }));
    } catch (e) {
      console.warn("trendsRising failed", keyword, (e as Error).message);
      return [] as Array<{ term: string; value: number }>;
    }
  }
}

export async function fetchRss(url: string, max = 20) {
  try {
    const Parser = await import("rss-parser");
    const rss = new Parser.default({ 
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PulseBot/1.0; +https://pulse.local)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*'
      }
    });
    const feed = await rss.parseURL(url);
    return (feed.items ?? []).slice(0, max).map((it) => ({
      title: it.title ?? "(untitled)",
      url: it.link ?? "",
      summary: (it.contentSnippet ?? it.content ?? "").slice(0, 400),
      published: it.isoDate ?? it.pubDate ?? null,
    })).filter((x) => x.url);
  } catch (e) {
    const err = e as Error;
    console.warn("fetchRss failed", url, err.message);
    return [];
  }
}

export async function fetchAndExtract(url: string): Promise<{ title: string; text: string; html: string; hero: string | null } | null> {
  try {
    const [{ JSDOM }, { Readability }, cheerio] = await Promise.all([
      import("jsdom"),
      import("@mozilla/readability"),
      import("cheerio"),
    ]);
    
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PulseBot/1.0; +https://pulse.local)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const art = reader.parse();
    if (!art) return null;
    const $ = cheerio.load(html);
    const hero =
      $('meta[property="og:image"]').attr("content") ??
      $('meta[name="twitter:image"]').attr("content") ??
      $("article img").first().attr("src") ??
      null;
    const text = (art.textContent ?? "").replace(/\s+/g, " ").trim();
    return { title: art.title ?? "", text, html: art.content ?? "", hero };
  } catch (e) {
    console.warn("fetchAndExtract failed", url, (e as Error).message);
    return null;
  }
}
