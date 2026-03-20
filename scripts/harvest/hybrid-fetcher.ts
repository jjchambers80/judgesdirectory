/**
 * Hybrid Fetcher - Uses Scrapling for complex sites, native for simple ones
 * 
 * This integrates Scrapling into the existing judgesDirectory pipeline.
 * 
 * Usage:
 *   import { hybridFetch } from './hybrid-fetcher';
 *   
 *   // Automatically chooses best fetcher
 *   const result = await hybridFetch('https://flcourts.gov/judges');
 *   
 *   // Or explicitly request Scrapling
 *   const result = await hybridFetch('https://hard-site.com', { 
 *     prefer: 'scrapling' 
 *   });
 */

import { fetchPage, cleanHtml } from './fetcher';
import { fetchWithScrapling, shouldUseScrapling } from './scrapling-fetcher';

export interface HybridFetchOptions {
  /** Which fetcher to prefer: 'auto', 'native', or 'scrapling' */
  prefer?: 'auto' | 'native' | 'scrapling';
  /** Timeout in ms (default: 30000) */
  timeout?: number;
  /** Site analysis hints */
  siteAnalysis?: {
    hasAntiBot?: boolean;
    requiresJS?: boolean;
    framework?: string;
  };
}

export interface HybridResult {
  markdown: string;
  source: 'native' | 'scrapling';
  method: string;
  htmlSize?: number;
  markdownSize?: number;
}

/**
 * Smart fetcher that chooses the best approach
 */
export async function hybridFetch(
  url: string,
  options: HybridFetchOptions = {}
): Promise<HybridResult> {
  const { 
    prefer = 'auto', 
    timeout = 30000,
    siteAnalysis 
  } = options;
  
  // If explicitly requested Scrapling
  if (prefer === 'scrapling') {
    console.log(`  [Hybrid] Using Scrapling (explicit): ${url}`);
    const result = await fetchWithScrapling(url, { timeout });
    return {
      markdown: result.markdown,
      source: 'scrapling',
      method: result.method
    };
  }
  
  // If explicitly requested native
  if (prefer === 'native') {
    console.log(`  [Hybrid] Using native: ${url}`);
    const result = await fetchPage(url);
    return {
      markdown: result.markdown,
      source: 'native',
      method: 'custom',
      htmlSize: result.htmlSize,
      markdownSize: result.markdownSize
    };
  }
  
  // Auto mode: try native first, then Scrapling if needed
  console.log(`  [Hybrid] Auto mode - trying native first: ${url}`);
  
  try {
    const nativeResult = await fetchPage(url);
    
    // Check if we should switch to Scrapling
    if (shouldUseScrapling(nativeResult, siteAnalysis)) {
      console.log(`  [Hybrid] Native returned < 200 chars, trying Scrapling...`);
      const scrapResult = await fetchWithScrapling(url, { timeout });
      
      if (scrapResult.success && scrapResult.markdown.length > nativeResult.markdown.length) {
        console.log(`  [Hybrid] Scrapling succeeded (${scrapResult.markdown.length} vs ${nativeResult.markdown.length})`);
        return {
          markdown: scrapResult.markdown,
          source: 'scrapling',
          method: scrapResult.method
        };
      }
    }
    
    // Return native result
    return {
      markdown: nativeResult.markdown,
      source: 'native',
      method: 'custom',
      htmlSize: nativeResult.htmlSize,
      markdownSize: nativeResult.markdownSize
    };
    
  } catch (nativeError) {
    // Native failed, try Scrapling as fallback
    console.log(`  [Hybrid] Native failed, trying Scrapling...`);
    const scrapResult = await fetchWithScrapling(url, { timeout });
    
    if (scrapResult.success) {
      return {
        markdown: scrapResult.markdown,
        source: 'scrapling',
        method: scrapResult.method
      };
    }
    
    // Both failed
    throw new Error(`Both fetchers failed. Native: ${nativeError}. Scrapling: ${scrapResult.error}`);
  }
}

// ---------------------------------------------------------------------------
// Known site configurations
// ---------------------------------------------------------------------------

/** Pre-configured site settings for known court websites */
export const SITE_CONFIGS: Record<string, {
  prefer: 'native' | 'scrapling';
  reason: string;
}> = {
  // Florida courts - our custom extractors work well
  'flcourts.gov': {
    prefer: 'native',
    reason: 'Custom Next.js/Gatsby extractors handle well'
  },
  // Add other states as we discover their patterns
  'azcourts.gov': {
    prefer: 'scrapling',
    reason: 'Needs JS rendering'
  },
  // Fallback for unknown sites
  'default': {
    prefer: 'auto',
    reason: 'Try native, fallback to Scrapling'
  }
};

/**
 * Get fetcher preference for a specific domain
 */
export function getSiteConfig(url: string): typeof SITE_CONFIGS['default'] {
  for (const [domain, config] of Object.entries(SITE_CONFIGS)) {
    if (url.includes(domain)) {
      return config;
    }
  }
  return SITE_CONFIGS.default;
}
