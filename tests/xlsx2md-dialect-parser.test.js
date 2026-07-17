import { describe, expect, it } from "vitest";
import {
  isBookMarker,
  looksLikeSheetMarker,
  looksLikeTableMarker,
  parseSheetMarker,
  parseTableMarker
} from "../src/ts/xlsx2md-dialect-parser.ts";

describe("miku-xlsx2md dialect parser", () => {
  it("parses the structural markers emitted by miku-xlsx2md", () => {
    expect(isBookMarker("Book: sample.xlsx")).toBe(true);
    expect(parseSheetMarker("Sheet: Alpha")).toBe("Alpha");
    expect(parseTableMarker("Table: 001 (B12-F16)")).toEqual({
      startRow: 11,
      startCol: 1,
      endRow: 15,
      endCol: 5
    });
  });

  it("distinguishes malformed marker-like headings from ordinary headings", () => {
    expect(looksLikeSheetMarker("Sheet:")).toBe(true);
    expect(parseSheetMarker("Sheet:")).toBeUndefined();
    expect(looksLikeSheetMarker("Sheet Alpha")).toBe(false);
    expect(looksLikeSheetMarker("Worksheet notes")).toBe(false);
    expect(looksLikeTableMarker("Table: 001 A1-B2")).toBe(true);
    expect(parseTableMarker("Table: 001 A1-B2")).toBeUndefined();
    expect(looksLikeTableMarker("Table 001 (A1-B2)")).toBe(false);
    expect(looksLikeTableMarker("Tables overview")).toBe(false);
  });

  it("rejects reversed and out-of-Excel table ranges", () => {
    expect(parseTableMarker("Table: 1 (C4-A1)")).toBeUndefined();
    expect(parseTableMarker("Table: 1 (A0-C4)")).toBeUndefined();
    expect(parseTableMarker("Table: 1 (XFE1-XFE2)")).toBeUndefined();
    expect(parseTableMarker("Table: 1 (A1-A1048577)")).toBeUndefined();
  });
});
