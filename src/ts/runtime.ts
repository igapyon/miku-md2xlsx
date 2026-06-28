import packageJson from "../../package.json" with { type: "json" };

export { markdownToXlsxModel, md2xlsx, workbookModelToXlsx } from "./core.ts";
export type { CellModel, Md2XlsxOptions, RowModel, SheetModel, WorkbookModel } from "./core.ts";

export const productName = packageJson.name;
export const productVersion = packageJson.version;
