import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { md2xlsx } from "../dist/core.js";
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
    expect(values).toContain("What It Converts");
    expect(values).toContain("CLI Use");
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
});
