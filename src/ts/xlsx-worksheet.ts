import type { SheetModel } from "./types.ts";
import type { SheetDrawing } from "./xlsx-drawing.ts";
import { worksheetHyperlinkRelsXml, worksheetHyperlinks, worksheetHyperlinksXml } from "./xlsx-hyperlinks.ts";
import { cellKey, coveredMergeCells, isMergeMarker, mergeRangeRef, mergeRanges } from "./xlsx-merge.ts";
import { cellInlineStringXml } from "./xlsx-rich-text.ts";
import { styleIndex } from "./xlsx-styles.ts";
import { columnName } from "./xlsx-xml.ts";

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
  const hyperlinks = worksheetHyperlinksXml(links);
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
  const hyperlinkRelationships = worksheetHyperlinkRelsXml(worksheetHyperlinks(sheet, drawing));
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${drawingRelationship}
${hyperlinkRelationships}
</Relationships>`;
}
