import {
  getZipTextEntry,
  readZipPackage,
  type ZipEntry,
  type ZipEntryInput
} from "../vendor/miku-ms-office-core-0.5.1.mjs";

interface TemplateSheet {
  name: string;
  path: string;
  xml: string;
}

export interface XlsxTemplateParts {
  entries: ZipEntry[];
  sheets: TemplateSheet[];
  stylesXml?: string;
  themeEntries: ZipEntryInput[];
}

export function readXlsxTemplateParts(templateXlsx: Uint8Array | undefined): XlsxTemplateParts | undefined {
  if (!templateXlsx) {
    return undefined;
  }

  const result = readZipPackage(templateXlsx);
  const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  if (errors.length > 0) {
    throw new Error(`Template XLSX is not a readable ZIP package: ${errors.map((diagnostic) => diagnostic.message).join("; ")}`);
  }

  const workbookXml = getZipTextEntry(result.entries, "xl/workbook.xml");
  const workbookRelsXml = getZipTextEntry(result.entries, "xl/_rels/workbook.xml.rels");
  if (!workbookXml || !workbookRelsXml) {
    throw new Error("Template XLSX does not contain required workbook parts.");
  }

  const relTargets = parseRelationships(workbookRelsXml);
  const sheets = Array.from(workbookXml.matchAll(/<sheet\b([^>]*)\/?>/g), (match, index) => {
    const attributes = parseAttributes(match[1] ?? "");
    const relId = attributes.get("r:id") ?? "";
    const path = normalizePackagePath("xl/workbook.xml", relTargets.get(relId) ?? `worksheets/sheet${index + 1}.xml`);
    const xml = getZipTextEntry(result.entries, path) ?? "";
    return {
      name: attributes.get("name") ?? `Sheet${index + 1}`,
      path,
      xml
    };
  }).filter((sheet) => sheet.xml);

  return {
    entries: result.entries,
    sheets,
    stylesXml: getZipTextEntry(result.entries, "xl/styles.xml"),
    themeEntries: result.entries
      .filter((entry) => entry.path === "xl/theme/theme1.xml")
      .map((entry) => ({ path: "xl/theme/theme1.xml", data: entry.data }))
  };
}

export function templateGeneratedWorksheetXml(template: XlsxTemplateParts | undefined, generatedXml: string, sheetIndex: number): string {
  const baseXml = selectTemplateSheet(template, sheetIndex)?.xml;
  if (!baseXml) {
    return generatedXml;
  }

  const generatedDimension = extractSelfClosing(generatedXml, "dimension");
  const generatedSheetData = mergeGeneratedSheetDataStyles(extractBlock(generatedXml, "sheetData") ?? "<sheetData/>", baseXml);
  const generatedMergeCells = extractBlock(generatedXml, "mergeCells") ?? "";
  const generatedHyperlinks = extractBlock(generatedXml, "hyperlinks") ?? "";
  const generatedDrawing = extractSelfClosing(generatedXml, "drawing") ?? "";
  const sheetViews = normalizeSheetViews(extractBlock(baseXml, "sheetViews") ?? extractBlock(generatedXml, "sheetViews") ?? "");
  const sheetFormat = extractSelfClosing(baseXml, "sheetFormatPr") ?? extractSelfClosing(generatedXml, "sheetFormatPr") ?? "";
  const cols = extractBlock(baseXml, "cols") ?? extractBlock(generatedXml, "cols") ?? "";
  const pageMargins = extractSelfClosing(baseXml, "pageMargins") ?? "";
  const worksheetStartTag = mergedWorksheetStartTag(baseXml, generatedXml);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
${worksheetStartTag}
${generatedDimension ?? ""}
${sheetViews}
${sheetFormat}
${cols}
${generatedSheetData}
${generatedMergeCells}
${generatedHyperlinks}
${pageMargins}
${generatedDrawing}
</worksheet>`;
}

export function shouldCopyTemplateEntry(path: string): boolean {
  return path === "xl/theme/theme1.xml";
}

export function hasTemplateTheme(template: XlsxTemplateParts | undefined): boolean {
  return Boolean(template?.themeEntries.length);
}

function selectTemplateSheet(template: XlsxTemplateParts | undefined, sheetIndex: number): TemplateSheet | undefined {
  if (!template || template.sheets.length === 0) {
    return undefined;
  }
  return template.sheets[Math.min(sheetIndex - 1, template.sheets.length - 1)];
}

function parseRelationships(xml: string): Map<string, string> {
  const relationships = new Map<string, string>();
  for (const match of xml.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const attributes = parseAttributes(match[1] ?? "");
    const id = attributes.get("Id");
    const target = attributes.get("Target");
    if (id && target) {
      relationships.set(id, target);
    }
  }
  return relationships;
}

function parseAttributes(xml: string): Map<string, string> {
  return new Map(Array.from(xml.matchAll(/\b([A-Za-z_:][\w:.-]*)="([^"]*)"/g), (match) => [match[1], decodeXml(match[2])]));
}

function decodeXml(value: string): string {
  return value
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function normalizePackagePath(sourcePath: string, targetPath: string): string {
  const sourceDir = sourcePath.split("/").slice(0, -1);
  const parts = targetPath.startsWith("/") ? [] : [...sourceDir];
  for (const part of targetPath.split("/")) {
    if (!part || part === ".") {
      continue;
    }
    if (part === "..") {
      parts.pop();
    } else {
      parts.push(part);
    }
  }
  return parts.join("/");
}

function extractBlock(xml: string, localName: string): string | undefined {
  return xml.match(new RegExp(`<${localName}\\b[\\s\\S]*?<\\/${localName}>`))?.[0];
}

function extractSelfClosing(xml: string, localName: string): string | undefined {
  return xml.match(new RegExp(`<${localName}\\b[^>]*/>`))?.[0];
}

function mergedWorksheetStartTag(baseXml: string, generatedXml: string): string {
  const fallback = '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">';
  const baseTag = baseXml.match(/<worksheet\b[^>]*>/)?.[0];
  const generatedTag = generatedXml.match(/<worksheet\b[^>]*>/)?.[0];
  if (!baseTag) {
    return generatedTag ?? fallback;
  }
  if (!generatedTag) {
    return baseTag;
  }

  const declaredNamespaces = new Set(Array.from(baseTag.matchAll(/\s(xmlns(?::[A-Za-z_][\w.-]*)?)="[^"]*"/g), (match) => match[1]));
  const missingNamespaces = Array.from(generatedTag.matchAll(/\s(xmlns(?::[A-Za-z_][\w.-]*)?)="[^"]*"/g))
    .filter((match) => !declaredNamespaces.has(match[1]))
    .map((match) => match[0])
    .join("");
  return missingNamespaces ? baseTag.replace(/>$/, `${missingNamespaces}>`) : baseTag;
}

function mergeGeneratedSheetDataStyles(generatedSheetData: string, templateWorksheetXml: string): string {
  const templateStyles = new Map<string, string>();
  const templateSheetData = extractBlock(templateWorksheetXml, "sheetData") ?? "";
  for (const match of templateSheetData.matchAll(/<c\b([^>]*)>/g)) {
    const attributes = parseAttributes(match[1] ?? "");
    const ref = attributes.get("r");
    const style = attributes.get("s");
    if (ref && style) {
      templateStyles.set(ref, style);
    }
  }
  return generatedSheetData.replace(/<c\b([^>]*)>/g, (full, attributesXml) => {
    const attributes = parseAttributes(attributesXml);
    const ref = attributes.get("r");
    const style = ref ? templateStyles.get(ref) ?? "0" : "0";
    if (/\bs="/.test(full)) {
      return full.replace(/\bs="[^"]*"/, `s="${style}"`);
    }
    return full.replace("<c", `<c s="${style}"`);
  });
}

function normalizeSheetViews(sheetViewsXml: string): string {
  return sheetViewsXml
    .replace(/\s*xr[0-9]*:uid="[^"]*"/g, "")
    .replace(/\s*activeCell="[^"]*"/g, "")
    .replace(/\s*sqref="[^"]*"/g, "");
}
