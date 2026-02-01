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

## Development

```bash
# Install dependencies
pnpm install

# Build the package
cd packages/pdf-export
pnpm build
```

## Package Documentation

See [packages/pdf-export/README.md](./packages/pdf-export/README.md) for full documentation on using the PDF export plugin.
