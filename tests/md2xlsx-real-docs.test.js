import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { markdownToXlsxModel, md2xlsx } from "../dist/core.js";
import { readSheetNames, readWorkbookXmlEntries, readWorksheetValues } from "./helpers/xlsx.js";

function flatten(values) {
  return values.flat().join("\n");
}

describe("repository Markdown document coverage", () => {
  it("converts README Markdown into a workbook without dropping representative sections", async () => {
    const markdown = await readFile("README.md", "utf8");
    const xlsx = md2xlsx(markdown, { sheetMode: "heading" });
    const entries = readWorkbookXmlEntries(xlsx);
    const values = flatten(readWorksheetValues(entries));

    expect(readSheetNames(entries)).toEqual(["miku-md2xlsx"]);
    expect(values).toContain("Quick Start");
    expect(values).toContain("What It Converts");
    expect(values).toContain("CLI Options");
    expect(values).toContain("npm run cli -- ./sample.md --out ./sample.xlsx");
  });

  it("converts the handoff document with second-level sheet splitting", async () => {
    const markdown = await readFile("docs/handoff-from-xlsx2md.md", "utf8");
    const xlsx = md2xlsx(markdown, { sheetMode: "heading", sheetHeadingDepth: 2 });
    const entries = readWorkbookXmlEntries(xlsx);
    const sheetNames = readSheetNames(entries);
    const implementationSheetIndex = sheetNames.indexOf("現在の実装状況") + 1;
    const prefaceValues = flatten(readWorksheetValues(entries));
    const implementationValues = flatten(readWorksheetValues(entries, implementationSheetIndex));

    expect(sheetNames).toContain("位置づけ");
    expect(implementationSheetIndex).toBeGreaterThan(0);
    expect(prefaceValues).toContain("miku-md2xlsx 申し送り");
    expect(implementationValues).toContain("Markdown parser は remark-parse + remark-gfm を使用。");
  });

  it("keeps hand-written specification Markdown blocks visible", async () => {
    const markdown = await readFile("tests/fixtures/real-markdown/spec-mixed-blocks.md", "utf8");
    const model = markdownToXlsxModel(markdown, { sheetMode: "heading", sheetHeadingDepth: 2 });
    const sheetValues = model.sheets.map((sheet) => flatten(sheet.rows.map((row) => row.cells.map((cell) => cell.value))));
    const values = sheetValues.join("\n");
    const operationRows = model.sheets[0].rows.map((row) => row.cells.map((cell) => cell.value));
    const operationValues = sheetValues[0];
    const dataValues = sheetValues[1];

    expect(model.sheets.map((sheet) => sheet.name)).toEqual(["操作手順", "データ項目"]);
    expect(values).toContain("本文の導入です。<kbd>Ctrl</kbd> + <kbd>S</kbd> で保存します。");
    expect(values).toContain("> 重要: この仕様は暫定です。\n> 利用者レビュー後に確定します。");
    expect(values).toContain("<div class=\"note\">HTML block note</div>");
    expect(operationRows).toContainEqual(["", "- 添付ファイルを確認する"]);
    expect(operationRows).toContainEqual(["", "", "1. PDF を確認する"]);
    expect(operationValues).toContain("export function approve(requestId: string): string");
    expect(dataValues).toContain("この段落は 1 つ目の表の前に残す。");
    expect(dataValues).toContain("requestId\nstring\n申請ID");
    expect(dataValues).toContain("この段落は表と表の間に残す。");
    expect(dataValues).toContain("approved\n承認済み");
    expect(dataValues).toContain("最後の補足です。");
  });
});
