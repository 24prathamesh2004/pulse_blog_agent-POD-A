/**
 * Complete Pipeline Demo
 * Developer: Developer A
 * 
 * Demonstrates the full Content Discovery Pipeline:
 * Keyword Agent → Discovery Agent → Scraper Agent
 * 
 * All data is saved to Supabase database
 */

import 'dotenv/config';
import { runKeywordAgent } from './keyword-agent/index';
import { runDiscoveryAgent } from './discovery-agent/index';
import { runScraperAgent } from './scraper-agent/index';
import { testConnection } from './database/supabase-client';

async function runPipelineDemo() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     Content Discovery Pipeline - Complete Demo            ║');
  console.log('║     Developer A Contribution                              ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Test database connection first
  console.log('┌─────────────────────────────────────────────────────────┐');
  console.log('│ Database Connection Test                                │');
  console.log('└─────────────────────────────────────────────────────────┘\n');

  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error('\n✗ Database connection failed. Please check your .env file and run setup.');
    console.error('  Run: npm run db:setup\n');
    process.exit(1);
  }

  console.log('✓ Database connected successfully!\n');

  const category = 'Artificial Intelligence';
  console.log(`Category: ${category}\n`);

  // ═══════════════════════════════════════════════════════════════
  // STAGE 1: Keyword Agent
  // ═══════════════════════════════════════════════════════════════
  console.log('┌─────────────────────────────────────────────────────────┐');
  console.log('│ STAGE 1: Keyword Agent - Discover Trending Topics      │');
  console.log('└─────────────────────────────────────────────────────────┘\n');

  const keywordResult = await runKeywordAgent({
    categoryName: category,
  });

  console.log(`\n✓ Found ${keywordResult.keywords.length} trending keywords:\n`);
  keywordResult.keywords.slice(0, 5).forEach((kw, i) => {
    console.log(`  ${i + 1}. [${kw.trend.toUpperCase()}] ${kw.term} (score: ${kw.score})`);
  });

  console.log(`\nStats:`);
  console.log(`  - Google Trends: ${keywordResult.stats.sources.googleTrends}`);
  console.log(`  - Google News: ${keywordResult.stats.sources.googleNews}`);
  console.log(`  - Deduplicated: ${keywordResult.stats.deduplicated}`);
  console.log(`  - Saved to database: ${keywordResult.stats.saved}`);

  // ═══════════════════════════════════════════════════════════════
  // STAGE 2: Discovery Agent
  // ═══════════════════════════════════════════════════════════════
  console.log('\n\n┌─────────────────────────────────────────────────────────┐');
  console.log('│ STAGE 2: Discovery Agent - Find Article URLs           │');
  console.log('└─────────────────────────────────────────────────────────┘\n');

  const discoveryResult = await runDiscoveryAgent({
    keywords: keywordResult.keywords.map(k => k.term),
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
    existingUrls: [], // In production, this would come from database
  });

  console.log(`\n✓ Found ${discoveryResult.articles.length} fresh articles:\n`);
  discoveryResult.articles.slice(0, 5).forEach((article, i) => {
    console.log(`  ${i + 1}. ${article.title}`);
    console.log(`     Source: ${article.reason}`);
    console.log(`     URL: ${article.url.slice(0, 60)}...`);
  });

  console.log(`\nStats:`);
  console.log(`  - Total found: ${discoveryResult.stats.totalFound}`);
  console.log(`  - From RSS: ${discoveryResult.stats.fromRss}`);
  console.log(`  - From keywords: ${discoveryResult.stats.fromKeywords}`);
  console.log(`  - Deduplicated: ${discoveryResult.stats.deduplicated}`);
  console.log(`  - Saved to database: ${discoveryResult.stats.saved}`);

  // ═══════════════════════════════════════════════════════════════
  // STAGE 3: Scraper Agent
  // ═══════════════════════════════════════════════════════════════
  console.log('\n\n┌─────────────────────────────────────────────────────────┐');
  console.log('│ STAGE 3: Scraper Agent - Extract Article Content       │');
  console.log('└─────────────────────────────────────────────────────────┘\n');

  // Take first 3 articles for demo
  const urlsToScrape = discoveryResult.articles.slice(0, 3).map((article, i) => ({
    id: `demo-${i + 1}`,
    url: article.url,
    title: article.title,
  }));

  const scraperResult = await runScraperAgent({
    urls: urlsToScrape,
  });

  console.log(`\n✓ Scraped ${scraperResult.stats.succeeded}/${scraperResult.stats.total} articles:\n`);
  
  scraperResult.results.forEach((result, i) => {
    console.log(`  ${i + 1}. ${result.success ? '✓' : '✗'} ${result.url.slice(0, 50)}...`);
    if (result.success && result.data) {
      console.log(`     Title: ${result.data.title}`);
      console.log(`     Content: ${result.data.textLength} characters`);
      console.log(`     Hero: ${result.data.hero ? '✓ Found' : '✗ None'}`);
      console.log(`     Latency: ${result.latencyMs}ms`);
    } else {
      console.log(`     Error: ${result.error}`);
    }
  });

  console.log(`\nStats:`);
  console.log(`  - Succeeded: ${scraperResult.stats.succeeded}`);
  console.log(`  - Failed: ${scraperResult.stats.failed}`);
  console.log(`    • Too thin: ${scraperResult.stats.tooThin}`);
  console.log(`    • Network errors: ${scraperResult.stats.networkError}`);
  console.log(`    • Extraction errors: ${scraperResult.stats.extractionError}`);
  console.log(`  - Saved to database: ${scraperResult.stats.saved}`);

  // ═══════════════════════════════════════════════════════════════
  // PIPELINE SUMMARY
  // ═══════════════════════════════════════════════════════════════
  console.log('\n\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    Pipeline Summary                        ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log(`Category: ${category}`);
  console.log(`\nPipeline Results:`);
  console.log(`  1. Keywords discovered: ${keywordResult.keywords.length} (${keywordResult.stats.saved} saved)`);
  console.log(`  2. Articles found: ${discoveryResult.articles.length} (${discoveryResult.stats.saved} saved)`);
  console.log(`  3. Articles scraped: ${scraperResult.stats.succeeded}/${scraperResult.stats.total} (${scraperResult.stats.saved} saved)`);
  
  console.log(`\n✓ Pipeline completed successfully!`);
  console.log(`\nDatabase Summary:`);
  console.log(`  - Total keywords saved: ${keywordResult.stats.saved}`);
  console.log(`  - Total URLs saved: ${discoveryResult.stats.saved}`);
  console.log(`  - Total content saved: ${scraperResult.stats.saved}`);
  console.log(`\nNext Step: Pass scraped content to Curator Agent (Developer B)`);
  console.log(`           for quality scoring and publishing.`);
  console.log(`\nView database stats: npm run db:stats\n`);
}

// Run the demo
runPipelineDemo().catch((error) => {
  console.error('\n✗ Pipeline failed:', error);
  process.exit(1);
});
