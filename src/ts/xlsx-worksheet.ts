import type { CellModel, HyperlinkModel, RichTextRun, SheetModel } from "./types.ts";
import type { SheetDrawing } from "./xlsx-drawing.ts";
import { styleIndex } from "./xlsx-styles.ts";
import { columnName, inlineTextXml, xml } from "./xlsx-xml.ts";

const LEFT_MERGE_MARKER = "[←M←]";
const UP_MERGE_MARKER = "[↑M↑]";

interface MergeRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

interface WorksheetHyperlink {
  ref: string;
  link: HyperlinkModel;
  relationshipId?: string;
}

function cellValue(sheet: SheetModel, rowIndex: number, cellIndex: number): string {
  return sheet.rows[rowIndex]?.cells[cellIndex]?.value ?? "";
}

function isMergeMarker(value: string): boolean {
  return value === LEFT_MERGE_MARKER || value === UP_MERGE_MARKER;
}

function cellKey(rowIndex: number, cellIndex: number): string {
  return `${rowIndex}:${cellIndex}`;
}

function mergeRangeRef(range: MergeRange): string {
  return `${columnName(range.startCol)}${range.startRow + 1}:${columnName(range.endCol)}${range.endRow + 1}`;
}

function mergeRanges(sheet: SheetModel): MergeRange[] {
  const ranges: MergeRange[] = [];
  for (const [rowIndex, row] of sheet.rows.entries()) {
    for (const [cellIndex, cell] of row.cells.entries()) {
      if (isMergeMarker(cell.value)) {
        continue;
      }

      let endCol = cellIndex;
      while (cellValue(sheet, rowIndex, endCol + 1) === LEFT_MERGE_MARKER) {
        endCol += 1;
      }

      let endRow = rowIndex;
      while (endRow + 1 < sheet.rows.length) {
        const nextRowContinues = Array.from({ length: endCol - cellIndex + 1 }, (_, offset) => (
          cellValue(sheet, endRow + 1, cellIndex + offset) === UP_MERGE_MARKER
        )).every(Boolean);
        if (!nextRowContinues) {
          break;
        }
        endRow += 1;
      }

      if (endCol > cellIndex || endRow > rowIndex) {
        ranges.push({ startRow: rowIndex, startCol: cellIndex, endRow, endCol });
      }
    }
  }
  return ranges;
}

function coveredMergeCells(ranges: MergeRange[]): Set<string> {
  const covered = new Set<string>();
  for (const range of ranges) {
    for (let row = range.startRow; row <= range.endRow; row += 1) {
      for (let col = range.startCol; col <= range.endCol; col += 1) {
        if (row !== range.startRow || col !== range.startCol) {
          covered.add(cellKey(row, col));
        }
      }
    }
  }
  return covered;
}

function worksheetHyperlinks(sheet: SheetModel, drawing?: SheetDrawing): WorksheetHyperlink[] {
  let externalIndex = drawing ? 2 : 1;
  return sheet.rows.flatMap((row, rowIndex) => row.cells.flatMap((cell, cellIndex) => {
    if (!cell.hyperlink) {
      return [];
    }
    const ref = `${columnName(cellIndex)}${rowIndex + 1}`;
    if (cell.hyperlink.kind === "internal") {
      return [{ ref, link: cell.hyperlink }];
    }
    const relationshipId = `rId${externalIndex}`;
    externalIndex += 1;
    return [{ ref, link: cell.hyperlink, relationshipId }];
  }));
}

function cellInlineStringXml(cell: CellModel, value: string): string {
  const runs = cell.richTextRuns;
  if (!runs?.length || runs.map((run) => run.text).join("") !== value) {
    return inlineTextXml(value);
  }
  return runs.map(richTextRunXml).join("");
}

function richTextRunXml(run: RichTextRun): string {
  const properties = richTextRunPropertiesXml(run);
  return `<r>${properties}${inlineTextXml(run.text)}</r>`;
}

function richTextRunPropertiesXml(run: RichTextRun): string {
  const properties = [
    run.bold ? "<b/>" : "",
    run.italic ? "<i/>" : "",
    run.strike ? "<strike/>" : "",
    run.underline ? "<u/>" : ""
  ].join("");
  return properties ? `<rPr>${properties}</rPr>` : "";
}

export function worksheetXml(sheet: SheetModel, drawing?: SheetDrawing): string {
  const maxColumns = Math.max(...sheet.rows.map((row) => row.cells.length), 1);
  const dimension = `A1:${columnName(maxColumns - 1)}${Math.max(sheet.rows.length, 1)}`;
  const columns = (sheet.columnHints ?? []).map((width, index) => (
    `<col min="${index + 1}" max="${index + 1}" width="${Math.max(width, 10)}" customWidth="1"/>`
  )).join("");
  const merges = mergeRanges(sheet);
  const coveredCells = coveredMergeCells(merges);
  const links = worksheetHyperlinks(sheet, drawing);
  const rows = sheet.rows.map((row, rowIndex) => {
    const cells = row.cells.map((cell, cellIndex) => {
      const ref = `${columnName(cellIndex)}${rowIndex + 1}`;
      const style = styleIndex(cell.styleRole);
      const value = coveredCells.has(cellKey(rowIndex, cellIndex)) || isMergeMarker(cell.value) ? "" : cell.value;
      return `<c r="${ref}" t="inlineStr" s="${style}"><is>${cellInlineStringXml(cell, value)}</is></c>`;
    }).join("");
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join("");
  const mergeCells = merges.length
    ? `<mergeCells count="${merges.length}">${merges.map((range) => `<mergeCell ref="${mergeRangeRef(range)}"/>`).join("")}</mergeCells>`
    : "";
  const hyperlinks = links.length
    ? `<hyperlinks>${links.map((link) => (
      link.link.kind === "internal"
        ? `<hyperlink ref="${link.ref}" location="${xml(link.link.target)}"/>`
        : `<hyperlink ref="${link.ref}" r:id="${link.relationshipId}"/>`
    )).join("")}</hyperlinks>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<dimension ref="${dimension}"/>
<sheetViews><sheetView workbookViewId="0"/></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${columns}</cols>
<sheetData>${rows}</sheetData>
${mergeCells}
${hyperlinks}
${drawing ? `<drawing r:id="${drawing.relationshipId}"/>` : ""}
</worksheet>`;
}

export function hasWorksheetRelationships(sheet: SheetModel, drawing?: SheetDrawing): boolean {
  return Boolean(drawing) || worksheetHyperlinks(sheet, drawing).some((link) => link.link.kind === "external");
}

export function worksheetRelsXml(sheet: SheetModel, drawing?: SheetDrawing): string {
  const drawingRelationship = drawing
    ? `<Relationship Id="${drawing.relationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${drawing.drawingIndex}.xml"/>`
    : "";
  const hyperlinkRelationships = worksheetHyperlinks(sheet, drawing)
    .filter((link) => link.link.kind === "external")
    .map((link) => `<Relationship Id="${link.relationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${xml(link.link.target)}" TargetMode="External"/>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${drawingRelationship}
${hyperlinkRelationships}
</Relationships>`;
}
