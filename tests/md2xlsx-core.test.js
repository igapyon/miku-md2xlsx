import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { md2xlsx, markdownToXlsxModel } from "../dist/core.js";
import { writeZipPackage } from "../src/vendor/miku-ms-office-core-0.6.0.mjs";
import { unzipStoredBinaryEntries, unzipStoredEntries } from "./helpers/zip.js";
import { readSheetNames, readWorkbookXmlEntries, readWorksheetCells, readWorksheetMergeRefs } from "./helpers/xlsx.js";

describe("miku-md2xlsx core", () => {
  it("converts a Markdown table into workbook model rows", () => {
    const model = markdownToXlsxModel("| A | B |\n| --- | --- |\n| 1 | 2 |\n");

    expect(model.sheets).toHaveLength(1);
    expect(model.sheets[0].rows[0].cells.map((cell) => cell.value)).toEqual(["A", "B"]);
    expect(model.sheets[0].rows[1].cells.map((cell) => cell.value)).toEqual(["1", "2"]);
    expect(model.sheets[0].rows[0].cells[0].styleRole).toBe("tableHeader");
  });

  it("keeps escaped pipe sequences inside table cells", () => {
    const model = markdownToXlsxModel(String.raw`| A | B |
| --- | --- |
| a \\| b | c \\| d |
`);

    expect(model.sheets[0].rows[1].cells.map((cell) => cell.value)).toEqual(["a \\| b", "c \\| d"]);
  });

  it("keeps empty and multiline-like table cell content", () => {
    const model = markdownToXlsxModel("| A | Empty | Multi |\n| --- | --- | --- |\n| x | | line1<br>line2 |\n");

    expect(model.sheets[0].rows[1].cells.map((cell) => cell.value)).toEqual(["x", "", "line1\nline2"]);
  });

  it("converts common inline Markdown styles into rich text runs", () => {
    const model = markdownToXlsxModel("plain **bold** *italic* ~~strike~~ <ins>under</ins> line1<br>line2\n");
    const cell = model.sheets[0].rows[0].cells[0];

    expect(cell.value).toBe("plain bold italic strike under line1\nline2");
    expect(cell.richTextRuns).toEqual([
      { text: "plain " },
      { text: "bold", bold: true },
      { text: " " },
      { text: "italic", italic: true },
      { text: " " },
      { text: "strike", strike: true },
      { text: " " },
      { text: "under", underline: true },
      { text: " line1\nline2" }
    ]);
  });

  it("writes numeric-looking Markdown table cells as inline strings", () => {
    const xlsx = md2xlsx("| code | date | percent | amount |\n| --- | --- | --- | --- |\n| 0010 | 2026-05-18 | 98.7% | ¥1,024 |\n");
    const entries = readWorkbookXmlEntries(xlsx);
    const cells = readWorksheetCells(entries);

    expect(cells.filter((cell) => ["0010", "2026-05-18", "98.7%", "¥1,024"].includes(cell.text))).toEqual([
      { attributes: expect.objectContaining({ t: "inlineStr" }), text: "0010" },
      { attributes: expect.objectContaining({ t: "inlineStr" }), text: "2026-05-18" },
      { attributes: expect.objectContaining({ t: "inlineStr" }), text: "98.7%" },
      { attributes: expect.objectContaining({ t: "inlineStr" }), text: "¥1,024" }
    ]);
  });

  it("preserves supplementary Unicode characters in worksheet text", () => {
    const xlsx = md2xlsx("| kind | value |\n| --- | --- |\n| Unicode | 😀 🐇 𠮷野家 |\n");
    const entries = readWorkbookXmlEntries(xlsx);
    const cells = readWorksheetCells(entries);

    expect(cells.some((cell) => cell.text === "😀 🐇 𠮷野家")).toBe(true);
  });

  it("keeps only XML 1.0 character ranges in worksheet text", () => {
    const validBoundaries = "\uD7FF\uE000\uFFFD\u{10000}\u{10FFFF}";
    const invalidCharacters = "before\uD800middle\uDC00\uFFFE\uFFFFafter";
    const xlsx = md2xlsx(
      `| kind | value |\n| --- | --- |\n| Valid | ${validBoundaries} |\n| Invalid | ${invalidCharacters} |\n`
    );
    const cells = readWorksheetCells(readWorkbookXmlEntries(xlsx));

    expect(cells.some((cell) => cell.text === validBoundaries)).toBe(true);
    expect(cells.some((cell) => cell.text === "beforemiddleafter")).toBe(true);
  });

  it("uses wider column hints for text-heavy block rows", () => {
    const model = markdownToXlsxModel("# Title\n\nshort\n\n- item\n\n```text\ncode\n```\n");

    expect(model.sheets[0].columnHints?.[0]).toBeGreaterThanOrEqual(32);
  });

  it("places nested list items in deeper columns", () => {
    const model = markdownToXlsxModel("- parent\n  - child\n    - grandchild\n");

    expect(model.sheets[0].rows.map((row) => row.cells.map((cell) => cell.value))).toEqual([
      ["- parent"],
      ["", "- child"],
      ["", "", "- grandchild"]
    ]);
  });

  it("assigns heading styles by Markdown heading depth", () => {
    const model = markdownToXlsxModel("# H1\n\n## H2\n\n### H3\n\n#### H4\n\n##### H5\n\n###### H6\n");

    expect(model.sheets[0].rows.map((row) => row.cells[0].styleRole)).toEqual([
      "heading1",
      "heading2",
      "heading3",
      "heading4",
      "heading5",
      "heading6"
    ]);
  });

  it("splits sheets by top-level headings", () => {
    const model = markdownToXlsxModel("# Alpha\n\ntext\n\n## Beta\n\nmore\n", { sheetMode: "heading" });

    expect(model.sheets.map((sheet) => sheet.name)).toEqual(["Alpha"]);
    expect(model.sheets[0].rows.some((row) => row.cells[0]?.value === "text")).toBe(true);
    expect(model.sheets[0].rows.some((row) => row.cells[0]?.value === "Beta")).toBe(true);
    expect(model.sheets[0].rows.some((row) => row.cells[0]?.value === "more")).toBe(true);
  });

  it("can split sheets by second-level headings while preserving preface rows", () => {
    const model = markdownToXlsxModel("# Book\n\nintro\n\n## Alpha\n\ntext\n\n## Beta\n\nmore\n", {
      sheetMode: "heading",
      sheetHeadingDepth: 2
    });

    expect(model.sheets.map((sheet) => sheet.name)).toEqual(["Alpha", "Beta"]);
    expect(model.sheets[0].rows.some((row) => row.cells[0]?.value === "Book")).toBe(true);
    expect(model.sheets[0].rows.some((row) => row.cells[0]?.value === "intro")).toBe(true);
    expect(model.sheets[1].rows.some((row) => row.cells[0]?.value === "more")).toBe(true);
  });

  it("restores xlsx2md sheet names and anchored table structure", () => {
    const markdown = `# Book: sample.xlsx

## Sheet: Alpha

intro

### Table: 001 (B3-D5)

| A | B | C |
| --- | --- | --- |
| one | merged | [←M←] |
| two | [↑M↑] | [↑M↑] |

## Sheet: 日本語

### Table: 001 (A1-B2)

| 項目 | 値 |
| --- | --- |
| 名前 | みく |
`;
    const model = markdownToXlsxModel(markdown, { inputDialect: "miku-xlsx2md" });
    const xlsx = md2xlsx(markdown, { inputDialect: "miku-xlsx2md" });
    const entries = readWorkbookXmlEntries(xlsx);

    expect(model.sheets.map((sheet) => sheet.name)).toEqual(["Alpha", "日本語"]);
    expect(model.sheets[0].rows[2].cells[1].value).toBe("A");
    expect(model.sheets[0].rows[4].cells[3].value).toBe("[↑M↑]");
    expect(model.sheets.flatMap((sheet) => sheet.rows.flatMap((row) => row.cells.map((cell) => cell.value)))).not.toContain("Book: sample.xlsx");
    expect(readSheetNames(entries)).toEqual(["Alpha", "日本語"]);
    expect(readWorksheetMergeRefs(entries, 1)).toEqual(["C4:D5"]);
    expect(entries.get("xl/worksheets/sheet1.xml")).toContain('<dimension ref="A1:D5"/>');
    expect(entries.get("xl/worksheets/sheet2.xml")).toContain('<dimension ref="A1:B2"/>');
  });

  it("rejects malformed xlsx2md dialect markers instead of guessing", () => {
    expect(() => markdownToXlsxModel("## Sheet:\n\ntext\n", {
      inputDialect: "miku-xlsx2md"
    })).toThrow("Expected: ## Sheet: <name>");
    expect(() => markdownToXlsxModel("## Sheet: Alpha\n\n### Table: 1 A1-B2\n", {
      inputDialect: "miku-xlsx2md"
    })).toThrow("Expected: ### Table: N (A1-C4)");
  });

  it("requires a table immediately after an xlsx2md Table marker", () => {
    expect(() => markdownToXlsxModel(`## Sheet: Alpha

### Table: 001 (A1-B2)

intervening paragraph

| A | B |
| --- | --- |
| 1 | 2 |
`, { inputDialect: "miku-xlsx2md" })).toThrow("must be followed immediately by a Markdown table");
  });

  it("writes an xlsx package with workbook and worksheet xml", async () => {
    const markdown = await readFile("tests/fixtures/smoke.md", "utf8");
    const xlsx = md2xlsx(markdown, { sheetMode: "heading" });
    const entries = unzipStoredEntries(xlsx);

    expect(entries.has("[Content_Types].xml")).toBe(true);
    expect(entries.has("xl/workbook.xml")).toBe(true);
    expect(entries.has("xl/worksheets/sheet1.xml")).toBe(true);
    expect(entries.get("xl/workbook.xml")).toContain("売上メモ");
    expect(entries.get("xl/worksheets/sheet1.xml")).toContain("りんご");
    expect(entries.get("xl/worksheets/sheet1.xml")).toContain("確認済み");
  });

  it("writes generated sheets over matching template sheets and reuses the rightmost template sheet when needed", () => {
    const templateEntries = Array.from(unzipStoredBinaryEntries(md2xlsx("# Template A\n\nTemplate-only A\n\n# Template B\n\nTemplate-only B", {
      sheetMode: "heading"
    })), ([path, data]) => {
      let text = new TextDecoder().decode(data);
      if (path === "xl/styles.xml") {
        text = text.replace(/Calibri/g, "TemplateFont");
      } else if (path === "xl/worksheets/sheet1.xml") {
        text = text
          .replace(/<worksheet\b/, '<worksheet xmlns:x14ac="http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac"')
          .replace(/<sheetFormatPr\b([^>]*)\/>/, '<sheetFormatPr$1 x14ac:dyDescent="0.2"/>')
          .replace(/<c r="A1"[^>]*>/, '<c r="A1" t="inlineStr" s="7">');
      } else if (path === "xl/worksheets/sheet2.xml") {
        text = text.replace(/<c r="A1"[^>]*>/, '<c r="A1" t="inlineStr" s="8">');
      } else {
        return { path, data };
      }
      return { path, data: new TextEncoder().encode(text) };
    });
    templateEntries.push({
      path: "xl/theme/theme1.xml",
      data: "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><a:theme xmlns:a=\"http://schemas.openxmlformats.org/drawingml/2006/main\" name=\"Template Theme\"/>"
    });
    const xlsx = md2xlsx("# Generated A\n\nGenerated body A\n\n# Generated B\n\nGenerated body B\n\n# Generated C\n\nGenerated body C", {
      sheetMode: "heading",
      templateXlsx: writeZipPackage(templateEntries)
    });
    const entries = unzipStoredEntries(xlsx);
    const sheet1Cells = readWorksheetCells(entries, 1);
    const sheet2Cells = readWorksheetCells(entries, 2);
    const sheet3Cells = readWorksheetCells(entries, 3);

    expect(entries.get("xl/styles.xml")).toContain("TemplateFont");
    expect(entries.get("xl/theme/theme1.xml")).toContain("Template Theme");
    expect(entries.get("xl/workbook.xml")).toContain("Generated A");
    expect(entries.get("xl/workbook.xml")).toContain("Generated B");
    expect(entries.get("xl/workbook.xml")).toContain("Generated C");
    expect(entries.get("xl/workbook.xml")).not.toContain("Template A");
    expect(entries.get("xl/worksheets/sheet1.xml")).toContain("Generated body A");
    expect(entries.get("xl/worksheets/sheet1.xml")).toContain('xmlns:x14ac="http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac"');
    expect(entries.get("xl/worksheets/sheet1.xml")).toContain('x14ac:dyDescent="0.2"');
    expect(entries.get("xl/worksheets/sheet2.xml")).toContain("Generated body B");
    expect(entries.get("xl/worksheets/sheet3.xml")).toContain("Generated body C");
    expect(entries.get("xl/worksheets/sheet1.xml")).not.toContain("Template-only A");
    expect(entries.get("xl/worksheets/sheet2.xml")).not.toContain("Template-only B");
    expect(sheet1Cells[0].attributes.s).toBe("7");
    expect(sheet2Cells[0].attributes.s).toBe("8");
    expect(sheet3Cells[0].attributes.s).toBe("8");
  });
});
