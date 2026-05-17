import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { unzipStoredEntries } from "./helpers/zip.js";

describe("miku-md2xlsx CLI", () => {
  it("prints version", () => {
    const result = spawnSync(process.execPath, ["scripts/miku-md2xlsx-cli.mjs", "--version"], { encoding: "utf8" });

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
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
});
