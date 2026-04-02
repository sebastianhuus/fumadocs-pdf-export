// Route handler
export { createPdfExportHandler } from './route-handler.js';

// Core (for programmatic use)
export { generatePdf, resolveConfig } from './core.js';

// Components
export { ExportButton, FumadocsExportButton } from './components/index.js';

// Types and presets
export type {
  PdfExportOptions,
  ExportButtonProps,
  PresetName,
} from './types.js';

export { presets } from './types.js';
