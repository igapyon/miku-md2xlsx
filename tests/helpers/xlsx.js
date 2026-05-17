import { unzipStoredEntries } from "./zip.js";

function decodeXml(value) {
  return value
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}

export function readWorkbookXmlEntries(xlsxBytes) {
  return unzipStoredEntries(xlsxBytes);
}

export function readSheetNames(entries) {
  const workbookXml = entries.get("xl/workbook.xml") ?? "";
  return Array.from(workbookXml.matchAll(/<sheet\b[^>]*\bname="([^"]*)"/g), (match) => decodeXml(match[1]));
}

export function readContentTypeDefaults(entries) {
  const contentTypesXml = entries.get("[Content_Types].xml") ?? "";
  return Array.from(contentTypesXml.matchAll(/<Default\b([^>]*)\/>/g), (match) => readXmlAttributes(match[1]));
}

export function readRelationships(entries, path) {
  const relsXml = entries.get(path) ?? "";
  return Array.from(relsXml.matchAll(/<Relationship\b([^>]*)\/>/g), (match) => readXmlAttributes(match[1]));
}

export function readWorksheetDrawingRelId(entries, sheetIndex = 1) {
  const worksheetXml = entries.get(`xl/worksheets/sheet${sheetIndex}.xml`) ?? "";
  return worksheetXml.match(/<drawing\b[^>]*\br:id="([^"]+)"/)?.[1];
}

export function readWorksheetValues(entries, sheetIndex = 1) {
  const worksheetXml = entries.get(`xl/worksheets/sheet${sheetIndex}.xml`) ?? "";
  return Array.from(worksheetXml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g), (rowMatch) => (
    Array.from(rowMatch[1].matchAll(/<c\b[^>]*>([\s\S]*?)<\/c>/g), (cellMatch) => {
      const textParts = Array.from(cellMatch[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g), (textMatch) => decodeXml(textMatch[1]));
      return textParts.join("");
    })
  ));
}

export function readDrawingAnchors(entries, drawingIndex = 1) {
  const drawingXml = entries.get(`xl/drawings/drawing${drawingIndex}.xml`) ?? "";
  return Array.from(drawingXml.matchAll(/<xdr:twoCellAnchor[\s\S]*?<xdr:from>([\s\S]*?)<\/xdr:from>[\s\S]*?<xdr:to>([\s\S]*?)<\/xdr:to>[\s\S]*?<a:blip\b[^>]*\br:embed="([^"]+)"/g), (match) => ({
    from: readDrawingMarker(match[1]),
    to: readDrawingMarker(match[2]),
    embedRelId: match[3]
  }));
}

function readDrawingMarker(xml) {
  return {
    col: Number(xml.match(/<xdr:col>(\d+)<\/xdr:col>/)?.[1] ?? 0),
    row: Number(xml.match(/<xdr:row>(\d+)<\/xdr:row>/)?.[1] ?? 0)
  };
}

function readXmlAttributes(attributesXml) {
  return Object.fromEntries(Array.from(attributesXml.matchAll(/\b([A-Za-z_:][\w:.-]*)="([^"]*)"/g), (match) => [
    match[1],
    decodeXml(match[2])
  ]));
}
