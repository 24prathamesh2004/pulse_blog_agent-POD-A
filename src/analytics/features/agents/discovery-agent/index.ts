/**
 * Discovery Agent - Content Discovery Pipeline
 * Developer: Developer A
 * 
 * Purpose: Finds fresh article URLs from multiple sources
 * 
 * Features:
 * - RSS feed parsing for category-specific sources
 * - Google News RSS search using keywords
 * - URL deduplication
 * - Filters against existing content
 * - Supabase database storage
 */

import 'dotenv/config';
import { fetchRss, ddgNews } from '../utils/external-apis';
import { supabase, startAgentRun, endAgentRun } from '../database/supabase-client';

export interface DiscoveryAgentInput {
  keywords: string[];
  sources: Array<{
    id: string;
    url: string;
    name: string;
    type: 'rss' | 'web';
  }>;
  existingUrls?: string[]; // URLs to filter out (already published/discovered)
}

export interface DiscoveredArticle {
  url: string;
  title: string;
  reason: string;
  sourceId?: string;
  summary?: string;
  publishedDate?: string;
}

export interface DiscoveryAgentOutput {
  articles: DiscoveredArticle[];
  stats: {
    totalFound: number;
    fromRss: number;
    fromKeywords: number;
    deduplicated: number;
    filtered: number;
    saved: number;
  };
}

/**
 * Main Discovery Agent function
 * Finds fresh article URLs from RSS feeds and keyword searches
 */
export async function runDiscoveryAgent(
  input: DiscoveryAgentInput
): Promise<DiscoveryAgentOutput> {
  console.log(`[Discovery Agent] Starting with ${input.keywords.length} keywords and ${input.sources.length} sources`);
  
  // Start agent run tracking
  const runId = await startAgentRun('discovery', 'URL Discovery', input);
  
  try {
    const found: DiscoveredArticle[] = [];
    let rssCount = 0;
    let keywordCount = 0;

    // 1. Fetch from RSS sources
    console.log(`[Discovery Agent] Fetching from ${input.sources.length} RSS sources...`);
    
    for (const source of input.sources) {
      if (source.type !== 'rss') continue;
      
      try {
        const items = await fetchRss(source.url, 10);
        console.log(`[Discovery Agent] Found ${items.length} items from ${source.name}`);
        
        for (const item of items) {
          found.push({
            url: item.url,
            title: item.title,
            reason: `RSS: ${source.name}`,
            sourceId: source.id,
            summary: item.summary,
            publishedDate: item.published || undefined,
          });
          rssCount++;
        }
      } catch (error) {
        console.warn(`[Discovery Agent] RSS fetch failed for ${source.name}:`, error);
      }
    }

    // 2. Search Google News for each keyword (top 6)
    console.log(`[Discovery Agent] Searching Google News for top ${Math.min(6, input.keywords.length)} keywords...`);
    
    for (const keyword of input.keywords.slice(0, 6)) {
      try {
        const news = await ddgNews(keyword, 5);
        console.log(`[Discovery Agent] Found ${news.length} articles for "${keyword}"`);
        
        for (const article of news) {
          if (article.url && article.title) {
            found.push({
              url: article.url,
              title: article.title,
              reason: `Keyword: ${keyword}`,
              summary: article.excerpt,
              publishedDate: article.date,
            });
            keywordCount++;
          }
        }
        
        // Rate limiting: 500ms delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.warn(`[Discovery Agent] Google News search failed for "${keyword}":`, error);
      }
    }

    console.log(`[Discovery Agent] Total found: ${found.length} (RSS: ${rssCount}, Keywords: ${keywordCount})`);

    // 3. Deduplicate by URL
    const seen = new Set<string>();
    const unique = found.filter(article => {
      if (!article.url || seen.has(article.url)) {
        return false;
      }
      seen.add(article.url);
      return true;
    });

    const deduplicatedCount = found.length - unique.length;
    console.log(`[Discovery Agent] After deduplication: ${unique.length} unique URLs (removed ${deduplicatedCount} duplicates)`);

    // 4. Filter against existing URLs
    const existingSet = new Set(input.existingUrls || []);
    const fresh = unique.filter(article => !existingSet.has(article.url));
    
    const filteredCount = unique.length - fresh.length;
    console.log(`[Discovery Agent] After filtering: ${fresh.length} fresh URLs (removed ${filteredCount} existing)`);

    // 5. Limit to top 50
    const final = fresh.slice(0, 50);
    
    // 6. Save to database
    let savedCount = 0;
    if (final.length > 0) {
      const { data, error } = await supabase
        .from('discovered_urls')
        .upsert(
          final.map((article) => ({
            url: article.url,
            title: article.title,
            reason: article.reason,
            source_id: article.sourceId,
            summary: article.summary,
            published_date: article.publishedDate,
          })),
          { onConflict: 'url' }
        )
        .select();

      if (error) {
        console.error('[Discovery Agent] Failed to save URLs:', error);
      } else {
        savedCount = data?.length || 0;
        console.log(`[Discovery Agent] Saved ${savedCount} URLs to database`);
      }
    }
    
    console.log(`[Discovery Agent] Completed: ${final.length} articles ready for scraping`);

    const output = {
      articles: final,
      stats: {
        totalFound: found.length,
        fromRss: rssCount,
        fromKeywords: keywordCount,
        deduplicated: deduplicatedCount,
        filtered: filteredCount,
        saved: savedCount,
      },
    };

    // End agent run tracking
    await endAgentRun(runId, 'succeeded', output);

    return output;
  } catch (error) {
    // End agent run with error
    await endAgentRun(runId, 'failed', undefined, (error as Error).message);
    throw error;
  }
}

/**
 * Standalone execution example
 */
export async function demo() {
  console.log('=== Discovery Agent Demo ===\n');

  const input: DiscoveryAgentInput = {
    keywords: [
      'GPT-5 release',
      'AI regulation',
      'machine learning breakthrough',
    ],
    sources: [
      {
        id: 'tc-001',
        url: 'https://techcrunch.com/feed/',
        name: 'TechCrunch',
        type: 'rss',
      },
      {
        id: 'tv-001',
        url: 'https://www.theverge.com/rss/index.xml',
        name: 'The Verge',
        type: 'rss',
      },
    ],
    existingUrls: [], // In real usage, this would come from database
  };

  const result = await runDiscoveryAgent(input);

  console.log(`\n--- Results ---`);
  console.log(`Total articles found: ${result.articles.length}\n`);

  console.log(`Sample articles:`);
  result.articles.slice(0, 5).forEach((article, i) => {
    console.log(`\n${i + 1}. ${article.title}`);
    console.log(`   URL: ${article.url}`);
    console.log(`   Source: ${article.reason}`);
    if (article.publishedDate) {
      console.log(`   Published: ${article.publishedDate}`);
    }
  });

  console.log(`\n--- Stats ---`);
  console.log(`Total found: ${result.stats.totalFound}`);
  console.log(`From RSS: ${result.stats.fromRss}`);
  console.log(`From keywords: ${result.stats.fromKeywords}`);
  console.log(`Deduplicated: ${result.stats.deduplicated}`);
  console.log(`Filtered (existing): ${result.stats.filtered}`);
}

// Run demo if executed directly
import { fileURLToPath } from 'url';
if (import.meta.url === `file://${process.argv[1]}`) {
  demo().catch(console.error);
}
