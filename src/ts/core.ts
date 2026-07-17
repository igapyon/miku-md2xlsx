import { markdownToWorkbook } from "./workbook-model.ts";
import { writeXlsx } from "./xlsx-writer.ts";
import type { Md2XlsxOptions, WorkbookModel } from "./types.ts";

export type { CellModel, Md2XlsxOptions, RowModel, SheetModel, WorkbookModel } from "./types.ts";

export function markdownToXlsxModel(markdown: string, options: Md2XlsxOptions = {}): WorkbookModel {
  return markdownToWorkbook(markdown, options);
}

export function workbookModelToXlsx(workbook: WorkbookModel): Uint8Array {
  return writeXlsx(workbook);
}

export function md2xlsx(markdown: string, options: Md2XlsxOptions = {}): Uint8Array {
  return workbookModelToXlsx(markdownToXlsxModel(markdown, options));
}
