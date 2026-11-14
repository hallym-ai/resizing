import {sourceBackgroundParts,withSeparationVisibility} from './source-background-separation.mjs';
import {inspectGridCandidate} from './grid-pattern.mjs';
import {createGridSourceProvenance,createRecoveredGridSourceProvenance,validGridSourceProvenance} from './grid-source.mjs';
import {encodeCompositeGrid,applyCompositeGrid,verifyExpandedGrid} from './grid-composite.mjs';
import {installOutsideRenderGuard} from './outside-render-guard.mjs';
import {mountOutsideStatus} from './outside-status.mjs';
import {registerTrustedOutsideReference,hasTrustedOutsideReference} from './final-outside-overlay.mjs';
import './main-raster-background.mjs';
import {partitionBackground,resizeBackgroundOnly,separationPreviews} from './background-only.mjs';
import {setMeasuredPanelBox} from './readability-panels.mjs';
import {prepareMaterialPanel} from './material-surfaces.mjs';
import {measureRenderedText} from './render-text-metrics.mjs';
import {typography,typographyRole,effectiveTextMinimum} from './type-scale.mjs';
import {adaptMaterialBackground,supportLightMaterialText} from './reference-layout-policy.mjs';
import {posterVisualEvidence} from './poster-material-evidence.mjs';
import {settleFloatingDecorations} from './floating-decorations.mjs';
import {regionCandidates} from './region-layout.mjs';
import {analyzeLayoutGraph,validateSourceRelations} from './source-graph.mjs';
import {tightNativeBox} from './family-master.mjs';
import {refreshStyleDecorations} from './design-styles.mjs';
import {relationshipCandidates,scoreMeasuredLayout,measuredLayoutSignature} from './layout-candidates.mjs';
import {semanticPlan} from './semantic-layout.mjs';
import {fitReadableBody} from './readable-text.mjs';
import './layers.mjs';
import {planLayout,validLayoutSize} from './layout-engine.mjs';
import {inspectLayout,solverInfo} from './design-layout.mjs';
import {extendSolidBackground} from './solid-background.mjs';
const $=id=>document.getElementById(id);
const controls=document.createElement('section');controls.className='reflow-controls';controls.id='reflowControls';
controls.innerHTML=`<h3>1단계 · 배경과 전체 요소 분리</h3><p>배경만 있는 화면과 배경을 뺀 전체 요소를 먼저 확인하세요. 이 단계에서는 원본 객체의 위치·크기·겹침을 유지합니다. 규격 변경은 분리 결과를 확인한 뒤 진행하세요.</p><div class="reflow-row"><label>출력 규격<select id="reflowRatio"><option value="">자유 크기 · 너비/높이 입력</option><option value="1080x1080">정사각형 · 1080 × 1080</option><option value="1920x1080">가로 · 1920 × 1080</option><option value="1080x1920">세로 · 1080 × 1920</option><option value="1800x600">가로 배너 · 1800 × 600</option></select></label><button class="doc-btn" id="reflowApply">배경만 크기 적용</button><button class="doc-btn" id="reflowUndo" disabled>크기 변경 전으로</button><button id="reflowNext" hidden disabled>다른 배치 적용</button></div><p id="reflowStatus" role="status" aria-live="polite">파일을 넣으면 배경과 보호 요소를 구분합니다.</p><label class="layer-help"><input type="checkbox" id="fitWholePictures" checked> 규격 변경 시 원본 그림의 전체 범위까지 맞춤</label><p class="layer-help">켜면 바깥으로 뻗은 별·선까지 포함해 전체 디자인을 같은 비율로 맞춥니다. 전체 디자인이 더 작아질 수 있습니다. 끄면 원본 프레임 기준을 유지하며, 새 여백이 없는 방향은 잘릴 수 있습니다.</p><details id="backgroundSeparationDetails" open><summary>배경과 전체 요소 · 분리 결과</summary><p id="backgroundSeparationStatus" role="status"></p><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><figure style="margin:0"><figcaption>배경만</figcaption><img id="backgroundOnlyPreview" alt="다른 요소를 제외한 배경" style="width:100%;max-height:230px;object-fit:contain;background:repeating-conic-gradient(#eee 0% 25%,#fff 0% 50%) 0/16px 16px"></figure><figure style="margin:0"><figcaption>배경을 뺀 전체 요소 · 투명 바탕</figcaption><img id="foregroundOnlyPreview" alt="배경과 구분된 보호 요소" style="width:100%;max-height:230px;object-fit:contain;background:repeating-conic-gradient(#eee 0% 25%,#fff 0% 50%) 0/16px 16px"></figure></div><div class="reflow-row"><button type="button" class="doc-btn" id="saveSeparatedBackground" disabled>배경 PNG 저장</button><button type="button" class="doc-btn" id="saveSeparatedElements" disabled>전체 요소 PNG 저장</button></div><p>먼저 원본 슬라이드 배경과 그 위의 전체 요소를 나눕니다. 위치·크기·겹침은 유지하며, 글씨와 그림의 세부 인식은 다음 단계입니다. 그림 안에 합쳐진 배경까지 지운 결과는 아닙니다.</p></details><details><summary>자유 비율 입력</summary><div class="reflow-custom"><label>가로 비율<input id="reflowCustomX" type="number" min="1" max="10000" value="16"></label><span>:</span><label>세로 비율<input id="reflowCustomY" type="number" min="1" max="10000" value="9"></label><button id="reflowCustomApply" class="doc-btn">이 비율로 배경 변경</button></div></details>`;
$('layerFields').prepend(controls);
mountOutsideStatus($('reflowStatus'),()=>globalThis.coexGetOutsideRecoveryReport?.()||null,()=>globalThis.coexLayerLayout?.read());
// Output dimensions have one visible owner. Legacy nodes stay for compatibility.
$('reflowRatio').closest('label').style.display='none';
$('reflowApply').style.display='none';
$('reflowCustomApply').closest('details').style.display='none';

const outputNote=document.createElement('p');outputNote.id='reflowOutputNote';outputNote.className='reflow-output-note';outputNote.setAttribute('role','status');$('snsActiveInfo').after(outputNote);
// This notice is separate from transient resize messages, so a saved JSON or
// undo scene cannot silently lose outside patches when its source-frame trust
// cannot be re-established.
const outsideReferenceNotice=document.createElement('p');outsideReferenceNotice.id='outsideReferenceNotice';outsideReferenceNotice.className='layer-help';outsideReferenceNotice.setAttribute('role','status');outsideReferenceNotice.setAttribute('aria-live','polite');outsideReferenceNotice.hidden=true;$('reflowStatus').after(outsideReferenceNotice);
const semanticMemory=new WeakMap();
window.addEventListener('coex:semantic-reset',e=>{for(const o of e.detail||[])semanticMemory.delete(o);for(const o of api()?.read()?.objects||[]){if(o.layoutOverlapBasis)o.set('layoutOverlapBasis',undefined);if(o.layoutGraphSource)o.set('layoutGraphSource',undefined);}baseline=null;});
const layoutSelections=new Map();
let candidateContext='';
let lastLayoutEngine='preserved-source-layout';let lastAutomaticDecision=null;
let baseline=null,undo=null,lastRevision=-1,queued=null,composing=false,sizeTimer=null;
const attrs=['partialSolidProvenance','nativeBitmapProvenance','gridSourceUserEdited','gridSourceProvenance','gridExpansion','__outsideTrialVisible','objectCaching','textureBackgroundFrame','left','top','scaleX','scaleY','angle','originX','originY','flipX','flipY','width','height','fontSize','textAlign','textBackgroundColor','readabilityPanelBox','layerRole','styles','splitByGrapheme','lineHeight','direction','radius','strokeWidth','rx','ry','visible','layoutOverlapBasis','layoutGraphSource'];
const tell=(text,error=false)=>{$('reflowStatus').textContent=text;$('reflowStatus').classList.toggle('error',error);};
const api=()=>globalThis.coexLayerLayout;
const pictureFitOptions=()=>({includeWholePictures:$('fitWholePictures').checked});
function updateOutsideReferenceNotice(state){
 const candidates=state?.objects.filter(o=>o.visible!==false&&o.__outsideTrialVisible&&o.trialOutsideRestore)||[];
 const held=candidates.some(o=>!hasTrustedOutsideReference(o.canvas));
 outsideReferenceNotice.hidden=!held;
 if(held)outsideReferenceNotice.textContent='원본 슬라이드의 기준 영역을 확인하지 못해 별·선 등 바깥 연결을 보류했습니다. 기존 요소는 유지됩니다. 저장 파일을 다시 열었거나 실행 취소한 경우 PPTX 원본을 다시 열고 결과를 확인해 주세요.';
}
const nativeText=o=>['text','textbox','itext'].includes(String(o.type).toLowerCase());
function capture(state){return{epoch:state.epoch,revision:state.revision,width:state.width,height:state.height,objects:state.objects.map(o=>({object:o,imageElement:o.getElement?.(),values:Object.fromEntries(attrs.map(k=>[k,k==='styles'?structuredClone(o[k]):o[k]]))}))};}
function matching(saved,state){return saved&&saved.epoch===state.epoch&&saved.objects.length===state.objects.length&&saved.objects.every(x=>state.objects.includes(x.object));}
function restore(saved){const live=api()?.read();if(live&&saved.objects.length===live.objects.length&&saved.objects.every(x=>live.objects.includes(x.object)))api().reorder?.(saved.objects.map(x=>x.object));for(const {object,imageElement,values}of saved.objects){if(imageElement&&object.getElement?.()!==imageElement)object.setElement(imageElement);object.set({...values,styles:structuredClone(values.styles)});if(nativeText(object))object.initDimensions();object.setCoords();}}
function rememberSemanticUnits(plan,state,geometry){
 for(const unit of plan.semanticUnits||[])for(const id of unit.ids){
  const object=state.objects[id];
  if(plan.engine==='relationships-v1'||!semanticMemory.has(object))semanticMemory.set(object,plan.engine==='relationships-v1'?{semanticUnit:unit.id,semanticRole:unit.role,semanticBand:unit.band,semanticOriginalText:semanticMemory.get(object)?.semanticOriginalText??object.text,semanticSourceWidth:semanticMemory.get(object)?.semanticSourceWidth||geometry[id].width,semanticSourceHeight:semanticMemory.get(object)?.semanticSourceHeight||geometry[id].height}:storedSemantic(object)||{semanticUnit:unit.id,semanticRole:unit.role,semanticBand:unit.band,semanticOriginalText:object.text,semanticSourceWidth:geometry[id].width,semanticSourceHeight:geometry[id].height});
 }
}
function storedSemantic(o){
 if(typeof o.layoutUnit!=='string'||!['logo','title','subject','body','details','decoration'].includes(o.layoutRole)||![o.layoutSourceWidth,o.layoutSourceHeight].every(n=>Number.isFinite(n)&&n>0))return null;
 return {semanticUnit:o.layoutUnit,semanticRole:o.layoutRole,semanticBand:o.layoutBand,semanticOriginalText:o.layoutOriginalText,semanticSourceWidth:o.layoutSourceWidth,semanticSourceHeight:o.layoutSourceHeight};
}
function descriptors(state){if(state.fontError){const error=Error(state.fontError);error.code='PROJECT_FONT_UNAVAILABLE';throw error;}return state.objects.map((o,i)=>{const b=o.getBoundingRect(),memory=semanticMemory.get(o)||storedSemantic(o);return{...memory,...posterVisualEvidence(o),semanticMaxScale:memory?Math.min(memory.semanticSourceWidth/b.width,memory.semanticSourceHeight/b.height):1,id:i,x:b.left,y:b.top,w:Math.max(.001,b.width),h:Math.max(.001,b.height),sourceGroup:o.sourceElementId||null,sourceIndex:o.sourceStackIndex,roleInferred:!!o.layerRoleInferred,imageFill:!!o.sourceImageFill,overlapBasis:o.layoutOverlapBasis||null,graphBasis:o.layoutGraphSource||null,tightBox:nativeText(o)?tightNativeBox(o,b):null,angle:o.angle||0,textAlign:o.textAlign,textWidth:nativeText(o)?o.textLines.reduce((sum,line,i)=>sum+o.getLineWidth(i),0)*Math.abs(o.scaleX||1):null,inkWidth:nativeText(o)?o.calcTextWidth()*Math.abs(o.scaleX||1):null,cutoutMethod:o.cutoutMethod,direction:o.direction,fontFamily:o.fontFamily,fontWeight:o.fontWeight,fontStyle:o.fontStyle,textFill:typeof o.fill==='string'?o.fill:null,textRunStyle:JSON.stringify(o.styles||{}),lineCount:nativeText(o)?o.textLines.length:1,manualGroup:o.layoutManualGroup,manualRole:o.layoutManualRole,fontSize:nativeText(o)?(o.fontSize||30)*Math.abs(o.scaleY||1):o.sourceText?b.height/Math.max(1,o.sourceText.split('\n').length)*.7:null,role:o.layerRole||'other',shapeType:String(o.type).toLowerCase(),kind:nativeText(o)?'text':String(o.type).toLowerCase()==='image'?'image':'shape',text:nativeText(o)?o.text:(o.sourceText||''),name:o.layerName||'',hidden:!o.visible,locked:!!o.layerLocked};});}
function place(o,p,F){
 const b=o.getBoundingRect(),center=o.getCenterPoint(),cx=p.x+(center.x-b.left)*p.scale,cy=p.y+(center.y-b.top)*p.scale;
 o.set({scaleX:o.scaleX*p.scale,scaleY:o.scaleY*p.scale});o.setPositionByOrigin(new F.Point(cx,cy),'center','center');o.setCoords();
}
function balanceSourceTypography(graph,plan,state){
 const normalized=[];for(const cohort of graph.typographyCohorts||[]){
  const items=cohort.ids.map(id=>({id,o:state.objects[id],p:plan.placements.find(p=>p.id===id)}));if(items.some(x=>!x.o))continue;
  const sizes=items.map(x=>(x.o.fontSize||0)*Math.abs(x.o.scaleY||1)),size=Math.min(...sizes);if(!(size>0)||Math.max(...sizes)/size<1.005)continue;
  const ratio=o=>Math.min(o.fontSize||30,...Object.values(o.styles||{}).flatMap(row=>Object.values(row).map(st=>st.fontSize).filter(n=>Number.isFinite(n)&&n>0)))/(o.fontSize||30);
  if(items.every(x=>String(x.o.type).toLowerCase()==='textbox'&&x.p?.readableBody&&x.p.zone&&size*ratio(x.o)>=(x.p.minimumSize||0)-.1)){
   for(const {o,p}of items)fitReadableBody(o,p.zone,Math.min(plan.width,plan.height),state.F,size*ratio(o),p.align,{minimumSize:p.minimumSize,verticalAlign:p.verticalAlign,textDirection:p.textDirection});normalized.push({ids:cohort.ids,size});
  }
 }plan.typographyBalance={cohorts:graph.typographyCohorts?.length||0,normalized,nonIndependentPolicy:'preserve source affine; review material divergence'};
}
function textMeasurer(state){
 const cache=new Map();return(id,width,size)=>{const key=id+':'+width.toFixed(3)+':'+size.toFixed(3);if(cache.has(key))return cache.get(key);const o=state.objects[id],base=o.fontSize||30,ratio=Math.abs(o.scaleX/o.scaleY)||1,styles=structuredClone(o.styles||{}),probe=new state.F.Textbox(o.text,{fontFamily:o.fontFamily,fontSize:base,fontWeight:o.fontWeight,fontStyle:o.fontStyle,charSpacing:o.charSpacing,lineHeight:o.lineHeight,styles,angle:o.angle||0,strokeWidth:o.strokeWidth||0,direction:o.direction,splitByGrapheme:false,width:Math.max(1,width/(size/base*ratio)-1),scaleX:size/base*ratio,scaleY:size/base});
 probe.initDimensions();if(probe.width*Math.abs(probe.scaleX)>width+.01&&!/[A-Za-z]{2}/.test(o.text)){probe.set({splitByGrapheme:true,width:Math.max(1,width/Math.abs(probe.scaleX)-1)});probe.initDimensions();}probe.setCoords();const b=probe.getBoundingRect(),answer={w:b.width,h:b.height,lines:probe.textLines.length};probe.dispose();cache.set(key,answer);return answer;};
}
function textInZone(o,zone,state,F,mode,role,design=null){
 const short=Math.min(state.targetWidth,state.targetHeight),factor=Math.min(state.targetWidth/state.width,state.targetHeight/state.height),ranges={title:[.055,.12],body:[.024,.046],details:[.022,.036],logo:[.028,.055]},range=ranges[role]||ranges.body;
 const emphasis=role==='title'?(design?.titleScale||1):1,requested=design?.adaptiveTypography?(role==='title'?design.titleSize:design.bodySize):null,desired=Number.isFinite(requested)&&requested>0?Math.min(2000,requested):Math.min(2000,short*range[1]*emphasis,Math.max(short*range[0],(o.fontSize||30)*Math.abs(o.scaleY||1)*factor)*emphasis);
 const center=design?.align?design.align==='center':mode==='portrait'||mode==='square',baseFont=o.fontSize||30,baseStyles=structuredClone(o.styles||{});
 const sizeText=size=>{const styles=structuredClone(baseStyles);for(const row of Object.values(styles))for(const st of Object.values(row))if(st.fontSize)st.fontSize*=size/baseFont;o.set({fontSize:size,styles,width:Math.max(1,zone.w*.98)});o.initDimensions();o.setCoords();};
 o.set({scaleX:1,scaleY:1,width:Math.max(1,zone.w*.98),textAlign:center?'center':'left'});sizeText(desired);
 // Measure real Fabric glyph wrapping, including long words and rotated text.
 let low=Math.min(1,desired),high=desired;
 for(let i=0;i<10;i++){const size=(low+high)/2;sizeText(size);const b=o.getBoundingRect();if(b.width<=zone.w&&b.height<=zone.h)low=size;else high=size;}
 sizeText(low);let b=o.getBoundingRect();const fit=Math.min(1,zone.w/Math.max(.001,b.width),zone.h/Math.max(.001,b.height));o.set({scaleX:fit,scaleY:fit});o.setCoords();b=o.getBoundingRect();
 const left=center?zone.x+(zone.w-b.width)/2:zone.x,top=zone.y+(zone.h-b.height)/2,point=o.getCenterPoint();o.setPositionByOrigin(new F.Point(point.x+left-b.left,point.y+top-b.top),'center','center');o.setCoords();
}
function validateDesign(plan,state){
 const actual=descriptors(state).map(e=>({...e,role:plan.roles[e.id]||e.role,sourceGroup:plan.layoutGroups?.[e.id]||e.sourceGroup})),decor=new Set((plan.decorations||[]).map(d=>d.id)),checked=actual.map(e=>decor.has(e.id)?{...e,role:'background'}:e),quality=inspectLayout(checked,plan.width,plan.height,plan.margin);
 if(plan.safeZone){const z=plan.safeZone;for(const e of checked.filter(e=>!e.hidden&&(e.text||e.role==='logo'))){if(e.x<z.x-.6||e.y<z.y-.6||e.x+e.w>z.x+z.w+.6||e.y+e.h>z.y+z.h+.6){const error=Error('조정 필요: 글자·로고가 안쪽 90% 안전 영역을 벗어났습니다.');error.code='LAYOUT_NEEDS_REVIEW';throw error;}}}
 if(quality.outside.length)throw Error('잠긴 요소 또는 글자·그림이 안전 여백 밖에 있어 적용하지 않았습니다. 잠금을 해제하거나 위치·크기를 확인하세요.');
 if(plan.engine==='relationships-v1'){
  const allowed=new Set(plan.allowedOverlaps.map(pair=>[...pair].sort((a,b)=>a-b).join(':'))),visible=checked.filter(e=>!e.hidden&&e.role!=='background');
  for(let i=0;i<visible.length;i++)for(let j=i+1;j<visible.length;j++){const a=visible[i],b=visible[j];if(allowed.has([a.id,b.id].sort((a,b)=>a-b).join(':')))continue;const intersection=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));if(intersection>Math.max(1,Math.min(a.w*a.h,b.w*b.h)*.002)){globalThis.coexLayoutFailure={overlap:[a,b]};const error=Error('조정 필요: '+[a.text||a.name,b.text||b.name].join(' / ')+' — 글자 또는 필수 정보가 겹칩니다. 묶음과 크기를 확인하세요.');error.code='LAYOUT_NEEDS_REVIEW';throw error;}}
 }
 if(plan.engine==='relationships-v1'){const allowed=new Set(plan.allowedOverlaps.map(pair=>[...pair].sort((a,b)=>a-b).join(':')));quality.overlaps=quality.overlaps.filter(pair=>!allowed.has([...pair].sort((a,b)=>a-b).join(':')));}
 for(const region of plan.protectedRegions||[])for(const e of actual.filter(e=>!e.hidden&&e.text&&!region.except.includes(e.id))){const intersection=Math.max(0,Math.min(e.x+e.w,region.x+region.w)-Math.max(e.x,region.x))*Math.max(0,Math.min(e.y+e.h,region.y+region.h)-Math.max(e.y,region.y));if(intersection>1){const error=Error('조정 필요: 제목·정보가 원본에서 보호할 상품 영역을 가립니다.');error.code='LAYOUT_NEEDS_REVIEW';throw error;}}
 for(const d of (plan.decorations||[]).filter(d=>['separator','ribbon'].includes(d.kind))){const a=actual[d.id];for(const b of actual.filter(e=>!e.hidden&&e.id!==d.id&&e.role!=='background'&&e.role!=='decoration')){if((plan.allowedOverlaps||[]).some(pair=>pair.includes(a.id)&&pair.includes(b.id)))continue;const overlap=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));if(overlap>.1){const error=Error('조정 필요: 구분선·리본이 새로 글자나 상품을 가립니다.');error.code='LAYOUT_NEEDS_REVIEW';throw error;}}}
 if(plan.engine==='relationships-v1'){const placed=plan.placements.map(p=>p.id),paint=plan.paintOrder||[],expected=actual.filter(e=>!e.hidden&&e.role!=='background').map(e=>e.id);if(new Set(placed).size!==placed.length||placed.length!==expected.length||expected.some(id=>!placed.includes(id))||paint.length!==state.objects.length||new Set(paint).size!==state.objects.length||paint.some(id=>!Number.isInteger(id)||id<0||id>=state.objects.length)){const e=Error('조정 필요: 원본 요소의 누락·중복을 발견했습니다.');e.code='LAYOUT_NEEDS_REVIEW';throw e;}}
 for(const [id,floor]of Object.entries(plan.fontFloorById||{})){const o=state.objects[id];if(nativeText(o)&&(o.fontSize||0)*Math.abs(o.scaleY)<floor-.1){const error=Error('조정 필요: 원본 묶음의 글자가 최소 크기보다 작아집니다.');error.code='LAYOUT_NEEDS_REVIEW';throw error;}}
 const movable=new Set(plan.placements.map(p=>p.id));
 if(quality.overlaps.some(pair=>pair.some(id=>movable.has(id))))throw Error('요소가 겹쳐 글자나 그림을 가릴 수 있어 적용하지 않았습니다. 잠금·용도·원본 묶음을 확인하세요.');
 const small=actual.filter(e=>e.text&&e.kind==='text'&&((state.objects[e.id].fontSize||0)*Math.abs(state.objects[e.id].scaleY||1)<Math.min(12,Math.min(plan.width,plan.height)*.02)));
 if(small.length)plan.warnings.push('일부 글자가 작습니다. 내용을 줄이거나 더 큰 출력 규격을 선택하세요.');
 if(plan.decorations)for(const d of plan.decorations.filter(d=>d.kind==='floating')){const a=actual[d.id];for(const b of actual.filter(e=>!e.hidden&&e.text)){if(plan.allowedOverlaps.some(pair=>pair.includes(d.id)&&pair.includes(b.id)))continue;const dx=Math.max(0,b.x-a.x-a.w,a.x-b.x-b.w),dy=Math.max(0,b.y-a.y-a.h,a.y-b.y-b.h);if(Math.hypot(dx,dy)<23.9){const error=Error('조정 필요: 장식과 글자의 24px 간격을 확보하지 못했습니다.');error.code='LAYOUT_NEEDS_REVIEW';throw error;}}}
 plan.quality=quality;if(plan.validation)plan.validation={...plan.validation,status:'needs_review',geometry:'passed',textProductCollision:'passed',decorationDistance:'passed',decorationScope:'original-recognized-decorations',aesthetic:'not_run',criticalProductRegion:'not_run',note:'실제 객체 경계·글자 크기 측정 완료. 픽셀 가림·상품 중요 부위·미관은 사용자 확인 필요.'};return quality;
}
function protectRasterSizes(plan,state){
 // Relationship subunits already enforce each original image limit. Reapplying
 // an affine cap to a mixed logo/text band would invalidate its measured cells.
 if(plan.engine==='relationships-v1')return;
 if($('preserveWholeSource')?.checked===false)return;
 const raster=o=>String(o.type).toLowerCase()==='image'||!!o.getObjects?.().some(raster),units=new Map();
 for(const p of plan.placements){const o=state.objects[p.id],key=p.layoutGroup||(p.groupRole==='logo'?'logos':o.sourceElementId?'native:'+o.sourceElementId:'item:'+p.id);if(!units.has(key))units.set(key,[]);units.get(key).push({p,o,b:o.getBoundingRect()});}
 for(const unit of units.values()){
  const limits=unit.filter(x=>raster(x.o)).map(({o,b})=>{const memory=semanticMemory.get(o)||storedSemantic(o);return plan.layoutGroups&&memory?Math.min(memory.semanticSourceWidth/b.width,memory.semanticSourceHeight/b.height):1;}),limit=Math.min(...limits);
  if(!limits.length||!unit.some(x=>x.p.scale>limit))continue;
  const left=Math.min(...unit.map(x=>x.b.left)),top=Math.min(...unit.map(x=>x.b.top)),right=Math.max(...unit.map(x=>x.b.left+x.b.width)),bottom=Math.max(...unit.map(x=>x.b.top+x.b.height));
  const tx=Math.min(...unit.map(x=>x.p.x)),ty=Math.min(...unit.map(x=>x.p.y)),tr=Math.max(...unit.map(x=>x.p.x+x.b.width*x.p.scale)),tb=Math.max(...unit.map(x=>x.p.y+x.b.height*x.p.scale));
  const x=unit.every(item=>item.p.align==='left')?tx:(tx+tr-(right-left)*limit)/2,y=(ty+tb-(bottom-top)*limit)/2;
  for(const item of unit){item.p.x=x+(item.b.left-left)*limit;item.p.y=y+(item.b.top-top)*limit;item.p.scale=limit;item.p.w=item.b.width*limit;item.p.h=item.b.height*limit;if(unit.length>1)item.p.zone=null;}
 }
}
function moveAccordingTo(plan,state,{remember=true}={}){
 const live=api()?.read(),publish=remember&&live&&state.objects.length===live.objects.length&&state.objects.every((o,i)=>o===live.objects[i]),previousDiagnostics={plan:globalThis.coexLastLayoutPlan,failure:globalThis.coexLayoutFailure};
 try{
 const relationGraph=analyzeLayoutGraph(descriptors(state),{sourceWidth:state.width,sourceHeight:state.height});
 const semanticSourceGeometry=plan.semanticUnits?state.objects.map(o=>o.getBoundingRect()):null;
 const F=state.F;protectRasterSizes(plan,state);let solidExtended=false;
 const autoBackground=$('extendSourceBackground')?.checked!==false;
 for(const id of plan.backgrounds){const o=state.objects[id],b=o.getBoundingRect();if(o.designAccent?.startsWith('style-'))continue;
  if(['top-line','bottom-line'].includes(o.designAccent)){const size=Math.min(plan.width,plan.height)*Math.max(.005,Math.min(.05,o.designAccentSize||.014));o.set({left:0,top:o.designAccent==='bottom-line'?plan.height-size:0,originX:'left',originY:'top',width:plan.width,height:size,scaleX:1,scaleY:1});o.setCoords();}
  else if(autoBackground&&plan.materialMode&&relationGraph.nodes.find(n=>n.id===id)?.materialKind==='panel'){const p=prepareMaterialPanel(o,relationGraph.nodes.find(n=>n.id===id),plan);if(!p)throw Error('종이 배경판 재구성을 확인하지 못했습니다.');place(o,p,F);plan.backgroundTreatment={strategy:p.strategy,status:'review',reason:'분리된 종이와 원본 벽돌 배경을 재구성했습니다. 질감 이음선·모서리는 검토가 필요합니다.'};}
  else if(autoBackground&&plan.materialMode&&adaptMaterialBackground(o,relationGraph.nodes.find(n=>n.id===id),plan.width,plan.height)){place(o,adaptMaterialBackground(o,relationGraph.nodes.find(n=>n.id===id),plan.width,plan.height),F);}
  else if(autoBackground&&extendSolidBackground(o,plan.width,plan.height)){solidExtended=true;}
  else if(autoBackground&&String(o.type).toLowerCase()==='rect'&&!o.angle){o.set({left:0,top:0,originX:'left',originY:'top',width:plan.width,height:plan.height,scaleX:1,scaleY:1});o.setCoords();}
  else{const protect=!autoBackground||String(o.type).toLowerCase()==='image'&&$('preserveWholeSource')?.checked!==false;const scale=protect?Math.min(1,plan.width/b.width,plan.height/b.height):Math.max(plan.width/b.width,plan.height/b.height);place(o,{x:(plan.width-b.width*scale)/2,y:(plan.height-b.height*scale)/2,scale},F);}
 }
 for(const p of plan.placements){const o=state.objects[p.id];
  // Contrast support is chosen from actual composed pixels below.
  if(p.overlapBasis)o.set('layoutOverlapBasis',structuredClone(p.overlapBasis));
  if(plan.graphBasis?.[p.id])o.set('layoutGraphSource',structuredClone(plan.graphBasis[p.id]));
  if(p.stretchDecoration){o.set({angle:0,scaleX:1,scaleY:1});o.setCoords();const b=o.getBoundingRect(),rad=Math.abs(p.angle||0)*Math.PI/180,thickness=p.decorationThickness||p.h,length=(p.w-thickness*Math.sin(rad))/Math.cos(rad);o.set({angle:p.angle||0,scaleX:length/b.width,scaleY:thickness/b.height});o.setCoords();const c=o.getCenterPoint(),r=o.getBoundingRect();o.setPositionByOrigin(new F.Point(c.x+p.x-r.left,c.y+p.y-r.top),'center','center');o.setCoords();continue;}
  if(p.nativeTightWidth&&nativeText(o)){o.set('width',p.nativeTightWidth);o.initDimensions();o.setCoords();}
  if(p.headlineWidth&&nativeText(o)){o.set('width',Math.max(1,p.headlineWidth/Math.abs(o.scaleX||1)-(o.strokeWidth||0)));o.initDimensions();o.setCoords();}
  if(p.readableTitle)o.set('textAlign','center');
  if(String(o.type).toLowerCase()==='textbox'&&p.readableBody&&p.zone)fitReadableBody(o,p.zone,Math.min(plan.width,plan.height),F,p.readableSize,plan.engine==='relationships-v1'||plan.design?.adaptiveTypography?p.align:undefined,plan.engine==='relationships-v1'?{minimumSize:p.minimumSize,verticalAlign:p.verticalAlign,textDirection:p.textDirection}:null);
  else if(String(o.type).toLowerCase()==='textbox'&&p.zone)textInZone(o,p.zone,{...state,targetWidth:plan.width,targetHeight:plan.height},F,plan.mode,p.groupRole,plan.design);else place(o,p,F);
  if(!plan.layoutGroups&&o.layerRole==='other'&&['title','details','subject'].includes(p.role))o.set('layerRole',p.role);
 }
 if(solidExtended){plan.warnings=plan.warnings.filter(w=>!w.startsWith('배경 이미지는'));plan.warnings.push('원본 단색 배경을 새 규격 전체로 연결했습니다. 사진 AI는 실행하지 않았습니다.');}
 if(plan.backgroundTreatment?.reason)plan.warnings.push(plan.backgroundTreatment.reason);
 plan.warnings=[...new Set(plan.warnings)];
 // Fit can shrink individual words below their requested cells. Repack each
 // inferred title row from measured ink boxes rather than leaving cell-width gaps.
 if(plan.engine==='relationships-v1'){const rows=new Map();for(const p of plan.placements.filter(p=>p.groupRole==='title'&&!p.keepRowAnchors&&p.zone&&nativeText(state.objects[p.id]))){const key=p.layoutGroup+':'+Math.round(p.zone.y*100);if(!rows.has(key))rows.set(key,[]);rows.get(key).push(p);}
  for(const row of rows.values()){if(row.length<2)continue;row.sort((a,b)=>a.zone.x-b.zone.x);const boxes=row.map(p=>state.objects[p.id].getBoundingRect()),space=Math.min(...row.map(p=>(state.objects[p.id].fontSize||0)*Math.abs(state.objects[p.id].scaleY)))*.24,total=boxes.reduce((n,b)=>n+b.width,0)+space*(row.length-1),left=Math.min(...row.map(p=>p.zone.x)),right=Math.max(...row.map(p=>p.zone.x+p.zone.w));if(total>right-left+.1)continue;let x=plan.mode==='extreme-portrait'?left+(right-left-total)/2:plan.readingDirection==='rtl'?right-total:left;row.forEach((p,i)=>{const o=state.objects[p.id],c=o.getCenterPoint();o.setPositionByOrigin(new F.Point(c.x+x-boxes[i].left,c.y),'center','center');o.setCoords();x+=boxes[i].width+space;});}
 }
 balanceSourceTypography(relationGraph,plan,state);
 refreshStyleDecorations(state.objects,plan);
 settleFloatingDecorations(plan,state);
 plan.sourceRelationQuality=validateSourceRelations(relationGraph,descriptors(state),plan.paintOrder,plan);if(!plan.sourceRelationQuality.passed){const error=Error('조정 필요: 원본의 글씨·그림 접점 또는 서체 위계가 달라집니다.');error.code='LAYOUT_NEEDS_REVIEW';error.details=plan.sourceRelationQuality;throw error;}
 for(const n of relationGraph.nodes.filter(n=>n.kind==='text')){const threshold=Math.max(plan.fontFloorById?.[n.id]||0,typography(typographyRole(n,plan.roles[n.id]||n.role),Math.min(plan.width,plan.height)).minimum);if(effectiveTextMinimum(state.objects[n.id])<threshold-.15){const e=Error('조정 필요: '+n.text.slice(0,24)+' — 역할별 최소 글자 크기 '+threshold.toFixed(1)+'px 미달');e.code='LAYOUT_NEEDS_REVIEW';throw e;}}
 validateDesign(plan,state);
 if(plan.engine==='relationships-v1'){const paint=plan.paintOrder.map(id=>state.objects[id]),checks=[];for(const p of plan.placements.filter(p=>nativeText(state.objects[p.id]))){const o=state.objects[p.id],role=plan.semanticUnits?.some(g=>g.role==='title'&&g.ids.includes(p.id))?'title':p.groupRole;const measure=()=>measureRenderedText(o,paint,{width:plan.width,height:plan.height,role,minimumSize:plan.fontFloorById[p.id]});let result=measure();if(result.status==='measured'&&!result.contrastPassed&&result.canvasInkPassed){setMeasuredPanelBox(o,result.inkBox,F);const c=document.createElement('canvas');c.width=c.height=1;const ctx=c.getContext('2d');ctx.fillStyle=typeof o.fill==='string'?o.fill:'#fff';ctx.fillRect(0,0,1,1);const rgb=ctx.getImageData(0,0,1,1).data,lum=[.2126,.7152,.0722].reduce((sum,k,i)=>{const v=rgb[i]/255;return sum+k*(v<=.04045?v/12.92:((v+.055)/1.055)**2.4);},0),tone=(lum+.05)/.05>=1.05/(lum+.05)?'0,0,0':'255,255,255';c.width=c.height=0;for(const alpha of[.04,.08,.12,.18,.26,.36,.48,.62,.76,.86,.92,.97]){o.set('textBackgroundColor','rgba('+tone+','+alpha+')');result=measure();if(result.status==='measured'&&result.contrastPassed)break;}}checks.push({id:p.id,...result});if(result.status!=='measured'||!result.canvasInkPassed||!result.fontMinimumPassed||!result.contrastPassed){globalThis.coexLastRenderedTextFailure={id:p.id,text:o.text,result};const error=Error('조정 필요: 실제 렌더링에서 글자 잘림·가독성을 확인하지 못했습니다: '+o.text.slice(0,30));error.code='LAYOUT_NEEDS_REVIEW';throw error;}}for(const item of checks){const o=state.objects[item.id],final=measureRenderedText(o,paint,{width:plan.width,height:plan.height,role:item.role,minimumSize:item.minimumSize});item.final=final;if(final.status!=='measured'||!final.canvasInkPassed||!final.fontMinimumPassed||!final.contrastPassed){globalThis.coexLastRenderedTextFailure={id:item.id,text:o.text,result:final};const e=Error('조정 필요: 최종 합성 후 글자 가독성 검사 실패: '+o.text.slice(0,30));e.code='LAYOUT_NEEDS_REVIEW';throw e;}}plan.renderedTextQuality=checks;}
 // Keep inferred membership only for these exact live objects. It must not
 // become a user-selected layer role or leak into another import/project.
 if(!remember)return;
 rememberSemanticUnits(plan,state,semanticSourceGeometry);
 if(plan.engine==='relationships-v1')for(const unit of plan.semanticUnits)for(const id of unit.ids){const o=state.objects[id],memory=semanticMemory.get(o);o.set({layoutUnit:unit.id,layoutRole:unit.role,layoutBand:unit.band,layoutOriginalText:memory.semanticOriginalText,layoutSourceWidth:memory.semanticSourceWidth,layoutSourceHeight:memory.semanticSourceHeight});}
 if(publish){globalThis.coexLastLayoutPlan=plan;globalThis.coexLayoutFailure=null;}
 }finally{if(!publish){globalThis.coexLastLayoutPlan=previousDiagnostics.plan;globalThis.coexLayoutFailure=previousDiagnostics.failure;}}
}
export function captureDesignSemantics(){
 const state=api()?.read();if(!state)return [];
 // Reconstruct native groups after a saved JSON is reopened, before adding
 // explicit uploaded assets. The stable source ids remain attached to objects.
 const native=descriptors(state).filter(e=>!String(e.sourceGroup||'').startsWith('upload:'));
 try{const plan=semanticPlan(native,{sourceWidth:state.width,sourceHeight:state.height,width:state.width,height:state.height});if(plan)rememberSemanticUnits(plan,state,state.objects.map(o=>o.getBoundingRect()));}catch{}
 return state.objects.map((o,i)=>{
  const memory=semanticMemory.get(o)||storedSemantic(o),b=o.getBoundingRect();
  if(memory)return {...memory,originalRole:o.layerRole||'other'};
  if(String(o.sourceElementId||'').startsWith('upload:')&&['logo','subject'].includes(o.layerRole))return {semanticUnit:'uploaded-'+i,semanticRole:o.layerRole,semanticBand:o.layerRole==='logo'?'extra-header':'extra-subject',semanticSourceWidth:b.width,semanticSourceHeight:b.height,originalRole:o.layerRole};
  return null;
 });
}
export function composeReflow(state,width,height,design=null){
 design={...design,measureText:textMeasurer(state)};
 if(!design.titleSize&&!design.bodySize&&!design.imageSide&&(!design.jointLayout||['region','measured'].includes(design.jointLayout.variant))){
  const trial=capture(state),candidateOptions={sourceWidth:state.width,sourceHeight:state.height,width,height,measureText:design.measureText},pool=design.jointLayout?.variant==='region'?regionCandidates(descriptors(state),candidateOptions):relationshipCandidates(descriptors(state),candidateOptions),success=[],rejected=[...pool.failures],signatures=new Set();
  try{for(const candidate of pool.plans){restore(trial);try{moveAccordingTo(candidate,state,{remember:false});const sig=measuredLayoutSignature(state.objects);if(!signatures.has(sig)){signatures.add(sig);success.push({plan:candidate,score:scoreMeasuredLayout(candidate,state.objects).score});}else rejected.push({candidate:candidate.candidate,reason:'duplicate measured geometry'});}catch(error){if(error.code!=='LAYOUT_NEEDS_REVIEW'&&!/안전 여백|요소가 겹쳐/.test(error.message))throw error;rejected.push({candidate:candidate.candidate,planner:candidate.planner||candidate.family||candidate.engine,reason:error.message});}}}finally{restore(trial);}
  if(success.length){success.sort((a,b)=>b.score-a.score);const selected=success[(design.jointLayout?.regionVariant||0)%success.length].plan;selected.selection={policy:'equal measured role metrics and conservative source-contact guards',evaluated:pool.plans.length+pool.failures.length,accepted:success.map(s=>({candidate:s.plan.candidate,planner:s.plan.planner||s.plan.family||s.plan.engine,score:s.score})),rejected};moveAccordingTo(selected,state);return selected;}
  if(['region','measured'].includes(design.jointLayout?.variant)){const e=Error('조정 필요: 공통 영역 후보에서 원문과 최소 크기를 유지할 수 없습니다.');e.code='LAYOUT_NEEDS_REVIEW';throw e;}
  globalThis.coexRegionTrials={evaluated:pool.plans.length,rejected};design={...design,skipRegion:true};
 }

 const seed=design?.semanticSeed;
 if(seed)state.objects.forEach((o,i)=>{if(seed[i])semanticMemory.set(o,{...seed[i]});});
 const elements=descriptors(state).map((e,i)=>seed?.[i]&&e.role!=='background'?{...e,role:'other'}:e);
 const options={sourceWidth:state.width,sourceHeight:state.height,width,height,design};
 let plan;
 if(design?.adaptiveTypography&&seed?.filter(e=>e?.semanticUnit&&!e.semanticUnit.startsWith('uploaded-')).length>=10){
  plan=semanticPlan(elements,options);
  if(!plan)throw Error('원본 묶음을 안전하게 디자인할 수 없습니다. 잠금·새 요소 용도를 확인하거나 원본 배치 유지를 사용하세요.');
 }else plan=planLayout(elements,options);
 moveAccordingTo(plan,state);
 if(design?.adaptiveTypography)for(const unit of plan.semanticUnits||[])for(const id of unit.ids){const o=state.objects[id],b=o.getBoundingRect(),memory=semanticMemory.get(o);o.set({layoutUnit:unit.id,layoutRole:unit.role,layoutBand:unit.band,layoutOriginalText:o.text,layoutSourceWidth:memory?.semanticSourceWidth||b.width,layoutSourceHeight:memory?.semanticSourceHeight||b.height});}
 return plan;
}

function baseFor(state){if(matching(baseline,state)&&lastRevision===state.revision)return baseline;baseline=capture(state);layoutSelections.clear();candidateContext='';return baseline;}
function chooseLayout(state,width,height,automatic=false,{alternate=false,updateChoice=true}={}){
 const options={sourceWidth:state.width,sourceHeight:state.height,width,height,measureText:textMeasurer(state)},input=descriptors(state),pool=relationshipCandidates(input,options);
 const key=`${state.epoch}:${width}x${height}`,trial=capture(state),success=[],failed=[...pool.failures],signatures=new Set();
 if(pool.plans.length){
  try{for(const plan of pool.plans){restore(trial);try{moveAccordingTo(plan,state,{remember:false});const signature=JSON.stringify(state.objects.map(o=>[o.left,o.top,o.width,o.height,o.scaleX,o.scaleY,o.textAlign].map(v=>typeof v==='number'?Math.round(v*1000):v)));if(!signatures.has(signature)){signatures.add(signature);success.push({plan,metrics:scoreMeasuredLayout(plan,state.objects)});}}catch(error){if(error.code!=='LAYOUT_NEEDS_REVIEW'&&!/안전 여백|요소가 겹쳐/.test(error.message))throw error;failed.push({id:plan.candidate,reason:error.message});}}}
  finally{restore(trial);}
  if(success.length){
   success.sort((a,b)=>b.metrics.score-a.metrics.score);
   let index=success.findIndex(item=>item.plan.candidate===layoutSelections.get(key));if(index<0)index=0;if(alternate)index=(index+1)%success.length;
   const chosen=success[index];if(updateChoice){layoutSelections.set(key,chosen.plan.candidate);candidateContext=key;globalThis.coexLayoutFailure=null;
   globalThis.coexLayoutCandidates={key,selected:chosen.plan.candidate,evaluated:pool.plans.length+pool.failures.length,accepted:success.map(item=>item.metrics),rejected:failed};}
   chosen.plan.candidateCount=success.length;return chosen.plan;
  }
 }
 if(failed.length){if(updateChoice)globalThis.coexLayoutCandidates={key,selected:null,accepted:[],rejected:failed};const error=Error('조정 필요: 여러 구도에서도 원문·상품·필수 정보를 읽을 크기로 배치하지 못했습니다. 더 큰 규격이나 묶음 수정을 선택하세요.');error.code='LAYOUT_NEEDS_REVIEW';throw error;}
 if(updateChoice)globalThis.coexLayoutCandidates={key,selected:null,accepted:[],rejected:[]};
 return automatic?semanticPlan(input,options):planLayout(input,options);
}
function automaticFallbackReason(state){
 const foreground=state.objects.filter(o=>o.visible!==false&&o.layerRole!=='background');
 if(foreground.some(o=>o.layerLocked))return '잠긴 요소를 존중해 원본 배치를 유지했습니다.';
 if(foreground.some(o=>nativeText(o)&&o.layerRole!=='other'))return '지정한 요소 용도를 존중해 원본 배치를 유지했습니다. 용도 기준 재배치는 가독성 재배치를 선택하세요.';
 return '자동으로 재배치할 원본 묶음을 확인하지 못해 원본 배치를 유지했습니다.';
}
function reflow(width,height,{preset=null,automatic=false,alternate=false}={}){
 globalThis.coexLayoutFailure=null;
 if($('resizeBehavior'))$('resizeBehavior').value=automatic?'auto':'reflow';
 clearTimeout(sizeTimer);
 const state=api()?.read();if(!state){tell('먼저 파일의 요소 인식이 끝나거나 레이어 원본을 열어 주세요.',true);return false;}
 if(!validLayoutSize(width,height)){tell('크기는 양의 정수, 한 변 12,000px / 전체 2,400만 픽셀 이하로 지정해 주세요.',true);return false;}
 const previous=capture(state),base=baseFor(state),keepLock=$('lockBtn').getAttribute('aria-checked')==='true';
 composing=true;
 try{
  restore(base);const source={...state,width:base.width,height:base.height};const plan=chooseLayout(source,width,height,automatic,{alternate});
  if(!plan){restore(previous);return resizePreservingLayout(width,height,{preset,reason:automaticFallbackReason(state)});}
  moveAccordingTo(plan,source);
  lastAutomaticDecision={policy:'automatic-v1',sourceEpoch:state.epoch,width,height,status:plan.backgroundTreatment?.status==='review'?'review':'ready',backgroundTreatment:plan.backgroundTreatment||null,inputKind:state.inputKind||'layered',path:'redesign',method:'native-reflow',planner:plan.planner||plan.family||plan.engine,reason:'인식한 요소를 새 규격에 맞게 재배치했습니다.',crop:'none',stretch:false};
  const result=api().commit(width,height,{epoch:state.epoch,revision:state.revision,apply:true,paintOrder:plan.paintOrder?.map(id=>source.objects[id])});
  globalThis.setLock?.(keepLock);
  undo={...previous,afterRevision:result.revision};lastRevision=result.revision;lastLayoutEngine=automatic?'automatic-native-reflow':'role-based-reflow';
  const labels={'extreme-landscape':'극단 가로 · 로고→문구→상품','extreme-portrait':'극단 세로 · 중앙 정렬',landscape:'가로형',portrait:'세로형',square:'정사각형',wide:'와이드'};
  const message=`${state.inputKind==='raster'?'이미지 입력':'레이어 입력'} · 요소 재설계 · ${width} × ${height}px · ${plan.layoutLabel?plan.layoutLabel+' · ':''}${labels[plan.mode]}으로 ${plan.placements.length}개 요소를 재배치했습니다.${plan.warnings.length?' '+plan.warnings.join(' '):' 안전 여백·글자 줄바꿈·겹침 검사를 통과했습니다.'}`;
  $('reflowNext').disabled=!(plan.candidateCount>1);tell(message);outputNote.textContent=plan.candidateCount?`${plan.candidateCount}개 검증된 구도 중 제목 가독성과 상품 비중을 비교해 선택했습니다. ‘다른 배치 적용’으로 바꿀 수 있습니다.`:'요소를 새 비율에 맞게 재배치한 결과입니다. 레이어별 수정과 JSON 저장이 가능합니다.';
  $('reflowUndo').disabled=false;
  if(preset)rasterPreset(preset);
  return true;
 }catch(error){restore(previous);api()?.refresh();if(error.code==='LAYOUT_NEEDS_REVIEW'){if(automatic){const result=resizePreservingLayout(width,height,{preset,reason:error.message+' 자동 재배치는 보류하고 원본 배치 유지로 변환했습니다.'});$('reflowStatus').classList.add('error');return result;}tell(error.message,true);outputNote.textContent=error.message;return false;}if(automatic)return resizePreservingLayout(width,height,{preset,reason:'자동 재배치 안전 검사를 통과하지 못해 원본 배치를 유지했습니다.'});tell(error.message,true);return false;}finally{composing=false;}
}
// Preserve the complete editable source, including intentional native groups.
function preserveObjects(state,width,height,{allowUpscale=false}={}){
 if(state.fontError){const error=Error(state.fontError);error.code='PROJECT_FONT_UNAVAILABLE';throw error;}
 const visible=state.objects.filter(o=>o.visible!==false&&o.layerRole!=='background').map(o=>{const b=o.getBoundingRect(),t=nativeText(o)?tightNativeBox(o,b):null;return t?{left:t.x,top:t.y,width:t.w,height:t.h}:b;});
 const left=Math.min(0,...visible.map(b=>b.left)),top=Math.min(0,...visible.map(b=>b.top));
 const right=Math.max(state.width,...visible.map(b=>b.left+b.width)),bottom=Math.max(state.height,...visible.map(b=>b.top+b.height));
 const frameWidth=right-left,frameHeight=bottom-top;
 const scale=Math.min(!allowUpscale&&$('preserveWholeSource')?.checked!==false?1:Infinity,width/frameWidth,height/frameHeight);
 const x=(width-frameWidth*scale)/2,y=(height-frameHeight*scale)/2;let extended=false;
 for(const object of state.objects){
  if($('extendSourceBackground')?.checked!==false&&extendSolidBackground(object,width,height)){extended=true;continue;}
  const center=object.getCenterPoint();object.set({scaleX:object.scaleX*scale,scaleY:object.scaleY*scale});
  object.setPositionByOrigin(new state.F.Point(x+(center.x-left)*scale,y+(center.y-top)*scale),'center','center');object.setCoords();
 }
 return {scale,extended};
}
// Apply the same complete-source fit on first native import, before its
// preview is published. Some original textbox bounds exceed the slide frame.
globalThis.prepareInitialNativeFrame=()=>{
 const state=api()?.read();if(!state)return;
 registerTrustedOutsideReference(state,globalThis.getLayerAnalysisSource?.());
 // Stage one must not promote partial artwork or fit/move source objects.
 // Display fitting is handled by the canvas viewport, not object transforms.
 api().refresh();separationKey='';
 queueMicrotask(()=>window.dispatchEvent(new Event('coex:history-source')));
};
function resizePreservingLayout(width,height,{preset=null,reason=''}={}){
 $('reflowNext').disabled=true;
 clearTimeout(sizeTimer);const state=api()?.read();
 if(!state||!validLayoutSize(width,height))return false;
 const previous=capture(state),base=baseFor(state),keepLock=$('lockBtn').getAttribute('aria-checked')==='true';
 composing=true;
 try{
  restore(base);const result=resizeBackgroundOnly({...state,width:base.width,height:base.height},width,height,pictureFitOptions());exposeOutsideTrial(state);
  lastAutomaticDecision=result;globalThis.coexBackgroundOnlyResult=result;
  const next=api().commit(width,height,{epoch:state.epoch,revision:state.revision,apply:true});
  globalThis.setLock?.(keepLock);undo={...previous,afterRevision:next.revision};lastRevision=next.revision;lastLayoutEngine='background-only-v1';$('reflowUndo').disabled=false;
  tell(`${width} × ${height}px · ${result.reason}${Math.abs(result.foregroundScale-1)>1e-6?' 요소 전체 균등 조절: '+Math.round(result.foregroundScale*100)+'%.':''}`);
  outputNote.textContent=result.backgroundScope;
  publishSeparation();
  if(preset)rasterPreset(preset);return true;
 }catch(error){restore(previous);api()?.refresh();tell(error.message,true);return false;}finally{composing=false;}
}
function resizeByPreference(width,height,options={}){return resizePreservingLayout(width,height,options);}
function targetInputs(w,h){for(const [id,value]of [['layerWidth',w],['layerHeight',h],['wInput',w],['hInput',h]])$(id).value=String(value);}
// The visible editor preset and custom sizes are prepared without changing the live scene across await.
let atomicResizeSerial=0;
globalThis.coexCancelEditorResize=()=>{atomicResizeSerial++;clearTimeout(sizeTimer);};
function trustedEditorState(state){const source=globalThis.getLayerAnalysisSource?.(),context=globalThis.getLayerOutputContextKey?.();return !!state&&!!context&&state.sceneOutputKey===context&&(state.sceneManual||(source?!!state.sourceKey&&state.sourceKey===source.key:state.linked));}
// Scratch review experiment only: source-crop provenance is not yet verified.
async function preloadOutsideTrial(state,isCurrent=()=>true){
 // Prepare without mutating shared Fabric objects across the asynchronous load.
 const records=state.objects.filter(o=>o.trialOutsideRestore?.outer?.src).map(o=>{
  const m=o.trialOutsideRestore,b=m.original,p=m.outer,s=m.slide;
  return {o,m,b,p,s,base:o.getElement?.(),src:o.getSrc?.(),fields:[m.baseSourceDigest,b.left,b.top,b.width,b.height,b.scaleX,b.scaleY,b.cropX,b.cropY,p.src,p.left,p.top,p.width,p.height,s.width,s.height]};
 });
 const same=r=>{const {o,m,b,p,s,fields}=r;return o.trialOutsideRestore===m&&m.original===b&&m.outer===p&&m.slide===s&&o.getElement?.()===r.base&&o.getSrc?.()===r.src&&fields.every((v,i)=>Object.is(v,[m.baseSourceDigest,b.left,b.top,b.width,b.height,b.scaleX,b.scaleY,b.cropX,b.cropY,p.src,p.left,p.top,p.width,p.height,s.width,s.height][i]));};
 const loaded=await Promise.all(records.map(r=>{
  const existing=r.o.__outsideTrialImage;
  if(existing)return existing.src===r.p.src?existing:null;
  return new Promise(resolve=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>resolve(null);im.src=r.p.src;});
 }));
 if(!isCurrent()||!records.every(same))throw Error('편집 내용이 바뀌어 바깥 요소 연결을 중단했습니다.');
 for(let i=0;i<records.length;i++){
  const o=records[i].o;
  if(!loaded[i]){o.__outsideReview=true;continue;}
  if(!o.__outsideTrialImage)o.__outsideTrialImage=loaded[i];
 }
 for(const o of state.objects.filter(o=>o.__outsideTrialImage&&!o.__outsideRenderInstalled))installOutsideRenderGuard(o);
 return ()=>records.every(same);
}
globalThis.coexInstallOutsideTrialForObjects=preloadOutsideTrial;
function exposeOutsideTrial(state){
 let applied=0;
 if(globalThis.coexDisableOutsideTrial){globalThis.coexOutsideTrialApplied=0;return;}
 for(const o of state.objects){const m=o.trialOutsideRestore,b=m?.original;if(!b)continue;if(!o.__outsideTrialImage||o.angle||o.flipX||o.flipY||o.originX!=='left'||o.originY!=='top'||o.width!==b.width||o.height!==b.height||!b.scaleX||!b.scaleY){o.__outsideReview=true;continue;}
  o.set({__outsideTrialVisible:true,objectCaching:false});o.dirty=true;o.setCoords();applied++;
 }
 globalThis.coexOutsideTrialApplied=applied;
}
// One candidate, one object, original scene owner transaction.
function makeCompositeTrial(state,result,base,width,height,reviewed){
 const f=result.foregroundOffset,k=result.foregroundScale;if(!f||!Number.isFinite(k)||k<=0)return null;
 const defaultFrame={left:f.x,top:f.y,right:f.x+base.width*k,bottom:f.y+base.height*k},targetFrame={left:0,top:0,right:width,bottom:height},permittedUnderlays=(result.separation?.backgrounds||[]).map(x=>state.objects[x.id]).filter(Boolean);
 for(const object of state.objects){if(String(object.type).toLowerCase()!=='image'||object.visible===false||object.layerRole!=='subject'||object.sourceElementType!=='picture')continue;const old=reviewed.get(object),frame=old?{left:f.x+old.left*k,top:f.y+old.top*k,right:f.x+old.right*k,bottom:f.y+old.bottom*k}:defaultFrame,b=object.getBoundingRect();if(Math.abs(b.left-frame.left)>2||Math.abs(b.left+b.width-frame.right)>2||Math.abs(b.top+b.height-frame.bottom)>2)continue;
  const el=object.getElement?.(),w=el?.naturalWidth||el?.width,h=el?.naturalHeight||el?.height;if(!el||!Number.isInteger(w)||!Number.isInteger(h)||w*h>4000000)continue;let c;try{c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(el,0,0);const pixels={data:x.getImageData(0,0,w,h).data,width:w,height:h};
   if(state.sourceFormat==='pptx'){const source=inspectGridCandidate({state,object,sourceFrame:frame,targetFrame,pixels,permittedUnderlays,allowNoExtension:true});const meta=createGridSourceProvenance({...state,width,height},object,frame,source);if(meta)object.set('gridSourceProvenance',meta);}
   const plan=encodeCompositeGrid({state,object,sourceFrame:frame,targetFrame,pixels,permittedUnderlays,reviewedJson:!!old,makeCanvas:(a,b)=>{const q=document.createElement('canvas');q.width=a;q.height=b;return q;}});if(plan)return plan;
  }catch{}finally{if(c)c.width=c.height=0;}
 }return null;
}
function decodeCompositeTrial(src){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('배경 이미지 합성 결과를 읽지 못했습니다.'));im.src=src;});}
async function resizeEditorAtomic(width,height,{preset=null}={}){
 const serial=++atomicResizeSerial;clearTimeout(sizeTimer);const state=api()?.read();
 if(!trustedEditorState(state)){tell('새 파일이나 슬라이드의 편집 요소가 준비된 뒤 규격을 선택하세요.',true);return false;}
 if(!validLayoutSize(width,height)){tell('규격의 너비와 높이를 확인하세요.',true);return false;}
 const liveGuard=api()?.captureAtomicLiveGuard?.();if(!liveGuard){tell('다중선택을 해제하고 요소 이동이나 편집을 마친 뒤 다시 시도하세요.',true);return false;}
 const loadingCurrent=()=>{const live=api()?.read();return serial===atomicResizeSerial&&trustedEditorState(live)&&live.epoch===state.epoch&&live.revision===state.revision&&live.sceneOutputKey===state.sceneOutputKey&&!!api()?.matchesAtomicLiveGuard?.(liveGuard);};
 try{await preloadOutsideTrial(state,loadingCurrent);}catch(error){tell(error.message,true);return false;}
 if(!loadingCurrent())return false;
 const context=state.sceneOutputKey,previous=capture(state),base=baseFor(state),expected={epoch:state.epoch,revision:state.revision};
 const current=()=>{const s=api()?.read();return serial===atomicResizeSerial&&trustedEditorState(s)&&s.epoch===expected.epoch&&s.revision===expected.revision&&s.sceneOutputKey===context&&Number($('wInput').value)===width&&Number($('hInput').value)===height;};
 const restoreInputs=()=>{const s=api()?.read();if(serial===atomicResizeSerial&&s&&s.epoch===expected.epoch&&s.revision===expected.revision&&s.sceneOutputKey===context&&globalThis.getLayerOutputContextKey?.()===context)targetInputs(s.width,s.height);};
 let target,promise,prepared,result,plan,decoded,recovered=null;targetInputs(width,height);
 const expanded=state.objects.filter(o=>o.gridExpansion),baseIsCurrent=base.width===state.width&&base.height===state.height&&base.objects.every(v=>v.object.getElement?.()===v.imageElement&&['left','top','width','height','scaleX','scaleY'].every(k=>Object.is(v.object[k],v.values[k])));
 globalThis.coexGridPreflight={baseIsCurrent,count:expanded.length,base:[base.width,base.height],scene:[state.width,state.height]};if(baseIsCurrent&&expanded.length===1){try{const under=partitionBackground(state).backgrounds.map(x=>x.object);recovered=await verifyExpandedGrid({state,object:expanded[0],permittedUnderlays:under,makeCanvas:(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;},decode:decodeCompositeTrial,isCurrent:()=>current()&&!!api()?.matchesAtomicLiveGuard?.(liveGuard)});}catch{}if(!current())return false;if(!api()?.matchesAtomicLiveGuard?.(liveGuard)){restoreInputs();tell('요소가 변경되어 규격 적용을 중지했습니다.',true);return false;}}
 globalThis.coexGridPreflight.recovered=!!recovered;composing=true;
 try{restore(base);const before={...state,width:base.width,height:base.height};if(recovered){const o=recovered.object;if(o.getElement?.()!==recovered.oldEl||o.getSrc?.()!==recovered.oldSrc)throw Error('격자 원본이 변경되어 변환을 중지했습니다.');o.setElement(recovered.raw);o.set({...recovered.original,gridExpansion:undefined});o.set('gridSourceProvenance',createRecoveredGridSourceProvenance(before,o,recovered.frame));o.setCoords();}
  const reviewed=new Map(state.objects.filter(o=>validGridSourceProvenance(before,o)).map(o=>[o,{...o.gridSourceProvenance.frame}]));result=resizeBackgroundOnly(before,width,height,pictureFitOptions());exposeOutsideTrial(state);plan=makeCompositeTrial(state,result,base,width,height,reviewed);
  if(recovered&&(!plan||plan.object!==recovered.object)){restore(base);result=resizeBackgroundOnly(before,width,height,pictureFitOptions());exposeOutsideTrial(state);plan=null;result.status='review';result.reason+=' 기존 격자는 원본을 유지했습니다. 새 규격의 연결을 확인하세요.';}else if(expanded.length&&!recovered&&baseIsCurrent){result.status='review';result.reason+=' 기존 격자는 원본을 유지했습니다. 새 규격의 연결을 확인하세요.';}
  target=capture({...state,width,height});}
 catch(error){restoreInputs();tell(error.message,true);return false;}finally{restore(previous);api()?.refresh();composing=false;}
 try{
  if(plan){decoded=await decodeCompositeTrial(plan.composite);if(!current())return false;if(!api()?.matchesAtomicLiveGuard?.(liveGuard)){restoreInputs();tell('요소가 변경되어 규격 적용을 중지했습니다.',true);return false;}}
  composing=true;try{restore(target);if(plan){if(!applyCompositeGrid(plan,decoded))throw Error('원본이 바뀌어 무늬 연결을 중지했습니다.');api().validateCompositeProject();result.status='review';result.reason+=' '+plan.warning;result.backgroundScope+=' 연결한 무늬를 확인하세요.';target=capture({...state,width,height});}promise=api().prepareAtomicSnapshot(width,height,{...expected,decision:result});}
  finally{restore(previous);api()?.refresh();composing=false;}
  prepared=await promise;if(!current()){globalThis.coexDiscardLayerSnapshotAtomic?.(prepared);return false;}
  if(!api()?.matchesAtomicLiveGuard?.(liveGuard)){globalThis.coexDiscardLayerSnapshotAtomic?.(prepared);if(current()){restoreInputs();tell('요소가 변경되어 규격 적용을 중지했습니다.',true);}return false;}
  composing=true;restore(target);let next;
  try{next=api().commitAtomic(width,height,expected,prepared);}catch(error){if(current()){restore(previous);api()?.refresh();restoreInputs();tell(error.message,true);}globalThis.coexDiscardLayerSnapshotAtomic?.(prepared);return false;}finally{composing=false;}
  lastAutomaticDecision=result;globalThis.coexBackgroundOnlyResult=result;undo={...previous,afterRevision:next.revision};lastRevision=next.revision;lastLayoutEngine='background-only-v1';
  try{globalThis.coexSetPresetMetadata?.(preset);$('reflowUndo').disabled=false;tell(width+' × '+height+'px · '+result.reason);outputNote.textContent=result.backgroundScope;publishSeparation();}catch{}return true;
 }catch(error){if(current()){restoreInputs();tell(error.message,true);}return false;}
}
globalThis.coexResizeEditorPreset=async function(p){if(!p){tell('규격을 선택하세요.',true);return false;}return resizeEditorAtomic(p.w,p.h,{preset:p});};
$('reflowRatio').onchange=()=>{const value=$('reflowRatio').value;if(!value)return;const [w,h]=value.split('x').map(Number);void resizeEditorAtomic(w,h);};
$('reflowApply').onclick=()=>resizeEditorAtomic(Number($('wInput').value),Number($('hInput').value));
$('layerResize').textContent='배경만 크기 적용';$('layerResize').onclick=()=>resizeEditorAtomic(Number($('wInput').value),Number($('hInput').value));
$('reflowCustomApply').onclick=()=>{let x=Number($('reflowCustomX').value),y=Number($('reflowCustomY').value);if(!Number.isInteger(x)||!Number.isInteger(y)||x<1||y<1||x>10000||y>10000){tell('비율은 1~10,000 사이 정수로 입력해 주세요.',true);return;}const gcd=(a,b)=>b?gcd(b,a%b):a,divisor=gcd(x,y);x/=divisor;y/=divisor;const unit=Math.max(1,Math.round(Number($('layerWidth').value)/x)),w=x*unit,h=y*unit;$('reflowRatio').value='';void resizeEditorAtomic(w,h);};
$('reflowNext').onclick=()=>{};
async function undoEditorAtomic(){
 const serial=++atomicResizeSerial;clearTimeout(sizeTimer);const state=api()?.read(),target=undo;
 if(!trustedEditorState(state)||!target||!matching(target,state)||state.revision!==target.afterRevision){$('reflowUndo').disabled=true;tell('이후 요소가 변경되어 이전 재배치를 되돌릴 수 없습니다.',true);return false;}
 const liveGuard=api()?.captureAtomicLiveGuard?.();if(!liveGuard){tell('다중선택을 해제하고 요소 이동이나 편집을 마친 뒤 다시 시도하세요.',true);return false;}
 const context=state.sceneOutputKey,previous=capture(state),expected={epoch:state.epoch,revision:state.revision},w=target.width,h=target.height;
 const current=()=>{const s=api()?.read();return serial===atomicResizeSerial&&trustedEditorState(s)&&s.epoch===expected.epoch&&s.revision===expected.revision&&s.sceneOutputKey===context&&Number($('wInput').value)===w&&Number($('hInput').value)===h;};
 const rollbackInputs=()=>{const s=api()?.read();if(serial===atomicResizeSerial&&s&&s.epoch===expected.epoch&&s.revision===expected.revision&&s.sceneOutputKey===context&&globalThis.getLayerOutputContextKey?.()===context)targetInputs(s.width,s.height);};
 const decision={policy:'background-only-v1',sourceEpoch:state.epoch,width:w,height:h,inputKind:state.inputKind||'layered',path:'background-only',method:'undo',status:'review',reason:'규격 변경 전 편집 화면을 복원했습니다.',backgroundScope:'복원된 배경을 확인하세요.'};
 let promise,prepared;targetInputs(w,h);composing=true;
 try{restore(target);promise=api().prepareAtomicSnapshot(w,h,{...expected,decision});}catch(error){rollbackInputs();tell(error.message,true);return false;}finally{restore(previous);api()?.refresh();composing=false;}
 try{prepared=await promise;if(!current()){globalThis.coexDiscardLayerSnapshotAtomic?.(prepared);return false;}
  if(!api()?.matchesAtomicLiveGuard?.(liveGuard)){globalThis.coexDiscardLayerSnapshotAtomic?.(prepared);if(current()){rollbackInputs();tell('요소가 변경되었거나 이동·다중선택 중이어서 되돌리기를 중지했습니다. 선택을 해제하고 다시 시도하세요.',true);}return false;}
  composing=true;restore(target);let result;
  try{result=api().commitAtomic(w,h,expected,prepared);}catch(error){if(current()){restore(previous);api()?.refresh();rollbackInputs();tell(error.message,true);}globalThis.coexDiscardLayerSnapshotAtomic?.(prepared);return false;}finally{composing=false;}
  lastAutomaticDecision=decision;globalThis.coexBackgroundOnlyResult=decision;lastRevision=-1;baseline=null;undo=null;try{globalThis.coexSetPresetMetadata?.(null);$('reflowUndo').disabled=true;tell('재배치 전의 크기와 요소 배치를 복원했습니다.');outputNote.textContent='재배치 전으로 복원한 화면입니다.';}catch{}return true;
 }catch(error){if(current()){rollbackInputs();tell(error.message,true);}return false;}
}
$('reflowUndo').onclick=()=>undoEditorAtomic();
// Existing SNS choices now use the editable scene when it belongs to the current source.
const rasterPreset=globalThis.applyPreset;
const originalEncode=globalThis.encodeTarget;
function sceneMatchesSource(state,source){return !!state&&(source?state.inputKind!=='raster'&&!!state.sourceKey&&source.key===state.sourceKey:state.linked);}
globalThis.applyPreset=function(p){
 const state=api()?.read(),source=globalThis.getLayerAnalysisSource?.();
 if(trustedEditorState(state)){
  queued=null;void resizeEditorAtomic(p.w,p.h,{preset:p});return;
 }
 rasterPreset(p);
 if(source?.inputKind==='layered'&&$('autoLayerPanel')&&$('autoLayerPanel').dataset.completedKey!==source.key){
  queued={preset:p,key:source.key,source:source.source};outputNote.textContent='요소 인식이 끝나면 선택한 규격으로 배경만 조정합니다.';
 }else outputNote.textContent='분리가 확인되면 배경만 조정하며, 확인 전에는 원본 전체를 보호합니다.';
};
// After a scene is active, freely edited output dimensions also trigger layout.
const rasterSchedule=globalThis.scheduleRender;
globalThis.scheduleRender=function(...args){
 const state=api()?.read(),w=Number($('wInput').value),h=Number($('hInput').value),source=globalThis.getLayerAnalysisSource?.();
 // A rendered slide is not an editable PPTX scene. Do not publish a white
 // raster preview while its native objects are still being connected.
 if(!composing&&source?.sourceFormat==='pptx'&&source.nativeProject&&!trustedEditorState(state)&&$('autoLayerPanel')?.dataset.completedKey!==source.key){
  globalThis.invalidate?.();globalThis.clearResult?.();
  outputNote.textContent='PPTX 원본 글씨와 그림을 연결하고 있습니다. 연결이 완료되면 선택한 규격을 적용합니다.';if($('automaticPolicyStatus'))$('automaticPolicyStatus').textContent=outputNote.textContent;
  return;
 }
 if(!composing&&trustedEditorState(state)&&validLayoutSize(w,h)&&(w!==state.width||h!==state.height)){
  clearTimeout(sizeTimer);const epoch=state.epoch,revision=state.revision,serial=atomicResizeSerial;
  sizeTimer=setTimeout(()=>{const next=api()?.read();if(serial===atomicResizeSerial&&trustedEditorState(next)&&next.epoch===epoch&&next.revision===revision&&Number($('wInput').value)===w&&Number($('hInput').value)===h)void resizeEditorAtomic(w,h);},180);return;
 }
 if(!composing&&trustedEditorState(state)&&w===state.width&&h===state.height&&globalThis.coexHasPendingEditedPreview?.()){
  globalThis.coexRequestEditedPreview?.();return;
 }
 return rasterSchedule(...args);
};
// An explicit background choice also refreshes an already-sized linked scene.
for(const id of ['extendSourceBackground','transparentBg','resizeBehavior','fitWholePictures'])$(id)?.addEventListener('change',()=>{
 const state=api()?.read(),w=Number($('wInput').value),h=Number($('hInput').value);
 if(!composing&&trustedEditorState(state)&&validLayoutSize(w,h))void resizeEditorAtomic(w,h);
});
const rasterSettings=globalThis.readCompositionSettings;
globalThis.readCompositionSettings=function(){const settings=rasterSettings(),state=api()?.read();if(state?.linked&&sceneMatchesSource(state,globalThis.getLayerAnalysisSource?.()))settings.layout={pictureFit:$('fitWholePictures').checked?'whole-source':'original-frame',engine:lastLayoutEngine,solver:solverInfo.name,solverVersion:solverInfo.version,rules:solverInfo.rules,sourceWidth:baseline?.width||state.width,sourceHeight:baseline?.height||state.height};return settings;};
globalThis.getAutomaticSceneDecision=(source,w,h)=>{
 const state=api()?.read();if(!sceneMatchesSource(state,globalThis.getLayerAnalysisSource?.())||!globalThis.isLayerOutputSource?.(source)||state.width!==w||state.height!==h)return null;
 if(lastAutomaticDecision&&lastAutomaticDecision.sourceEpoch===state.epoch&&lastAutomaticDecision.width===w&&lastAutomaticDecision.height===h)return lastAutomaticDecision;
 const p=partitionBackground(state),bitmap=p.backgrounds.some(x=>['pptx-native-bitmap-stretch-review','json-independent-bitmap-stretch-review'].includes(x.evidence));return{policy:'background-only-v1',sourceEpoch:state.epoch,width:w,height:h,inputKind:state.inputKind||'layered',path:'background-only',method:'current-scene',status:p.separated&&!p.unresolved.length&&!bitmap&&!p.backgrounds.some(x=>x.textureProfile)?'ready':'review',reason:bitmap?'배경 후보에 포함된 글씨·로고와 늘어난 모양을 확인하세요.':p.separated?'원본 요소 배치를 유지한 편집 장면입니다. 확인된 배경만 크기를 바꿉니다.':'독립 배경 분리를 확인하지 못했습니다. 원본 전체를 보호하고 있습니다.',crop:'none',stretch:false};
};
globalThis.encodeTarget=async function(source,p,settings){
 const policy=globalThis.coexAutoResizePolicy,state=api()?.read(),sourceInfo=globalThis.getLayerAnalysisSource?.(),origin=policy.origin(source),alias=policy.alias(source);
 if(!sceneMatchesSource(state,sourceInfo)||!globalThis.isLayerOutputSource?.(origin))return originalEncode(source,p,{...settings,mode:'auto'});
 if(alias&&(alias.epoch!==state.epoch||alias.revision!==state.revision))throw Error('편집 내용이 바뀌어 일괄 변환을 중단했습니다.');
 const fitWholePictures=$('fitWholePictures').checked,guard=api()?.captureAtomicLiveGuard?.();
 if(!guard)throw Error('요소 이동이나 편집을 마친 뒤 일괄 변환해 주세요.');
 const current=()=>{const live=api()?.read(),info=globalThis.getLayerAnalysisSource?.();return $('fitWholePictures').checked===fitWholePictures&&!!live&&live.epoch===state.epoch&&live.revision===state.revision&&live.sceneOutputKey===state.sceneOutputKey&&sceneMatchesSource(live,info)&&!!globalThis.isLayerOutputSource?.(origin)&&!!api()?.matchesAtomicLiveGuard?.(guard);};
 const outsideCurrent=await preloadOutsideTrial(state,current);
 if(!current()||!outsideCurrent())throw Error('편집 내용이 바뀌어 일괄 변환을 중단했습니다.');
 const original=capture(state),base=baseFor(state),diagnostics={plan:globalThis.coexLastLayoutPlan,candidates:globalThis.coexLayoutCandidates,failure:globalThis.coexLayoutFailure};let image,decision;
 try{
  // No await while the live scene temporarily has target geometry.
  const wasComposing=composing;composing=true;
  try{restore(base);const sourceState={...state,width:base.width,height:base.height};decision=resizeBackgroundOnly(sourceState,p.w,p.h,{includeWholePictures:fitWholePictures});exposeOutsideTrial(state);image=api().snapshot(p.w,p.h);policy.record(image,decision);}
  finally{try{restore(original);api().refresh();globalThis.coexLastLayoutPlan=diagnostics.plan;globalThis.coexLayoutCandidates=diagnostics.candidates;globalThis.coexLayoutFailure=diagnostics.failure;}finally{composing=wasComposing;}}
  if(!current()||!outsideCurrent())throw Error('편집 내용이 바뀌어 일괄 변환을 중단했습니다.');
  const blob=await originalEncode(image,p,{...settings,mode:'auto'});
  if(!current()||!outsideCurrent())throw Error('편집 내용이 바뀌어 일괄 변환을 중단했습니다.');
  policy.record(blob,decision);return blob;
 }finally{if(image)image.width=image.height=0;}
};
$('layerPreset').onchange=()=>{if(!$('layerPreset').value)return;const [w,h]=$('layerPreset').value.split('x').map(Number);$('reflowRatio').value='';void resizeEditorAtomic(w,h);};
let separationKey='',separationAttemptKey='',separationAttempts=0,separationRetryAt=0,separationBusy=false,separationPendingKey='',separationQuietAt=0;
function publishSeparation(){
 if(separationBusy||document.hidden||$('layerWork').hidden||!$('backgroundSeparationDetails').open)return;
 const state=api()?.read();if(!state)return;
 const key=state.epoch+':'+state.revision+':'+state.width+'x'+state.height;if(key===separationKey)return;
 if(separationPendingKey!==key){separationPendingKey=key;separationQuietAt=performance.now()+600;return;}
 if(performance.now()<separationQuietAt)return;
 if(separationAttemptKey!==key){separationAttemptKey=key;separationAttempts=0;separationRetryAt=0;}
 if(state.fontError||document.fonts.status==='loading'||separationAttempts>=2||performance.now()<separationRetryAt)return;
 separationBusy=true;separationAttempts++;separationRetryAt=performance.now()+1250;
 try{const source=globalThis.getLayerAnalysisSource?.(),native=state.sourceFormat==='pptx'&&source?.key===state.sourceKey;const parts=native?sourceBackgroundParts(state):null;const p=separationPreviews(state,()=>api().snapshotThumbnail(512),parts||undefined);$('backgroundOnlyPreview').src=p.background;$('foregroundOnlyPreview').src=p.foreground;
 const coverage=native?source.nativeProject?.analysis?.backgroundSeparation:null;
 const colour=coverage?.backgroundColor;
 $('backgroundSeparationStatus').textContent=(p.parts.separated?'배경과 전체 요소를 별도로 표시합니다.':'배경 분리 확인이 필요합니다.')+(colour?' 배경색 '+colour.toUpperCase()+'.':'')+' 배경 '+p.parts.backgrounds.length+'개 · 요소 레이어 '+p.parts.foreground.length+'개.'+(coverage?' 불러올 때 '+(coverage.coverageBasis==='slide-xml'?'원본 객체 ':'가져오기에서 확인된 객체 ')+coverage.expected+'개 중 '+coverage.retained+'개를 유지했습니다.'+(coverage.missing.length?' 누락/화면 밖 '+coverage.missing.length+'개는 확인이 필요합니다.':''):'')+' 글씨·그림의 세부 분류 및 실제 화면은 아직 검증하지 않았습니다.';
 $('saveSeparatedBackground').disabled=!native||!p.parts.separated;
 $('saveSeparatedElements').disabled=!native||!p.parts.separated||!p.parts.foreground.length;
 separationKey=key;
 }catch(error){$('backgroundSeparationStatus').textContent='분리 미리보기 확인 필요: '+error.message+(separationAttempts>=2?' · 반복 처리를 멈췄습니다. 새 파일이나 규격 변경 후 다시 확인합니다.':'');}finally{separationBusy=false;}
}
function saveSeparated(kind){
 const state=api()?.read(),source=globalThis.getLayerAnalysisSource?.();
 if(!state||state.sourceFormat!=='pptx'||source?.key!==state.sourceKey)return;
 const parts=sourceBackgroundParts(state);if(!parts.separated){tell('배경 분리 상태를 먼저 확인하세요.',true);return;}
 let c;try{c=withSeparationVisibility(state,parts,kind,()=>api().snapshot(state.width,state.height));c.toBlob(blob=>{
  c.width=c.height=0;if(!blob){tell('분리 PNG를 저장하지 못했습니다.',true);return;}
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(source.name||'PPTX')+(kind==='background'?'_배경.png':'_전체요소.png');a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
 },'image/png');}catch(error){if(c)c.width=c.height=0;tell('분리 PNG 저장 확인 필요: '+error.message,true);}
}
$('saveSeparatedBackground').onclick=()=>saveSeparated('background');
$('saveSeparatedElements').onclick=()=>saveSeparated('foreground');
const timer=setInterval(()=>{
 if(document.hidden)return;
 publishSeparation();const state=api()?.read();$('reflowApply').disabled=!state;$('reflowUndo').disabled=!state||!matching(undo,state)||state.revision!==undo?.afterRevision;
 updateOutsideReferenceNotice(state);
 if(!state||candidateContext!==`${state.epoch}:${state.width}x${state.height}`)$('reflowNext').disabled=true;
 if(queued){const source=globalThis.getLayerAnalysisSource?.();if(!source||source.key!==queued.key||source.source!==queued.source){queued=null;outputNote.textContent='';}
  else if(state?.sourceKey===queued.key&&sceneMatchesSource(state,source)){const p=queued.preset;queued=null;void resizeEditorAtomic(p.w,p.h,{preset:p});}
 }
},250);
// A manual size replaces a preset queued while OCR or native import is pending.
for(const id of ['wInput','hInput'])$(id).addEventListener('input',()=>{queued=null;atomicResizeSerial++;clearTimeout(sizeTimer);},{capture:true});
$('fitWholePictures').addEventListener('change',()=>{queued=null;atomicResizeSerial++;clearTimeout(sizeTimer);},{capture:true});
window.addEventListener('coex:layer-source',()=>{queued=null;atomicResizeSerial++;clearTimeout(sizeTimer);});
window.addEventListener('coex:layer-edit',()=>{
 const source=globalThis.getLayerAnalysisSource?.(),state=api()?.read();
 const oldSceneWasEdited=!!source&&source.sourceFormat==='pptx'&&!!source.nativeProject&&state&&state.sourceKey!==source.key&&$('autoLayerPanel')?.dataset.completedKey!==source.key;
 queued=null;clearTimeout(sizeTimer);
 if(oldSceneWasEdited){
  // Keep the user's edited scene and never show its raster result as the new
  // PPTX. Re-opening the source is required after the pending import cancels.
  globalThis.invalidate?.();globalThis.clearResult?.();
  outputNote.textContent='이전 편집 내용이 변경되어 새 PPTX 연결을 중단했습니다. 현재 내용을 저장한 뒤 PPTX를 다시 열어 주세요.';if($('automaticPolicyStatus'))$('automaticPolicyStatus').textContent=outputNote.textContent;
 }
});
window.addEventListener('pagehide',e=>{if(!e.persisted)clearInterval(timer);});

window.addEventListener('coex:layer-unavailable',e=>{if(queued?.key===e.detail?.key)queued=null;outputNote.textContent=e.detail?.reason||'원본 리사이징을 사용하세요.';const source=globalThis.getLayerAnalysisSource?.();if(source?.sourceFormat==='pptx'&&source.key===e.detail?.key&&$('automaticPolicyStatus'))$('automaticPolicyStatus').textContent=outputNote.textContent;});


// A preset can be picked while the self-hosted Yoga module is still loading.
// Replay only for a fresh automatic scene; never overwrite intervening edits.
{
 const initialSource=globalThis.getLayerAnalysisSource?.(),initialState=api()?.read();
 const initialPreset=typeof activePreset==='undefined'?null:activePreset;
 if(initialSource&&initialPreset&&(!initialState||initialState.sourceKey===initialSource.key&&initialState.revision===0)&&Number($('wInput').value)===initialPreset.w&&Number($('hInput').value)===initialPreset.h)globalThis.applyPreset(initialPreset);
}

// Read the pre-reflow frame without changing the live editor. The first design
// candidate must not preserve an already automatically rearranged scene.
export function capturePreservedDesignSource(doc,state){
 const saved=baseFor(state),source=structuredClone(doc);source.width=saved.width;source.height=saved.height;
 const current=source.scene.objects;source.scene.objects=saved.objects.map(({object,values})=>Object.assign(current[state.objects.indexOf(object)],structuredClone(values)));return source;
}
export function composePreservedDesign(state,width,height){
 const fit=preserveObjects(state,width,height,{allowUpscale:true});
 return {engine:'preserved-source-layout',candidate:'preserved-source',width,height,warnings:[],...fit};
}
