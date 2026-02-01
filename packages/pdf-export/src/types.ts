import type { LaunchOptions } from 'puppeteer';

/**
 * Configuration options for the PDF export handler
 */
export interface PdfExportOptions {
  /**
   * CSS selector for the main content container
   * @default 'article'
   */
  contentSelector?: string;

  /**
   * CSS selectors for elements to remove from the PDF
   * @default ['#nd-sidebar', '#nd-toc', 'nav', '.print-hidden']
   */
  removeSelectors?: string[];

  /**
   * Whether to expand accordions before generating PDF
   * @default true
   */
  expandAccordions?: boolean;

  /**
   * CSS selectors for accordion trigger buttons (closed state)
   * @default ['button[data-state="closed"]', '[data-state="closed"] > button', '[data-state="closed"][role="button"]']
   */
  accordionTriggerSelectors?: string[];

  /**
   * CSS selectors for accordion content containers
   * @default ['[data-radix-accordion-content]', '[data-radix-collapsible-content]']
   */
  accordionContentSelectors?: string[];

  /**
   * Whether to scroll through the page to trigger lazy-loaded images
   * @default true
   */
  triggerLazyImages?: boolean;

  /**
   * PDF page width in pixels
   * @default 850
   */
  pageWidth?: number;

  /**
   * PDF margins in pixels
   * @default { top: 30, right: 30, bottom: 30, left: 30 }
   */
  margins?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };

  /**
   * Timeout for page navigation in milliseconds
   * @default 30000
   */
  timeout?: number;

  /**
   * Additional Puppeteer launch options
   */
  puppeteerOptions?: LaunchOptions;

  /**
   * Custom function to transform the page before PDF generation
   * Runs in the browser context after default transformations
   */
  beforePdfGeneration?: string;
}

/**
 * Props for the ExportButton component
 */
export interface ExportButtonProps {
  /**
   * API endpoint path for PDF generation
   * @default '/api/export-pdf'
   */
  apiPath?: string;

  /**
   * Additional CSS class names
   */
  className?: string;

  /**
   * Custom content to render inside the button
   */
  children?: React.ReactNode;

  /**
   * Button title/tooltip
   * @default 'Export as PDF'
   */
  title?: string;

  /**
   * Callback fired when export starts
   */
  onExportStart?: () => void;

  /**
   * Callback fired when export completes successfully
   */
  onExportSuccess?: () => void;

  /**
   * Callback fired when export fails
   */
  onExportError?: (error: Error) => void;

  /**
   * Custom filename for the downloaded PDF (without extension)
   * If not provided, derives from current URL path
   */
  filename?: string;

  /**
   * Whether the button is disabled
   */
  disabled?: boolean;
}

/**
 * Preset configurations for common documentation frameworks
 */
export const presets = {
  fumadocs: {
    contentSelector: 'article',
    removeSelectors: ['#nd-sidebar', '#nd-toc', 'nav', '.print-hidden'],
    accordionTriggerSelectors: [
      'button[data-state="closed"]',
      '[data-state="closed"] > button',
      '[data-state="closed"][role="button"]',
    ],
    accordionContentSelectors: [
      '[data-radix-accordion-content]',
      '[data-radix-collapsible-content]',
    ],
  },
  docusaurus: {
    contentSelector: 'article',
    removeSelectors: ['.theme-doc-sidebar-container', '.table-of-contents', 'nav', '.print-hidden'],
    accordionTriggerSelectors: ['.collapsible-button', 'button[aria-expanded="false"]'],
    accordionContentSelectors: ['.collapsible-content'],
  },
  nextra: {
    contentSelector: 'article',
    removeSelectors: ['nav', 'aside', '.nextra-sidebar', '.nextra-toc', '.print-hidden'],
    accordionTriggerSelectors: ['button[data-state="closed"]'],
    accordionContentSelectors: ['[data-radix-collapsible-content]'],
  },
} as const;

export type PresetName = keyof typeof presets;
