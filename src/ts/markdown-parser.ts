import { unified } from "unified";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import type { CellModel, RichTextRun } from "./types.ts";

export function parseMarkdown(markdown: string): any {
  return unified().use(remarkParse).use(remarkGfm).parse(markdown) as any;
}

export function extractText(node: any): string {
  if (!node) {
    return "";
  }
  if (node.type === "image") {
    const alt = typeof node.alt === "string" ? node.alt : "";
    const url = typeof node.url === "string" ? node.url : "";
    return url ? `![${alt}](${url})` : alt;
  }
  if (node.type === "link") {
    const label = Array.isArray(node.children) ? node.children.map((child: any) => extractText(child)).join("") : "";
    const url = typeof node.url === "string" ? node.url : "";
    if (label === url) {
      return label;
    }
    return url ? `[${label}](${url})` : label;
  }
  if (typeof node.value === "string") {
    return node.value;
  }
  if (Array.isArray(node.children)) {
    return node.children.map((child: any) => extractText(child)).join("");
  }
  return "";
}

export function extractCell(node: any): Pick<CellModel, "value" | "hyperlink" | "richTextRuns"> {
  const children = inlineChildren(node);
  const linkNodes = children.filter((child: any) => child.type === "link");
  if (linkNodes.length !== 1) {
    return richCellFromChildren(children, extractText(node));
  }

  const link = linkNodes[0];
  const linkIndex = children.indexOf(link);
  const before = children.slice(0, linkIndex).map((child: any) => extractText(child)).join("");
  const after = children.slice(linkIndex + 1).map((child: any) => extractText(child)).join("");
  const label = Array.isArray(link.children) ? link.children.map((child: any) => extractText(child)).join("") : "";
  const url = typeof link.url === "string" ? link.url : "";
  if (!url || before.trim()) {
    return richCellFromChildren(children, extractText(node));
  }

  const internalLocation = after.match(/^\s*\(([^()]+![A-Z]{1,3}\d+)\)\s*$/);
  if (url.startsWith("#") && internalLocation) {
    return {
      value: label,
      hyperlink: { target: internalLocation[1], kind: "internal" }
    };
  }

  if (!after.trim() && isExternalLinkTarget(url)) {
    return {
      value: label,
      hyperlink: { target: url, kind: "external" }
    };
  }

  return richCellFromChildren(children, extractText(node));
}

function inlineChildren(node: any): any[] {
  if (!Array.isArray(node?.children)) {
    return [];
  }
  if (node.children.length === 1 && node.children[0]?.type === "paragraph" && Array.isArray(node.children[0].children)) {
    return node.children[0].children;
  }
  return node.children;
}

function isExternalLinkTarget(url: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(url);
}

interface RichState {
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  underline?: boolean;
}

function richCellFromChildren(children: any[], fallback: string): Pick<CellModel, "value" | "richTextRuns"> {
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

export function collectImageRefs(node: any): { alt: string; path: string }[] {
  if (!node) {
    return [];
  }
  const refs: { alt: string; path: string }[] = [];
  if (node.type === "image" && typeof node.url === "string") {
    refs.push({
      alt: typeof node.alt === "string" ? node.alt : "",
      path: node.url
    });
  }
  for (const child of node.children ?? []) {
    refs.push(...collectImageRefs(child));
  }
  return refs;
}
