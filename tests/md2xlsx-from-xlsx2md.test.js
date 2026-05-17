import { describe, expect, it } from "vitest";
import { access, readFile } from "node:fs/promises";
import { md2xlsx, markdownToXlsxModel } from "../dist/core.js";
import { readSheetNames, readWorkbookXmlEntries, readWorksheetValues } from "./helpers/xlsx.js";
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

  it("handles Markdown escape-heavy xlsx2md output as workbook text and table cells", async () => {
    const markdown = await readFixture("rich-markdown-escape-sample01.md");
    const xlsx = md2xlsx(markdown);
    const entries = readWorkbookXmlEntries(xlsx);
    const values = flatten(readWorksheetValues(entries));

    expect(values).toContain("Book: rich-markdown-escape-sample01.xlsx");
    expect(values).toContain("rich+escape");
    expect(values).toContain("![alt](image.png)");
    expect(values).toContain("Header \\| One");
    expect(values).toContain("# not heading");
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

    expect(binaryEntries.has("xl/media/image1.png")).toBe(true);
    expect(binaryEntries.has("xl/media/image2.png")).toBe(true);
    expect(textEntries.get("[Content_Types].xml")).toContain('Extension="png" ContentType="image/png"');
    expect(textEntries.get("xl/worksheets/sheet1.xml")).toContain('<drawing r:id="rId1"/>');
    expect(textEntries.get("xl/worksheets/_rels/sheet1.xml.rels")).toContain("drawings/drawing1.xml");
    expect(textEntries.get("xl/drawings/_rels/drawing1.xml.rels")).toContain("../media/image1.png");
    expect(textEntries.get("xl/drawings/_rels/drawing1.xml.rels")).toContain("../media/image2.png");
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
});
