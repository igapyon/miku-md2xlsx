import {
  buildOpcContentTypesXml,
  buildOpcRelationshipsXml,
  writeZipPackage,
  type ZipEntryInput
} from "../vendor/miku-ms-office-core-0.5.1.mjs";
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
import {
  hasTemplateTheme,
  readXlsxTemplateParts,
  shouldCopyTemplateEntry,
  templateGeneratedWorksheetXml,
  type XlsxTemplateParts
} from "./xlsx-template.ts";
import { hasWorksheetRelationships, worksheetRelsXml, worksheetXml } from "./xlsx-worksheet.ts";
import { xml } from "./xlsx-xml.ts";

function contentTypes(sheetCount: number, drawings: SheetDrawing[], template?: XlsxTemplateParts): string {
  const imageExtensions = Array.from(new Set(drawings.flatMap((drawing) => drawing.images.map((image) => mediaExtension(image.asset)))));
  return buildOpcContentTypesXml({
    defaults: [
      {
        extension: "rels",
        contentType: "application/vnd.openxmlformats-package.relationships+xml"
      },
      { extension: "xml", contentType: "application/xml" },
      ...imageExtensions.map((extension) => ({
        extension,
        contentType: mediaContentType(extension)
      }))
    ],
    overrides: [
      {
        partName: "xl/workbook.xml",
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"
      },
      {
        partName: "xl/styles.xml",
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"
      },
      ...(hasTemplateTheme(template) ? [{
        partName: "xl/theme/theme1.xml",
        contentType: "application/vnd.openxmlformats-officedocument.theme+xml"
      }] : []),
      { partName: "docProps/core.xml", contentType: "application/vnd.openxmlformats-package.core-properties+xml" },
      { partName: "docProps/app.xml", contentType: "application/vnd.openxmlformats-officedocument.extended-properties+xml" },
      ...Array.from({ length: sheetCount }, (_unused, index) => ({
        partName: `xl/worksheets/sheet${index + 1}.xml`,
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"
      })),
      ...drawings.map((drawing) => ({
        partName: `xl/drawings/drawing${drawing.drawingIndex}.xml`,
        contentType: "application/vnd.openxmlformats-officedocument.drawing+xml"
      }))
    ]
  });
}

function rootRels(): string {
  return buildOpcRelationshipsXml([
    {
      id: "rId1",
      type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument",
      target: "xl/workbook.xml"
    },
    {
      id: "rId2",
      type: "http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties",
      target: "docProps/core.xml"
    },
    {
      id: "rId3",
      type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties",
      target: "docProps/app.xml"
    }
  ]);
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

function workbookRels(sheetCount: number, template?: XlsxTemplateParts): string {
  return buildOpcRelationshipsXml([
    ...Array.from({ length: sheetCount }, (_unused, index) => ({
      id: `rId${index + 1}`,
      type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet",
      target: `worksheets/sheet${index + 1}.xml`
    })),
    {
      id: `rId${sheetCount + 1}`,
      type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles",
      target: "styles.xml"
    },
    ...(hasTemplateTheme(template) ? [{
      id: `rId${sheetCount + 2}`,
      type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme",
      target: "theme/theme1.xml"
    }] : [])
  ]);
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
  const template = readXlsxTemplateParts(workbook.templateXlsx);
  const generatedWorksheetEntries = renderWorkbook.sheets.map((sheet, index) => ({
    path: `xl/worksheets/sheet${index + 1}.xml`,
    data: templateGeneratedWorksheetXml(template, worksheetXml(sheet, drawingsBySheet.get(index + 1)), index + 1)
  }));
  const entries: ZipEntryInput[] = [
    ...(template?.entries.filter((entry) => shouldCopyTemplateEntry(entry.path)).map((entry) => ({ path: entry.path, data: entry.data })) ?? []),
    { path: "[Content_Types].xml", data: contentTypes(renderWorkbook.sheets.length, drawings, template) },
    { path: "_rels/.rels", data: rootRels() },
    { path: "xl/workbook.xml", data: workbookXml(renderWorkbook.sheets) },
    { path: "xl/_rels/workbook.xml.rels", data: workbookRels(renderWorkbook.sheets.length, template) },
    { path: "xl/styles.xml", data: template?.stylesXml ?? stylesXml() },
    { path: "docProps/core.xml", data: coreProps() },
    { path: "docProps/app.xml", data: appProps(renderWorkbook.sheets.length) },
    ...generatedWorksheetEntries,
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
  return writeZipPackage(entries);
}
