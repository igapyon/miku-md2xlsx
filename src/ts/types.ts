export type SheetMode = "single" | "heading";
export type SheetHeadingDepth = 1 | 2;
export type TableStyleMode = "plain" | "bordered";
export type CellStyleRole = "normal" | "title" | "heading" | "tableHeader" | "tableCell" | "code" | "separator";
export type RowKind = "title" | "heading" | "paragraph" | "list" | "table" | "code" | "separator" | "image" | "blank";

export interface Md2XlsxImageAsset {
  path: string;
  data: Uint8Array;
  contentType?: string;
}

export interface Md2XlsxOptions {
  sheetMode?: SheetMode;
  sheetHeadingDepth?: SheetHeadingDepth;
  title?: string;
  tableStyle?: TableStyleMode;
  headerRow?: boolean;
  imageAssets?: Md2XlsxImageAsset[];
}

export interface WorkbookModel {
  sheets: SheetModel[];
  imageAssets?: Md2XlsxImageAsset[];
}

export interface SheetModel {
  name: string;
  rows: RowModel[];
  columnHints?: number[];
}

export interface RowModel {
  kind: RowKind;
  cells: CellModel[];
  imageRefs?: ImageRefModel[];
}

export interface CellModel {
  value: string;
  styleRole?: CellStyleRole;
}

export interface ImageRefModel {
  alt: string;
  path: string;
}
