import type { Md2XlsxImageAsset, RowModel, WorkbookModel } from "./types.ts";
import { xml } from "./xlsx-xml.ts";

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

const PREVIEW_COLUMN_PIXELS = 64;
const PREVIEW_ROW_PIXELS = 20;
const MIN_IMAGE_PREVIEW_ROWS = 4;
const MAX_IMAGE_PREVIEW_ROWS = 24;

interface ImageSize {
  width: number;
  height: number;
}

function readUint16Be(data: Uint8Array, offset: number): number {
  return ((data[offset] ?? 0) << 8) | (data[offset + 1] ?? 0);
}

function readUint16Le(data: Uint8Array, offset: number): number {
  return (data[offset] ?? 0) | ((data[offset + 1] ?? 0) << 8);
}

function readUint32Be(data: Uint8Array, offset: number): number {
  return (((data[offset] ?? 0) << 24) | ((data[offset + 1] ?? 0) << 16) | ((data[offset + 2] ?? 0) << 8) | (data[offset + 3] ?? 0)) >>> 0;
}

function pngSize(data: Uint8Array): ImageSize | undefined {
  if (data.length < 24 || data[0] !== 0x89 || data[1] !== 0x50 || data[2] !== 0x4e || data[3] !== 0x47) {
    return undefined;
  }
  return { width: readUint32Be(data, 16), height: readUint32Be(data, 20) };
}

function gifSize(data: Uint8Array): ImageSize | undefined {
  if (data.length < 10 || data[0] !== 0x47 || data[1] !== 0x49 || data[2] !== 0x46) {
    return undefined;
  }
  return { width: readUint16Le(data, 6), height: readUint16Le(data, 8) };
}

function jpegSize(data: Uint8Array): ImageSize | undefined {
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) {
    return undefined;
  }
  let offset = 2;
  while (offset + 9 < data.length) {
    if (data[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = data[offset + 1] ?? 0;
    const length = readUint16Be(data, offset + 2);
    if (length < 2 || offset + 2 + length > data.length) {
      return undefined;
    }
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
      return { width: readUint16Be(data, offset + 7), height: readUint16Be(data, offset + 5) };
    }
    offset += 2 + length;
  }
  return undefined;
}

function imageSize(asset: Md2XlsxImageAsset): ImageSize | undefined {
  return pngSize(asset.data) ?? gifSize(asset.data) ?? jpegSize(asset.data);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function imagePreviewRows(asset: Md2XlsxImageAsset): number {
  const size = imageSize(asset);
  if (!size?.width || !size.height) {
    return IMAGE_PREVIEW_ROWS;
  }
  const previewWidthPixels = IMAGE_PREVIEW_COLUMNS * PREVIEW_COLUMN_PIXELS;
  const aspectRatio = size.width / size.height;
  const previewHeightPixels = previewWidthPixels / aspectRatio;
  return clamp(Math.ceil(previewHeightPixels / PREVIEW_ROW_PIXELS), MIN_IMAGE_PREVIEW_ROWS, MAX_IMAGE_PREVIEW_ROWS);
}

export function mediaExtension(asset: Md2XlsxImageAsset): string {
  const fromPath = asset.path.match(/\.([a-z0-9]+)(?:[?#].*)?$/i)?.[1]?.toLowerCase();
  if (fromPath === "jpg" || fromPath === "jpeg" || fromPath === "png" || fromPath === "gif") {
    return fromPath;
  }
  switch (asset.contentType) {
    case "image/jpeg":
      return "jpg";
    case "image/gif":
      return "gif";
    default:
      return "png";
  }
}

export function mediaContentType(extension: string): string {
  switch (extension) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    default:
      return "image/png";
  }
}

export function drawingXml(drawing: SheetDrawing): string {
  const anchors = drawing.images.map((image, imageIndex) => {
    const row = image.rowIndex;
    const col = 1;
    return `<xdr:twoCellAnchor editAs="oneCell">
<xdr:from><xdr:col>${col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
<xdr:to><xdr:col>${col + IMAGE_PREVIEW_COLUMNS}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row + image.previewRows}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
<xdr:pic>
<xdr:nvPicPr><xdr:cNvPr id="${imageIndex + 1}" name="${xml(image.alt || image.path)}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>
<xdr:blipFill><a:blip r:embed="${image.relationshipId}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>
<xdr:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr>
</xdr:pic>
<xdr:clientData/>
</xdr:twoCellAnchor>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
${anchors}
</xdr:wsDr>`;
}

export function drawingRelsXml(drawing: SheetDrawing): string {
  const relationships = drawing.images.map((image) => (
    `<Relationship Id="${image.relationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${image.mediaPath}"/>`
  )).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${relationships}
</Relationships>`;
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
