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

Install from npm:

```bash
npm install fumadocs-pdf-export puppeteer
# or
pnpm add fumadocs-pdf-export puppeteer
# or
yarn add fumadocs-pdf-export puppeteer
```

Or install from GitHub:

```bash
pnpm add github:sebastianhuus/fumadocs-pdf-export puppeteer
```

> **Note:** Puppeteer is a peer dependency and must be installed separately. It will download Chromium (~300MB) on install.

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

#### Basic Usage (Standalone Button)

```tsx
// app/docs/[[...slug]]/page.tsx
import { FumadocsExportButton } from 'fumadocs-pdf-export/components';

export default async function Page(props: PageProps<'/docs/[[...slug]]'>) {
  const params = await props.params;
  const page = source.getPage(params.slug);

  return (
    <DocsPage toc={page.data.toc}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>

      <div className="flex justify-end print-hidden">
        <FumadocsExportButton />
      </div>

      <DocsBody>
        <MDX components={getMDXComponents()} />
      </DocsBody>
    </DocsPage>
  );
}
```

#### Recommended: Integrated Action Bar

For a more cohesive UI, integrate the PDF export button with other page actions:

```tsx
// app/docs/[[...slug]]/page.tsx
import { FumadocsExportButton } from 'fumadocs-pdf-export/components';
import { LLMCopyButton, ViewOptions } from '@/components/ai/page-actions';

export default async function Page(props: PageProps<'/docs/[[...slug]]'>) {
  const params = await props.params;
  const page = source.getPage(params.slug);

  return (
    <DocsPage toc={page.data.toc}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription className="mb-0">{page.data.description}</DocsDescription>

      {/* Integrated action bar with all page actions */}
      <div className="flex flex-row gap-2 items-center border-b pb-6 print-hidden">
        <FumadocsExportButton />
        <LLMCopyButton markdownUrl={`${page.url}.mdx`} />
        <ViewOptions
          markdownUrl={`${page.url}.mdx`}
          githubUrl={`https://github.com/user/repo/blob/main/content/docs/${page.path}`}
        />
      </div>

      <DocsBody>
        <MDX components={getMDXComponents()} />
      </DocsBody>
    </DocsPage>
  );
}
```

This creates a unified action bar where all page actions are grouped together with consistent spacing and styling.

### 4. Configure Next.js (required for pnpm)

If using pnpm, add this to your `next.config.js` to prevent Turbopack warnings:

```js
// next.config.js
const nextConfig = {
  serverExternalPackages: ['puppeteer'],
};

module.exports = nextConfig;
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

### FumadocsExportButton

Pre-styled button that matches Fumadocs design system with consistent sizing and colors:

```tsx
import { FumadocsExportButton } from 'fumadocs-pdf-export/components';

<FumadocsExportButton
  onExportSuccess={() => toast.success('PDF downloaded!')}
/>
```

**Styling details:**
- Uses Fumadocs `buttonVariants` with `color: 'secondary'` and `size: 'sm'`
- Includes printer icon (normal state) and spinning loader (loading state)
- Matches the styling of other Fumadocs UI components
- Shows "Export PDF" text with "Generating..." during export

**Integration tip:** Place it alongside other action buttons (like `LLMCopyButton`, `ViewOptions`) in a unified action bar:

```tsx
<div className="flex flex-row gap-2 items-center border-b pb-6 print-hidden">
  <FumadocsExportButton />
  <LLMCopyButton markdownUrl={`${page.url}.mdx`} />
  <ViewOptions markdownUrl={`${page.url}.mdx`} githubUrl="..." />
</div>
```

**Important:** Always add `print-hidden` class to the action bar to prevent it from appearing in the PDF export.

### ExportButton

Unstyled base button component for complete custom styling:

```tsx
import { ExportButton } from 'fumadocs-pdf-export/components';

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

Use this when you need full control over styling or want to match a custom design system.

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

### pnpm warnings about puppeteer

If you see "Package puppeteer can't be external" warnings with pnpm:

1. Ensure puppeteer is installed as a direct dependency (not just via fumadocs-pdf-export)
2. Add `serverExternalPackages: ['puppeteer']` to your `next.config.js` (see Quick Start step 4)
3. If using `pnpm-workspace.yaml`, add puppeteer to `onlyBuiltDependencies`:

```yaml
onlyBuiltDependencies:
  - puppeteer
```

### Authentication issues

The handler forwards cookies automatically. For complex auth:

1. Ensure cookies are set on the same domain
2. Check for `__Host-` or `__Secure-` prefixed cookies

## License

MIT
