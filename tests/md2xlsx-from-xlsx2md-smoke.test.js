import { describe, expect, it } from "vitest";
import { md2xlsx, markdownToXlsxModel } from "../dist/core.js";
import { readSheetNames, readWorkbookXmlEntries, readWorksheetValues } from "./helpers/xlsx.js";
import { allGeneratedFixtureMarkdown, flatten, readFixture } from "./helpers/from-xlsx2md.js";

describe("miku-xlsx2md generated Markdown fixture smoke", () => {
  it.each(allGeneratedFixtureMarkdown)("converts generated fixture Markdown: %s", async (fixtureName) => {
    const markdown = await readFixture(fixtureName);
    const xlsx = md2xlsx(markdown);
    const entries = readWorkbookXmlEntries(xlsx);
    const values = flatten(readWorksheetValues(entries));
    const expectedBookName = fixtureName.split("/").at(-1).replace(/\.md$/, ".xlsx");

    expect(readSheetNames(entries)).toEqual(["Sheet1"]);
    expect(values).toContain(`Book: ${expectedBookName}`);
  });

  it("converts the basic xlsx2md fixture Markdown without losing representative table values", async () => {
    const markdown = await readFixture("xlsx2md-basic-sample01.md");
    const xlsx = md2xlsx(markdown);
    const entries = readWorkbookXmlEntries(xlsx);
    const values = flatten(readWorksheetValues(entries));

    expect(readSheetNames(entries)).toEqual(["Sheet1"]);
    expect(values).toContain("Book: xlsx2md-basic-sample01.xlsx");
    expect(values).toContain("Table: 001 (B12-F16)");
    expect(values).toContain("項番");
    expect(values).toContain("登録日");
    expect(values).toContain("何かの登録日");
  });

  it("can split xlsx2md generated Markdown by sheet headings without creating a separate book sheet", async () => {
    const markdown = await readFixture("xlsx2md-basic-sample01.md");
    const model = markdownToXlsxModel(markdown, { sheetMode: "heading", sheetHeadingDepth: 2 });

    expect(model.sheets.map((sheet) => sheet.name)).toEqual(["Sheet xlsx2md-basic"]);
    expect(model.sheets[0].rows.some((row) => row.cells[0]?.value === "Book: xlsx2md-basic-sample01.xlsx")).toBe(true);
    expect(model.sheets[0].rows.some((row) => row.cells[0]?.value === "Sheet: xlsx2md-basic")).toBe(true);
  });

  it("restores exact sheet names and table coordinates with the xlsx2md dialect", async () => {
    const markdown = await readFixture("xlsx2md-basic-sample01.md");
    const model = markdownToXlsxModel(markdown, { inputDialect: "miku-xlsx2md" });

    expect(model.sheets.map((sheet) => sheet.name)).toEqual(["xlsx2md-basic"]);
    expect(model.sheets[0].rows[11].cells[1].value).toBe("項番");
    expect(model.sheets[0].rows[15].cells[6]?.value).toBeUndefined();
    expect(model.sheets[0].rows.flatMap((row) => row.cells.map((cell) => cell.value))).not.toContain("Table: 001 (B12-F16)");
  });

  it("keeps adjacent table sections from the xlsx2md table fixture visible", async () => {
    const markdown = await readFixture("table-basic-sample01.md");
    const model = markdownToXlsxModel(markdown);
    const values = flatten(model.sheets[0].rows.map((row) => row.cells.map((cell) => cell.value)));

    expect(values).toContain("隣接するテーブルその1");
    expect(values).toContain("Table: 001 (B3-F7)");
    expect(values).toContain("隣接するテーブルその2");
    expect(values).toContain("Table: 002 (B9-F13)");
    expect(values).toContain("Hanako");
  });
});
