import { describe, expect, it } from "vitest";
import { access } from "node:fs/promises";
import { markdownToXlsxModel } from "../dist/core.js";
import { flatten, readFixture } from "./helpers/from-xlsx2md.js";

describe("miku-xlsx2md generated Markdown content compatibility", () => {
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
});
