import puppeteer from 'puppeteer';
import { PDFDocument, PDFHexString, PDFName } from 'pdf-lib';
import type { PdfExportOptions } from './types.js';
import { presets, type PresetName } from './types.js';

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

export interface ResolvedConfig {
  contentSelector: string;
  removeSelectors: string[];
  expandAccordions: boolean;
  accordionTriggerSelectors: string[];
  accordionContentSelectors: string[];
  triggerLazyImages: boolean;
  pageWidth: number;
  margins: { top: number; right: number; bottom: number; left: number };
  timeout: number;
  puppeteerOptions?: PdfExportOptions['puppeteerOptions'];
  beforePdfGeneration?: string;
}

/**
 * Resolve preset/options into a full config object
 */
export function resolveConfig(options?: PdfExportOptions | PresetName): ResolvedConfig {
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

  return {
    ...defaultOptions,
    ...resolvedOptions,
    margins: { ...defaultOptions.margins, ...resolvedOptions.margins } as { top: number; right: number; bottom: number; left: number },
  };
}

type PuppeteerPage = Awaited<ReturnType<Awaited<ReturnType<typeof puppeteer.launch>>['newPage']>>;

/**
 * Generate a PDF from a fully-qualified URL.
 * Returns the raw PDF bytes with outline bookmarks.
 */
export async function generatePdf(
  pageUrl: string,
  config: ResolvedConfig,
  options?: {
    cookies?: { name: string; value: string; domain?: string; path?: string; secure?: boolean; url?: string }[];
  }
): Promise<Uint8Array> {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors'],
      ...config.puppeteerOptions,
    });

    const page = await browser.newPage();

    if (options?.cookies && options.cookies.length > 0) {
      await page.setCookie(...options.cookies);
    }

    await page.setViewport({ width: config.pageWidth, height: 600 });
    await page.goto(pageUrl, { waitUntil: 'networkidle0', timeout: config.timeout });

    if (config.expandAccordions) {
      await expandAccordions(page, config.accordionTriggerSelectors);
    }

    if (config.triggerLazyImages) {
      await triggerLazyImages(page);
    }

    await cleanupPageForPdf(page, config);

    if (config.beforePdfGeneration) {
      await page.evaluate(config.beforePdfGeneration);
    }

    const { contentHeight, headings } = await page.evaluate((selector, marginTop) => {
      const content = document.querySelector(selector) as HTMLElement | null;
      const height = content
        ? (content.offsetHeight, content.getBoundingClientRect().height + 40)
        : document.body.scrollHeight;

      const container = content || document.body;
      const headingEls = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
      const extracted: { text: string; level: number; top: number }[] = [];
      headingEls.forEach((el) => {
        const htmlEl = el as HTMLElement;
        const text = htmlEl.textContent?.replace(/\s+/g, ' ').trim() || '';
        if (!text || text === '#') return;
        const rect = htmlEl.getBoundingClientRect();
        if (rect.height === 0 || rect.width === 0) return;
        const level = parseInt(el.tagName[1], 10);
        extracted.push({ text, level, top: rect.top + (marginTop ?? 0) });
      });

      return { contentHeight: height, headings: extracted };
    }, config.contentSelector, config.margins.top);

    const totalHeight = contentHeight + 60;

    const pdfBuffer = await page.pdf({
      width: config.pageWidth,
      height: totalHeight,
      printBackground: true,
      margin: config.margins,
      preferCSSPageSize: false,
      tagged: true,
    });

    await browser.close();
    browser = undefined;

    return addPdfOutline(pdfBuffer, headings, totalHeight);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Parse cookie header into Puppeteer cookie format
 */
export function parseCookies(
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

      if (cookieName.startsWith('__Host-')) {
        return {
          name: cookieName,
          value: cookieValue || '',
          url: baseUrl,
          path: '/',
          secure: true,
        };
      }

      if (cookieName.startsWith('__Secure-')) {
        return {
          name: cookieName,
          value: cookieValue || '',
          url: baseUrl,
          path: '/',
          secure: true,
        };
      }

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
async function expandAccordions(page: PuppeteerPage, selectors: string[]) {
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

  await new Promise((resolve) => setTimeout(resolve, 500));
}

/**
 * Scroll through page to trigger lazy-loaded images
 */
async function triggerLazyImages(page: PuppeteerPage) {
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
async function cleanupPageForPdf(page: PuppeteerPage, config: ResolvedConfig) {
  await page.evaluate(
    (contentSelector, removeSelectors, accordionContentSelectors, pageWidth) => {
      const content = document.querySelector(contentSelector);
      if (!content) return;

      const contentClone = content.cloneNode(true) as HTMLElement;

      document.body.innerHTML = '';
      document.body.appendChild(contentClone);

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

      contentClone.querySelectorAll('[class*="grid-cols-1"], [class*="grid-cols-2"]').forEach((el) => {
        if (el.classList.contains('grid') && el.closest('[class*="@container"]')) {
          el.remove();
        }
      });

      contentClone.querySelectorAll('[class*="@container"]').forEach((el) => {
        const links = el.querySelectorAll('a');
        const hasNavigation = links.length === 1 || links.length === 2;
        const hasChevron = el.querySelector('[class*="chevron"]');
        if (hasNavigation || hasChevron) {
          el.remove();
        }
      });

      removeSelectors.forEach((selector) => {
        contentClone.querySelectorAll(selector).forEach((el) => el.remove());
      });

      contentClone.querySelectorAll('*').forEach((el) => {
        const htmlEl = el as HTMLElement;
        const style = getComputedStyle(el);
        if (style.position === 'fixed' || style.position === 'sticky') {
          htmlEl.style.position = 'static';
        }
        if (style.overflow === 'hidden' || style.overflowY === 'hidden' || style.overflowX === 'hidden') {
          htmlEl.style.overflow = 'visible';
        }
        // Strip shadows from all elements — they render poorly in PDFs
        if (style.boxShadow && style.boxShadow !== 'none') {
          htmlEl.style.boxShadow = 'none';
        }
      });

      // Expand code blocks: remove scroll constraints and wrap long lines
      // Target the Fumadocs code block structure: figure.shiki > div[overflow-auto, max-h] > pre > code
      contentClone.querySelectorAll('figure.shiki').forEach((el) => {
        const htmlEl = el as HTMLElement;
        htmlEl.style.overflow = 'visible';
      });
      contentClone.querySelectorAll('figure.shiki > div').forEach((el) => {
        const htmlEl = el as HTMLElement;
        htmlEl.style.overflow = 'visible';
        htmlEl.style.maxHeight = 'none';
      });
      contentClone.querySelectorAll('pre').forEach((el) => {
        const htmlEl = el as HTMLElement;
        htmlEl.style.overflow = 'visible';
        htmlEl.style.maxHeight = 'none';
        htmlEl.style.maxWidth = '100%';
        htmlEl.style.width = '100%';
        htmlEl.style.whiteSpace = 'pre-wrap';
        htmlEl.style.wordWrap = 'break-word';
        htmlEl.style.overflowWrap = 'break-word';
      });
      contentClone.querySelectorAll('pre code').forEach((el) => {
        const htmlEl = el as HTMLElement;
        htmlEl.style.whiteSpace = 'pre-wrap';
        htmlEl.style.wordWrap = 'break-word';
        htmlEl.style.overflowWrap = 'break-word';
      });

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

      // Disable all page-break rules — the PDF is a single continuous page
      const noBreaks = document.createElement('style');
      noBreaks.textContent = `
        @page { size: ${pageWidth}px 99999px !important; }
        * {
          break-before: auto !important;
          break-after: auto !important;
          break-inside: auto !important;
          page-break-before: auto !important;
          page-break-after: auto !important;
          page-break-inside: auto !important;
        }
      `;
      document.head.appendChild(noBreaks);

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
    config.accordionContentSelectors,
    config.pageWidth
  );

  // Scroll through the cleaned page to force the browser to paint all elements
  await page.evaluate(async () => {
    const distance = 400;
    let totalHeight = 0;
    const scrollHeight = document.body.scrollHeight;
    while (totalHeight < scrollHeight + 500) {
      window.scrollBy(0, distance);
      totalHeight += distance;
      await new Promise((r) => setTimeout(r, 50));
    }
    window.scrollTo(0, 0);
    // Force a final reflow
    document.body.offsetHeight;
  });

  await new Promise((resolve) => setTimeout(resolve, 200));
}

/**
 * Add PDF outline (bookmarks) from extracted headings using pdf-lib
 */
async function addPdfOutline(
  pdfBuffer: Uint8Array,
  headings: { text: string; level: number; top: number }[],
  pageHeight: number
): Promise<Uint8Array> {
  if (headings.length === 0) return pdfBuffer;

  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();
  if (pages.length === 0) return pdfBuffer;

  const page = pages[0];
  const pdfPageHeight = page.getHeight();

  const context = pdfDoc.context;

  const outlineItemRefs = headings.map(() => context.nextRef());
  const outlineRef = context.nextRef();

  interface OutlineNode {
    index: number;
    children: OutlineNode[];
  }

  const root: OutlineNode = { index: -1, children: [] };
  const stack: OutlineNode[] = [root];

  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i];
    const node: OutlineNode = { index: i, children: [] };

    while (stack.length > 1) {
      const parentIndex = stack[stack.length - 1].index;
      if (parentIndex === -1 || headings[parentIndex].level < heading.level) break;
      stack.pop();
    }

    stack[stack.length - 1].children.push(node);
    stack.push(node);
  }

  function createOutlineItems(
    children: OutlineNode[],
    parentRef: ReturnType<typeof context.nextRef>
  ) {
    for (let i = 0; i < children.length; i++) {
      const node = children[i];
      const heading = headings[node.index];
      const ref = outlineItemRefs[node.index];

      const yPos = pdfPageHeight - (heading.top / pageHeight) * pdfPageHeight;

      const dict = context.obj({
        Parent: parentRef,
        Dest: [page.ref, 'XYZ', 0, yPos, null],
      });
      dict.set(PDFName.of('Title'), PDFHexString.fromText(heading.text));

      if (i > 0) {
        dict.set(PDFName.of('Prev'), outlineItemRefs[children[i - 1].index]);
      }
      if (i < children.length - 1) {
        dict.set(PDFName.of('Next'), outlineItemRefs[children[i + 1].index]);
      }

      if (node.children.length > 0) {
        dict.set(PDFName.of('First'), outlineItemRefs[node.children[0].index]);
        dict.set(PDFName.of('Last'), outlineItemRefs[node.children[node.children.length - 1].index]);
        dict.set(PDFName.of('Count'), context.obj(node.children.length));
        createOutlineItems(node.children, ref);
      }

      context.assign(ref, dict);
    }
  }

  createOutlineItems(root.children, outlineRef);

  const outlineDict = context.obj({
    Type: 'Outlines',
    First: outlineItemRefs[root.children[0].index],
    Last: outlineItemRefs[root.children[root.children.length - 1].index],
    Count: root.children.length,
  });
  context.assign(outlineRef, outlineDict);

  pdfDoc.catalog.set(PDFName.of('Outlines'), outlineRef);

  return pdfDoc.save();
}
