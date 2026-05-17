import { createZip, type ZipFileEntry } from "./zip-io.ts";
import type { SheetModel, WorkbookModel } from "./types.ts";
import {
  collectSheetDrawings,
  drawingRelsXml,
  drawingXml,
  mediaContentType,
  mediaExtension,
  type SheetDrawing,
  withReservedImagePreviewRows
} from "./xlsx-drawing.ts";
import { stylesXml } from "./xlsx-styles.ts";
import { hasWorksheetRelationships, worksheetRelsXml, worksheetXml } from "./xlsx-worksheet.ts";
import { xml } from "./xlsx-xml.ts";

function contentTypes(sheetCount: number, drawings: SheetDrawing[]): string {
  const sheets = Array.from({ length: sheetCount }, (_, index) => (
    `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  )).join("");
  const drawingOverrides = drawings.map((drawing) => (
    `<Override PartName="/xl/drawings/drawing${drawing.drawingIndex}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`
  )).join("");
  const imageDefaults = Array.from(new Set(drawings.flatMap((drawing) => drawing.images.map((image) => mediaExtension(image.asset)))))
    .map((extension) => `<Default Extension="${xml(extension)}" ContentType="${mediaContentType(extension)}"/>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
${imageDefaults}
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
${sheets}
${drawingOverrides}
</Types>`;
}

function rootRels(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;
}

function workbookXml(sheets: SheetModel[]): string {
  const sheetXml = sheets.map((sheet, index) => (
    `<sheet name="${xml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
  )).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${sheetXml}</sheets>
</workbook>`;
}

function workbookRels(sheetCount: number): string {
  const sheets = Array.from({ length: sheetCount }, (_, index) => (
    `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
  )).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheets}
<Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function coreProps(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:creator>miku-md2xlsx</dc:creator>
<cp:lastModifiedBy>miku-md2xlsx</cp:lastModifiedBy>
</cp:coreProperties>`;
}

function appProps(sheetCount: number): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
<Application>miku-md2xlsx</Application>
<DocSecurity>0</DocSecurity>
<ScaleCrop>false</ScaleCrop>
<HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>${sheetCount}</vt:i4></vt:variant></vt:vector></HeadingPairs>
</Properties>`;
}

export function writeXlsx(workbook: WorkbookModel): Uint8Array {
  const renderWorkbook = withReservedImagePreviewRows(workbook);
  const drawings = collectSheetDrawings(renderWorkbook);
  const drawingsBySheet = new Map(drawings.map((drawing) => [drawing.sheetIndex, drawing]));
  const entries: ZipFileEntry[] = [
    { path: "[Content_Types].xml", data: contentTypes(renderWorkbook.sheets.length, drawings) },
    { path: "_rels/.rels", data: rootRels() },
    { path: "xl/workbook.xml", data: workbookXml(renderWorkbook.sheets) },
    { path: "xl/_rels/workbook.xml.rels", data: workbookRels(renderWorkbook.sheets.length) },
    { path: "xl/styles.xml", data: stylesXml() },
    { path: "docProps/core.xml", data: coreProps() },
    { path: "docProps/app.xml", data: appProps(renderWorkbook.sheets.length) },
    ...renderWorkbook.sheets.map((sheet, index) => ({
      path: `xl/worksheets/sheet${index + 1}.xml`,
      data: worksheetXml(sheet, drawingsBySheet.get(index + 1))
    })),
    ...renderWorkbook.sheets.flatMap((sheet, index) => {
      const drawing = drawingsBySheet.get(index + 1);
      return hasWorksheetRelationships(sheet, drawing)
        ? [{
            path: `xl/worksheets/_rels/sheet${index + 1}.xml.rels`,
            data: worksheetRelsXml(sheet, drawing)
          }]
        : [];
    }),
    ...drawings.map((drawing) => ({
      path: `xl/drawings/drawing${drawing.drawingIndex}.xml`,
      data: drawingXml(drawing)
    })),
    ...drawings.map((drawing) => ({
      path: `xl/drawings/_rels/drawing${drawing.drawingIndex}.xml.rels`,
      data: drawingRelsXml(drawing)
    })),
    ...drawings.flatMap((drawing) => drawing.images.map((image) => ({
      path: `xl/media/${image.mediaPath}`,
      data: image.asset.data
    })))
  ];
  return createZip(entries);
}
