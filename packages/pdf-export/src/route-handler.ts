import { NextRequest, NextResponse } from 'next/server';
import type { PdfExportOptions, PresetName } from './types.js';
import { resolveConfig, generatePdf, parseCookies } from './core.js';

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
  const config = resolveConfig(options);

  return async function handler(request: NextRequest): Promise<NextResponse> {
    const searchParams = request.nextUrl.searchParams;
    const path = searchParams.get('path');

    if (!path) {
      return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 });
    }

    const protocol = request.nextUrl.protocol.replace(':', '');
    const host = request.headers.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;
    const pageUrl = `${baseUrl}${path}`;

    const cookieHeader = request.headers.get('cookie') || '';

    try {
      const cookies = cookieHeader
        ? parseCookies(cookieHeader, host.split(':')[0], protocol === 'https', baseUrl)
        : [];

      const pdfBytes = await generatePdf(pageUrl, config, { cookies });

      const filename = path.replace(/\//g, '-').replace(/^-/, '') || 'document';

      return new NextResponse(Buffer.from(pdfBytes), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}.pdf"`,
        },
      });
    } catch (error) {
      console.error('PDF generation error:', error);
      return NextResponse.json(
        { error: 'Failed to generate PDF', details: String(error) },
        { status: 500 }
      );
    }
  };
}
