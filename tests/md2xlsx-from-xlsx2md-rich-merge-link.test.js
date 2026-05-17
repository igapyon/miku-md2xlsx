import { describe, expect, it } from "vitest";
import { md2xlsx, markdownToXlsxModel } from "../dist/core.js";
import { readRelationships, readWorkbookXmlEntries, readWorksheetHyperlinks, readWorksheetMergeRefs, readWorksheetValues } from "./helpers/xlsx.js";
import { flatten, readFixture } from "./helpers/from-xlsx2md.js";

describe("miku-xlsx2md generated Markdown rich text, links, and merges", () => {
  it("preserves hyperlink Markdown from xlsx2md generated documents", async () => {
    const markdown = await readFixture("hyperlink-basic-sample01.md");
    const model = markdownToXlsxModel(markdown);
    const rows = model.sheets[0].rows.map((row) => row.cells.map((cell) => cell.value));
    const values = flatten(rows);

    expect(values).toContain("Open example");
    expect(values).toContain("Jump to Other");
    expect(rows).toContainEqual(["External", "Open example"]);
    expect(rows).toContainEqual(["Internal", "Jump to Other"]);
    expect(model.sheets[0].rows[2].cells[0].hyperlink).toEqual({ target: "https://example.com/", kind: "external" });
    expect(model.sheets[0].rows[3].cells[0].hyperlink).toEqual({ target: "Other!A1", kind: "internal" });
    expect(model.sheets[0].rows[7].cells[1].hyperlink).toEqual({ target: "https://example.com/docs", kind: "external" });
    expect(model.sheets[0].rows[8].cells[1].hyperlink).toEqual({ target: "Other!A1", kind: "internal" });
  });

  it("writes xlsx hyperlinks for xlsx2md generated hyperlink Markdown", async () => {
    const markdown = await readFixture("hyperlink-basic-sample01.md");
    const xlsx = md2xlsx(markdown, { sheetMode: "heading", sheetHeadingDepth: 2 });
    const entries = readWorkbookXmlEntries(xlsx);
    const values = flatten(readWorksheetValues(entries));
    const hyperlinks = readWorksheetHyperlinks(entries);
    const relationships = readRelationships(entries, "xl/worksheets/_rels/sheet1.xml.rels");

    expect(values).toContain("Open example");
    expect(values).toContain("Jump to Other");
    expect(values).not.toContain("[Open example](https://example.com/)");
    expect(hyperlinks).toEqual([
      { ref: "A3", "r:id": "rId1" },
      { ref: "A4", location: "'Sheet Other'!A1" },
      { ref: "B8", "r:id": "rId2" },
      { ref: "B9", location: "'Sheet Other'!A1" }
    ]);
    expect(relationships).toEqual([
      expect.objectContaining({
        Id: "rId1",
        Type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink",
        Target: "https://example.com/",
        TargetMode: "External"
      }),
      expect.objectContaining({
        Id: "rId2",
        Type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink",
        Target: "https://example.com/docs",
        TargetMode: "External"
      })
    ]);
  });

  it("keeps multiline and merge marker text from xlsx2md merge fixtures", async () => {
    const markdown = await readFixture("merge-multiline-sample01.md");
    const model = markdownToXlsxModel(markdown);
    const rows = model.sheets[0].rows.map((row) => row.cells.map((cell) => cell.value));

    expect(rows).toContainEqual(["1", "1行目\n2行目", "[←M←]"]);
    expect(rows).toContainEqual(["2", "[↑M↑]", "[↑M↑]"]);
  });

  it("keeps horizontal and vertical merge marker patterns from xlsx2md merge fixtures", async () => {
    const markdown = await readFixture("merge-pattern-sample01.md");
    const model = markdownToXlsxModel(markdown);
    const rows = model.sheets[0].rows.map((row) => row.cells.map((cell) => cell.value));
    const values = flatten(rows);

    expect(values).toContain("※横結合のサンプルです");
    expect(values).toContain("※縦結合のサンプルです");
    expect(values).toContain("※2x2結合のサンプルです");
    expect(rows).toContainEqual(["1", "横結合", "[←M←]", "横結合", "[←M←]"]);
    expect(rows).toContainEqual(["2", "[↑M↑]", "[↑M↑]", "[↑M↑]"]);
  });

  it("converts xlsx2md merge markers into worksheet merge ranges", async () => {
    const markdown = await readFixture("merge-pattern-sample01.md");
    const xlsx = md2xlsx(markdown);
    const entries = readWorkbookXmlEntries(xlsx);
    const values = flatten(readWorksheetValues(entries));
    const mergeRefs = readWorksheetMergeRefs(entries);

    expect(values).not.toContain("[←M←]");
    expect(values).not.toContain("[↑M↑]");
    expect(mergeRefs).toEqual([
      "B5:C5",
      "D5:E5",
      "B6:D6",
      "B7:E7",
      "B12:B13",
      "C12:C14",
      "D12:D15",
      "B14:B15",
      "B20:C21",
      "D20:E21",
      "B22:C23",
      "D22:E23"
    ]);
  });

  it("converts representative rich text Markdown output into workbook rich text", async () => {
    const markdown = await readFixture("rich-text-github-sample01.md");
    const model = markdownToXlsxModel(markdown);
    const values = flatten(model.sheets[0].rows.map((row) => row.cells.map((cell) => cell.value)));

    expect(values).toContain("underline whole cell");
    expect(values).toContain("改行入り文字列で\n一部だけ太字");
    expect(values).toContain("abc def");
    expect(values).toContain("24690");
    expect(model.sheets[0].rows.some((row) => row.cells.some((cell) => (
      cell.value === "underline whole cell" && cell.richTextRuns?.some((run) => run.text === "underline whole cell" && run.underline)
    )))).toBe(true);
    expect(model.sheets[0].rows.some((row) => row.cells.some((cell) => (
      cell.value === "abc def" && cell.richTextRuns?.some((run) => run.text === "def" && run.underline)
    )))).toBe(true);
  });

  it("keeps practical rich text and hyperlink table content from xlsx2md output", async () => {
    const markdown = await readFixture("rich-usecase-sample01.md");
    const model = markdownToXlsxModel(markdown);
    const values = flatten(model.sheets[0].rows.map((row) => row.cells.map((cell) => cell.value)));

    expect(values).toContain("Apple");
    expect(model.sheets[0].rows.some((row) => row.cells.some((cell) => (
      cell.value === "Apple" && cell.hyperlink?.target === "https://www.apple.com/"
    )))).toBe(true);
    expect(values).toContain("Apple の製品が購入できます。");
    expect(values).toContain("実店舗とともに\nネットショップでもお世話になっています。");
    expect(values).toContain("池袋の激戦区で、生き残るのはどの店舗か。\n→トルツメ: この部分は文面から外すことを提案。");
    expect(model.sheets[0].rows.some((row) => row.cells.some((cell) => (
      cell.value === "Apple の製品が購入できます。"
      && cell.richTextRuns?.some((run) => run.text === "購入できます" && run.underline)
    )))).toBe(true);
  });

  it("handles Markdown escape-heavy xlsx2md output as workbook text and table cells", async () => {
    const markdown = await readFixture("rich-markdown-escape-sample01.md");
    const xlsx = md2xlsx(markdown);
    const entries = readWorkbookXmlEntries(xlsx);
    const values = flatten(readWorksheetValues(entries));
    const model = markdownToXlsxModel(markdown);
    const rows = model.sheets[0].rows.map((row) => row.cells.map((cell) => cell.value));

    expect(values).toContain("Book: rich-markdown-escape-sample01.xlsx");
    expect(values).toContain("rich+escape");
    expect(values).toContain("![alt](image.png)");
    expect(values).toContain("Header | One");
    expect(values).toContain("# not heading");
    expect(rows).toContainEqual(["a \\| b", "a \\| b"]);
    expect(rows).toContainEqual(["Header | One", "Header *Two*", "Header [Three](x)"]);
  });
});
