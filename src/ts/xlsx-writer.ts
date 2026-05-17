import { createZip, type ZipFileEntry } from "./zip-io.ts";
import type { CellStyleRole, Md2XlsxImageAsset, RowModel, SheetModel, WorkbookModel } from "./types.ts";

interface EmbeddedImage {
  alt: string;
  path: string;
  rowIndex: number;
  asset: Md2XlsxImageAsset;
  mediaPath: string;
  relationshipId: string;
}

interface SheetDrawing {
  sheetIndex: number;
  drawingIndex: number;
  relationshipId: string;
  images: EmbeddedImage[];
}

function xml(value: string): string {
  return sanitizeXmlText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function sanitizeXmlText(value: string): string {
  return value.replace(/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD]/g, "");
}

function inlineTextXml(value: string): string {
  const sanitized = sanitizeXmlText(value);
  const preserve = sanitized.length === 0 || /^\s|\s$/.test(sanitized) || /[\n\r\t]/.test(sanitized);
  const attribute = preserve ? ` xml:space="preserve"` : "";
  return `<t${attribute}>${xml(sanitized)}</t>`;
}

function columnName(index: number): string {
  let value = index + 1;
  let name = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

function mediaExtension(asset: Md2XlsxImageAsset): string {
  const fromPath = asset.path.match(/\.([a-z0-9]+)(?:[?#].*)?$/i)?.[1]?.toLowerCase();
  if (fromPath === "jpg" || fromPath === "jpeg" || fromPath === "png" || fromPath === "gif") {
    return fromPath;
  }
  switch (asset.contentType) {
    case "image/jpeg":
      return "jpg";
    case "image/gif":
      return "gif";
    default:
      return "png";
  }
}

function styleIndex(role: CellStyleRole | undefined): number {
  switch (role) {
    case "title":
      return 1;
    case "heading":
      return 2;
    case "tableHeader":
      return 3;
    case "code":
      return 4;
    case "separator":
      return 5;
    case "tableCell":
      return 6;
    default:
      return 0;
  }
}

function mediaContentType(extension: string): string {
  switch (extension) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    default:
      return "image/png";
  }
}

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

function stylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="5">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="14"/><name val="Calibri"/></font>
<font><b/><sz val="12"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><name val="Calibri"/></font>
<font><sz val="11"/><name val="Consolas"/></font>
</fonts>
<fills count="4">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE8F0FE"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF2F2F2"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="3">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color rgb="FFD9D9D9"/></left><right style="thin"><color rgb="FFD9D9D9"/></right><top style="thin"><color rgb="FFD9D9D9"/></top><bottom style="thin"><color rgb="FFD9D9D9"/></bottom><diagonal/></border>
<border><left/><right/><top style="thin"><color rgb="FF808080"/></top><bottom/><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="7">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="4" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="2" xfId="0" applyBorder="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

function worksheetXml(sheet: SheetModel, drawing?: SheetDrawing): string {
  const maxColumns = Math.max(...sheet.rows.map((row) => row.cells.length), 1);
  const dimension = `A1:${columnName(maxColumns - 1)}${Math.max(sheet.rows.length, 1)}`;
  const columns = (sheet.columnHints ?? []).map((width, index) => (
    `<col min="${index + 1}" max="${index + 1}" width="${Math.max(width, 10)}" customWidth="1"/>`
  )).join("");
  const rows = sheet.rows.map((row, rowIndex) => {
    const cells = row.cells.map((cell, cellIndex) => {
      const ref = `${columnName(cellIndex)}${rowIndex + 1}`;
      const style = styleIndex(cell.styleRole);
      return `<c r="${ref}" t="inlineStr" s="${style}"><is>${inlineTextXml(cell.value)}</is></c>`;
    }).join("");
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<dimension ref="${dimension}"/>
<sheetViews><sheetView workbookViewId="0"/></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${columns}</cols>
<sheetData>${rows}</sheetData>
${drawing ? `<drawing r:id="${drawing.relationshipId}"/>` : ""}
</worksheet>`;
}

function worksheetRelsXml(drawing: SheetDrawing): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="${drawing.relationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${drawing.drawingIndex}.xml"/>
</Relationships>`;
}

function drawingXml(drawing: SheetDrawing): string {
  const anchors = drawing.images.map((image, imageIndex) => {
    const row = image.rowIndex;
    const col = 1;
    return `<xdr:twoCellAnchor editAs="oneCell">
<xdr:from><xdr:col>${col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
<xdr:to><xdr:col>${col + 3}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row + 8}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
<xdr:pic>
<xdr:nvPicPr><xdr:cNvPr id="${imageIndex + 1}" name="${xml(image.alt || image.path)}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>
<xdr:blipFill><a:blip r:embed="${image.relationshipId}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>
<xdr:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr>
</xdr:pic>
<xdr:clientData/>
</xdr:twoCellAnchor>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
${anchors}
</xdr:wsDr>`;
}

function drawingRelsXml(drawing: SheetDrawing): string {
  const relationships = drawing.images.map((image) => (
    `<Relationship Id="${image.relationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${image.mediaPath}"/>`
  )).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${relationships}
</Relationships>`;
}

function imageAssetsByPath(workbook: WorkbookModel): Map<string, Md2XlsxImageAsset> {
  const assets = new Map<string, Md2XlsxImageAsset>();
  for (const asset of workbook.imageAssets ?? []) {
    assets.set(asset.path, asset);
  }
  return assets;
}

function collectSheetDrawings(workbook: WorkbookModel): SheetDrawing[] {
  const assets = imageAssetsByPath(workbook);
  const drawings: SheetDrawing[] = [];
  let drawingIndex = 1;
  let mediaIndex = 1;
  for (const [sheetOffset, sheet] of workbook.sheets.entries()) {
    const images: EmbeddedImage[] = [];
    for (const [rowIndex, row] of sheet.rows.entries()) {
      for (const ref of row.imageRefs ?? []) {
        const asset = assets.get(ref.path);
        if (!asset) {
          continue;
        }
        const extension = mediaExtension(asset);
        images.push({
          alt: ref.alt,
          path: ref.path,
          rowIndex,
          asset,
          mediaPath: `image${mediaIndex}.${extension}`,
          relationshipId: `rId${images.length + 1}`
        });
        mediaIndex += 1;
      }
    }
    if (images.length) {
      drawings.push({
        sheetIndex: sheetOffset + 1,
        drawingIndex,
        relationshipId: "rId1",
        images
      });
      drawingIndex += 1;
    }
  }
  return drawings;
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
  const drawings = collectSheetDrawings(workbook);
  const drawingsBySheet = new Map(drawings.map((drawing) => [drawing.sheetIndex, drawing]));
  const entries: ZipFileEntry[] = [
    { path: "[Content_Types].xml", data: contentTypes(workbook.sheets.length, drawings) },
    { path: "_rels/.rels", data: rootRels() },
    { path: "xl/workbook.xml", data: workbookXml(workbook.sheets) },
    { path: "xl/_rels/workbook.xml.rels", data: workbookRels(workbook.sheets.length) },
    { path: "xl/styles.xml", data: stylesXml() },
    { path: "docProps/core.xml", data: coreProps() },
    { path: "docProps/app.xml", data: appProps(workbook.sheets.length) },
    ...workbook.sheets.map((sheet, index) => ({
      path: `xl/worksheets/sheet${index + 1}.xml`,
      data: worksheetXml(sheet, drawingsBySheet.get(index + 1))
    })),
    ...drawings.map((drawing) => ({
      path: `xl/worksheets/_rels/sheet${drawing.sheetIndex}.xml.rels`,
      data: worksheetRelsXml(drawing)
    })),
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
