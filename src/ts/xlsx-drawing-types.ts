import type { Md2XlsxImageAsset } from "./types.ts";

export interface EmbeddedImage {
  alt: string;
  path: string;
  rowIndex: number;
  asset: Md2XlsxImageAsset;
  mediaPath: string;
  relationshipId: string;
  previewRows: number;
}

export interface SheetDrawing {
  sheetIndex: number;
  drawingIndex: number;
  relationshipId: string;
  images: EmbeddedImage[];
}

export const IMAGE_PREVIEW_COLUMNS = 3;
export const IMAGE_PREVIEW_ROWS = 6;
