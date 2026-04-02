#!/usr/bin/env node

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { resolveConfig, generatePdf } from './core.js';
import type { PresetName } from './types.js';

interface CliOptions {
  url: string;
  outDir: string;
  preset?: PresetName;
  paths?: string[];
  sitemap?: boolean;
}

function printUsage(): void {
  console.log(`
Usage: fumadocs-pdf generate [options]

Options:
  --url <url>        Base URL of the running dev server (required)
  --out <dir>        Output directory (default: ./public/pdfs)
  --preset <name>    Preset: fumadocs, docusaurus, nextra (default: fumadocs)
  --paths <paths>    Comma-separated list of paths to export
  --sitemap          Discover pages from /sitemap.xml

Examples:
  fumadocs-pdf generate --url http://localhost:3000 --sitemap
  fumadocs-pdf generate --url http://localhost:3000 --paths /docs/getting-started,/docs/api
  fumadocs-pdf generate --url http://localhost:3000 --sitemap --out ./public/pdfs --preset fumadocs
`);
}

function parseArgs(args: string[]): CliOptions | null {
  // Skip "generate" subcommand if present
  const startIdx = args[0] === 'generate' ? 1 : 0;

  let url = '';
  let outDir = './public/pdfs';
  let preset: PresetName | undefined = 'fumadocs';
  let paths: string[] | undefined;
  let sitemap = false;

  for (let i = startIdx; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--url':
        url = args[++i] || '';
        break;
      case '--out':
        outDir = args[++i] || outDir;
        break;
      case '--preset':
        preset = (args[++i] as PresetName) || preset;
        break;
      case '--paths':
        paths = (args[++i] || '').split(',').map((p) => p.trim()).filter(Boolean);
        break;
      case '--sitemap':
        sitemap = true;
        break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
      default:
        console.error(`Unknown option: ${arg}`);
        printUsage();
        process.exit(1);
    }
  }

  if (!url) {
    console.error('Error: --url is required');
    printUsage();
    return null;
  }

  if (!paths && !sitemap) {
    console.error('Error: either --paths or --sitemap is required');
    printUsage();
    return null;
  }

  return { url: url.replace(/\/$/, ''), outDir, preset, paths, sitemap };
}

/**
 * Fetch and parse sitemap.xml to extract doc page paths
 */
async function discoverFromSitemap(baseUrl: string): Promise<string[]> {
  const sitemapUrl = `${baseUrl}/sitemap.xml`;
  console.log(`Fetching sitemap from ${sitemapUrl}...`);

  const response = await fetch(sitemapUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch sitemap: ${response.status} ${response.statusText}`);
  }

  const xml = await response.text();

  // Simple XML parsing - extract all <loc> URLs
  const urls: string[] = [];
  const locRegex = /<loc>(.*?)<\/loc>/g;
  let match;
  while ((match = locRegex.exec(xml)) !== null) {
    urls.push(match[1]);
  }

  // Convert absolute URLs to paths, filter to doc pages
  const paths = urls
    .map((u) => {
      try {
        return new URL(u).pathname;
      } catch {
        return u;
      }
    })
    .filter((p) => p !== '/' && p.length > 1);

  return paths;
}

function pathToFilename(urlPath: string): string {
  return urlPath.replace(/^\//, '').replace(/\//g, '-') || 'index';
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printUsage();
    process.exit(0);
  }

  const options = parseArgs(args);
  if (!options) process.exit(1);

  // Discover paths
  let paths: string[];
  if (options.paths) {
    paths = options.paths;
  } else {
    paths = await discoverFromSitemap(options.url);
  }

  if (paths.length === 0) {
    console.error('No pages found to export.');
    process.exit(1);
  }

  console.log(`Found ${paths.length} page(s) to export:`);
  paths.forEach((p) => console.log(`  ${p}`));

  const config = resolveConfig(options.preset);
  const outDir = resolve(process.cwd(), options.outDir);

  // Ensure output directory exists
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  const manifest: Record<string, { filename: string; path: string }> = {};
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < paths.length; i++) {
    const pagePath = paths[i];
    const pageUrl = `${options.url}${pagePath}`;
    const filename = pathToFilename(pagePath);

    console.log(`\n[${i + 1}/${paths.length}] Generating PDF for ${pagePath}...`);

    try {
      const pdfBytes = await generatePdf(pageUrl, config);
      const outputPath = join(outDir, `${filename}.pdf`);
      writeFileSync(outputPath, Buffer.from(pdfBytes));

      manifest[pagePath] = { filename: `${filename}.pdf`, path: pagePath };
      successCount++;
      console.log(`  -> ${outputPath}`);
    } catch (error) {
      failCount++;
      console.error(`  Error: ${error}`);
    }
  }

  // Write manifest
  const manifestPath = join(outDir, 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\nManifest written to ${manifestPath}`);

  console.log(`\nDone! ${successCount} succeeded, ${failCount} failed out of ${paths.length} pages.`);

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
