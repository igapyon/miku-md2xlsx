import packageJson from "../package.json" with { type: "json" };

const runtime = await import("../bundle/miku-md2xlsx-runtime.mjs");

if (runtime.productName !== packageJson.name) {
  throw new Error(`Unexpected runtime product name: ${runtime.productName}`);
}

if (runtime.productVersion !== packageJson.version) {
  throw new Error(`Unexpected runtime product version: ${runtime.productVersion}`);
}

for (const exportName of ["markdownToXlsxModel", "workbookModelToXlsx", "md2xlsx"]) {
  if (typeof runtime[exportName] !== "function") {
    throw new Error(`Runtime bundle does not export ${exportName}.`);
  }
}

const workbook = runtime.markdownToXlsxModel("# Runtime Smoke\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n");
if (!Array.isArray(workbook.sheets) || workbook.sheets.length !== 1) {
  throw new Error("Runtime markdownToXlsxModel returned an unexpected workbook shape.");
}

const xlsx = runtime.md2xlsx("# Runtime Smoke\n");
if (!(xlsx instanceof Uint8Array) || xlsx.byteLength < 100) {
  throw new Error("Runtime md2xlsx returned an unexpectedly small XLSX payload.");
}
