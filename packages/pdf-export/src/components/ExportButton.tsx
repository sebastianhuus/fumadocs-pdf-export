'use client';

import { useState, useCallback } from 'react';
import type { ExportButtonProps } from '../types.js';

/**
 * Button component that triggers PDF export of the current page
 *
 * @example
 * // Basic usage with Fumadocs styling
 * <ExportButton className="fd-button" />
 *
 * @example
 * // Custom content
 * <ExportButton>
 *   <DownloadIcon /> Download PDF
 * </ExportButton>
 *
 * @example
 * // With callbacks
 * <ExportButton
 *   onExportStart={() => console.log('Starting...')}
 *   onExportSuccess={() => toast.success('PDF downloaded!')}
 *   onExportError={(err) => toast.error(err.message)}
 * />
 */
export function ExportButton({
  apiPath = '/api/export-pdf',
  className,
  children,
  title = 'Export as PDF',
  onExportStart,
  onExportSuccess,
  onExportError,
  filename,
  disabled,
}: ExportButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleExport = useCallback(async () => {
    if (isLoading || disabled) return;

    setIsLoading(true);
    onExportStart?.();

    try {
      const currentPath = window.location.pathname;
      const response = await fetch(`${apiPath}?path=${encodeURIComponent(currentPath)}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || 'Failed to generate PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename
        ? `${filename}.pdf`
        : `${currentPath.replace(/\//g, '-').replace(/^-/, '') || 'document'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      onExportSuccess?.();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('[PDF Export] Error:', err);
      onExportError?.(err);
    } finally {
      setIsLoading(false);
    }
  }, [apiPath, filename, isLoading, disabled, onExportStart, onExportSuccess, onExportError]);

  return (
    <button
      onClick={handleExport}
      disabled={isLoading || disabled}
      className={className}
      title={title}
      aria-busy={isLoading}
    >
      {children ?? (isLoading ? 'Generating...' : 'Export PDF')}
    </button>
  );
}

/**
 * Pre-styled ExportButton for Fumadocs projects
 * Uses Fumadocs CSS variables for consistent styling
 */
export function FumadocsExportButton(props: Omit<ExportButtonProps, 'className' | 'children'>) {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <ExportButton
      {...props}
      onExportStart={() => {
        setIsLoading(true);
        props.onExportStart?.();
      }}
      onExportSuccess={() => {
        setIsLoading(false);
        props.onExportSuccess?.();
      }}
      onExportError={(err) => {
        setIsLoading(false);
        props.onExportError?.(err);
      }}
      className="inline-flex items-center gap-2 rounded-md border border-fd-border bg-fd-background px-3 py-1.5 text-sm text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-accent-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isLoading ? (
        <>
          <LoadingSpinner />
          Generating...
        </>
      ) : (
        <>
          <PrinterIcon />
          Export PDF
        </>
      )}
    </ExportButton>
  );
}

function PrinterIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect width="12" height="8" x="6" y="14" />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="animate-spin"
      style={{ animation: 'spin 1s linear infinite' }}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
