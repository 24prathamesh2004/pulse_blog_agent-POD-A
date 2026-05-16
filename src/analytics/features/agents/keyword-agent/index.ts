/**
 * Keyword Agent - Content Discovery Pipeline
 * Developer: Developer A
 * 
 * Purpose: Discovers trending topics and keywords for content discovery
 * 
 * Features:
 * - Google Trends integration for rising search terms
 * - Google News RSS for current headlines
 * - Keyword scoring and ranking
 * - Deduplication and filtering
 * - Supabase database storage
 */

import 'dotenv/config';
import { trendsRising, ddgNews } from '../utils/external-apis';
import { supabase, startAgentRun, endAgentRun } from '../database/supabase-client';

export interface KeywordAgentInput {
  categoryName: string;
  seedHints?: string[];
}

export interface Keyword {
  term: string;
  score: number;
  trend: 'rising' | 'news';
}

export interface KeywordAgentOutput {
  keywords: Keyword[];
  stats: {
    totalFound: number;
    deduplicated: number;
    saved: number;
    sources: {
      googleTrends: number;
      googleNews: number;
    };
  };
}

/**
 * Main Keyword Agent function
 * Discovers trending keywords for a given category
 */
export async function runKeywordAgent(
  input: KeywordAgentInput
): Promise<KeywordAgentOutput> {
  console.log(`[Keyword Agent] Starting for category: ${input.categoryName}`);
  
  // Start agent run tracking
  const runId = await startAgentRun('keyword', input.categoryName, input);
  
  try {
    const seeds = input.seedHints?.length ? input.seedHints : [input.categoryName];
    const all: Keyword[] = [];
    let trendsCount = 0;
    let newsCount = 0;

    // Process each seed keyword
    for (const seed of seeds.slice(0, 3)) {
      console.log(`[Keyword Agent] Processing seed: ${seed}`);
      
      // 1. Get trending terms from Google Trends
      try {
        const trends = await trendsRising(seed);
        console.log(`[Keyword Agent] Found ${trends.length} trends for "${seed}"`);
        
        for (const t of trends) {
          all.push({ term: t.term, score: t.value, trend: 'rising' });
          trendsCount++;
        }
      } catch (error) {
        console.warn(`[Keyword Agent] Google Trends failed for "${seed}":`, error);
      }

      // 2. Get news headlines from Google News RSS
      try {
        const news = await ddgNews(seed, 8);
        console.log(`[Keyword Agent] Found ${news.length} news items for "${seed}"`);
        
        for (const n of news) {
          all.push({ term: n.title.slice(0, 80), score: 50, trend: 'news' });
          newsCount++;
        }
      } catch (error) {
        console.warn(`[Keyword Agent] Google News failed for "${seed}":`, error);
      }
    }

    // 3. Deduplicate by term (case-insensitive)
    const dedup = new Map<string, Keyword>();
    for (const k of all) {
      const key = k.term.toLowerCase();
      if (!dedup.has(key)) {
        dedup.set(key, k);
      }
    }

    // 4. Sort by score and take top 12
    const top = Array.from(dedup.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);

    // 5. Save to database
    let savedCount = 0;
    if (top.length > 0) {
      const { data, error } = await supabase
        .from('keywords')
        .upsert(
          top.map((k) => ({
            term: k.term,
            score: k.score,
            trend_direction: k.trend,
            category: input.categoryName,
          })),
          { onConflict: 'term,category' }
        )
        .select();

      if (error) {
        console.error('[Keyword Agent] Failed to save keywords:', error);
      } else {
        savedCount = data?.length || 0;
        console.log(`[Keyword Agent] Saved ${savedCount} keywords to database`);
      }
    }

    console.log(`[Keyword Agent] Completed: ${top.length} keywords (from ${all.length} total)`);

    const output = {
      keywords: top,
      stats: {
        totalFound: all.length,
        deduplicated: all.length - top.length,
        saved: savedCount,
        sources: {
          googleTrends: trendsCount,
          googleNews: newsCount,
        },
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
  console.log('=== Keyword Agent Demo ===\n');

  const categories = [
    'Artificial Intelligence',
    'Climate Change',
    'Cryptocurrency',
  ];

  for (const category of categories) {
    console.log(`\n--- Category: ${category} ---`);
    
    const result = await runKeywordAgent({
      categoryName: category,
    });

    console.log(`\nTop Keywords:`);
    result.keywords.forEach((kw, i) => {
      console.log(`${i + 1}. [${kw.trend}] ${kw.term} (score: ${kw.score})`);
    });

    console.log(`\nStats:`);
    console.log(`- Total found: ${result.stats.totalFound}`);
    console.log(`- Google Trends: ${result.stats.sources.googleTrends}`);
    console.log(`- Google News: ${result.stats.sources.googleNews}`);
    console.log(`- Deduplicated: ${result.stats.deduplicated}`);
  }
}

// Run demo if executed directly
import { fileURLToPath } from 'url';
if (import.meta.url === `file://${process.argv[1]}`) {
  demo().catch(console.error);
}
