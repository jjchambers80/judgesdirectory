/**
 * Scrapling-based fetcher for judgesDirectory
 * 
 * Uses Scrapling for sites that require:
 * - Anti-bot protection bypass
 * - Full JavaScript rendering
 * - Complex SPA sites that defeat our custom extractors
 * 
 * Usage:
 *   import { fetchWithScrapling } from './scrapling-fetcher';
 *   const result = await fetchWithScrapling('https://example.com');
 * 
 * Run with: scrapling extract stealthy-fetch <url>
 */

import { spawn } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const exec = promisify(spawn);

// Temp file for output
const TEMP_DIR = '/tmp/judges-scraping';
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

export interface ScraplingResult {
  markdown: string;
  html: string;
  url: string;
  success: boolean;
  method: 'stealthy' | 'browser' | 'static';
  error?: string;
}

/**
 * Fetch a URL using Scrapling with stealth mode
 * Falls back to browser mode if stealth fails
 */
export async function fetchWithScrapling(
  url: string,
  options: {
    mode?: 'stealthy' | 'browser' | 'auto';
    timeout?: number;
  } = {}
): Promise<ScraplingResult> {
  const { mode = 'stealthy', timeout = 30000 } = options;
  
  const outputFile = path.join(TEMP_DIR, `scrapling_${Date.now()}.txt`);
  
  try {
    // Try stealthy fetch first (handles most anti-bot)
    if (mode === 'stealthy' || mode === 'auto') {
      console.log(`  [Scrapling] Attempting stealthy fetch: ${url}`);
      const result = await runScraplingCommand(
        ['extract', 'stealthy-fetch', url, '--markdown'],
        timeout
      );
      
      if (result.success) {
        return {
          markdown: result.output,
          html: '',
          url,
          success: true,
          method: 'stealthy'
        };
      }
      
      console.log(`  [Scrapling] Stealthy failed, trying browser mode...`);
    }
    
    // Fallback to browser-based fetch
    if (mode === 'browser' || mode === 'auto') {
      console.log(`  [Scrapling] Attempting browser fetch: ${url}`);
      const result = await runScraplingCommand(
        ['extract', 'fetch', url, '--markdown'],
        timeout
      );
      
      if (result.success) {
        return {
          markdown: result.output,
          html: '',
          url,
          success: true,
          method: 'browser'
        };
      }
    }
    
    return {
      markdown: '',
      html: '',
      url,
      success: false,
      method: 'stealthy',
      error: 'All Scrapling methods failed'
    };
    
  } catch (error) {
    return {
      markdown: '',
      html: '',
      url,
      success: false,
      method: 'stealthy',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Run a Scrapling CLI command
 */
async function runScraplingCommand(
  args: string[],
  timeout: number
): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve) => {
    const output: string[] = [];
    let errorOutput: string[] = [];
    
    const proc = spawn('scrapling', args, {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    proc.stdout.on('data', (data) => {
      output.push(data.toString());
    });
    
    proc.stderr.on('data', (data) => {
      errorOutput.push(data.toString());
    });
    
    const timeoutId = setTimeout(() => {
      proc.kill();
      resolve({ success: false, output: 'Timeout' });
    }, timeout);
    
    proc.on('close', (code) => {
      clearTimeout(timeoutId);
      
      if (code === 0) {
        resolve({ success: true, output: output.join('') });
      } else {
        resolve({ success: false, output: errorOutput.join('') });
      }
    });
    
    proc.on('error', (err) => {
      clearTimeout(timeoutId);
      resolve({ success: false, output: err.message });
    });
  });
}

/**
 * Decision framework: When to use Scrapling vs native fetcher
 * 
 * Use Scrapling when:
 * - Site has anti-bot protection (Cloudflare, etc.)
 * - Site requires JavaScript rendering
 * - Native fetcher returns empty/trivial results
 * - Site uses complex React/Vue/Angular frameworks
 * 
 * Use native fetcher when:
 * - Simple static HTML
 * - Our custom Next.js/Gatsby extractors work
 * - Speed is critical (Scrapling is slower)
 * - We're rate-limited (native has better control)
 */
export function shouldUseScrapling(
  nativeResult: { markdown: string },
  siteAnalysis?: {
    hasAntiBot: boolean;
    requiresJS: boolean;
    framework?: string;
  }
): boolean {
  // If native returned meaningful content, don't switch
  if (nativeResult.markdown.length > 200) {
    return false;
  }
  
  // If we know the site needs Scrapling
  if (siteAnalysis?.hasAntiBot || siteAnalysis?.requiresJS) {
    return true;
  }
  
  // If native returned essentially nothing, try Scrapling
  if (nativeResult.markdown.length < 50) {
    return true;
  }
  
  return false;
}

// ---------------------------------------------------------------------------
// CLI usage example
// ---------------------------------------------------------------------------

/**
 * CLI entry point for direct usage:
 *   npx ts-node scripts/harvest/scrapling-fetcher.ts https://example.com
 */
async function main() {
  const url = process.argv[2];
  
  if (!url) {
    console.log('Usage: node scrapling-fetcher.ts <url>');
    console.log('Example: node scrapling-fetcher.ts https://flcourts.gov');
    process.exit(1);
  }
  
  console.log(`\n🤖 Scrapling fetcher for: ${url}\n`);
  
  const result = await fetchWithScrapling(url);
  
  if (result.success) {
    console.log(`✅ Success! Method: ${result.method}`);
    console.log(`📄 Markdown length: ${result.markdown.length} chars`);
    console.log(`\n--- Preview ---`);
    console.log(result.markdown.substring(0, 500));
    console.log('...\n');
  } else {
    console.log(`❌ Failed: ${result.error}`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}
