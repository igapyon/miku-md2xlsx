import { describe, expect, it } from "vitest";
import { access, readFile } from "node:fs/promises";
import { md2xlsx } from "../dist/core.js";
import { readContentTypeDefaults, readDrawingAnchors, readRelationships, readSheetNames, readWorkbookXmlEntries, readWorksheetDrawingRelId, readWorksheetValues } from "./helpers/xlsx.js";
import { unzipStoredBinaryEntries } from "./helpers/zip.js";
import { flatten, readFixture } from "./helpers/from-xlsx2md.js";

describe("miku-xlsx2md generated Markdown image compatibility", () => {
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
