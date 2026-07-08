import { parseMarkdown } from "./markdown-parser.ts";
import { buildSheets } from "./sheet-builder.ts";
import type { Md2XlsxOptions, SheetModel, WorkbookModel } from "./types.ts";

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
  return { sheets: normalizeInternalHyperlinkTargets(sheets), imageAssets: options.imageAssets, templateXlsx: options.templateXlsx };
}

function normalizeInternalHyperlinkTargets(sheets: SheetModel[]): SheetModel[] {
  const sheetNames = new Set(sheets.map((sheet) => sheet.name));
  return sheets.map((sheet) => ({
    ...sheet,
    rows: sheet.rows.map((row) => ({
      ...row,
      cells: row.cells.map((cell) => {
        if (cell.hyperlink?.kind !== "internal") {
          return cell;
        }
        const match = cell.hyperlink.target.match(/^([^!]+)!(.+)$/);
        if (!match || sheetNames.has(unquoteSheetName(match[1]))) {
          return cell;
        }
        const xlsx2mdSheetName = `Sheet ${unquoteSheetName(match[1])}`;
        if (!sheetNames.has(xlsx2mdSheetName)) {
          return cell;
        }
        return {
          ...cell,
          hyperlink: {
            ...cell.hyperlink,
            target: `${quoteSheetName(xlsx2mdSheetName)}!${match[2]}`
          }
        };
      })
    }))
  }));
}

function unquoteSheetName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replace(/''/g, "'");
  }
  return trimmed;
}

function quoteSheetName(name: string): string {
  return /^[A-Za-z0-9_]+$/.test(name) ? name : `'${name.replace(/'/g, "''")}'`;
}
