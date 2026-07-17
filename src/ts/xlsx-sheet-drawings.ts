import type { Md2XlsxImageAsset, WorkbookModel } from "./types.ts";
import type { EmbeddedImage, SheetDrawing } from "./xlsx-drawing-types.ts";
import { imagePreviewRows } from "./xlsx-image-preview.ts";
import { mediaExtension } from "./xlsx-media.ts";

function imageAssetsByPath(workbook: WorkbookModel): Map<string, Md2XlsxImageAsset> {
  const assets = new Map<string, Md2XlsxImageAsset>();
  for (const asset of workbook.imageAssets ?? []) {
    assets.set(asset.path, asset);
  }
  return assets;
}

export function collectSheetDrawings(workbook: WorkbookModel): SheetDrawing[] {
  const assets = imageAssetsByPath(workbook);
  const drawings: SheetDrawing[] = [];
  let drawingIndex = 1;
  let mediaIndex = 1;
  for (const [sheetOffset, sheet] of workbook.sheets.entries()) {
    const images: EmbeddedImage[] = [];
    for (const [rowIndex, row] of sheet.rows.entries()) {
      for (const ref of row.imageRefs ?? []) {
        const asset = assets.get(ref.path);
        if (!asset) {
          continue;
        }
        const extension = mediaExtension(asset);
        images.push({
          alt: ref.alt,
          path: ref.path,
          rowIndex,
          asset,
          mediaPath: `image${mediaIndex}.${extension}`,
          relationshipId: `rId${images.length + 1}`,
          previewRows: imagePreviewRows(asset)
        });
        mediaIndex += 1;
      }
    }
    if (images.length) {
      drawings.push({
        sheetIndex: sheetOffset + 1,
        drawingIndex,
        relationshipId: "rId1",
        images
      });
      drawingIndex += 1;
    }
  }
  return drawings;
}
