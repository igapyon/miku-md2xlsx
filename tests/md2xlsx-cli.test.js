import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { md2xlsx } from "../dist/core.js";
import { writeZipPackage } from "../src/vendor/miku-ms-office-core-0.6.0.mjs";
import { unzipStoredBinaryEntries, unzipStoredEntries } from "./helpers/zip.js";
import { readSheetNames, readWorksheetCells } from "./helpers/xlsx.js";
import packageJson from "../package.json" with { type: "json" };

describe("miku-md2xlsx CLI", () => {
  it("prints version", () => {
    const result = spawnSync(process.execPath, ["scripts/miku-md2xlsx-cli.mjs", "--version"], { encoding: "utf8" });

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(packageJson.version);
  });

  it("prints agent-readable help", () => {
    const result = spawnSync(process.execPath, ["scripts/miku-md2xlsx-cli.mjs", "--help"], { encoding: "utf8" });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("converts a Markdown file into an Excel .xlsx workbook");
    expect(result.stdout).toContain("node miku-md2xlsx-cli.mjs <input.md> --out <output.xlsx>");
    expect(result.stdout).toContain("Examples:");
    expect(result.stdout).toContain("Outputs:");
    expect(result.stdout).toContain("Successful conversion is silent.");
    expect(result.stdout).toContain("There is no --summary output mode");
    expect(result.stdout).toContain("Overwrite behavior:");
    expect(result.stdout).toContain("Exit codes:");
    expect(result.stdout).toContain("no-argument help");
    expect(result.stdout).toContain("Markdown handling notes:");
    expect(result.stdout).toContain("Table cell values are written as strings.");
    expect(result.stdout).toContain("Template mode notes:");
    expect(result.stdout).toContain("rightmost template sheet");
    expect(result.stdout).toContain("Sheet mode notes:");
    expect(result.stdout).toContain("miku-xlsx2md dialect notes:");
    expect(result.stdout).toContain("--input-dialect <name>");
    expect(result.stdout).toContain("miku-xlsx2md is an early access feature");
    expect(result.stdout).toContain("Early access: this input dialect");
    expect(result.stdout).toContain("--template <file>");
    expect(result.stdout).not.toContain("npm run");
    expect(result.stdout).not.toContain("dist/");
    expect(result.stdout).not.toContain("bundle/");
  });

  it("prints help with no arguments", () => {
    const result = spawnSync(process.execPath, ["scripts/miku-md2xlsx-cli.mjs"], { encoding: "utf8" });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Usage:");
    expect(result.stderr).toBe("");
  });

  it("rejects unsupported sheet mode values", () => {
    const result = spawnSync(process.execPath, [
      "scripts/miku-md2xlsx-cli.mjs",
      "tests/fixtures/smoke.md",
      "--out",
      "unused.xlsx",
      "--sheet-mode",
      "invalid"
    ], { encoding: "utf8" });

    expect(result.status).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("--sheet-mode must be single or heading.");
  });

  it("rejects unsupported table style values", () => {
    const result = spawnSync(process.execPath, [
      "scripts/miku-md2xlsx-cli.mjs",
      "tests/fixtures/smoke.md",
      "--out",
      "unused.xlsx",
      "--table-style",
      "invalid"
    ], { encoding: "utf8" });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("--table-style must be plain or bordered.");
  });

  it("rejects unsupported input dialect values", () => {
    const result = spawnSync(process.execPath, [
      "scripts/miku-md2xlsx-cli.mjs",
      "tests/fixtures/smoke.md",
      "--out",
      "unused.xlsx",
      "--input-dialect",
      "invalid"
    ], { encoding: "utf8" });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("--input-dialect must be markdown or miku-xlsx2md.");
  });

  it("rejects generic sheet options combined with the miku-xlsx2md dialect", () => {
    const result = spawnSync(process.execPath, [
      "scripts/miku-md2xlsx-cli.mjs",
      "tests/fixtures/from-xlsx2md/xlsx2md-basic-sample01.md",
      "--out",
      "unused.xlsx",
      "--input-dialect",
      "miku-xlsx2md",
      "--sheet-mode",
      "heading"
    ], { encoding: "utf8" });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("cannot be combined with --sheet-mode or --sheet-heading-depth");
  });

  it("reports malformed early access dialect markers", async () => {
    const dir = await mkdtemp(join(tmpdir(), "miku-md2xlsx-"));
    const input = join(dir, "invalid-dialect.md");
    const out = join(dir, "invalid-dialect.xlsx");
    try {
      await writeFile(input, "## Sheet:\n\ntext\n", "utf8");
      const result = spawnSync(process.execPath, [
        "scripts/miku-md2xlsx-cli.mjs",
        input,
        "--out",
        out,
        "--input-dialect",
        "miku-xlsx2md"
      ], { encoding: "utf8" });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Invalid miku-xlsx2md dialect at Markdown line 1");
      expect(result.stderr).toContain("Expected: ## Sheet: <name>");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("writes an xlsx file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "miku-md2xlsx-"));
    const out = join(dir, "created-parent", "out.xlsx");
    try {
      const result = spawnSync(process.execPath, [
        "scripts/miku-md2xlsx-cli.mjs",
        "tests/fixtures/smoke.md",
        "--out",
        out,
        "--sheet-mode",
        "heading"
      ], { encoding: "utf8" });

      expect(result.status).toBe(0);
      expect(result.stdout).toBe("");
      expect(result.stderr).toBe("");
      const entries = unzipStoredEntries(await readFile(out));
      expect(entries.get("xl/workbook.xml")).toContain("売上メモ");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("writes an xlsx file using template sheets", async () => {
    const dir = await mkdtemp(join(tmpdir(), "miku-md2xlsx-"));
    const input = join(dir, "input.md");
    const template = join(dir, "template.xlsx");
    const out = join(dir, "out.xlsx");
    try {
      await writeFile(input, "# Generated A\n\nGenerated body A\n\n# Generated B\n\nGenerated body B\n", "utf8");
      const templateEntries = Array.from(unzipStoredBinaryEntries(md2xlsx("# Template A\n\nTemplate-only A", {
        sheetMode: "heading"
      })), ([path, data]) => ({ path, data }));
      templateEntries.push({
        path: "xl/theme/theme1.xml",
        data: "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><a:theme xmlns:a=\"http://schemas.openxmlformats.org/drawingml/2006/main\" name=\"CLI Template Theme\"/>"
      });
      await writeFile(template, writeZipPackage(templateEntries));
      const result = spawnSync(process.execPath, [
        "scripts/miku-md2xlsx-cli.mjs",
        input,
        "--out",
        out,
        "--sheet-mode",
        "heading",
        "--template",
        template
      ], { encoding: "utf8" });

      expect(result.status).toBe(0);
      const entries = unzipStoredEntries(await readFile(out));
      expect(entries.get("xl/theme/theme1.xml")).toContain("CLI Template Theme");
      expect(entries.get("xl/worksheets/sheet1.xml")).toContain("Generated body A");
      expect(entries.get("xl/worksheets/sheet2.xml")).toContain("Generated body B");
      expect(entries.get("xl/worksheets/sheet1.xml")).not.toContain("Template-only A");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("embeds relative image assets next to an xlsx2md-generated Markdown file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "miku-md2xlsx-"));
    const out = join(dir, "image-out.xlsx");
    try {
      const result = spawnSync(process.execPath, [
        "scripts/miku-md2xlsx-cli.mjs",
        "tests/fixtures/from-xlsx2md/image-basic-sample01.md",
        "--out",
        out
      ], { encoding: "utf8" });

      expect(result.status).toBe(0);
      const entries = unzipStoredBinaryEntries(await readFile(out));
      expect(entries.has("xl/media/image1.png")).toBe(true);
      expect(entries.has("xl/media/image2.png")).toBe(true);
      expect(new TextDecoder().decode(entries.get("xl/worksheets/sheet1.xml"))).toContain('<drawing r:id="rId1"/>');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("embeds relative image assets whose Markdown URL is wrapped in angle brackets", async () => {
    const dir = await mkdtemp(join(tmpdir(), "miku-md2xlsx-"));
    const input = join(dir, "image-space.md");
    const imageDir = join(dir, "assets");
    const imagePath = join(imageDir, "image space.png");
    const out = join(dir, "image-space-out.xlsx");
    try {
      await mkdir(imageDir, { recursive: true });
      await writeFile(input, "# Image Space\n\n![alt](<assets/image space.png>)\n", "utf8");
      await writeFile(imagePath, new Uint8Array([1, 2, 3]));
      const result = spawnSync(process.execPath, [
        "scripts/miku-md2xlsx-cli.mjs",
        input,
        "--out",
        out
      ], { encoding: "utf8" });

      expect(result.status).toBe(0);
      const entries = unzipStoredBinaryEntries(await readFile(out));
      expect(entries.has("xl/media/image1.png")).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("supports second-level heading sheet splits for xlsx2md-style Markdown", async () => {
    const dir = await mkdtemp(join(tmpdir(), "miku-md2xlsx-"));
    const out = join(dir, "heading-depth-out.xlsx");
    try {
      const result = spawnSync(process.execPath, [
        "scripts/miku-md2xlsx-cli.mjs",
        "tests/fixtures/from-xlsx2md/xlsx2md-basic-sample01.md",
        "--out",
        out,
        "--sheet-mode",
        "heading",
        "--sheet-heading-depth",
        "2"
      ], { encoding: "utf8" });

      expect(result.status).toBe(0);
      const entries = unzipStoredEntries(await readFile(out));
      expect(readSheetNames(entries)).toEqual(["Sheet xlsx2md-basic"]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("restores exact sheet names and table anchors in the miku-xlsx2md dialect", async () => {
    const dir = await mkdtemp(join(tmpdir(), "miku-md2xlsx-"));
    const out = join(dir, "xlsx2md-dialect-out.xlsx");
    try {
      const result = spawnSync(process.execPath, [
        "scripts/miku-md2xlsx-cli.mjs",
        "tests/fixtures/from-xlsx2md/xlsx2md-basic-sample01.md",
        "--out",
        out,
        "--input-dialect",
        "miku-xlsx2md"
      ], { encoding: "utf8" });

      expect(result.status).toBe(0);
      const entries = unzipStoredEntries(await readFile(out));
      const cells = readWorksheetCells(entries);
      expect(readSheetNames(entries)).toEqual(["xlsx2md-basic"]);
      expect(cells).toContainEqual({ attributes: expect.objectContaining({ r: "B12" }), text: "項番" });
      expect(cells.some((cell) => cell.text === "Book: xlsx2md-basic-sample01.xlsx")).toBe(false);
      expect(cells.some((cell) => cell.text === "Table: 001 (B12-F16)")).toBe(false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
