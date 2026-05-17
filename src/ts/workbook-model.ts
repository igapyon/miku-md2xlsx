import { parseMarkdown } from "./markdown-parser.ts";
import { buildSheets } from "./sheet-builder.ts";
import type { Md2XlsxOptions, WorkbookModel } from "./types.ts";

export function markdownToWorkbook(markdown: string, options: Md2XlsxOptions = {}): WorkbookModel {
  const tree = parseMarkdown(markdown);
  const headerRow = options.headerRow ?? true;
  const tableStyle = options.tableStyle ?? "bordered";
  const sheetHeadingDepth = options.sheetHeadingDepth ?? 1;
  const sheets = buildSheets(tree, {
    headerRow,
    tableStyle,
    sheetMode: options.sheetMode,
    sheetHeadingDepth,
    title: options.title
  });
  return { sheets, imageAssets: options.imageAssets };
}
