# fumadocs-pdf-export

PDF export plugin for documentation sites. Works with Fumadocs, Docusaurus, Nextra, and other frameworks.

## Features

- Single-page PDF export (no page breaks)
- Automatic accordion/collapsible expansion
- Lazy image loading support
- Cookie forwarding for authenticated pages
- Configurable selectors for different frameworks
- Pre-built presets for popular doc frameworks

## Installation

```bash
npm install fumadocs-pdf-export
# or
pnpm add fumadocs-pdf-export
# or
yarn add fumadocs-pdf-export
```

> **Note:** This package includes Puppeteer as a dependency, which downloads Chromium (~300MB) on install.

## Quick Start (Fumadocs)

### 1. Create the API route

```typescript
// app/api/export-pdf/route.ts
import { createPdfExportHandler } from 'fumadocs-pdf-export';

export const GET = createPdfExportHandler();
```

### 2. Import print styles

```css
/* app/global.css */
@import 'fumadocs-pdf-export/styles/print.css';
```

### 3. Add the export button

```tsx
// app/docs/[[...slug]]/page.tsx
import { FumadocsExportButton } from 'fumadocs-pdf-export';

export default function Page() {
  return (
    <DocsPage>
      <div className="flex justify-end print-hidden">
        <FumadocsExportButton />
      </div>
      {/* ... rest of your page */}
    </DocsPage>
  );
}
```

## Configuration

### Using Presets

```typescript
import { createPdfExportHandler } from 'fumadocs-pdf-export';

// Fumadocs (default)
export const GET = createPdfExportHandler('fumadocs');

// Docusaurus
export const GET = createPdfExportHandler('docusaurus');

// Nextra
export const GET = createPdfExportHandler('nextra');
```

### Custom Options

```typescript
import { createPdfExportHandler } from 'fumadocs-pdf-export';

export const GET = createPdfExportHandler({
  // CSS selector for main content
  contentSelector: 'article',

  // Elements to remove from PDF
  removeSelectors: ['#sidebar', '.toc', 'nav', '.print-hidden'],

  // Accordion handling
  expandAccordions: true,
  accordionTriggerSelectors: ['button[data-state="closed"]'],
  accordionContentSelectors: ['[data-radix-accordion-content]'],

  // Lazy image handling
  triggerLazyImages: true,

  // PDF dimensions
  pageWidth: 850,
  margins: { top: 30, right: 30, bottom: 30, left: 30 },

  // Puppeteer options
  timeout: 30000,
  puppeteerOptions: {
    headless: true,
  },

  // Custom page transformation (runs in browser context)
  beforePdfGeneration: `
    document.querySelectorAll('.custom-element').forEach(el => el.remove());
  `,
});
```

## Components

### ExportButton

Unstyled button component for custom styling:

```tsx
import { ExportButton } from 'fumadocs-pdf-export';

<ExportButton
  apiPath="/api/export-pdf"
  className="my-custom-button"
  title="Download PDF"
  filename="my-document"
  onExportStart={() => console.log('Starting...')}
  onExportSuccess={() => toast.success('Downloaded!')}
  onExportError={(err) => toast.error(err.message)}
>
  <DownloadIcon /> Export as PDF
</ExportButton>
```

### FumadocsExportButton

Pre-styled button that matches Fumadocs design:

```tsx
import { FumadocsExportButton } from 'fumadocs-pdf-export';

<FumadocsExportButton
  onExportSuccess={() => toast.success('PDF downloaded!')}
/>
```

## API Reference

### `createPdfExportHandler(options?)`

Creates a Next.js API route handler for PDF generation.

**Parameters:**
- `options` - Configuration object or preset name (`'fumadocs'` | `'docusaurus'` | `'nextra'`)

**Returns:** Next.js GET route handler

### `PdfExportOptions`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `contentSelector` | `string` | `'article'` | CSS selector for main content |
| `removeSelectors` | `string[]` | `['#nd-sidebar', ...]` | Elements to remove |
| `expandAccordions` | `boolean` | `true` | Expand accordions before PDF |
| `triggerLazyImages` | `boolean` | `true` | Scroll to load lazy images |
| `pageWidth` | `number` | `850` | PDF width in pixels |
| `margins` | `object` | `{top:30,...}` | PDF margins |
| `timeout` | `number` | `30000` | Navigation timeout (ms) |
| `puppeteerOptions` | `LaunchOptions` | `{}` | Puppeteer launch options |
| `beforePdfGeneration` | `string` | - | Custom JS to run before PDF |

### `ExportButtonProps`

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `apiPath` | `string` | `'/api/export-pdf'` | API endpoint path |
| `className` | `string` | - | CSS classes |
| `children` | `ReactNode` | - | Button content |
| `title` | `string` | `'Export as PDF'` | Button tooltip |
| `filename` | `string` | - | Custom filename |
| `disabled` | `boolean` | `false` | Disable button |
| `onExportStart` | `() => void` | - | Called on export start |
| `onExportSuccess` | `() => void` | - | Called on success |
| `onExportError` | `(Error) => void` | - | Called on error |

## Print Styles

The package includes print-optimized CSS that:

- Hides navigation, sidebars, and TOC
- Expands all accordions and collapsibles
- Shows all tab panel content
- Handles code block wrapping
- Prevents page breaks inside elements

Import in your global CSS:

```css
@import 'fumadocs-pdf-export/styles/print.css';
```

## Troubleshooting

### Puppeteer fails to launch

On Linux servers, you may need additional dependencies:

```bash
apt-get install -y chromium-browser
```

Or use `puppeteer-core` with a system Chrome:

```typescript
export const GET = createPdfExportHandler({
  puppeteerOptions: {
    executablePath: '/usr/bin/chromium-browser',
  },
});
```

### PDF is blank or missing content

1. Ensure `contentSelector` matches your content container
2. Check that lazy images are loading (increase timeout if needed)
3. Verify accordions are being expanded

### Authentication issues

The handler forwards cookies automatically. For complex auth:

1. Ensure cookies are set on the same domain
2. Check for `__Host-` or `__Secure-` prefixed cookies

## License

MIT
