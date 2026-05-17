import type { SheetDrawing } from "./xlsx-drawing-types.ts";
import { IMAGE_PREVIEW_COLUMNS } from "./xlsx-drawing-types.ts";
import { xml } from "./xlsx-xml.ts";

export function drawingXml(drawing: SheetDrawing): string {
  const anchors = drawing.images.map((image, imageIndex) => {
    const row = image.rowIndex;
    const col = 1;
    return `<xdr:twoCellAnchor editAs="oneCell">
<xdr:from><xdr:col>${col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
<xdr:to><xdr:col>${col + IMAGE_PREVIEW_COLUMNS}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row + image.previewRows}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
<xdr:pic>
<xdr:nvPicPr><xdr:cNvPr id="${imageIndex + 1}" name="${xml(image.alt || image.path)}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>
<xdr:blipFill><a:blip r:embed="${image.relationshipId}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>
<xdr:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr>
</xdr:pic>
<xdr:clientData/>
</xdr:twoCellAnchor>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
${anchors}
</xdr:wsDr>`;
}

export function drawingRelsXml(drawing: SheetDrawing): string {
  const relationships = drawing.images.map((image) => (
    `<Relationship Id="${image.relationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${image.mediaPath}"/>`
  )).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${relationships}
</Relationships>`;
}
