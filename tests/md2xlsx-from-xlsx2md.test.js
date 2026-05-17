import { describe, expect, it } from "vitest";
import { access, readFile } from "node:fs/promises";
import { md2xlsx, markdownToXlsxModel } from "../dist/core.js";
import {
  readContentTypeDefaults,
  readDrawingAnchors,
  readRelationships,
  readSheetNames,
  readWorkbookXmlEntries,
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

describe("miku-xlsx2md generated Markdown compatibility", () => {
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

    expect(values).toContain("[Open example](https://example.com/)");
    expect(values).toContain("[Jump to Other](#other) (Other!A1)");
    expect(rows).toContainEqual(["External", "[Open example](https://example.com/docs)"]);
    expect(rows).toContainEqual(["Internal", "[Jump to Other](#other) (Other!A1)"]);
  });

  it("keeps multiline and merge marker text from xlsx2md merge fixtures", async () => {
    const markdown = await readFixture("merge-multiline-sample01.md");
    const model = markdownToXlsxModel(markdown);
    const rows = model.sheets[0].rows.map((row) => row.cells.map((cell) => cell.value));

    expect(rows).toContainEqual(["1", "1行目<br>2行目", "[←M←]"]);
    expect(rows).toContainEqual(["2", "[↑M↑]", "[↑M↑]"]);
  });

  it("keeps representative rich text Markdown output as workbook text", async () => {
    const markdown = await readFixture("rich-text-github-sample01.md");
    const model = markdownToXlsxModel(markdown);
    const values = flatten(model.sheets[0].rows.map((row) => row.cells.map((cell) => cell.value)));

    expect(values).toContain("<ins>underline whole cell</ins>");
    expect(values).toContain("改行入り文字列で<br>一部だけ太字");
    expect(values).toContain("abc <ins>def</ins>");
    expect(values).toContain("<ins>24690</ins>");
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
      { from: { col: 1, row: image1Row }, to: { col: 4, row: image1Row + 6 }, embedRelId: "rId1" },
      { from: { col: 1, row: image2Row }, to: { col: 4, row: image2Row + 6 }, embedRelId: "rId2" }
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
    expect(anchors[0].to.row - anchors[0].from.row).toBe(6);
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
