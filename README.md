# fumadocs-pdf-export

PDF export plugin for documentation sites. Works with Fumadocs, Docusaurus, Nextra, and other frameworks.

For some reason, Word/Powerpoint are the 'best' solution that billion dollar Fortune 500 companies offer for creating guides and procedures... Now we don't have to suffer anymore :) Write that beautiful article in whatever framework you want, export to PDF and be done with it. 

<!-- Basic example -->
https://github.com/user-attachments/assets/a1e9c0bd-c67e-4b82-9cd0-83c75cdc4cf6

<!-- Advanced example -->

https://github.com/user-attachments/assets/0315d55d-5612-4dd1-9f6d-9a375a0c516a

Note: you can see some kinks, such as the "Architecture" MD diagram not rendering fully because it is in a scrollable container. To be honest, you can fix that yourself by making a non-scrollable page element, using Mermaid, etc - as fixing it in the plugin would require modifying a lot of Fumadocs components.

## Repository Structure

This is a monorepo containing:

- `packages/pdf-export` - The npm package for PDF export functionality
- `apps/demo` - Demo Fumadocs wiki for previewing components and creating screenshots (coming soon)

## Quick Start

Two modes are supported:

**Live mode** — generates PDFs on-demand via a Next.js API route (requires Chromium at runtime):

```typescript
// app/api/export-pdf/route.ts
import { createPdfExportHandler } from 'fumadocs-pdf-export';
export const GET = createPdfExportHandler('fumadocs');
```

**Static mode** — pre-renders PDFs at build time, serves as static files (works everywhere):

```bash
# Start your dev server, then:
npx fumadocs-pdf generate --url http://localhost:3000 --sitemap
```

See [packages/pdf-export/README.md](./packages/pdf-export/README.md) for full documentation.

## GitHub Actions Example

Automate PDF generation on every content change:

```yaml
# .github/workflows/generate-pdfs.yml
name: Generate PDFs
on:
  push:
    branches: [main]
    paths: ['content/**']

jobs:
  pdfs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install
      - run: pnpm build
      - run: pnpm start &
      - run: sleep 5
      - run: npx fumadocs-pdf generate --url http://localhost:3000 --sitemap
      - uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: 'chore: update generated PDFs'
          file_pattern: 'public/pdfs/*'
```

## Development

```bash
# Install dependencies
pnpm install

# Build the package
cd packages/pdf-export
pnpm build
```
