export type SheetMode = "single" | "heading";
export type SheetHeadingDepth = 1 | 2;
export type TableStyleMode = "plain" | "bordered";
export type CellStyleRole =
  | "normal"
  | "heading1"
  | "heading2"
  | "heading3"
  | "heading4"
  | "heading5"
  | "heading6"
  | "title"
  | "heading"
  | "tableHeader"
  | "tableCell"
  | "code"
  | "separator";
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
  templateXlsx?: Uint8Array;
}

export interface WorkbookModel {
  sheets: SheetModel[];
  imageAssets?: Md2XlsxImageAsset[];
  templateXlsx?: Uint8Array;
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
  hyperlink?: HyperlinkModel;
  richTextRuns?: RichTextRun[];
}

export interface HyperlinkModel {
  target: string;
  kind: "external" | "internal";
}

export interface RichTextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  underline?: boolean;
}

export interface ImageRefModel {
  alt: string;
  path: string;
}
