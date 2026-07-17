import type { CellModel, RichTextRun } from "./types.ts";
import { extractText } from "./markdown-text.ts";

interface RichState {
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  underline?: boolean;
}

export function richCellFromChildren(children: any[], fallback: string): Pick<CellModel, "value" | "richTextRuns"> {
  const runs = mergeRichTextRuns(inlineRichTextRuns(children));
  if (!runs.length) {
    return { value: fallback };
  }
  const value = runs.map((run) => run.text).join("");
  return hasRichTextStyle(runs) || value !== fallback ? { value, richTextRuns: runs } : { value };
}

function inlineRichTextRuns(children: any[], state: RichState = {}): RichTextRun[] {
  const runs: RichTextRun[] = [];
  let underline = Boolean(state.underline);
  for (const child of children) {
    if (!child) {
      continue;
    }
    if (child.type === "html") {
      const html = String(child.value ?? "").trim().toLowerCase();
      if (/^<br\s*\/?>$/.test(html)) {
        runs.push(richTextRun("\n", { ...state, underline }));
      } else if (html === "<ins>") {
        underline = true;
      } else if (html === "</ins>") {
        underline = false;
      } else {
        runs.push(richTextRun(String(child.value ?? ""), { ...state, underline }));
      }
      continue;
    }
    if (child.type === "text") {
      runs.push(richTextRun(String(child.value ?? ""), { ...state, underline }));
      continue;
    }
    if (child.type === "break") {
      runs.push(richTextRun("\n", { ...state, underline }));
      continue;
    }
    if (child.type === "strong") {
      runs.push(...inlineRichTextRuns(child.children ?? [], { ...state, underline, bold: true }));
      continue;
    }
    if (child.type === "emphasis") {
      runs.push(...inlineRichTextRuns(child.children ?? [], { ...state, underline, italic: true }));
      continue;
    }
    if (child.type === "delete") {
      runs.push(...inlineRichTextRuns(child.children ?? [], { ...state, underline, strike: true }));
      continue;
    }
    if (child.type === "link") {
      runs.push(richTextRun(extractText(child), { ...state, underline }));
      continue;
    }
    if (Array.isArray(child.children)) {
      runs.push(...inlineRichTextRuns(child.children, { ...state, underline }));
      continue;
    }
    if (typeof child.value === "string") {
      runs.push(richTextRun(child.value, { ...state, underline }));
    }
  }
  return runs;
}

function richTextRun(text: string, state: RichState): RichTextRun {
  return {
    text,
    ...(state.bold ? { bold: true } : {}),
    ...(state.italic ? { italic: true } : {}),
    ...(state.strike ? { strike: true } : {}),
    ...(state.underline ? { underline: true } : {})
  };
}

function mergeRichTextRuns(runs: RichTextRun[]): RichTextRun[] {
  const merged: RichTextRun[] = [];
  for (const run of runs) {
    if (!run.text) {
      continue;
    }
    const previous = merged[merged.length - 1];
    if (
      previous
      && Boolean(previous.bold) === Boolean(run.bold)
      && Boolean(previous.italic) === Boolean(run.italic)
      && Boolean(previous.strike) === Boolean(run.strike)
      && Boolean(previous.underline) === Boolean(run.underline)
    ) {
      previous.text += run.text;
    } else {
      merged.push({ ...run });
    }
  }
  return merged;
}

function hasRichTextStyle(runs: RichTextRun[]): boolean {
  return runs.some((run) => run.bold || run.italic || run.strike || run.underline);
}
