import { unified } from "unified";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
export { collectImageRefs, extractCell, extractText } from "./markdown-inline.ts";

export function parseMarkdown(markdown: string): any {
  return unified().use(remarkParse).use(remarkGfm).parse(markdown) as any;
}
