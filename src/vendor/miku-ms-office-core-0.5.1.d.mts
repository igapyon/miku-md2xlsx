export interface ZipEntryInput {
  path: string;
  data: Uint8Array | string;
  date?: Date;
  compression?: "store" | "deflate";
}

export interface OpcRelationship {
  id: string;
  type: string;
  target: string;
  targetMode?: string;
}

export declare function buildOpcContentTypesXml(input: {
  defaults?: Array<{ extension: string; contentType: string }>;
  overrides?: Array<{ partName: string; contentType: string }>;
}): string;

export declare function buildOpcRelationshipsXml(relationships: OpcRelationship[]): string;

export declare function writeZipPackage(entries: ZipEntryInput[]): Uint8Array;
