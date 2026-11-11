# Third party notices

Original image UI: Copyright (c) 2026 Lena, MIT (see /LICENSE).

pdfjs-dist 6.4.299 — Apache-2.0, Mozilla contributors. See vendor/pdfjs/LICENSE.

@aiden0z/pptx-renderer 1.3.0 — Apache-2.0. See vendor/pptx/LICENSE, THIRD_PARTY_NOTICES.md and licenses/. The browser bundle includes JSZip, ECharts and mtx-decompressor. MPL source availability: https://github.com/ChristopherVR/mtx-decompressor/tree/v1.4.2 .

html-to-image 1.11.13 — MIT. See vendor/capture/LICENSE.

JSZip 3.10.1 — dual licensed MIT/GPLv3, used under MIT. See vendor/zip/LICENSE.markdown.


## Layer-preserving source editor

Fabric.js 7.4.0 — MIT — https://github.com/fabricjs/fabric.js
License retained at vendor/layers/LICENSE-fabric.txt.

ag-psd 31.0.3 — MIT — https://github.com/Agamnentzar/ag-psd
License retained at vendor/layers/LICENSE-ag-psd.txt. Only library code is included; sample images/brush assets are not distributed.

The layer project format is coex-layer-project version 1. PSD import retains pixel-layer positions/order/opacity/visibility and source text where available, but does not reconstruct Photoshop masks, blend modes, adjustment/effects, smart-object internals or editable original typography. SVG import accepts basic vector/text/embedded raster assets, rejecting external content and unsupported effects. JSON stores editable Fabric objects and embedded bitmap data. Raster downloads/SNS ZIPs remain flattened.

## Flat-source recognition

Tesseract.js 6.0.1 — Apache-2.0 — https://github.com/naptha/tesseract.js . License: vendor/ocr/LICENSE-tesseract.txt.
Tesseract.js-core 6.1.2 (Tesseract WebAssembly) — Apache-2.0 — https://github.com/naptha/tesseract.js-core . License: vendor/ocr/LICENSE-core.txt.
Official tessdata_fast kor/eng language data — Apache-2.0 — https://github.com/tesseract-ocr/tessdata_fast . License: vendor/ocr/LICENSE-tessdata.txt. Exact revision, npm integrity-verified archives and delivered-file SHA256: vendor/ocr/vendor-lock.json. Browser assets are served locally; no CDN or remote OCR inference is used.
The graphic-region proposer is a conservative colour/connected-component heuristic written for this application, not LayerD, Qwen, or a trained semantic classifier. Pixel layers preserve initial visible regions; background fill and OCR text are estimates.

Automatic low-confidence Korean crop fallback model: tesseract-ocr/tessdata_best, Apache-2.0. License vendor/ocr/LICENSE-tessdata-best.txt; revision and SHA256 in vendor/ocr/vendor-lock.json and best-model-lock.json. English data in the best folder is identical to the pinned tessdata_fast English model.


PPTX original-object extraction: local nd/text-container adapter modifications to the pinned renderer are documented in vendor/pptx/COEX_ADAPTER.md. Original Apache-2.0/dependency licenses remain retained. No BiRefNet/SAM2/LaMa model is bundled by this adapter.


## Browser photo foreground AI

ONNX Runtime Web1.23.2 (MIT), self-hosted. License and third-party notices: vendor/ai/LICENSE-onnxruntime.txt, ThirdPartyNotices.txt. npm archive integrity and delivered runtime SHA256: vendor/ai/vendor-lock.json.
BiRefNet lite512 converted weights/configs: studioludens/birefnet-lite-512, revision962e67969ec6acec9c19fab76acee4f5e22e990c, MIT. Copyright(c)2024 ZhengPeng; Copyright(c)2026 Studio Ludens V.O.F. Full license vendor/ai/LICENSE-model-web512.txt, model revision/source/chunk SHA256 in vendor/ai/model-web512-*.json. Original BiRefNet code https://github.com/ZhengPeng7/BiRefNet . No user file bytes are sent to model providers; assets are self-hosted and inference runs in a browser worker. Matting is an estimate, not source-layer restoration. No SAM2/LaMa or Penpot platform code is added. Yoga 3.2.1 is included separately for layout calculation; its MIT license/notices are retained in vendor/yoga.


## Yoga layout integration

Yoga (yoga-layout) 3.2.1 — MIT — https://github.com/react/yoga . License: vendor/yoga/LICENSE. Verified npm archive integrity and delivered-file SHA256: vendor/yoga/vendor-lock.json. Same-origin ESM embeds WASM; no CDN or remote layout inference. Penpot Flexbox concepts guide the original coex-flex-v1 rule schema; no Penpot source code is bundled.
