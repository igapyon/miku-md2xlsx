import { describe, expect, it } from "vitest";
import { access, readFile } from "node:fs/promises";
import { md2xlsx, markdownToXlsxModel } from "../dist/core.js";
import {
  readContentTypeDefaults,
  readDrawingAnchors,
  readRelationships,
  readSheetNames,
  readWorkbookXmlEntries,
  readWorksheetHyperlinks,
  readWorksheetMergeRefs,
  readWorksheetDrawingRelId,
  readWorksheetValues
} from "./helpers/xlsx.js";
import { unzipStoredBinaryEntries } from "./helpers/zip.js";

async function readFixture(name) {
  return readFile(`tests/fixtures/from-xlsx2md/${name}`, "utf8");
}

function flatten(values) {
  return values.flat().join("\n");
}

const allGeneratedFixtureMarkdown = [
  "chart-basic-sample01.md",
  "chart-mixed-sample01.md",
  "display-format-sample01.md",
  "edge-empty-sample01.md",
  "edge-weird-sheetname-sample01.md",
  "formula-basic-sample01.md",
  "formula-crosssheet-sample01.md",
  "formula-shared-sample01.md",
  "formula-spill-sample01.md",
  "grid-layout-sample-01.md",
  "hyperlink-basic-sample01.md",
  "image-basic-sample01.md",
  "image-basic-sample02/image-basic-sample02.md",
  "merge-multiline-sample01.md",
  "merge-pattern-sample01.md",
  "named-range-sample01.md",
  "narrative-vs-table-sample01.md",
  "rich-markdown-escape-sample01.md",
  "rich-text-github-sample01.md",
  "rich-usecase-sample01.md",
  "shape-basic-sample01.md",
  "shape-block-arrow-sample01.md",
  "shape-callout-sample01.md",
  "shape-flowchart-sample01.md",
  "table-basic-sample01.md",
  "table-basic-sample02.md",
  "table-basic-sample03.md",
  "table-basic-sample11.md",
  "table-basic-sample12.md",
  "table-basic-sample13.md",
  "table-basic-sample14.md",
  "table-basic-sample15.md",
  "table-basic-sample16.md",
  "table-border-priority-sample01.md",
  "xlsx2md-basic-sample01.md"
];

describe("miku-xlsx2md generated Markdown compatibility", () => {
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

  it("keeps narrative paragraphs and table rows from real-document style xlsx2md Markdown", async () => {
    const markdown = await readFixture("narrative-vs-table-sample01.md");
    const model = markdownToXlsxModel(markdown);
    const rows = model.sheets[0].rows.map((row) => row.cells.map((cell) => cell.value));
    const values = flatten(rows);

    expect(values).toContain("この設計書は受注入力画面を説明する。");
    expect(values).toContain("本文は罫線なしのままにする。");
    expect(rows).toContainEqual(["項番", "項目名称", "物理名", "初期値", "備考"]);
    expect(rows).toContainEqual(["3", "登録日", "entrydate", "3月13日", "何かの登録日"]);
  });

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
    expect(model.sheets[0].rows[6].cells[1].hyperlink).toEqual({ target: "https://example.com/docs", kind: "external" });
    expect(model.sheets[0].rows[7].cells[1].hyperlink).toEqual({ target: "Other!A1", kind: "internal" });
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
      { ref: "B7", "r:id": "rId2" },
      { ref: "B8", location: "'Sheet Other'!A1" }
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
      "B11:B12",
      "C11:C13",
      "D11:D14",
      "B13:B14",
      "B18:C19",
      "D18:E19",
      "B20:C21",
      "D20:E21"
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

  it("keeps display formatted values from xlsx2md output", async () => {
    const markdown = await readFixture("display-format-sample01.md");
    const model = markdownToXlsxModel(markdown);
    const rows = model.sheets[0].rows.map((row) => row.cells.map((cell) => cell.value));

    expect(rows).toContainEqual(["3", "通貨", "value3", "¥1,024,768", "通貨"]);
    expect(rows).toContainEqual(["7", "パーセンテージ", "value7", "98.7%", "パーセンテージ"]);
    expect(rows).toContainEqual(["12", "和暦", "value12", "令和8年3月17日", "和暦"]);
  });

  it("keeps formula fixture cached/resolved values from xlsx2md output", async () => {
    const markdown = await readFixture("formula-basic-sample01.md");
    const model = markdownToXlsxModel(markdown);
    const rows = model.sheets[0].rows.map((row) => row.cells.map((cell) => cell.value));

    expect(rows).toContainEqual(["arith", "15"]);
    expect(rows).toContainEqual(["if", "OK"]);
    expect(rows).toContainEqual(["date", "2024/3/17"]);
    expect(rows).toContainEqual(["value_num", "1234.5"]);
  });

  it("keeps multi-sheet formula and named range fixture content visible", async () => {
    const formulaMarkdown = await readFixture("formula-crosssheet-sample01.md");
    const namedRangeMarkdown = await readFixture("named-range-sample01.md");
    const formulaModel = markdownToXlsxModel(formulaMarkdown, { sheetMode: "heading", sheetHeadingDepth: 2 });
    const namedRangeModel = markdownToXlsxModel(namedRangeMarkdown, { sheetMode: "heading", sheetHeadingDepth: 2 });

    expect(formulaModel.sheets.map((sheet) => sheet.name)).toEqual(["Sheet Sheet1", "Sheet Sheet2", "Sheet 日本語シート"]);
    expect(flatten(formulaModel.sheets.flatMap((sheet) => sheet.rows.map((row) => row.cells.map((cell) => cell.value))))).toContain("日本語参照値");
    expect(namedRangeModel.sheets.map((sheet) => sheet.name)).toEqual(["Sheet Summary", "Sheet Other"]);
    expect(flatten(namedRangeModel.sheets.flatMap((sheet) => sheet.rows.map((row) => row.cells.map((cell) => cell.value))))).toContain("CrossRef CrossRef");
  });

  it("keeps xlsx2md chart metadata as semantic workbook text", async () => {
    const markdown = await readFixture("chart-basic-sample01.md");
    const model = markdownToXlsxModel(markdown);
    const values = flatten(model.sheets[0].rows.map((row) => row.cells.map((cell) => cell.value)));

    expect(values).toContain("Chart: 001 (B10)");
    expect(values).toContain("Title: 棒グラフのグラフ");
    expect(values).toContain("Type: Bar Chart");
    expect(values).toContain("categories: 'chart-basic'!$B$4:$B$7");
  });

  it("keeps edge-case sheets and sparse content visible", async () => {
    const emptyMarkdown = await readFixture("edge-empty-sample01.md");
    const weirdNameMarkdown = await readFixture("edge-weird-sheetname-sample01.md");
    const emptyModel = markdownToXlsxModel(emptyMarkdown, { sheetMode: "heading", sheetHeadingDepth: 2 });
    const weirdNameModel = markdownToXlsxModel(weirdNameMarkdown, { sheetMode: "heading", sheetHeadingDepth: 2 });

    expect(emptyModel.sheets.map((sheet) => sheet.name)).toEqual(["Sheet edge-empty"]);
    expect(flatten(emptyModel.sheets[0].rows.map((row) => row.cells.map((cell) => cell.value)))).toContain("only-value");
    expect(weirdNameModel.sheets.map((sheet) => sheet.name)).toEqual(["Sheet A B-東京&大阪.01"]);
    expect(flatten(weirdNameModel.sheets[0].rows.map((row) => row.cells.map((cell) => cell.value)))).toContain("何かの登録日");
  });

  it("keeps dense table fixture sections visible", async () => {
    const markdown = await readFixture("table-basic-sample13.md");
    const model = markdownToXlsxModel(markdown);
    const values = flatten(model.sheets[0].rows.map((row) => row.cells.map((cell) => cell.value)));

    expect(values).toContain("Table: 001 (B3-T7)");
    expect(values).toContain("Table: 004 (V10-AN14)");
    expect(values).toContain("方眼紙風のためにセル結合が多用されます");
    expect(values).toContain("Sabro");
  });

  it("keeps xlsx2md generated shape assets with the fixture assets", async () => {
    await Promise.all([
      access("tests/fixtures/from-xlsx2md/assets/shape-basic/shape_001.svg"),
      access("tests/fixtures/from-xlsx2md/assets/shape-basic/shape_002.svg"),
      access("tests/fixtures/from-xlsx2md/assets/shape-basic/shape_003.svg"),
      access("tests/fixtures/from-xlsx2md/assets/shape-flowchart/shape_005.svg"),
      access("tests/fixtures/from-xlsx2md/assets/shape-flowchart/shape_006.svg"),
      access("tests/fixtures/from-xlsx2md/assets/shape-flowchart/shape_007.svg")
    ]);
  });

  it("preserves xlsx2md image asset references as semantic workbook text", async () => {
    const markdown = await readFixture("image-basic-sample01.md");
    const xlsx = md2xlsx(markdown);
    const entries = readWorkbookXmlEntries(xlsx);
    const values = flatten(readWorksheetValues(entries));

    expect(values).toContain("Image: 001 (C8)");
    expect(values).toContain("File: assets/image/image_001.png");
    expect(values).toContain("![image_001.png](assets/image/image_001.png)");
    expect(values).toContain("Image: 002 (F8)");
    expect(values).toContain("File: assets/image/image_002.png");
    expect(values).toContain("![image_002.png](assets/image/image_002.png)");
  });

  it("embeds xlsx2md image assets when matching relative assets are provided", async () => {
    const markdown = await readFixture("image-basic-sample01.md");
    const image1 = await readFile("tests/fixtures/from-xlsx2md/assets/image/image_001.png");
    const image2 = await readFile("tests/fixtures/from-xlsx2md/assets/image/image_002.png");
    const xlsx = md2xlsx(markdown, {
      imageAssets: [
        { path: "assets/image/image_001.png", data: image1, contentType: "image/png" },
        { path: "assets/image/image_002.png", data: image2, contentType: "image/png" }
      ]
    });
    const textEntries = readWorkbookXmlEntries(xlsx);
    const binaryEntries = unzipStoredBinaryEntries(xlsx);
    const defaults = readContentTypeDefaults(textEntries);
    const sheetRels = readRelationships(textEntries, "xl/worksheets/_rels/sheet1.xml.rels");
    const drawingRels = readRelationships(textEntries, "xl/drawings/_rels/drawing1.xml.rels");

    expect(binaryEntries.has("xl/media/image1.png")).toBe(true);
    expect(binaryEntries.has("xl/media/image2.png")).toBe(true);
    expect(defaults).toContainEqual({ Extension: "png", ContentType: "image/png" });
    expect(readWorksheetDrawingRelId(textEntries)).toBe("rId1");
    expect(sheetRels).toContainEqual(expect.objectContaining({ Id: "rId1", Target: "../drawings/drawing1.xml" }));
    expect(drawingRels).toContainEqual(expect.objectContaining({ Id: "rId1", Target: "../media/image1.png" }));
    expect(drawingRels).toContainEqual(expect.objectContaining({ Id: "rId2", Target: "../media/image2.png" }));
  });

  it("reserves worksheet rows after embedded xlsx2md images to avoid overlapping following rows", async () => {
    const markdown = await readFixture("image-basic-sample01.md");
    const image1 = await readFile("tests/fixtures/from-xlsx2md/assets/image/image_001.png");
    const image2 = await readFile("tests/fixtures/from-xlsx2md/assets/image/image_002.png");
    const xlsx = md2xlsx(markdown, {
      imageAssets: [
        { path: "assets/image/image_001.png", data: image1, contentType: "image/png" },
        { path: "assets/image/image_002.png", data: image2, contentType: "image/png" }
      ]
    });
    const entries = readWorkbookXmlEntries(xlsx);
    const values = readWorksheetValues(entries);
    const image1Row = values.findIndex((row) => row.includes("![image_001.png](assets/image/image_001.png)"));
    const image2HeadingRow = values.findIndex((row) => row.includes("Image: 002 (F8)"));
    const image2Row = values.findIndex((row) => row.includes("![image_002.png](assets/image/image_002.png)"));
    const anchors = readDrawingAnchors(entries);

    expect(image2HeadingRow - image1Row).toBeGreaterThanOrEqual(7);
    expect(anchors).toEqual([
      { from: { col: 1, row: image1Row }, to: { col: 4, row: image1Row + 15 }, embedRelId: "rId1" },
      { from: { col: 1, row: image2Row }, to: { col: 4, row: image2Row + 10 }, embedRelId: "rId2" }
    ]);
  });

  it("converts an xlsx2md image and chart coexistence fixture without dropping semantic chart text", async () => {
    const markdown = await readFixture("image-basic-sample02/image-basic-sample02.md");
    const image = await readFile("tests/fixtures/from-xlsx2md/image-basic-sample02/assets/image/image_001.png");
    const xlsx = md2xlsx(markdown, {
      imageAssets: [
        { path: "assets/image/image_001.png", data: image, contentType: "image/png" }
      ]
    });
    const textEntries = readWorkbookXmlEntries(xlsx);
    const binaryEntries = unzipStoredBinaryEntries(xlsx);
    const values = flatten(readWorksheetValues(textEntries));
    const anchors = readDrawingAnchors(textEntries);

    expect(values).toContain("Chart: 001 (B9)");
    expect(values).toContain("Title: このグラフのタイトル");
    expect(values).toContain("Type: Line Chart");
    expect(values).toContain("![image_001.png](assets/image/image_001.png)");
    expect(binaryEntries.has("xl/media/image1.png")).toBe(true);
    expect(anchors).toHaveLength(1);
    expect(anchors[0].to.row - anchors[0].from.row).toBe(10);
  });

  it("keeps embedded image drawings separate across heading-split sheets", () => {
    const xlsx = md2xlsx("# First\n\n![one](assets/one.png)\n\n# Second\n\n![two](assets/two.png)\n", {
      sheetMode: "heading",
      imageAssets: [
        { path: "assets/one.png", data: new Uint8Array([1, 2, 3]), contentType: "image/png" },
        { path: "assets/two.png", data: new Uint8Array([4, 5, 6]), contentType: "image/png" }
      ]
    });
    const textEntries = readWorkbookXmlEntries(xlsx);
    const binaryEntries = unzipStoredBinaryEntries(xlsx);
    const sheet1Rels = readRelationships(textEntries, "xl/worksheets/_rels/sheet1.xml.rels");
    const sheet2Rels = readRelationships(textEntries, "xl/worksheets/_rels/sheet2.xml.rels");
    const drawing1Rels = readRelationships(textEntries, "xl/drawings/_rels/drawing1.xml.rels");
    const drawing2Rels = readRelationships(textEntries, "xl/drawings/_rels/drawing2.xml.rels");

    expect(readSheetNames(textEntries)).toEqual(["First", "Second"]);
    expect(readWorksheetDrawingRelId(textEntries, 1)).toBe("rId1");
    expect(readWorksheetDrawingRelId(textEntries, 2)).toBe("rId1");
    expect(sheet1Rels).toContainEqual(expect.objectContaining({ Id: "rId1", Target: "../drawings/drawing1.xml" }));
    expect(sheet2Rels).toContainEqual(expect.objectContaining({ Id: "rId1", Target: "../drawings/drawing2.xml" }));
    expect(drawing1Rels).toContainEqual(expect.objectContaining({ Id: "rId1", Target: "../media/image1.png" }));
    expect(drawing2Rels).toContainEqual(expect.objectContaining({ Id: "rId1", Target: "../media/image2.png" }));
    expect(binaryEntries.has("xl/media/image1.png")).toBe(true);
    expect(binaryEntries.has("xl/media/image2.png")).toBe(true);
  });

  it("keeps xlsx2md image assets in the same relative folder structure as Markdown references", async () => {
    const markdown = await readFixture("image-basic-sample01.md");
    const imagePaths = Array.from(markdown.matchAll(/!\[[^\]]*]\((assets\/[^)]+)\)/g), (match) => match[1]);

    expect(imagePaths).toEqual([
      "assets/image/image_001.png",
      "assets/image/image_002.png"
    ]);
    await Promise.all(imagePaths.map((imagePath) => access(`tests/fixtures/from-xlsx2md/${imagePath}`)));
  });

  it("keeps nested xlsx2md image fixtures self-contained when asset names overlap", async () => {
    const markdown = await readFixture("image-basic-sample02/image-basic-sample02.md");
    const imagePaths = Array.from(markdown.matchAll(/!\[[^\]]*]\((assets\/[^)]+)\)/g), (match) => match[1]);

    expect(imagePaths).toEqual(["assets/image/image_001.png"]);
    await Promise.all(imagePaths.map((imagePath) => access(`tests/fixtures/from-xlsx2md/image-basic-sample02/${imagePath}`)));
  });
});
