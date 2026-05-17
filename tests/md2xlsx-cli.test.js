import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { unzipStoredBinaryEntries, unzipStoredEntries } from "./helpers/zip.js";
import { readSheetNames } from "./helpers/xlsx.js";

describe("miku-md2xlsx CLI", () => {
  it("prints version", () => {
    const result = spawnSync(process.execPath, ["scripts/miku-md2xlsx-cli.mjs", "--version"], { encoding: "utf8" });

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("prints agent-readable help", () => {
    const result = spawnSync(process.execPath, ["scripts/miku-md2xlsx-cli.mjs", "--help"], { encoding: "utf8" });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("converts a Markdown file into an Excel .xlsx workbook");
    expect(result.stdout).toContain("Examples:");
    expect(result.stdout).toContain("Markdown handling notes:");
    expect(result.stdout).toContain("Table cell values are written as strings.");
    expect(result.stdout).toContain("Sheet mode notes:");
  });

  it("writes an xlsx file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "miku-md2xlsx-"));
    const out = join(dir, "out.xlsx");
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
      const entries = unzipStoredEntries(await readFile(out));
      expect(entries.get("xl/workbook.xml")).toContain("売上メモ");
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
});
