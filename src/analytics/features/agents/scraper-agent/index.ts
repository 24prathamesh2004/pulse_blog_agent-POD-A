/**
 * Scraper Agent - Content Discovery Pipeline
 * Developer: Developer A
 * 
 * Purpose: Extracts clean article content from URLs
 * 
 * Features:
 * - Mozilla Readability for content extraction
 * - Hero image extraction (Open Graph, Twitter Cards)
 * - Content validation (minimum length checks)
 * - Error handling and retry logic
 * - Supabase database storage
 */

import 'dotenv/config';
import { fetchAndExtract } from '../utils/external-apis';
import { supabase, startAgentRun, endAgentRun } from '../database/supabase-client';

export interface ScraperAgentInput {
  urls: Array<{
    id: string;
    url: string;
    title?: string;
  }>;
}

export interface ScrapedContent {
  title: string;
  text: string;
  html: string;
  hero: string | null;
  textLength: number;
}

export interface ScraperResult {
  id: string;
  url: string;
  success: boolean;
  data?: ScrapedContent;
  error?: string;
  latencyMs?: number;
}

export interface ScraperAgentOutput {
  results: ScraperResult[];
  stats: {
    total: number;
    succeeded: number;
    failed: number;
    tooThin: number;
    networkError: number;
    extractionError: number;
    saved: number;
  };
}

/**
 * Main Scraper Agent function
 * Extracts clean content from article URLs
 */
export async function runScraperAgent(
  input: ScraperAgentInput
): Promise<ScraperAgentOutput> {
  console.log(`[Scraper Agent] Starting with ${input.urls.length} URLs`);
  
  // Start agent run tracking
  const runId = await startAgentRun('scraper', 'Content Extraction', input);
  
  try {
    const results: ScraperResult[] = [];
    const stats = {
      total: input.urls.length,
      succeeded: 0,
      failed: 0,
      tooThin: 0,
      networkError: 0,
      extractionError: 0,
      saved: 0,
    };

    // Process each URL
    for (const candidate of input.urls) {
      const startTime = Date.now();
      console.log(`[Scraper Agent] Processing: ${candidate.url}`);
      
      try {
        // Fetch and extract content
        const extracted = await fetchAndExtract(candidate.url);
        const latencyMs = Date.now() - startTime;

        // Check if extraction failed
        if (!extracted) {
          console.warn(`[Scraper Agent] Extraction failed for ${candidate.url}`);
          results.push({
            id: candidate.id,
            url: candidate.url,
            success: false,
            error: 'Extraction failed - no content returned',
            latencyMs,
          });
          stats.failed++;
          stats.extractionError++;
          continue;
        }

        // Validate content length (minimum 400 characters)
        if (extracted.text.length < 400) {
          console.warn(`[Scraper Agent] Content too thin for ${candidate.url} (${extracted.text.length} chars)`);
          results.push({
            id: candidate.id,
            url: candidate.url,
            success: false,
            error: `Content too thin (${extracted.text.length} chars)`,
            latencyMs,
          });
          stats.failed++;
          stats.tooThin++;
          continue;
        }

        // Success - store extracted content
        const scrapedData: ScrapedContent = {
          title: extracted.title || candidate.title || 'Untitled',
          text: extracted.text.slice(0, 50000), // Limit to 50KB
          html: extracted.html.slice(0, 200000), // Limit to 200KB
          hero: extracted.hero,
          textLength: extracted.text.length,
        };

        console.log(`[Scraper Agent] ✓ Successfully extracted ${extracted.text.length} chars from ${candidate.url}`);
        
        results.push({
          id: candidate.id,
          url: candidate.url,
          success: true,
          data: scrapedData,
          latencyMs,
        });
        stats.succeeded++;

        // Save to database
        try {
          // First, try to find the discovered_url_id
          const { data: discoveredUrl } = await supabase
            .from('discovered_urls')
            .select('id')
            .eq('url', candidate.url)
            .single();

          const { error: insertError } = await supabase
            .from('scraped_content')
            .upsert({
              url: candidate.url,
              title: scrapedData.title,
              text_content: scrapedData.text,
              html_content: scrapedData.html,
              hero_image: scrapedData.hero,
              text_length: scrapedData.textLength,
              discovered_url_id: discoveredUrl?.id,
            }, { onConflict: 'url' });

          if (insertError) {
            console.error(`[Scraper Agent] Failed to save content for ${candidate.url}:`, insertError);
          } else {
            stats.saved++;
          }
        } catch (dbError) {
          console.error(`[Scraper Agent] Database error for ${candidate.url}:`, dbError);
        }

      } catch (error) {
        const latencyMs = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        console.error(`[Scraper Agent] Error processing ${candidate.url}:`, errorMessage);
        
        // Categorize error type
        const isNetworkError = errorMessage.includes('timeout') || 
                              errorMessage.includes('ECONNREFUSED') ||
                              errorMessage.includes('ENOTFOUND') ||
                              errorMessage.includes('fetch failed');
        
        results.push({
          id: candidate.id,
          url: candidate.url,
          success: false,
          error: errorMessage,
          latencyMs,
        });
        stats.failed++;
        
        if (isNetworkError) {
          stats.networkError++;
        } else {
          stats.extractionError++;
        }
      }
    }

    console.log(`[Scraper Agent] Completed: ${stats.succeeded}/${stats.total} succeeded, ${stats.failed} failed`);
    console.log(`[Scraper Agent] Saved ${stats.saved} to database`);
    console.log(`[Scraper Agent] Failures: ${stats.tooThin} too thin, ${stats.networkError} network errors, ${stats.extractionError} extraction errors`);

    const output = {
      results,
      stats,
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
 * Process URLs in parallel with concurrency limit
 */
export async function runScraperAgentParallel(
  input: ScraperAgentInput,
  concurrency: number = 5
): Promise<ScraperAgentOutput> {
  console.log(`[Scraper Agent] Starting parallel processing with concurrency: ${concurrency}`);
  
  // Start agent run tracking
  const runId = await startAgentRun('scraper', 'Content Extraction (Parallel)', input);
  
  try {
    const results: ScraperResult[] = [];
    const stats = {
      total: input.urls.length,
      succeeded: 0,
      failed: 0,
      tooThin: 0,
      networkError: 0,
      extractionError: 0,
      saved: 0,
    };

    // Process in batches
    for (let i = 0; i < input.urls.length; i += concurrency) {
      const batch = input.urls.slice(i, i + concurrency);
      console.log(`[Scraper Agent] Processing batch ${Math.floor(i / concurrency) + 1}/${Math.ceil(input.urls.length / concurrency)}`);
      
      const batchResults = await Promise.allSettled(
        batch.map(async (candidate) => {
          const startTime = Date.now();
          const extracted = await fetchAndExtract(candidate.url);
          const latencyMs = Date.now() - startTime;

          if (!extracted) {
            throw new Error('Extraction failed - no content returned');
          }

          if (extracted.text.length < 400) {
            throw new Error(`Content too thin (${extracted.text.length} chars)`);
          }

          return {
            id: candidate.id,
            url: candidate.url,
            success: true as const,
            data: {
              title: extracted.title || candidate.title || 'Untitled',
              text: extracted.text.slice(0, 50000),
              html: extracted.html.slice(0, 200000),
              hero: extracted.hero,
              textLength: extracted.text.length,
            },
            latencyMs,
          };
        })
      );

      // Process batch results
      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j];
        const candidate = batch[j];

        if (result.status === 'fulfilled') {
          results.push(result.value);
          stats.succeeded++;

          // Save to database
          try {
            const { data: discoveredUrl } = await supabase
              .from('discovered_urls')
              .select('id')
              .eq('url', candidate.url)
              .single();

            const { error: insertError } = await supabase
              .from('scraped_content')
              .upsert({
                url: candidate.url,
                title: result.value.data.title,
                text_content: result.value.data.text,
                html_content: result.value.data.html,
                hero_image: result.value.data.hero,
                text_length: result.value.data.textLength,
                discovered_url_id: discoveredUrl?.id,
              }, { onConflict: 'url' });

            if (!insertError) {
              stats.saved++;
            }
          } catch (dbError) {
            console.error(`[Scraper Agent] Database error for ${candidate.url}:`, dbError);
          }
        } else {
          const errorMessage = result.reason?.message || 'Unknown error';
          const isTooThin = errorMessage.includes('too thin');
          const isNetworkError = errorMessage.includes('timeout') || 
                                errorMessage.includes('ECONNREFUSED') ||
                                errorMessage.includes('fetch failed');

          results.push({
            id: candidate.id,
            url: candidate.url,
            success: false,
            error: errorMessage,
          });
          stats.failed++;

          if (isTooThin) stats.tooThin++;
          else if (isNetworkError) stats.networkError++;
          else stats.extractionError++;
        }
      }
    }

    console.log(`[Scraper Agent] Completed: ${stats.succeeded}/${stats.total} succeeded, ${stats.failed} failed`);
    console.log(`[Scraper Agent] Saved ${stats.saved} to database`);

    const output = {
      results,
      stats,
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
  console.log('=== Scraper Agent Demo ===\n');

  const input: ScraperAgentInput = {
    urls: [
      {
        id: 'demo-001',
        url: 'https://techcrunch.com/2024/01/01/example-article/',
        title: 'Example Tech Article',
      },
      {
        id: 'demo-002',
        url: 'https://www.theverge.com/2024/1/1/example-article',
      },
      {
        id: 'demo-003',
        url: 'https://invalid-url-that-will-fail.com/article',
      },
    ],
  };

  console.log('--- Sequential Processing ---\n');
  const sequentialResult = await runScraperAgent(input);

  console.log(`\n--- Results ---`);
  sequentialResult.results.forEach((result, i) => {
    console.log(`\n${i + 1}. ${result.url}`);
    console.log(`   Status: ${result.success ? '✓ Success' : '✗ Failed'}`);
    if (result.success && result.data) {
      console.log(`   Title: ${result.data.title}`);
      console.log(`   Text length: ${result.data.textLength} chars`);
      console.log(`   Hero image: ${result.data.hero || 'None'}`);
    } else {
      console.log(`   Error: ${result.error}`);
    }
    if (result.latencyMs) {
      console.log(`   Latency: ${result.latencyMs}ms`);
    }
  });

  console.log(`\n--- Stats ---`);
  console.log(`Total: ${sequentialResult.stats.total}`);
  console.log(`Succeeded: ${sequentialResult.stats.succeeded}`);
  console.log(`Failed: ${sequentialResult.stats.failed}`);
  console.log(`  - Too thin: ${sequentialResult.stats.tooThin}`);
  console.log(`  - Network errors: ${sequentialResult.stats.networkError}`);
  console.log(`  - Extraction errors: ${sequentialResult.stats.extractionError}`);

  console.log('\n\n--- Parallel Processing (concurrency: 2) ---\n');
  const parallelResult = await runScraperAgentParallel(input, 2);
  
  console.log(`\nParallel stats: ${parallelResult.stats.succeeded}/${parallelResult.stats.total} succeeded`);
}

// Run demo if executed directly
import { fileURLToPath } from 'url';
if (import.meta.url === `file://${process.argv[1]}`) {
  demo().catch(console.error);
}
