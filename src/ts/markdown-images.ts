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
