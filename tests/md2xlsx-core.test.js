import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { md2xlsx, markdownToXlsxModel } from "../dist/core.js";
import { unzipStoredEntries } from "./helpers/zip.js";

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

    expect(model.sheets[0].rows[1].cells.map((cell) => cell.value)).toEqual(["x", "", "line1<br>line2"]);
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
});
