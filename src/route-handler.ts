import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import type { PdfExportOptions, PresetName } from './types.js';
import { presets } from './types.js';

const defaultOptions: Required<Omit<PdfExportOptions, 'puppeteerOptions' | 'beforePdfGeneration'>> = {
  contentSelector: 'article',
  removeSelectors: ['#nd-sidebar', '#nd-toc', 'nav', '.print-hidden'],
  expandAccordions: true,
  accordionTriggerSelectors: [
    'button[data-state="closed"]',
    '[data-state="closed"] > button',
    '[data-state="closed"][role="button"]',
  ],
  accordionContentSelectors: [
    '[data-radix-accordion-content]',
    '[data-radix-collapsible-content]',
  ],
  triggerLazyImages: true,
  pageWidth: 850,
  margins: { top: 30, right: 30, bottom: 30, left: 30 },
  timeout: 30000,
};

/**
 * Creates a Next.js API route handler for PDF export
 *
 * @param options - Configuration options or a preset name
 * @returns Next.js GET route handler
 *
 * @example
 * // app/api/export-pdf/route.ts
 * import { createPdfExportHandler } from 'fumadocs-pdf-export';
 *
 * // Using default options (Fumadocs)
 * export const GET = createPdfExportHandler();
 *
 * // Using a preset
 * export const GET = createPdfExportHandler('docusaurus');
 *
 * // Using custom options
 * export const GET = createPdfExportHandler({
 *   contentSelector: '.my-content',
 *   removeSelectors: ['.sidebar', '.toc'],
 * });
 */
export function createPdfExportHandler(options?: PdfExportOptions | PresetName) {
  // Resolve preset if string is passed
  let resolvedOptions: PdfExportOptions;
  if (typeof options === 'string') {
    const preset = presets[options];
    resolvedOptions = {
      ...preset,
      removeSelectors: [...preset.removeSelectors],
      accordionTriggerSelectors: [...preset.accordionTriggerSelectors],
      accordionContentSelectors: [...preset.accordionContentSelectors],
    };
  } else {
    resolvedOptions = options || {};
  }

  const config = {
    ...defaultOptions,
    ...resolvedOptions,
    margins: { ...defaultOptions.margins, ...resolvedOptions.margins },
  };

  return async function handler(request: NextRequest): Promise<NextResponse> {
    const searchParams = request.nextUrl.searchParams;
    const path = searchParams.get('path');

    if (!path) {
      return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 });
    }

    // Build the page URL from request
    const protocol = request.nextUrl.protocol.replace(':', '');
    const host = request.headers.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;
    const pageUrl = `${baseUrl}${path}`;

    // Get cookies for authenticated pages
    const cookieHeader = request.headers.get('cookie') || '';

    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors'],
        ...config.puppeteerOptions,
      });

      const page = await browser.newPage();

      // Forward cookies for authentication
      if (cookieHeader) {
        const domain = host.split(':')[0];
        const isSecure = protocol === 'https';
        const cookies = parseCookies(cookieHeader, domain, isSecure, baseUrl);
        if (cookies.length > 0) {
          await page.setCookie(...cookies);
        }
      }

      await page.setViewport({ width: config.pageWidth, height: 600 });
      await page.goto(pageUrl, { waitUntil: 'networkidle0', timeout: config.timeout });

      // Expand accordions if enabled
      if (config.expandAccordions) {
        await expandAccordions(page, config.accordionTriggerSelectors);
      }

      // Trigger lazy images if enabled
      if (config.triggerLazyImages) {
        await triggerLazyImages(page);
      }

      // Clean up page for PDF
      await cleanupPageForPdf(page, config);

      // Run custom transformation if provided
      if (resolvedOptions.beforePdfGeneration) {
        await page.evaluate(resolvedOptions.beforePdfGeneration);
      }

      // Calculate content height
      const contentHeight = await page.evaluate((selector) => {
        const content = document.querySelector(selector) as HTMLElement | null;
        if (content) {
          content.offsetHeight; // Force reflow
          const rect = content.getBoundingClientRect();
          return rect.height + 40;
        }
        return document.body.scrollHeight;
      }, config.contentSelector);

      // Generate PDF
      const pdfBuffer = await page.pdf({
        width: config.pageWidth,
        height: contentHeight + 60,
        printBackground: true,
        margin: config.margins,
        preferCSSPageSize: false,
      });

      await browser.close();

      const filename = path.replace(/\//g, '-').replace(/^-/, '') || 'document';

      return new NextResponse(Buffer.from(pdfBuffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}.pdf"`,
        },
      });
    } catch (error) {
      console.error('PDF generation error:', error);
      if (browser) {
        await browser.close();
      }
      return NextResponse.json(
        { error: 'Failed to generate PDF', details: String(error) },
        { status: 500 }
      );
    }
  };
}

/**
 * Parse cookie header into Puppeteer cookie format
 */
function parseCookies(
  cookieHeader: string,
  domain: string,
  isSecure: boolean,
  baseUrl: string
) {
  return cookieHeader
    .split(';')
    .map((cookie) => {
      const trimmed = cookie.trim();
      if (!trimmed || !trimmed.includes('=')) return null;

      const [name, ...valueParts] = trimmed.split('=');
      const cookieName = name?.trim();
      const cookieValue = valueParts.join('=');

      if (!cookieName) return null;

      // __Host- cookies: must have secure=true, path=/, NO domain
      if (cookieName.startsWith('__Host-')) {
        return {
          name: cookieName,
          value: cookieValue || '',
          url: baseUrl,
          path: '/',
          secure: true,
        };
      }

      // __Secure- cookies: must have secure=true
      if (cookieName.startsWith('__Secure-')) {
        return {
          name: cookieName,
          value: cookieValue || '',
          url: baseUrl,
          path: '/',
          secure: true,
        };
      }

      // Regular cookies
      return {
        name: cookieName,
        value: cookieValue || '',
        domain,
        path: '/',
        secure: isSecure,
      };
    })
    .filter((cookie): cookie is NonNullable<typeof cookie> => cookie !== null);
}

/**
 * Expand all accordions on the page
 */
async function expandAccordions(
  page: Awaited<ReturnType<typeof puppeteer.launch>>['newPage'] extends () => Promise<infer P>
    ? P
    : never,
  selectors: string[]
) {
  const selectorString = selectors.join(', ');

  for (let i = 0; i < 5; i++) {
    const expanded = await page.evaluate((sel) => {
      const closedButtons = document.querySelectorAll(sel);
      closedButtons.forEach((btn) => (btn as HTMLElement).click());
      return closedButtons.length;
    }, selectorString);

    if (expanded === 0) break;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  // Wait for content to render
  await new Promise((resolve) => setTimeout(resolve, 500));
}

/**
 * Scroll through page to trigger lazy-loaded images
 */
async function triggerLazyImages(
  page: Awaited<ReturnType<typeof puppeteer.launch>>['newPage'] extends () => Promise<infer P>
    ? P
    : never
) {
  // Scroll through the page
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 200;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= document.body.scrollHeight + 500) {
          clearInterval(timer);
          window.scrollTo(0, 0);
          resolve();
        }
      }, 50);
    });
  });

  // Wait for images to load
  await page.evaluate(async () => {
    const images = document.querySelectorAll('img');
    images.forEach((img) => img.removeAttribute('loading'));

    await Promise.all(
      Array.from(images).map((img) => {
        if (img.complete && img.naturalHeight > 0) return Promise.resolve();
        return new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
          const src = img.src;
          img.src = '';
          img.src = src;
        });
      })
    );
  });

  await new Promise((resolve) => setTimeout(resolve, 1000));
}

/**
 * Clean up the page DOM for PDF generation
 */
async function cleanupPageForPdf(
  page: Awaited<ReturnType<typeof puppeteer.launch>>['newPage'] extends () => Promise<infer P>
    ? P
    : never,
  config: typeof defaultOptions
) {
  await page.evaluate(
    (contentSelector, removeSelectors, accordionContentSelectors) => {
      const content = document.querySelector(contentSelector);
      if (!content) return;

      const contentClone = content.cloneNode(true) as HTMLElement;

      // Clear body and add only content
      document.body.innerHTML = '';
      document.body.appendChild(contentClone);

      // Reset styles
      document.body.style.cssText = `
        margin: 0;
        padding: 0;
        background: white;
        width: 100%;
        max-width: 100%;
      `;
      document.documentElement.style.cssText = `
        margin: 0;
        padding: 0;
        background: white;
      `;

      contentClone.style.cssText = `
        max-width: 100%;
        width: 100%;
        margin: 0;
        padding: 0;
        background: white;
      `;

      // Remove navigation elements
      contentClone.querySelectorAll('[class*="grid-cols-2"]').forEach((el) => el.remove());
      contentClone.querySelectorAll('[class*="@container"]').forEach((el) => {
        if (el.querySelector('[class*="grid-cols-2"]') || el.querySelectorAll('a').length === 2) {
          el.remove();
        }
      });

      // Remove specified selectors
      removeSelectors.forEach((selector) => {
        contentClone.querySelectorAll(selector).forEach((el) => el.remove());
      });

      // Fix fixed/sticky elements
      contentClone.querySelectorAll('*').forEach((el) => {
        const htmlEl = el as HTMLElement;
        const style = getComputedStyle(el);
        if (style.position === 'fixed' || style.position === 'sticky') {
          htmlEl.style.position = 'static';
        }
        if (style.overflow === 'hidden' || style.overflowY === 'hidden') {
          htmlEl.style.overflow = 'visible';
        }
      });

      // Fix accordion styling
      contentClone.querySelectorAll('[data-state="open"], [data-state="closed"]').forEach((el) => {
        const htmlEl = el as HTMLElement;
        htmlEl.style.transform = 'none';
        htmlEl.style.transition = 'none';
        htmlEl.style.animation = 'none';
        htmlEl.style.position = 'relative';
        htmlEl.style.height = 'auto';
        htmlEl.style.opacity = '1';
        htmlEl.style.visibility = 'visible';
        htmlEl.style.display = 'block';
        htmlEl.style.overflow = 'visible';
      });

      accordionContentSelectors.forEach((selector) => {
        contentClone.querySelectorAll(selector).forEach((el) => {
          const htmlEl = el as HTMLElement;
          htmlEl.style.height = 'auto';
          htmlEl.style.transform = 'none';
          htmlEl.style.transition = 'none';
          htmlEl.style.animation = 'none';
          htmlEl.style.position = 'relative';
          htmlEl.style.display = 'block';
          htmlEl.style.overflow = 'visible';
        });
      });

      // Fix accordion root layout
      contentClone
        .querySelectorAll('[data-radix-accordion-root], [data-orientation]')
        .forEach((el) => {
          const htmlEl = el as HTMLElement;
          htmlEl.style.display = 'flex';
          htmlEl.style.flexDirection = 'column';
          htmlEl.style.gap = '0';
        });

      contentClone.querySelectorAll('[data-radix-accordion-item]').forEach((el) => {
        const htmlEl = el as HTMLElement;
        htmlEl.style.position = 'relative';
        htmlEl.style.display = 'block';
        htmlEl.style.height = 'auto';
      });

      // Remove top margins
      contentClone.style.marginTop = '0';
      contentClone.style.paddingTop = '0';

      const firstChild = contentClone.firstElementChild as HTMLElement;
      if (firstChild) {
        firstChild.style.marginTop = '0';
        firstChild.style.paddingTop = '0';
      }
    },
    config.contentSelector,
    config.removeSelectors,
    config.accordionContentSelectors
  );

  // Force reflow
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.body.offsetHeight;
  });

  await new Promise((resolve) => setTimeout(resolve, 100));
}
