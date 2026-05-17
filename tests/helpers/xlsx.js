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

export function readWorksheetValues(entries, sheetIndex = 1) {
  const worksheetXml = entries.get(`xl/worksheets/sheet${sheetIndex}.xml`) ?? "";
  return Array.from(worksheetXml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g), (rowMatch) => (
    Array.from(rowMatch[1].matchAll(/<c\b[^>]*>([\s\S]*?)<\/c>/g), (cellMatch) => {
      const textParts = Array.from(cellMatch[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g), (textMatch) => decodeXml(textMatch[1]));
      return textParts.join("");
    })
  ));
}
