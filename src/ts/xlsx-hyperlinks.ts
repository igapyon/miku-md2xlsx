import type { HyperlinkModel, SheetModel } from "./types.ts";
import type { SheetDrawing } from "./xlsx-drawing.ts";
import { columnName, xml } from "./xlsx-xml.ts";

export interface WorksheetHyperlink {
  ref: string;
  link: HyperlinkModel;
  relationshipId?: string;
}

export function worksheetHyperlinks(sheet: SheetModel, drawing?: SheetDrawing): WorksheetHyperlink[] {
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

export function worksheetHyperlinksXml(links: WorksheetHyperlink[]): string {
  return links.length
    ? `<hyperlinks>${links.map((link) => (
      link.link.kind === "internal"
        ? `<hyperlink ref="${link.ref}" location="${xml(link.link.target)}"/>`
        : `<hyperlink ref="${link.ref}" r:id="${link.relationshipId}"/>`
    )).join("")}</hyperlinks>`
    : "";
}

export function worksheetHyperlinkRelsXml(links: WorksheetHyperlink[]): string {
  return links
    .filter((link) => link.link.kind === "external")
    .map((link) => `<Relationship Id="${link.relationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${xml(link.link.target)}" TargetMode="External"/>`)
    .join("");
}
