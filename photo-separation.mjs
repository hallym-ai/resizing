import './photo-mask-import.mjs';
import {removePhotoBackground} from './photo-ai.mjs';
import {splitPhotoPixels} from './photo-separation-mask.mjs';
import {applyPhotoSeparation} from './photo-separation-transaction.mjs';
import {estimateHiddenBackground} from './photo-background-inpaint.mjs';
import {installPhotoCompositeRecovery} from './photo-composite-recovery.mjs';
import {unsafePhotoSourceRenderer} from './photo-composite-render.mjs';

// Explicit, local-only inference on one selected picture. A proposal never
// changes the source until the user applies it and the scene guard still holds.
const by=id=>document.getElementById(id),api=()=>globalThis.coexLayerLayout;
installPhotoCompositeRecovery(api);
const panel=document.createElement('details');panel.id='photoSeparationPanel';
panel.innerHTML=`<summary>실사 사진 속 상품과 배경 분리</summary><p class="layer-help">사진 레이어 하나를 선택하고 분리 결과를 확인하세요. 사진은 이 브라우저에서 처리하며 최초 실행 시 사진 모델을 준비합니다. 가는 경계는 거칠 수 있으니 전경과 배경을 먼저 확인하세요.</p><div class="layer-tools"><button id="photoSeparationStart" type="button" class="doc-btn">선택한 사진 분리</button><button id="photoSeparationCancel" type="button" class="doc-btn" hidden>분리 중지</button></div><p id="photoSeparationStatus" role="status" aria-live="polite">사진 요소를 선택하세요.</p><div id="photoSeparationPreviews" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px" hidden><figure style="margin:0"><figcaption>상품·전경 추정</figcaption><img id="photoSeparationForeground" alt="상품·전경 분리 후보" style="width:100%;height:150px;object-fit:contain;background:repeating-conic-gradient(#ddd 0 25%,#fff 0 50%) 0/16px 16px"></figure><figure style="margin:0"><figcaption>남은 배경 · 가려진 곳은 투명</figcaption><img id="photoSeparationBackground" alt="상품 뒤가 비어 있는 배경 후보" style="width:100%;height:150px;object-fit:contain;background:repeating-conic-gradient(#ddd 0 25%,#fff 0 50%) 0/16px 16px"></figure></div><button id="photoSeparationRepair" type="button" class="doc-btn" hidden>확인한 상품 뒤의 배경 후보 만들기</button><figure id="photoSeparationRepairFigure" style="margin:0" hidden><figcaption>주변색으로 추정한 배경 · 실제 원본 복원 아님</figcaption><img id="photoSeparationRepairPreview" alt="가려진 부분을 주변색으로 추정한 배경 후보" style="width:100%;height:150px;object-fit:contain;background:repeating-conic-gradient(#ddd 0 25%,#fff 0 50%) 0/16px 16px"></figure><label id="photoSeparationRepairChoice" class="layer-help" hidden><input id="photoSeparationUseRepair" type="checkbox"> 확인한 추정 배경을 함께 적용</label><button id="photoSeparationApply" type="button" class="doc-btn" hidden>확인 후 각각의 레이어로 적용</button><button id="photoSeparationDiscard" type="button" class="doc-btn" hidden>후보 닫기</button>`;
by('photoMaskPanel').after(panel);
let ticket=0,pending=null,controller=null;
const say=message=>{by('photoSeparationStatus').textContent=message;};
function selected(){const state=api()?.read(),canvas=state?.objects.find(o=>o.canvas)?.canvas,o=canvas?.getActiveObject();return {state,canvas,o};}
function allowed(o){return !!o&&!unsafePhotoSourceRenderer(o)&&String(o.type).toLowerCase()==='image'&&o.visible!==false&&!o.layerLocked&&!o.photoInstanceGroup&&!o.originalPhotoSource&&!o.group&&!o.clipPath&&!o.shadow&&!o.filters?.length&&!o.cropX&&!o.cropY&&!o.sourceText&&!o.sourceImageFill&&(!o.globalCompositeOperation||o.globalCompositeOperation==='source-over')&&!(o.stroke&&o.strokeWidth);}
function clear(){ticket++;controller?.abort();controller=null;pending=null;by('photoSeparationCancel').hidden=true;by('photoSeparationStart').disabled=false;by('photoSeparationApply').hidden=true;by('photoSeparationDiscard').hidden=true;by('photoSeparationRepair').hidden=true;by('photoSeparationRepair').disabled=false;by('photoSeparationRepairFigure').hidden=true;by('photoSeparationRepairChoice').hidden=true;by('photoSeparationUseRepair').checked=false;by('photoSeparationRepairPreview').removeAttribute('src');by('photoSeparationPreviews').hidden=true;by('photoSeparationForeground').removeAttribute('src');by('photoSeparationBackground').removeAttribute('src');}
function current(p){const {state,canvas,o}=selected();return !!state&&canvas===p.canvas&&o===p.object&&state.epoch===p.epoch&&state.revision===p.revision&&api()?.matchesAtomicLiveGuard?.(p.guard)&&o.getElement?.()===p.element&&o.getSrc?.()===p.source;}
function makeCanvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function encodePixels(pixels,w,h){const c=makeCanvas(w,h);try{const ctx=c.getContext('2d');ctx.putImageData(new ImageData(pixels,w,h),0,0);return c.toDataURL('image/png');}finally{c.width=c.height=0;}}
async function decode(src){const image=new Image();image.src=src;await image.decode();return image;}
by('photoSeparationStart').onclick=async()=>{
 clear();panel.open=true;const {state,canvas,o}=selected();
 if(!state||!allowed(o)){say(unsafePhotoSourceRenderer(o)?'바깥 영역이 복원된 사진은 원본 보존을 위해 자동 분리를 보류합니다.':'잠금이 해제된 사진 요소 한 개를 선택하세요. 이미 분리한 사진은 먼저 원본으로 복원하세요.');return;}
 const el=o.getElement?.(),w=el?.naturalWidth||el?.width,h=el?.naturalHeight||el?.height;
 if(!Number.isSafeInteger(w)||!Number.isSafeInteger(h)||w<1||h<1||w*h>4000000||o.width!==w||o.height!==h){say('원본 사진의 크기나 자르기 상태를 확인하세요. 사진은 400만 픽셀 이하에서 분리할 수 있습니다.');return;}
 const guard=api()?.captureAtomicLiveGuard?.();if(!guard){say('사진 이동이나 편집을 마친 뒤 다시 시도하세요.');return;}
 const p={canvas,object:o,epoch:state.epoch,revision:state.revision,guard,element:el,source:o.getSrc?.(),token:ticket},abort=new AbortController();controller=abort;by('photoSeparationStart').disabled=true;by('photoSeparationCancel').hidden=false;
 let original,estimate;
 try{
  say('사진 분리 모델을 준비하고 있습니다…');original=makeCanvas(w,h);const ctx=original.getContext('2d',{willReadFrequently:true});ctx.drawImage(el,0,0,w,h);
  estimate=await removePhotoBackground(original,{signal:abort.signal,onProgress:event=>{if(p.token!==ticket)return;if(event.phase==='download')say('사진 모델 준비 '+event.progress+'%');else if(event.phase==='inference')say('상품과 배경을 추정하고 있습니다…');}});
  if(p.token!==ticket||!current(p))throw Error('사진이나 편집 상태가 바뀌어 분리 후보를 취소했습니다.');
  const src=ctx.getImageData(0,0,w,h).data,mask=estimate.canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,w,h).data,result=splitPhotoPixels(src,mask,w,h);
  p.original=original.toDataURL('image/png');p.foreground=encodePixels(result.foreground,w,h);p.background=encodePixels(result.background,w,h);p.backgroundPixels=new Uint8ClampedArray(result.background);p.width=w;p.height=h;p.sourcePixels=new Uint8ClampedArray(src);p.mask=new Uint8Array(w*h);for(let i=0;i<w*h;i++)if(result.foreground[i*4+3])p.mask[i]=255;
  if(p.original.length+p.foreground.length+p.background.length>35*1024*1024)throw Error('분리 결과가 프로젝트 저장 용량을 넘을 수 있습니다. 사진 크기를 줄여 다시 시도하세요.');
  if(p.token!==ticket||!current(p))throw Error('사진이나 편집 상태가 바뀌어 분리 후보를 취소했습니다.');
  pending=p;by('photoSeparationForeground').src=p.foreground;by('photoSeparationBackground').src=p.background;by('photoSeparationPreviews').hidden=false;by('photoSeparationApply').hidden=false;by('photoSeparationDiscard').hidden=false;by('photoSeparationRepair').hidden=false;
  say('분리 후보입니다. 상품·글씨의 누락과 경계를 확인하세요. 상품 뒤의 가려진 배경은 아직 복원되지 않았습니다.');
 }catch(error){if(p.token===ticket)say(error.name==='AbortError'?'사진 분리를 중지했습니다.':error.message);}
 finally{if(original)original.width=original.height=0;if(estimate?.canvas)estimate.canvas.width=estimate.canvas.height=0;if(p.token===ticket){controller=null;by('photoSeparationCancel').hidden=true;by('photoSeparationStart').disabled=false;}}
};
by('photoSeparationCancel').onclick=()=>{clear();say('사진 분리를 중지했습니다.');};
by('photoSeparationDiscard').onclick=()=>{clear();say('분리 후보를 닫았습니다. 원본 사진은 유지됩니다.');};
by('photoSeparationRepair').onclick=async()=>{
 const p=pending;if(!p||!current(p)){clear();say('사진 선택이나 편집 상태가 바뀌었습니다. 다시 분리해 주세요.');return;}
 if(p.object.opacity!==1){say('반투명 사진에는 배경 추정 후보를 적용할 수 없습니다. 불투명도를 100%로 바꾼 뒤 다시 시도하세요.');return;}
 for(let i=0;i<p.mask.length;i++)if(p.mask[i]&&p.sourcePixels[i*4+3]!==255){say('반투명 상품 뒤의 배경은 안전하게 추정할 수 없어 보류했습니다.');return;}
 const abort=new AbortController();controller=abort;by('photoSeparationRepair').disabled=true;by('photoSeparationCancel').hidden=false;
 try{
  say('확인한 상품 뒤의 배경을 주변 색으로 추정하고 있습니다…');
  const result=await estimateHiddenBackground({pixels:p.sourcePixels,mask:p.mask,width:p.width,height:p.height,evidence:{kind:'user-reviewed-mask',confirmed:true},signal:abort.signal});
  if(pending!==p||!current(p))throw Error('사진이나 편집 상태가 바뀌어 배경 후보를 취소했습니다.');
  if(result.status!=='review'){say('이 사진은 주변 배경이 복잡하거나 범위가 커서 배경 추정을 보류했습니다. 원본 사진을 유지하고 배경을 별도로 확인해 주세요.');return;}
  p.repairedPixels=new Uint8ClampedArray(result.pixels);p.repaired=encodePixels(result.pixels,p.width,p.height);if(p.original.length+p.foreground.length+p.repaired.length>35*1024*1024){delete p.repaired;delete p.repairedPixels;throw Error('배경 후보가 프로젝트 저장 용량을 넘을 수 있습니다. 사진 크기를 줄여 다시 시도하세요.');}by('photoSeparationRepairPreview').src=p.repaired;by('photoSeparationRepairFigure').hidden=false;by('photoSeparationRepairChoice').hidden=false;by('photoSeparationUseRepair').checked=false;
  say('가려진 부분은 주변 색으로 추정했습니다. 실제 배경 복원이 아니므로 경계와 잔상을 확인한 뒤 적용 여부를 선택하세요.');
 }catch(error){if(pending===p)say(error.name==='AbortError'?'배경 후보 만들기를 중지했습니다.':error.message);}
 finally{if(pending===p){controller=null;by('photoSeparationRepair').disabled=false;by('photoSeparationCancel').hidden=true;}}
};
by('photoSeparationApply').onclick=async()=>{
 const p=pending;if(!p||!current(p)){clear();say('사진 선택이나 편집 상태가 바뀌었습니다. 다시 분리해 주세요.');return;}
 try{
  const useRepair=!!p.repaired&&by('photoSeparationUseRepair').checked;const [bg,fg]=await Promise.all([decode(useRepair?p.repaired:p.background),decode(p.foreground)]);if(pending!==p||!current(p))throw Error('사진 선택이나 편집 상태가 바뀌었습니다.');
  const state=api().read();if(useRepair&&p.object.opacity!==1)throw Error('반투명 사진에는 배경 추정 후보를 적용할 수 없습니다.');const parts=await applyPhotoSeparation({canvas:p.canvas,object:p.object,state,F:state.F,background:bg,foreground:fg,original:p.original,group:crypto.randomUUID(),backgroundInpainted:useRepair,guard:p.guard,isCurrent:()=>pending===p&&current(p),api:api()});
  try{globalThis.coexRegisterPhotoBackgroundExtension?.({object:parts[0],pixels:useRepair?p.repairedPixels:p.backgroundPixels,foregroundMask:p.mask,width:p.width,height:p.height});}catch{}
  clear();say('상품과 배경을 각각의 레이어로 적용했습니다. '+(useRepair?'가려진 배경은 주변 색으로 추정했으므로 결과를 확인하세요.':'상품 뒤에 가려졌던 배경은 투명하며 상품을 이동하면 빈 곳이 드러날 수 있습니다.')+' 사진 속 물체를 각각 구분한 결과는 아니므로 확인해 주세요.');
 }catch(error){say(error.message);}
};
for(const event of ['coex:layer-source','coex:layer-edit'])window.addEventListener(event,()=>{if(controller||pending){clear();say('편집 상태가 바뀌어 분리 후보를 닫았습니다.');}});
