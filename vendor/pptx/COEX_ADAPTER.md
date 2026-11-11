# Local adapter notice

@aiden0z/pptx-renderer 1.3.0 remains under Apache-2.0 with its original notices/licenses.
2026-10-17 local modifications: nd wrapper marks each original shape/picture/table/chart/group DOM element and records its original OOXML id/name/text; LR text rendering marks native text containers. The application uses these markers to isolate drawing objects before OCR. Core geometry/rendering logic and dependency notices remain retained.

2026-10-18 local modification: lazy ZIP parsing defers media entry-size/aggregate checks until media is requested, so unrelated embedded media does not reject an otherwise readable selected slide. Non-media ZIP validation and the per-entry inflate check remain. The application uses parseZipLazyMedia, sanitizes lazy SVG content and evicts previous-page media. Original dependency licenses remain unchanged.

2026-10-18 editable-vector adapter: export coexDecodeEmbeddedFont using the existing bounded EOT/SFNT decoder (including its embedding-permission checks). The application uses rendered DOM run styles and SVG geometry for editable Fabric text/path objects, preserves the original DOM paint order and group transforms, and persists permitted embedded font bytes in the project. Complex unsupported rendering still uses object images.
