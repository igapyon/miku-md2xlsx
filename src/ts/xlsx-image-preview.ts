import type { Md2XlsxImageAsset, RowModel, WorkbookModel } from "./types.ts";
import { imageSize } from "./image-size.ts";
import { IMAGE_PREVIEW_COLUMNS, IMAGE_PREVIEW_ROWS } from "./xlsx-drawing-types.ts";

const PREVIEW_COLUMN_PIXELS = 64;
const PREVIEW_ROW_PIXELS = 20;
const MIN_IMAGE_PREVIEW_ROWS = 4;
const MAX_IMAGE_PREVIEW_ROWS = 24;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function imagePreviewRows(asset: Md2XlsxImageAsset): number {
  const size = imageSize(asset.data);
  if (!size?.width || !size.height) {
    return IMAGE_PREVIEW_ROWS;
  }
  const previewWidthPixels = IMAGE_PREVIEW_COLUMNS * PREVIEW_COLUMN_PIXELS;
  const aspectRatio = size.width / size.height;
  const previewHeightPixels = previewWidthPixels / aspectRatio;
  return clamp(Math.ceil(previewHeightPixels / PREVIEW_ROW_PIXELS), MIN_IMAGE_PREVIEW_ROWS, MAX_IMAGE_PREVIEW_ROWS);
}

function imageAssetsByPath(workbook: WorkbookModel): Map<string, Md2XlsxImageAsset> {
  const assets = new Map<string, Md2XlsxImageAsset>();
  for (const asset of workbook.imageAssets ?? []) {
    assets.set(asset.path, asset);
  }
  return assets;
}

function blankPreviewRow(): RowModel {
  return { kind: "blank", cells: [{ value: "" }] };
}

function rowHasEmbeddableImage(row: RowModel, assets: Map<string, Md2XlsxImageAsset>): boolean {
  return (row.imageRefs ?? []).some((ref) => assets.has(ref.path));
}

function previewRowsForRow(row: RowModel, assets: Map<string, Md2XlsxImageAsset>): number {
  return Math.max(
    IMAGE_PREVIEW_ROWS,
    ...(row.imageRefs ?? []).map((ref) => {
      const asset = assets.get(ref.path);
      return asset ? imagePreviewRows(asset) : IMAGE_PREVIEW_ROWS;
    })
  );
}

export function withReservedImagePreviewRows(workbook: WorkbookModel): WorkbookModel {
  const assets = imageAssetsByPath(workbook);
  if (!assets.size) {
    return workbook;
  }
  return {
    ...workbook,
    sheets: workbook.sheets.map((sheet) => ({
      ...sheet,
      rows: sheet.rows.flatMap((row) => (
        rowHasEmbeddableImage(row, assets)
          ? [row, ...Array.from({ length: previewRowsForRow(row, assets) }, blankPreviewRow)]
          : [row]
      ))
    }))
  };
}
