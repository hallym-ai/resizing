import {sourceDigest} from './outside-recovery.mjs';
import {nativeText,nativeShape} from './pptx-native-elements.mjs';
import {readSimplePicture} from './dom-picture-evidence.mjs';
import {outsidePictureSvg} from './outside-picture-svg.mjs';
import {mergeOutsideCandidate} from './outside-merge-runtime.mjs';
import {derivePictureEvidence} from './ooxml-picture-provenance.mjs';
import {matchRendererGeometry} from './renderer-geometry-gate.mjs';
/* Separate PPTX drawing objects before any raster OCR or colour segmentation. */
const stale=signal=>{if(signal.aborted)throw new DOMException('Cancelled','AbortError');};
function image(src,w,h,x,y,name,role='other',text='',locked=false){return{type:'Image',version:'7.4.0',originX:'left',originY:'top',left:x,top:y,width:w,height:h,scaleX:1,scaleY:1,angle:0,opacity:1,visible:true,src,layerName:name,layerRole:role,layerLocked:locked,sourceText:text,crossOrigin:null,filters:[]};}
function crop(canvas){const w=canvas.width,h=canvas.height,ctx=canvas.getContext('2d',{willReadFrequently:true}),data=ctx.getImageData(0,0,w,h).data;let x0=w,y0=h,x1=-1,y1=-1;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(data[(y*w+x)*4+3]){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
 if(x1<0)return null;const c=document.createElement('canvas');c.width=x1-x0+1;c.height=y1-y0+1;c.getContext('2d').drawImage(canvas,x0,y0,c.width,c.height,0,0,c.width,c.height);return{canvas:c,x:x0,y:y0};
}

// SVG image subresources inside a foreignObject export cannot retain blob URLs.
// Inline imported media before both whole-slide and individual-object capture.
const preparedMedia=new WeakMap();
export async function preparePptxCapture(root,{signal}={}){
 let cached=preparedMedia.get(root);if(cached)return cached;
 const task=(async()=>{const resources=new Map();let bytes=0,count=0;
  for(const im of root.querySelectorAll('svg image')){
   if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
   const src=im.getAttribute('href')||im.getAttributeNS('http://www.w3.org/1999/xlink','href')||im.getAttribute('xlink:href');if(!src)continue;
   if(!src.startsWith('blob:')&&!src.startsWith('data:image/'))throw Error('PPTX 이미지 채움은 파일 안에 포함된 이미지여야 합니다.');
   if(!resources.has(src))resources.set(src,(async()=>{
    let url=src;if(src.startsWith('blob:')){const response=await fetch(src,{signal});if(!response.ok)throw Error('PPTX 이미지 채움 자료를 읽지 못했습니다.');const blob=await response.blob();bytes+=blob.size;if(bytes>128*1024*1024)throw Error('PPTX 이미지 채움 자료가 작업 한도를 넘습니다.');url=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('PPTX 이미지 자료를 변환하지 못했습니다.'));reader.readAsDataURL(blob);});}
    const probe=new Image();probe.src=url;try{await probe.decode();}catch{throw Error('PPTX 이미지 채움 자료를 표시하지 못했습니다.');}return url;
   })());
   const url=await resources.get(src);im.setAttribute('href',url);im.setAttributeNS('http://www.w3.org/1999/xlink','xlink:href',url);count++;
  }return{imageFillResources:count,uniqueResources:resources.size,embeddedBytes:bytes,status:'embedded-local-media'};
 })();preparedMedia.set(root,task);try{return await task;}catch(error){preparedMedia.delete(root);throw error;}
}

export async function extractPptxObjects(root,original,{width,height,pixelRatio,signal,onProgress,provenance}){
 // Isolated diagnostic; never used to change a visible or saved object.
 const outsideProbe={status:'diagnostic-only',records:[]};globalThis.coexOriginalOutsideProbe=outsideProbe;
 const mediaCoverage=await preparePptxCapture(root,{signal});
 const leaves=[...root.querySelectorAll('[data-coex-pptx-node]')].filter(el=>el.dataset.coexPptxType!=='group'),nodes=[];
 for(const el of leaves){const info=el.coexPptxInfo||{},text=el.querySelector('[data-coex-pptx-text]');
  if(info.text&&text){nodes.push({el,info:{...info,text:''},excludeText:true});nodes.push({el:text,info:{...info,type:'text'}});}
  else nodes.push({el,info});
 }
 const W=original.width,H=original.height,objects=[],warnings=[];let pixels=W*H,empty=0;
 // Allocate a bounded working texture budget, rather than rejecting a whole slide.
 // Geometry and OOXML text stay at original slide coordinates.
 const budget=Math.max(1000000,56000000-2*W*H),count=Math.max(1,nodes.length);
 const captureRatio=Math.min(pixelRatio,Math.sqrt(budget/(width*height*count)));
 const captureWidth=Math.max(1,Math.floor(width*captureRatio)),captureHeight=Math.max(1,Math.floor(height*captureRatio));
 const sx=W/captureWidth,sy=H/captureHeight;
 if(captureRatio<pixelRatio*.99)warnings.push('복잡한 슬라이드는 객체 작업용 해상도를 자동 조절했습니다. 원본 좌표·독립 객체·글자 원문은 유지합니다.');
 const capture=filter=>globalThis.htmlToImage.toCanvas(root,{width,height,pixelRatio:captureRatio,skipFonts:true,cacheBust:false,filter,style:{transform:'none',margin:'0',backgroundColor:'transparent',backgroundImage:'none'}});
 // Keep the actual slide fill separately; do not infer a colour or erase text.
 const background=await globalThis.htmlToImage.toCanvas(root,{width,height,pixelRatio,skipFonts:true,cacheBust:false,filter:node=>!node.dataset?.coexPptxNode,style:{transform:'none',margin:'0'}});stale(signal);
 objects.push(image(background.toDataURL('image/png'),W,H,0,0,'PPTX 슬라이드 배경','background','',true));background.width=background.height=0;
 for(let i=0;i<nodes.length;i++){
  stale(signal);const {el,info,excludeText}=nodes[i],ancestors=new Set();let p=el;while(p&&p!==root){ancestors.add(p);p=p.parentElement;}
  // Retain each ancestor transform, but never a sibling's text or picture.
  const filter=node=>{if(node===root)return true;if(excludeText&&node.dataset?.coexPptxText)return false;if(ancestors.has(node.parentElement)&&node.parentElement!==el&&!ancestors.has(node))return false;if(node.dataset?.coexPptxNode&&!ancestors.has(node)&&!el.contains(node))return false;return true;};
  let native=null;
  try{if(info.type==='text')native=await nativeText(el,root,info,{x:W/width,y:H/height});else if(info.type==='shape')native=await nativeShape(el,root,{x:W/width,y:H/height});}catch{}
  if(native){
   if(native.empty)empty++;else{const o=native.object,b=native.bounds,text=String(info.text||'').slice(0,20000),full=b.width>=W*.97&&b.height>=H*.97&&b.left<=2&&b.top<=2;
    Object.assign(o,{layerName:(text||info.name||`객체 ${i+1}`).replace(/\s+/g,' ').trim().slice(0,170),layerRole:/로고|logo/i.test(info.name||'')?'logo':full&&!text?'background':text?'other':'decoration',sourceText:text,sourceElementId:String(info.id||i),sourceElementType:info.type,sourceStackIndex:i,cutoutMethod:'pptx-original-object'});o.layerRoleInferred=true;o.sourceImageFill=!!el.querySelector('svg image');o.layerLocked=o.layerRole==='background';objects.push(o);
   }
   onProgress?.(i+1,nodes.length);await new Promise(resolve=>setTimeout(resolve,0));continue;
  }
  const styled=[];if(info.type==='text')for(const ancestor of ancestors)if(ancestor!==el){styled.push([ancestor,ancestor.style.backgroundColor,ancestor.style.backgroundImage,ancestor.style.boxShadow]);ancestor.style.backgroundColor='transparent';ancestor.style.backgroundImage='none';ancestor.style.boxShadow='none';}
  let canvas,cropped,outsideRec=null;
  try{canvas=await capture(filter);stale(signal);cropped=crop(canvas);
   if(info.type==='picture'){
    const rr=root.getBoundingClientRect(),er=el.getBoundingClientRect(),left=er.left-rr.left,top=er.top-rr.top,right=er.right-rr.left,bottom=er.bottom-rr.top;
    if([left,top,right,bottom].every(Number.isFinite)&&(left<0||top<0||right>width||bottom>height)){
     let rec;try{if(outsideProbe.records.length>=12){rec={name:info.name,id:info.id,reason:'candidate-limit-review'};}else{const evidence=await readSimplePicture(el,root,{signal,width,height});
      if(!evidence.ok)rec={name:info.name,id:info.id,reason:evidence.reason};
      else{const match=String(info.id||'').match(/^slide:(\d+)$/);let source=null,geometry=null;
       if(match&&provenance?.slideXml&&provenance?.relsXml&&provenance?.slidePart&&typeof provenance.readMedia==='function'){
        const response=await fetch(evidence.mediaDataUrl,{signal});const displayed=new Uint8Array(await response.arrayBuffer());stale(signal);
        const sourceRecords=await derivePictureEvidence({...provenance,onlyId:match[1],displayedBytes:async id=>id===match[1]?displayed:null});source=sourceRecords[0]||null;
        if(source&&(source.status==='source-verified'||source.status==='source-equivalent'))geometry=matchRendererGeometry(source,evidence.object);
       }
       if(!source||!['source-verified','source-equivalent'].includes(source.status)||geometry?.status!=='geometry-matched')rec={name:info.name,id:info.id,reason:'source-review:'+(source?.reason||'unavailable')+':'+(geometry?.reason||'not-matched')};
       else{const padding={left:Math.ceil(Math.max(0,-left)+2),right:Math.ceil(Math.max(0,right-width)+2),top:Math.ceil(Math.max(0,-top)+2),bottom:Math.ceil(Math.max(0,bottom-height)+2)};
       const trial=outsidePictureSvg({slideWidth:width,slideHeight:height,padding,object:evidence.object,mediaDataUrl:evidence.mediaDataUrl,maxPixels:4000000,insetX:2*width/captureWidth,insetY:2*height/captureHeight});
       rec=trial.ok?{name:info.name,id:info.id,status:'unverified-render',sourceStatus:source.status,sourceSha:source.media.sha256,geometryStatus:geometry.status,geometry:evidence.object,viewBox:trial.viewBox,svg:trial.svg}:{name:info.name,id:info.id,reason:trial.reason};
      }}}
     }catch(e){if(signal.aborted)throw e;rec={name:info.name,id:info.id,reason:String(e)};}
     outsideRec=rec;outsideProbe.records.push(rec);
    }
   }
   else{
    // Native conversion failed: this canvas-captured object may have already
    // lost off-slide pixels. Record the limitation; never invent a patch.
    const rr=root.getBoundingClientRect(),er=el.getBoundingClientRect(),left=er.left-rr.left,top=er.top-rr.top,right=er.right-rr.left,bottom=er.bottom-rr.top;
    if([left,top,right,bottom].every(Number.isFinite)&&(left<0||top<0||right>width||bottom>height))outsideProbe.records.push({name:info.name,id:info.id,reason:'non-picture-capture-boundary-review'});
   }
   if(!cropped){if(outsideRec)outsideRec.mergeReason='off-slide-only-not-retained';if(el.querySelector('svg image'))throw Error('이미지 채움 도형을 표시하지 못해 개별 요소 분리를 중단했습니다. 원본 화면을 확인하세요.');empty++;continue;}
   const c=cropped.canvas;pixels+=c.width*c.height;
   const text=String(info.text||'').slice(0,20000),name=(text?text.replace(/\s+/g,' ').trim():String(info.name||`객체 ${i+1}`)).slice(0,170),full=c.width>=captureWidth*.97&&c.height>=captureHeight*.97&&cropped.x<=2&&cropped.y<=2;
   const role=/로고|logo/i.test(String(info.name||name))?'logo':full&&!text?'background':text?'other':info.type==='picture'?'subject':'decoration';
   const o=image(c.toDataURL('image/png'),c.width,c.height,cropped.x,cropped.y,text?name:`PPTX ${name}`,role,text,role==='background');
   o.left*=sx;o.top*=sy;o.scaleX=sx;o.scaleY=sy;
   // Diagnostic trial only: exposed outside content remains review status.
   // A full-width edge strip may be the existing footer or background, not
   // movable decoration. Keep it on the original path until its role is proven.
   const edgeStrip=(cropped.x<=2&&cropped.x+c.width>=captureWidth-2&&(cropped.y<=2||cropped.y+c.height>=captureHeight-2))||(cropped.y<=2&&cropped.y+c.height>=captureHeight-2&&(cropped.x<=2||cropped.x+c.width>=captureWidth-2));
   if(outsideRec?.status==='unverified-render'&&!full&&!edgeStrip){
    try{const merged=await mergeOutsideCandidate({svg:outsideRec.svg,viewBox:outsideRec.viewBox,baseCanvas:c,cropX:cropped.x,cropY:cropped.y,captureWidth,captureHeight,width,height,sx,sy,signal});
     if(merged.ok){o.outsideRecovery={version:1,status:'unverified',visible:false,baseSourceDigest:await sourceDigest(o.src),outer:merged.outer,slide:{width:W,height:H},original:{left:o.left,top:o.top,width:o.width,height:o.height,scaleX:o.scaleX,scaleY:o.scaleY,cropX:0,cropY:0}};outsideRec.stored=true;outsideRec.added=merged.added;}
     else outsideRec.mergeReason=merged.reason;
    }catch(e){if(signal.aborted)throw e;outsideRec.mergeReason=String(e)}
   }else if(outsideRec&&edgeStrip)outsideRec.mergeReason='ambiguous-edge-strip';
   o.nativeKind='image';o.sourceStackIndex=i;o.layerRoleInferred=true;o.sourceImageFill=!!el.querySelector('svg image');
   o.sourceElementId=String(info.id||i);o.sourceElementType=info.type||'shape';o.cutoutMethod='pptx-original-object';objects.push(o);
  }finally{for(const [ancestor,color,bg,shadow]of styled){ancestor.style.backgroundColor=color;ancestor.style.backgroundImage=bg;ancestor.style.boxShadow=shadow;}if(canvas)canvas.width=canvas.height=0;if(cropped)cropped.canvas.width=cropped.canvas.height=0;}
  onProgress?.(i+1,nodes.length);await new Promise(resolve=>setTimeout(resolve,0));
 }
 const textCount=objects.filter(o=>o.sourceText).length,pictureCount=leaves.filter(n=>n.coexPptxInfo?.type==='picture').length;
 if(!textCount&&pictureCount)warnings.push('이 슬라이드에 독립 글자 객체가 없습니다. 그림 안에 합쳐진 글자는 원래 레이어로 분리할 수 없습니다.');
 if(empty)warnings.push(`화면에 보이지 않는 객체 ${empty}개는 제외했습니다.`);
 const editableTextCount=objects.filter(o=>o.nativeKind==='text').length,vectorCount=objects.filter(o=>o.nativeKind==='vector').length;
 warnings.push(`편집 글자 ${editableTextCount}개 · 벡터 도형 ${vectorCount}개. 표·차트와 지원하지 않는 복잡한 효과는 원본 객체 이미지로 보존합니다. 원본 글꼴이 없으면 대체 글꼴로 표시될 수 있습니다.`);
 const ref=image(original.toDataURL('image/png'),W,H,0,0,'PPTX 원본 비교용 · 숨김','background','',true);ref.visible=false;objects.unshift(ref);
 const recoveryRecords=outsideProbe.records.slice(0,200).map((r,i)=>({id:String(r.id||`unknown:${i}`).slice(0,120),name:String(r.name||'요소').slice(0,170),candidate:!!r.stored,reason:r.stored?'':r.mergeReason==='off-slide-only-not-retained'?'off-slide':r.reason==='candidate-limit-review'?'limit':r.mergeReason==='ambiguous-edge-strip'?'ambiguous':r.reason?'unsupported':'other'}));
 const outsideRecoveryReport=recoveryRecords.length?{version:1,records:recoveryRecords,omitted:Math.max(0,outsideProbe.records.length-200)}:null;
 return{format:'coex-layer-project',version:objects.some(o=>o.outsideRecovery)||outsideRecoveryReport?2:1,...(outsideRecoveryReport?{outsideRecoveryReport}:{}),width:W,height:H,analysis:{engine:'pptx-original-objects',mediaCoverage,workingPixelRatio:captureRatio,sourcePixelRatio:pixelRatio,objectCount:objects.length-2,textCount,pictureCount,editableTextCount,vectorCount,warnings},scene:{version:'7.4.0',objects}};
}
