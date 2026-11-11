import {embeddedProjectFonts} from './pptx-native-elements.mjs';
import {extractPptxObjects,preparePptxCapture} from './pptx-object-layers.mjs';
// Document pages become local canvases. No file bytes leave the browser.
const vendor = name => new URL('./vendor/'+name, import.meta.url).href;
const MAX_SIDE = 12000, MAX_PIXELS = 24000000;
const stale = signal => { if (signal.aborted) throw new DOMException('Cancelled','AbortError'); };
let pdfModule, pptModule, captureModule;
function targetScale(width,height) { return Math.min(2,4096/Math.max(width,height),Math.sqrt(MAX_PIXELS/(width*height))); }

export async function openDocument(buffer,kind,signal) {
  stale(signal);
  if (kind === 'pdf') return openPdf(buffer,signal);
  return openPptx(buffer,signal);
}

async function openPdf(buffer,signal) {
  pdfModule ||= import(vendor('pdfjs/pdf.min.mjs'));
  const pdfjs = await pdfModule; stale(signal);
  pdfjs.GlobalWorkerOptions.workerSrc = vendor('pdfjs/pdf.worker.min.mjs');
  const task = pdfjs.getDocument({
    data: new Uint8Array(buffer), cMapUrl: vendor('pdfjs/cmaps/'), cMapPacked:true,
    standardFontDataUrl: vendor('pdfjs/standard_fonts/'), wasmUrl:vendor('pdfjs/wasm/'),
    isEvalSupported:false, enableXfa:false, stopAtErrors:true,
    maxImageSize:MAX_PIXELS, canvasMaxAreaInBytes:MAX_PIXELS*4,
  });
  let password = false;
  task.onPassword = () => { password = true; void task.destroy(); };
  const abort = () => { void task.destroy(); };
  signal.addEventListener('abort',abort,{once:true});
  let pdf;
  try { pdf = await task.promise; stale(signal); }
  catch (error) { signal.removeEventListener('abort',abort); if (password) throw Error('PASSWORD'); throw error; }
  if (!pdf.numPages) { await task.destroy(); signal.removeEventListener('abort',abort); throw Error('PAGES'); }
  return {
    count:pdf.numPages, kind:'pdf', externalRemoved:false,
    async render(index,pageSignal) {
      stale(pageSignal);
      const page = await pdf.getPage(index+1); stale(pageSignal);
      const natural = page.getViewport({scale:1});
      const viewport = page.getViewport({scale:targetScale(natural.width,natural.height)});
      const canvas = document.createElement('canvas'); canvas.width=Math.max(1,Math.round(viewport.width)); canvas.height=Math.max(1,Math.round(viewport.height));
      if (canvas.width>MAX_SIDE || canvas.height>MAX_SIDE || !Number.isFinite(viewport.width)) throw Error('DIMENSIONS');
      const renderTask=page.render({canvasContext:canvas.getContext('2d'),viewport,background:'#ffffff'});
      const cancel = () => renderTask.cancel(); pageSignal.addEventListener('abort',cancel,{once:true});
      try { await renderTask.promise; stale(pageSignal); return {canvas,partial:false}; }
      finally { pageSignal.removeEventListener('abort',cancel); page.cleanup(); }
    },
    async dispose() { signal.removeEventListener('abort',abort); await task.destroy(); }
  };
}

function removeExternalRelationships(files) {
  let removed = false;
  const clean = xml => {
    const doc = new DOMParser().parseFromString(xml,'application/xml');
    for (const rel of [...doc.getElementsByTagNameNS('*','Relationship')]) {
      if (rel.getAttribute('TargetMode')?.toLowerCase() === 'external') { rel.remove(); removed=true; }
    }
    return new XMLSerializer().serializeToString(doc);
  };
  files.presentationRels = clean(files.presentationRels);
  for (const key of ['slideRels','slideLayoutRels','slideMasterRels','chartRels']) {
    if (files[key]) for (const [name,xml] of files[key]) files[key].set(name,clean(xml));
  }
  // Embedded SVG may itself contain linked images/styles; remove remote sources.
  for (const [name,data] of files.media) {
    if (!name.toLowerCase().endsWith('.svg')) continue;
    const doc = new DOMParser().parseFromString(new TextDecoder().decode(data),'image/svg+xml');
    doc.querySelectorAll('script,foreignObject').forEach(node=>{node.remove();removed=true;});
    for(const node of doc.querySelectorAll('*')) for(const attr of [...node.attributes]) {
      if (/^on/i.test(attr.name) || /(?:https?:|\/\/|javascript:|@import)/i.test(attr.value)) { node.removeAttribute(attr.name); removed=true; }
    }
    for(const node of doc.querySelectorAll('style')) if (/(?:https?:|\/\/|@import)/i.test(node.textContent)) {node.remove();removed=true;}
    files.media.set(name,new TextEncoder().encode(new XMLSerializer().serializeToString(doc)));
  }
  return removed;
}

async function openPptx(buffer,signal) {
  pptModule ||= import(vendor('pptx/pptx-renderer.js'));
  const ppt = await pptModule; stale(signal);
  const limits={...ppt.RECOMMENDED_ZIP_LIMITS,maxEntries:100000,maxEntryUncompressedBytes:256*1024*1024,maxTotalUncompressedBytes:2*1024*1024*1024,maxMediaBytes:2*1024*1024*1024,maxConcurrency:2};
  const files=await ppt.parseZipLazyMedia(buffer,limits); stale(signal);
  let externalRemoved=removeExternalRelationships(files);
  // Media is inflated only when a selected slide asks for it. Sanitize lazy SVG too.
  const resolver=files.mediaResolver,resolve=resolver.resolve.bind(resolver);
  resolver.resolve=async path=>{stale(signal);const result=await resolve(path);stale(signal);
    if(result&&result.mediaPath.toLowerCase().endsWith('.svg')){
      const holder={presentationRels:'<Relationships/>',media:new Map([[result.mediaPath,result.data]])};
      if(removeExternalRelationships(holder))externalRemoved=true;result.data=holder.media.get(result.mediaPath);files.media.set(result.mediaPath,result.data);
    }return result;};
  const presentation=ppt.buildPresentation(files,{lazySlides:true});
  if (!presentation.slides.length) throw Error('PAGES');
  if (!(presentation.width>0 && presentation.height>0 && presentation.width<=MAX_SIDE && presentation.height<=MAX_SIDE)) throw Error('DIMENSIONS');
  let disposed=false;
  return {
    count:presentation.slides.length,kind:'pptx',get externalRemoved(){return externalRemoved;},
    get mediaStats(){return{loaded:files.media.size,bytes:resolver.loadedBytes,total:resolver.totalCount};},
    async render(index,pageSignal,onProgress) {
      files.media.clear();resolver.loadedPaths?.clear();
      stale(pageSignal); if(disposed) throw new DOMException('Cancelled','AbortError');
      captureModule ||= import(vendor('capture/html-to-image.js'));
      await captureModule; stale(pageSignal);
      const host=document.createElement('div'); host.className='document-render-host'; host.inert=true; document.body.appendChild(host);
      let partial=false,handle;
      const charts=new Set();
      try {
        handle=ppt.renderSlide(presentation,presentation.slides[index],{
          pdfjs:{moduleUrl:vendor('pdfjs/pdf.min.mjs'),workerUrl:vendor('pdfjs/pdf.worker.min.mjs')},
          onNodeError:()=>{partial=true;},onNavigate:()=>{},chartInstances:charts,
        });
        host.appendChild(handle.element); await handle.ready; stale(pageSignal);
        // ECharts may still be animating after DOM render. Export its final state.
        for(const chart of charts){chart.setOption({animation:false,animationDuration:0,animationDurationUpdate:0});chart.getZr().flush();}
        await document.fonts.ready; stale(pageSignal);
        await Promise.all([...handle.element.querySelectorAll('img')].map(im=>im.decode().catch(()=>{partial=true;}))); stale(pageSignal);
        await preparePptxCapture(handle.element,{signal:pageSignal}); stale(pageSignal);
        // Capture at the slide's intrinsic layout size, regardless of viewport width.
        const canvas=await globalThis.htmlToImage.toCanvas(handle.element,{
          width:presentation.width,height:presentation.height,pixelRatio:targetScale(presentation.width,presentation.height),
          skipFonts:true,cacheBust:false,
          style:{transform:'none',margin:'0'},
        });
        stale(pageSignal); if(disposed) throw new DOMException('Cancelled','AbortError');
        let layerProject=null,nativeError=null;
        try{if(partial)throw Error('일부 PPTX 객체를 표시하지 못해 정확한 객체 분리를 중단했습니다.');layerProject=await extractPptxObjects(handle.element,canvas,{width:presentation.width,height:presentation.height,pixelRatio:targetScale(presentation.width,presentation.height),signal:pageSignal,onProgress});layerProject.fonts=await embeddedProjectFonts(presentation,ppt,layerProject.scene.objects);}
        catch(error){stale(pageSignal);nativeError=error.message||'PPTX 원본 객체를 분리하지 못했습니다.';}
        stale(pageSignal);return {canvas,partial,layerProject,nativeError};
      } finally { handle?.dispose(); host.remove(); }
    },
    async dispose() { disposed=true; files.media.clear();files.mediaResolver?.entries?.clear(); }
  };
}
