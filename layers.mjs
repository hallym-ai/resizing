import {validateOutsideReport} from './outside-status.mjs';
import {canonicalOutside,outsideSourceChanged,validateOutside,installOutside} from './outside-recovery.mjs';
import {installTextureBackgroundRenderer,validTextureFrame} from './texture-background.mjs';
import {installReadabilityPanels} from './readability-panels.mjs';
import {solidBackgroundColor,sourceBoundaryBackgroundColor} from './solid-background.mjs';
import {loadProjectFonts,fontDataUrl,restoreLoadedProjectFonts,assertProjectFontReferences} from './project-fonts.mjs';
/* Layer-preserving source editor. Fabric scene JSON is separate from raster output. */
const panel=document.createElement('section');panel.className='card layer-entry';panel.id='layerPanel';
panel.innerHTML=`<h2>레이어로 열고 요소 편집</h2><p>레이어가 있는 원본을 가져와 글자·그림을 따로 이동하세요. 편집 프로젝트는 JSON으로 보관하고, 완성한 화면을 SNS 리사이징에 적용합니다.</p>
<div class="layer-tools"><button id="layerOpen" class="doc-btn">PSD · SVG · 레이어 JSON 열기</button><button id="layerDemo" class="doc-btn">샘플로 시작</button><button id="layerToggle" class="doc-btn" hidden>편집 화면 접기</button></div>
<input id="layerFile" type="file" accept=".psd,.svg,.json" hidden><input id="layerAsset" type="file" accept="image/png,image/jpeg,image/webp" hidden>
<p id="layerStatus" class="layer-status" role="status" aria-live="polite">이미지·PDF·PPTX 페이지를 열면 자동으로 요소를 인식합니다. PSD·SVG·JSON 원본도 직접 열 수 있습니다.</p>
<div id="layerWork" class="layer-work" hidden><div class="layer-heading"><strong id="layerName">새 프로젝트</strong><button class="doc-btn" id="layerSave">레이어 JSON 저장</button></div>
<p class="layer-help">PSD는 픽셀 레이어별로 이동하며, PSD 텍스트는 픽셀 상태이며 PPTX의 일반 글자는 바로 편집됩니다. SVG·PPTX 도형은 지원하는 경우 벡터를 보존합니다. 그룹 안의 요소는 ‘그룹 풀기’를 사용하세요.</p>
<fieldset id="layerFields"><div class="layer-size" style="display:none" aria-hidden="true"><label>너비 <input id="layerWidth" type="number" min="1" max="12000" value="1080"></label><span>×</span><label>높이 <input id="layerHeight" type="number" min="1" max="12000" value="1080"></label><button id="layerResize" class="doc-btn">캔버스만 변경</button><select id="layerPreset" aria-label="레이어 캔버스 SNS 규격"><option value="">SNS 규격 선택</option></select></div>
<p class="layer-help">현재 캔버스 <strong id="layerCanvasSize">1080 × 1080 px</strong> · <button type="button" class="doc-btn" id="layerOutputSizeOpen">출력 규격 설정</button></p>
<div class="layer-tools" role="group" aria-label="요소 선택과 편집"><button id="layerSelectAll" class="doc-btn">전체 선택</button><button id="layerDeselect" class="doc-btn">선택 해제</button><button id="layerDuplicate" class="doc-btn">복제</button><button id="layerGroup" class="doc-btn">그룹 묶기</button></div><p class="layer-help">빈 곳에서 드래그해 영역 선택 · Shift+클릭으로 추가 선택 · Ctrl+A 전체 선택 · Ctrl+D 복제 · 방향키 1px / Shift+방향키 10px 이동 · Esc 해제. 잠금·숨김 요소는 전체 선택에서 제외됩니다.</p><div class="layer-tools"><button id="layerTextAdd" class="doc-btn">+ 글자</button><button id="layerImageAdd" class="doc-btn">+ 사진·그림 파일</button><button id="layerLogoAdd" class="doc-btn">+ 로고 파일</button><button id="layerShapeAdd" class="doc-btn">+ 사각형</button><button id="layerUngroup" class="doc-btn">그룹 풀기</button></div>
<details><summary>자동 재배치 묶음 수정</summary><p class="layer-help">함께 읽을 요소를 체크하거나 Shift+클릭한 뒤 같은 묶음 이름과 역할을 지정하세요. 글자·사진 자체와 앞뒤 순서는 유지됩니다.</p><button id="layerRelationSelect" class="doc-btn">같은 의미 묶음 선택</button><label>묶음 이름 <input id="layerRelationName" maxlength="80" placeholder="예: 영업정보"></label><label>묶음 역할 <select id="layerRelationRole"><option value="title">제목</option><option value="body">설명</option><option value="details">영업·필수정보</option><option value="subject">주요 이미지</option><option value="logo">브랜드정보</option><option value="decoration">장식</option></select></label><button id="layerRelationApply" class="doc-btn">선택 요소 묶음 지정</button><button id="layerRelationClear" class="doc-btn">선택 요소 자동 판단으로</button></details><div class="layer-tools" role="group" aria-label="선택 요소 정렬"><label>정렬 기준 <select id="layerAlignTarget"><option value="selection">선택 영역 · 1개일 때 캔버스</option><option value="canvas">전체 캔버스</option></select></label><button id="layerAlignLeft" class="doc-btn">왼쪽 정렬</button><button id="layerAlignCenter" class="doc-btn">가로 가운데</button><button id="layerAlignRight" class="doc-btn">오른쪽 정렬</button><button id="layerAlignTop" class="doc-btn">위쪽 정렬</button><button id="layerAlignMiddle" class="doc-btn">세로 가운데</button><button id="layerAlignBottom" class="doc-btn">아래쪽 정렬</button><button id="layerDistributeX" class="doc-btn">가로 간격 맞춤</button><button id="layerDistributeY" class="doc-btn">세로 간격 맞춤</button></div><div class="layer-layout"><div id="layerStage" class="layer-stage"><canvas id="layerCanvas" aria-label="요소를 선택해 이동할 수 있는 편집 캔버스"></canvas></div><aside class="layer-side"><div><h3>요소 · 위쪽이 앞</h3><p class="layer-help">종류와 원본 순서를 인식합니다. 체크하거나 Shift+클릭해 여러 요소를 선택하세요.</p><p id="layerSelectionCount" class="layer-help"></p><div id="layerList" class="layer-groups"><section class="layer-group" aria-labelledby="layerTextHeading"><h4 id="layerTextHeading">글씨 <span id="layerTextCount" class="layer-count">0</span></h4><label class="layer-search-label" for="layerTextSearch">글씨 검색</label><div class="layer-search"><input id="layerTextSearch" type="search" maxlength="200" placeholder="글씨 내용이나 이름 검색" autocomplete="off" aria-controls="layerTextList"><button id="layerTextClear" type="button" aria-label="글씨 검색 지우기" hidden>지우기</button></div><p id="layerTextResult" class="layer-search-result" role="status" aria-live="polite"></p><ol id="layerTextList" class="layer-list" aria-label="글씨 요소"></ol><p id="layerTextEmpty" class="layer-empty" hidden></p></section><section class="layer-group" aria-labelledby="layerVisualHeading"><h4 id="layerVisualHeading">이미지·도형 <span id="layerVisualCount" class="layer-count">0</span></h4><ol id="layerVisualList" class="layer-list" aria-label="이미지·도형·그룹 요소"></ol><p id="layerVisualEmpty" class="layer-empty" hidden>이미지·도형 요소가 없습니다.</p></section></div><div class="layer-tools"><button id="layerFront" class="doc-btn">한 단계 앞으로</button><button id="layerBack" class="doc-btn">한 단계 뒤로</button><button id="layerToFront" class="doc-btn">맨 앞으로</button><button id="layerToBack" class="doc-btn">맨 뒤로</button><button id="layerDelete" class="doc-btn">삭제</button></div></div>
<fieldset id="layerProps" class="layer-props" disabled><div id="independentBgControls" hidden><p class="layer-help">선택한 배경 사진만 현재 캔버스에 맞춥니다. 화면 맞춤은 가장자리가 잘릴 수 있으며, 투명 영역이 남을 수 있습니다. 전체 보기는 여백이 생길 수 있습니다. 새 배경을 생성하지 않습니다.</p><button type="button" class="doc-btn" id="independentBgCover">배경 사진 화면에 맞추기</button><button type="button" class="doc-btn" id="independentBgContain">배경 사진 전체 보기</button><button type="button" class="doc-btn" id="independentBgUndo" disabled>방금 배경 맞춤 되돌리기</button></div><label for="layerObjectName">요소 이름</label><input id="layerObjectName" maxlength="200"><label for="layerPriority">공간 부족 시 우선순위</label><select id="layerPriority"><option value="keep">필수 · 항상 유지</option><option value="high">중요 · 최대한 유지</option><option value="normal">보통</option><option value="optional">낮음 · 먼저 생략 가능</option></select><p class="layer-help">생략 허용을 켠 경우에만 낮은 순위부터 숨깁니다. 필수·잠금·배경은 유지합니다.</p><label for="layerRole">용도</label><select id="layerRole"><option value="other">기타</option><option value="background">배경</option><option value="logo">로고</option><option value="title">행사명·제목</option><option value="details">날짜·장소</option><option value="subject">주요 이미지</option><option value="decoration">장식</option></select>
<div class="row2"><div><label for="layerX">X 위치</label><input id="layerX" type="number" step="1"></div><div><label for="layerY">Y 위치</label><input id="layerY" type="number" step="1"></div></div>
<label><input type="checkbox" id="layerVisible"> 표시</label><label><input type="checkbox" id="layerLocked"> 잠금</label><label for="layerOpacity">불투명도</label><input id="layerOpacity" type="range" min="0" max="100" value="100">
<div id="layerTextProps" hidden><label for="layerText">글자 내용</label><textarea id="layerText" maxlength="20000"></textarea><div class="row2"><div><label for="layerFontSize">글자 크기</label><input type="number" id="layerFontSize" min="1" max="2000"></div><div><label for="layerColor">글자색</label><input type="color" id="layerColor"></div></div></div>
<div id="layerTypography" hidden><label for="layerTextAlign">글자 정렬</label><select id="layerTextAlign"><option value="left">왼쪽</option><option value="center">가운데</option><option value="right">오른쪽</option><option value="justify">양쪽</option></select><label for="layerLineHeight">줄 간격 배수</label><input id="layerLineHeight" type="number" min="0.5" max="5" step="0.05"><label for="layerCharSpacing">자간 (1/1000 em)</label><input id="layerCharSpacing" type="number" min="-200" max="2000" step="10"><label><input id="layerBold" type="checkbox"> 굵게</label><label><input id="layerItalic" type="checkbox"> 기울임</label></div><label for="layerFontFamily">글꼴</label><input id="layerFontFamily" maxlength="300" placeholder="예: Malgun Gothic"><button id="layerFontLoad" type="button" class="doc-btn">원본 글꼴 파일 불러오기</button><input id="layerFontFile" type="file" accept=".ttf,.otf,.woff,.woff2" hidden><p class="layer-help">원본 글꼴이 없으면 대체됩니다. 포함된 글꼴과 직접 불러온 글꼴은 프로젝트 JSON에 보관합니다.</p><p id="layerCutoutNotice" class="layer-help" hidden></p><button id="layerTextRebuild" class="doc-btn" hidden>이미지 글자를 편집 글자로 교체</button></fieldset></aside></div>
<p id="layerSummary" class="layer-summary"></p><div class="layer-tools layer-actions"><button id="layerApply" class="btn-primary">현재 화면을 리사이징에 적용</button><button id="layerPng" class="doc-btn">현재 화면 PNG 저장</button><button id="layerSvg" class="doc-btn">SVG 저장 · 글자·도형 벡터</button></div>
</fieldset><details><summary>지원 범위와 사용한 오픈 소스</summary><p>Fabric.js 7.4.0 · ag-psd 31.0.3 (MIT). PSD는 RGB 8비트 / 픽셀 레이어 200개까지. 그룹 경로·표시·불투명도·위치·순서를 가져오며 마스크·블렌딩·조정·복잡한 효과를 재현하지 않습니다. 원본 PSD·PPTX로 다시 저장하지 않습니다. 이미지 글자를 편집 글자로 교체하면 글꼴·줄바꿈이 바뀔 수 있습니다. 설치된 글꼴을 사용합니다.</p><p>SVG 안의 스크립트·원격 참조·필터·애니메이션은 가져오지 않습니다. 외부 사진·로고는 PNG/JPG/WebP 파일로, 글꼴은 TTF/OTF/WOFF/WOFF2 파일로 직접 추가할 수 있습니다. 디자인 후보에서는 해당 자산과 글꼴을 사용해 규격별 크기·줄바꿈·여백을 조정합니다. 이 원본 입력 경로에서는 평면 이미지의 글자를 인식하지 않습니다. 일반 이미지·문서 입력에서 자동으로 인식합니다. 레이어 JSON은 이 편집기의 저장 형식입니다. 파일은 서버로 보내지 않습니다.</p><p><a href="https://github.com/fabricjs/fabric.js" target="_blank" rel="noopener noreferrer">Fabric.js 소스</a> · <a href="https://github.com/Agamnentzar/ag-psd" target="_blank" rel="noopener noreferrer">ag-psd 소스</a> · <a href="./vendor/layers/LICENSE-fabric.txt" target="_blank">Fabric MIT</a> · <a href="./vendor/layers/LICENSE-ag-psd.txt" target="_blank">ag-psd MIT</a></p></details></div>`;
document.getElementById('dropzone').before(panel);
const by=id=>document.getElementById(id),MAX_FILE=50*1024*1024,extra=['photoBoundaryOriginal','photoInstanceCrop','generatedPhotoSource','generatedRegionMask','generatedMethod','photoInstanceGroup','photoInstanceKind','photoInstanceWasLocked','photoInstanceWasVisible','perPixelTargetFind','originalPhotoSource','originalPhotoCutoutMethod','textureBackgroundFrame','readabilityPanelBox','layerName','layerRole','layerLocked','sourceText','cutoutMethod','cutoutBackground','sourceElementId','sourceElementType','nativeKind','sourceFontFamily','sourceStackIndex','layerRoleInferred','sourceImageFill','designAccent','designAccentSize','layerPriority','autoOmitted','layoutUnit','layoutRole','layoutBand','layoutOriginalText','layoutSourceWidth','layoutSourceHeight','layoutManualGroup','layoutManualRole','layoutOverlapBasis','layoutGraphSource','outsideRecoveryReview'];
let F,canvas,initPromise,epoch=0,worker=null,workerReject=null,width=1080,height=1080,projectName='새 프로젝트',revision=0,linked=false,loading=false;
let outsideRecoveryReport=null;globalThis.coexGetOutsideRecoveryReport=()=>outsideRecoveryReport;
let sceneInputKind='layered',sceneSourceFormat='layer-json';
let sceneSourceKey=null,sceneOutputKey=null,sceneManual=false,projectFonts=[],fontHandle=null;const marked=new Set();
const sceneOutputCurrent=()=>{const key=globalThis.getLayerOutputContextKey?.();return !!key&&!!sceneOutputKey&&key===sceneOutputKey;};
const say=(text,error=false)=>{by('layerStatus').textContent=text;by('layerStatus').classList.toggle('error',error);};
const dims=(w,h)=>Number.isInteger(w)&&Number.isInteger(h)&&w>0&&h>0&&w<=12000&&h<=12000&&w*h<=24000000;
const current=()=>canvas?.getActiveObject();
const textObject=o=>o&&['text','itext','textbox'].includes(String(o.type).toLowerCase());
const roles=['other','background','logo','title','details','subject','decoration'];
function fail(message){throw Error(message);}
function noRasterCache(o){o.set('objectCaching',false);o.getObjects?.().forEach(noRasterCache);}
function normalize(o,name){noRasterCache(o);if(o.sourceText?.trim()&&/^인식 글자 \d+(?: · OCR \d+%)?$/.test(o.layerName||''))o.set('layerName',o.sourceText.replace(/\s+/g,' ').trim());o.set({layerName:o.layerName||name||o.type,layerRole:roles.includes(o.layerRole)?o.layerRole:'other',objectCaching:false});if(String(o.type).toLowerCase()==='image')o.set('perPixelTargetFind',true);lock(o,!!o.layerLocked);return o;}
function lock(o,on){o.set({layerLocked:on,lockMovementX:on,lockMovementY:on,lockScalingX:on,lockScalingY:on,lockRotation:on,hasControls:!on,selectable:!on,evented:!(on&&o.layerRole==='background')});}
async function init(){
 if(initPromise)return initPromise;
 initPromise=(async()=>{F=await import('./vendor/layers/fabric.mjs');installReadabilityPanels(F);installTextureBackgroundRenderer(F);F.config.NUM_FRACTION_DIGITS=5;F.FabricObject.ownDefaults.originX='left';F.FabricObject.ownDefaults.originY='top';
 canvas=new F.Canvas('layerCanvas',{width:1080,height:1080,selection:true,selectionFullyContained:false,preserveObjectStacking:true,enableRetinaScaling:false,renderOnAddRemove:false});
 canvas.on('before:render',syncSolidBackdrop);
 canvas.on('selection:created',selection);canvas.on('selection:updated',selection);canvas.on('selection:cleared',selection);
 canvas.on('mouse:up',()=>setTimeout(()=>resumeEditedPreview('interaction'),0));
 canvas.on('selection:updated',()=>setTimeout(()=>resumeEditedPreview('interaction'),0));
 canvas.on('selection:cleared',()=>setTimeout(()=>resumeEditedPreview('interaction'),0));
 canvas.on('object:modified',changed);canvas.on('text:changed',()=>changed(false));
 let fitFrame=0;new ResizeObserver(()=>{if(fitFrame)return;fitFrame=requestAnimationFrame(()=>{fitFrame=0;fit();});}).observe(by('layerStage'));
 })();return initPromise;
}
// A verified solid slide capture may have alpha 254 on its outermost pixel.
// Fill behind it in the editor itself, so PNG export does not add a different
// colour later. This never modifies the source image or foreground objects.
globalThis.resolveCompositionBackgroundColor=source=>{
 const original=globalThis.getLayerAnalysisSource?.();
 if(globalThis.isLayerOutputSource?.(source)&&(!original?linked:sceneSourceKey&&sceneSourceKey===original.key)){const solid=canvas?.getObjects().map(solidBackgroundColor).find(Boolean);if(solid)return solid;}
 return sourceBoundaryBackgroundColor(source);
};
function syncSolidBackdrop(){
 if(!canvas)return;
 const solid=by('extendSourceBackground')?.checked!==false?canvas.getObjects().map(solidBackgroundColor).find(Boolean):null;
 const transparent=by('transparentBg')?.checked!==false;
 canvas.backgroundColor=solid||(!transparent?by('backgroundColor')?.value||'#ffffff':by('fmtSelect')?.value==='image/jpeg'?'#ffffff':'');
}
function ensureProjectTypography(){
 if(!canvas||loading)return;
 assertProjectFontReferences(canvas.getObjects(),projectFonts);
 const objects=[];
 const visit=o=>{objects.push(o);
  o.getObjects?.().forEach(visit);
 };
 canvas.getObjects().forEach(visit);
 const repaired=restoreLoadedProjectFonts(projectFonts);
 if(repaired.length){
  // Fabric caches full family lists as well as aliases; clear all font entries
  // before rebuilding dimensions, including run styles and nested text.
  F.cache.clearFontCache();
  for(const o of objects)if(textObject(o)){o.initDimensions();o.dirty=true;o.setCoords();}
  for(const o of [...objects].reverse())if(o.getObjects){o.triggerLayout?.();o.dirty=true;o.setCoords();}
  canvas.requestRenderAll();globalThis.coexFontRecovery={families:repaired,status:'restored-and-remeasured'};
 }
}
function nativeSnapshot(w,h){
 ensureProjectTypography();
 const previous=canvas.viewportTransform;
 try{canvas.setViewportTransform([1,0,0,1,0,0]);return canvas.toCanvasElement(1,{left:0,top:0,width:w,height:h});}
 finally{canvas.setViewportTransform(previous);canvas.requestRenderAll();}
}
// Resolve the current scene when the output is linked, or when a fresh native
// PPTX has just finished loading. Keep its document session and page controls.
globalThis.resolveLayerCompositionSource=(source,w,h)=>{
 if(!canvas||loading||!globalThis.isLayerOutputSource?.(source))return source;
 const original=globalThis.getLayerAnalysisSource?.();
 if(original&&original.key!==sceneSourceKey)return source;
 if(!linked&&!(revision===0&&original?.nativeProject&&original.key===sceneSourceKey))return source;
 // Snapshot the complete validated scene; the composition renderer fits it
 // to the target. Using target dimensions here would crop the source first.
 return nativeSnapshot(width,height);
};
function fit(){if(!canvas||by('layerWork').hidden)return;const available=Math.max(180,by('layerStage').clientWidth-26),zoom=Math.min(1,available/width,580/height);const displayWidth=Math.round(width*zoom),displayHeight=Math.round(height*zoom);if(canvas.getWidth()===displayWidth&&canvas.getHeight()===displayHeight&&Math.abs(canvas.getZoom()-zoom)<1e-8)return;canvas.setDimensions({width:displayWidth,height:displayHeight});canvas.setZoom(zoom);canvas.requestRenderAll();}
function show(){mountSizeControls(true);syncOutputSize();by('layerWork').hidden=false;by('layerToggle').hidden=false;by('layerToggle').textContent='편집 화면 접기';fit();}
function selection(){
 window.dispatchEvent(new Event('coex:outside-recovery-change'));
 marked.clear();for(const item of canvas?.getActiveObjects()||[])marked.add(item);
 const active=current(),o=active?.isType('ActiveSelection')?null:active;by('layerProps').disabled=!o;by('layerCutoutNotice').hidden=true;if(o&&String(o.type).toLowerCase()==='image'&&o.cutoutMethod){by('layerCutoutNotice').hidden=false;by('layerCutoutNotice').textContent=o.cutoutMethod==='pptx-original-object'?'PPTX 원래 객체를 배경·다른 객체와 분리했습니다. 객체 이미지 속에 이미 합쳐진 글자는 별도 글자가 아닙니다.':o.cutoutMethod?.startsWith('poster-')?'PNG/JPG에서 윤곽을 추정한 요소입니다. 글씨 모양은 이미지로 보존되며 내용 편집 시 서체가 달라집니다. 이동 후 추정 배경과 가장자리를 확인하세요.':o.cutoutMethod==='unresolved'?'이 영역은 배경을 확실히 구별하지 못했습니다. 복잡한 배경·같은 색은 별도 원본이 필요할 수 있습니다.':'배경을 투명하게 분리한 요소입니다. 투명한 부분은 클릭 선택되지 않습니다.';}by('layerTypography').hidden=!textObject(o);if(textObject(o)){by('layerTextAlign').value=o.textAlign;by('layerLineHeight').value=o.lineHeight;by('layerCharSpacing').value=o.charSpacing;by('layerBold').checked=o.fontWeight==='bold'||Number(o.fontWeight)>=600;by('layerItalic').checked=o.fontStyle==='italic';}if(!o){by('layerTextProps').hidden=true;by('layerTextRebuild').hidden=true;list();return;}
 by('layerObjectName').value=o.layerName||o.type;by('layerRole').value=o.layerRole||'other';by('layerPriority').value=['keep','high','normal','optional'].includes(o.layerPriority)?o.layerPriority:'keep';by('layerX').value=Math.round(o.left);by('layerY').value=Math.round(o.top);by('layerVisible').checked=o.visible;by('layerLocked').checked=!!o.layerLocked;by('layerOpacity').value=Math.round(o.opacity*100);
 by('layerTextProps').hidden=!(textObject(o)||o.sourceText||o.nativeKind==='text');by('layerTextRebuild').hidden=!(o.sourceText||o.nativeKind==='text')||textObject(o);
 by('layerFontFamily').disabled=!textObject(o);by('layerFontLoad').disabled=!textObject(o);by('layerFontFamily').value=textObject(o)?o.fontFamily:'';
 if((o.sourceText||o.nativeKind==='text')&&!textObject(o)){by('layerText').value=o.sourceText||'';by('layerText').placeholder='OCR 내용 확인 · 인식되지 않은 문구는 직접 입력';by('layerFontSize').value='';by('layerColor').value='#1a1814';}
 if(textObject(o)){by('layerText').value=o.text;by('layerFontSize').value=o.fontSize;by('layerColor').value=typeof o.fill==='string'?'#'+new F.Color(o.fill).toHex():'#1a1814';}
 list();
}
function typeName(o){if(textObject(o))return '글자';if(o.nativeKind==='vector'||['path','rect','circle','ellipse','polygon','polyline','line','group','triangle'].includes(String(o.type).toLowerCase()))return '벡터';return o.sourceText||o.nativeKind==='text'?'글자 모양 이미지':'그림';}
function selected(){return canvas?.getActiveObjects()||[];}
function selectItems(items){
 if(!canvas)return;canvas.discardActiveObject();
 const valid=[...new Set(items)].filter(o=>canvas.getObjects().includes(o));
 if(valid.length)canvas.setActiveObject(valid.length===1?valid[0]:new F.ActiveSelection(valid,{canvas}));
 canvas.requestRenderAll();selection();
}
function releaseSelection(){const items=selected();canvas.discardActiveObject();return items;}
function editableSelection(){return selected().filter(o=>!o.layerLocked&&o.visible);}
// Fail closed: Fabric clone/group serialization cannot retain recovery renderers.
function containsOutsideRecovery(object,seen=new Set()){
 if(!object||seen.has(object))return false;seen.add(object);
 if(object.trialOutsideRestore||object.outsideRecovery||object.outsideRecoveryReview)return true;
 return (object.getObjects?.()||[]).some(child=>containsOutsideRecovery(child,seen));
}
function hasNestedOutsideRecovery(object){return (object?.getObjects?.()||[]).some(child=>containsOutsideRecovery(child));}

function searchText(value){return String(value||'').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g,' ').trim();}
function isTextLayer(o){return textObject(o)||!!o.sourceText?.trim()||o.nativeKind==='text';}
by('layerTextSearch').addEventListener('input',()=>list());
by('layerTextClear').onclick=()=>{by('layerTextSearch').value='';list();by('layerTextSearch').focus();};
window.addEventListener('coex:history-source',()=>{by('layerTextSearch').value='';list();});

// The Fabric scene remains authoritative; raster snapshots only feed preview/export.
let editedPreviewTimer=null,editedPreviewSerial=0,editedPreviewWait=null,editedPreviewDirty=false;
function cancelEditedPreview(){clearTimeout(editedPreviewTimer);editedPreviewTimer=null;editedPreviewWait=null;editedPreviewDirty=false;editedPreviewSerial++;}
globalThis.coexHasPendingEditedPreview=()=>editedPreviewDirty&&!!canvas&&!loading&&linked&&sceneOutputCurrent();
globalThis.coexRequestEditedPreview=()=>{if(globalThis.coexHasPendingEditedPreview?.()&&Number(by('wInput').value)===width&&Number(by('hInput').value)===height)queueEditedPreview();};
function resumeEditedPreview(reason){
 const waiting=editedPreviewWait;if(!waiting||waiting.reason!==reason)return;
 const t=waiting.ticket,valid=!!canvas&&!loading&&linked&&epoch===t.epoch&&revision===t.revision&&sceneOutputCurrent()&&sceneOutputKey===t.source&&editedPreviewSerial===t.serial;
 if(!valid){editedPreviewWait=null;return;}
 if(reason==='interaction'&&(canvas._currentTransform||canvas._groupSelector||canvas._isCurrentlyDrawing||atomicMultiSelection()))return;
 if(reason==='draft'&&(Number(by('wInput').value)!==width||Number(by('hInput').value)!==height))return;
 editedPreviewWait=null;queueEditedPreview(t.retry);
}
for(const id of ['wInput','hInput'])by(id).addEventListener('input',()=>queueMicrotask(()=>resumeEditedPreview('draft')),{capture:true});
// Reuse the original controls and handlers beside the editable result; never clone IDs.
const sizeHome=document.createComment('output size home'),snsHome=document.createComment('SNS size home');
by('outputSizeControls').before(sizeHome);by('snsSection').before(snsHome);
const previewColumn=document.createElement('div');previewColumn.className='layer-preview-column';
by('layerStage').before(previewColumn);previewColumn.append(by('layerStage'));
const sizeDock=document.createElement('div');sizeDock.id='layerSizeDock';
previewColumn.prepend(sizeDock);
const presetRow=document.createElement('div');presetRow.className='layer-inline-presets';
presetRow.innerHTML='<label for="layerQuickSize">규격 선택</label><select id="layerQuickSize"><option value="">배너 · 자유 규격 입력</option></select><button type="button" class="doc-btn" id="layerFreeSize">자유 규격 입력</button>';
by('outputSizeControls').querySelector('h3').after(presetRow);
const moreOutput=document.createElement('details');moreOutput.className='layer-output-options';
moreOutput.innerHTML='<summary>출력 형식·배율·내 규격 저장</summary>';
for(const el of [...by('outputSizeControls').children])if(el.matches('.row2,.sns-custom-row,#snsStorageStatus,#qualityField'))moreOutput.append(el);
const scales=by('outputSizeControls').querySelector('.presets');if(scales)moreOutput.prepend(scales);
by('outputSizeControls').append(moreOutput);
const morePresets=document.createElement('details');morePresets.className='layer-all-presets';morePresets.innerHTML='<summary>전체 SNS 규격·저장한 규격 찾기</summary>';
const dockHelp=document.createElement('p');dockHelp.className='layer-help';dockHelp.textContent='규격을 바꾸면 바로 아래 편집 캔버스에 적용됩니다. 결과의 글자·이미지를 선택해 계속 편집하세요.';
sizeDock.append(dockHelp,morePresets);
function mountSizeControls(active){
 if(active){if(by('outputSizeControls').parentNode!==sizeDock)sizeDock.prepend(by('outputSizeControls'));if(by('snsSection').parentNode!==morePresets)morePresets.append(by('snsSection'));}
 else{sizeHome.after(by('outputSizeControls'));snsHome.after(by('snsSection'));}
}
function quickPresets(){return globalThis.SNS_CATALOG?.presets||[];}
for(const p of quickPresets()){
 const option=document.createElement('option');option.value=p.id;option.textContent=(typeof p.name==='string'?p.name:p.name.ko)+' · '+p.w+' × '+p.h;by('layerQuickSize').append(option);
}
let quickSizeTicket=0;
by('layerQuickSize').onchange=async()=>{const ticket=++quickSizeTicket,p=quickPresets().find(p=>p.id===by('layerQuickSize').value);if(!p){globalThis.coexCancelEditorResize?.();by('layerQuickSize').disabled=false;by('layerFreeSize').click();return;}const originalEpoch=epoch,originalContext=sceneOutputKey;by('layerQuickSize').disabled=true;
 try{if(typeof globalThis.coexResizeEditorPreset!=='function')throw Error('편집 규격 기능을 불러오지 못했습니다. 파일을 저장하고 다시 열어 주세요.');const ok=await globalThis.coexResizeEditorPreset(p);if(!ok&&ticket===quickSizeTicket&&epoch===originalEpoch&&sceneOutputKey===originalContext&&sceneOutputCurrent())say('편집 화면에 규격을 적용하지 못했습니다. 캔버스 크기와 안내를 확인하세요.',true);}
 catch(error){if(ticket===quickSizeTicket&&epoch===originalEpoch&&sceneOutputKey===originalContext&&sceneOutputCurrent())say(error.message,true);}
 finally{if(ticket===quickSizeTicket)by('layerQuickSize').disabled=false;}
};
by('layerFreeSize').onclick=()=>{by('freeSizeBtn').click();globalThis.setLock?.(false);by('layerQuickSize').value='';by('wInput').focus({preventScroll:true});};
const inlineStyle=document.createElement('style');inlineStyle.textContent=`
.layer-preview-column{min-width:0}.layer-preview-column #outputSizeControls{margin:0;padding:12px;border:1px solid var(--border);border-radius:10px;background:var(--card-bg,#fff)}
.layer-inline-presets{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:8px 0}.layer-inline-presets label{font-size:.8rem}.layer-inline-presets select{flex:1;min-width:130px;max-width:100%;padding:7px;border:1px solid var(--border);border-radius:7px;background:white}
.layer-output-options,.layer-all-presets{margin:8px 0!important}.layer-output-options summary,.layer-all-presets summary{cursor:pointer}.layer-preview-column .layer-stage{margin-top:10px}.layer-preview-column .dims{flex-wrap:wrap}.layer-preview-column .dims .col{min-width:90px}.layer-preview-column #snsSection{margin:8px 0;padding:8px}.layer-preview-column #snsGrid{max-height:250px;overflow:auto}
`;document.head.append(inlineStyle);
function syncOutputSize(){
 for(const [id,value]of [['layerWidth',width],['layerHeight',height],...((sceneInputKind!=='raster'||linked)?[['wInput',width],['hInput',height]]:[])])if(by(id))by(id).value=String(value);
 if(by('layerCanvasSize'))by('layerCanvasSize').textContent=width+' × '+height+' px';
 const matching=quickPresets().find(p=>p.w===width&&p.h===height);by('layerQuickSize').value=matching?.id||'';
}
function updateEditingBridge(){
 const bridge=by('editingBridge');if(!bridge)return;
 const objects=canvas?.getObjects()||[],source=globalThis.getLayerAnalysisSource?.(),matches=!source||!!sceneSourceKey&&sceneSourceKey===source.key;
 bridge.hidden=!canvas||loading||!objects.length||!matches;
 if(bridge.hidden)return;
 const texts=objects.filter(o=>o.visible!==false&&textObject(o)).length,visuals=objects.filter(o=>o.visible!==false&&!textObject(o)&&o.layerRole!=='background').length;
 const text=canvas.getObjects().some(o=>o.cutoutMethod?.startsWith('poster-'))?'PNG/JPG의 글씨 모양과 그림을 각각 선택·이동할 수 있습니다. 글자 내용과 추정 배경은 확인하세요.':sceneInputKind==='raster'?'원본 레이어를 보존합니다. 이미지 안에 합쳐진 글씨·상품은 개별 편집 복원이 확인되지 않았습니다.':'편집 글자 '+texts+'개 · 그림/도형 '+visuals+'개 유지. 규격을 바꾼 뒤에도 각각 선택해 편집할 수 있습니다.';
 if(by('editingBridgeStatus').textContent!==text)by('editingBridgeStatus').textContent=text;
}
function acceptWorkingSnapshot(output,name){
 if(!sceneOutputCurrent())throw Error('새 파일 또는 슬라이드가 열리는 중입니다.');
 globalThis.acceptLayerSnapshot(output,name);sceneOutputKey=globalThis.getLayerOutputContextKey?.()||null;linked=true;cancelEditedPreview();
}
function publishWorkingScene(){
 if(!canvas||loading)return false;
 if(!sceneOutputCurrent())throw Error('새 파일 또는 슬라이드를 불러오는 중이거나 원본이 바뀌었습니다. 편집 화면이 준비될 때까지 기다려 주세요.');
 cancelEditedPreview();const outputFormat=by('fmtSelect').value,keepLock=by('lockBtn').getAttribute('aria-checked')==='true';
 const output=nativeSnapshot(width,height);
 acceptWorkingSnapshot(output,projectName);
 if(by('fmtSelect').value!==outputFormat){by('fmtSelect').value=outputFormat;globalThis.syncQualityVisibility?.();globalThis.scheduleRender?.();}
 globalThis.setLock?.(keepLock);updateEditingBridge();return true;
}
function queueEditedPreview(retry=0){
 cancelEditedPreview();editedPreviewDirty=true;const ticket={epoch,revision,source:globalThis.getLayerOutputContextKey?.(),serial:editedPreviewSerial,retry};
 const current=()=>!!canvas&&!loading&&linked&&epoch===ticket.epoch&&revision===ticket.revision&&sceneOutputCurrent()&&sceneOutputKey===ticket.source&&editedPreviewSerial===ticket.serial;
 const matchingSize=()=>Number(by('wInput').value)===width&&Number(by('hInput').value)===height;
 const interacting=()=>!!(canvas._currentTransform||canvas._groupSelector||canvas._isCurrentlyDrawing||atomicMultiSelection());
 editedPreviewTimer=setTimeout(async()=>{
  editedPreviewTimer=null;if(!current())return;
  if(!matchingSize()){editedPreviewWait={ticket,reason:'draft'};return;}
  if(interacting()){editedPreviewWait={ticket,reason:'interaction'};return;}
  let guard;
  try{guard=atomicSceneSignature();}catch(error){if(current())say('편집 원본은 유지했습니다. 미리보기를 확인해 주세요: '+error.message,true);return;}
  let output,prepared;
  try{
   output=nativeSnapshot(width,height);
   const decision={policy:'background-only-v1',sourceEpoch:epoch,width,height,inputKind:sceneInputKind||'layered',path:'background-only',method:'current-scene',status:'review',reason:'편집한 레이어 화면입니다. 배경과 요소를 확인하세요.'};
   prepared=await globalThis.coexPrepareLayerSnapshotAtomic(output,projectName,ticket.source,decision);
   if(!current()){globalThis.coexDiscardLayerSnapshotAtomic?.(prepared);return;}
   if(!matchingSize()){globalThis.coexDiscardLayerSnapshotAtomic?.(prepared);editedPreviewWait={ticket,reason:'draft'};return;}
   if(interacting()){globalThis.coexDiscardLayerSnapshotAtomic?.(prepared);editedPreviewWait={ticket,reason:'interaction'};return;}
   if(!atomicSceneMatches(guard)){globalThis.coexDiscardLayerSnapshotAtomic?.(prepared);if(retry<1)queueEditedPreview(retry+1);else say('편집 상태가 계속 바뀌어 미리보기 갱신을 중지했습니다. 다시 편집하거나 적용하세요.',true);return;}
   const context=globalThis.coexCommitLayerSnapshotAtomic(prepared);sceneOutputKey=context;linked=true;editedPreviewDirty=false;
   try{updateEditingBridge();say('편집 요소를 유지한 채 미리보기를 갱신했습니다.');}catch{}
  }catch(error){
   if(prepared)globalThis.coexDiscardLayerSnapshotAtomic?.(prepared);else if(output){output.width=output.height=0;}
   if(current()&&!matchingSize()){editedPreviewWait={ticket,reason:'draft'};return;}
   if(current())say('편집 원본은 유지했습니다. 미리보기 갱신에 실패해 이전 미리보기는 저장할 수 없습니다: '+error.message,true);
  }
 },450);
}
function focusEditing(){
 if(!canvas||loading)return false;
 show();const active=canvas.getActiveObject();if(active?.visible===false)canvas.discardActiveObject();
 canvas.requestRenderAll();selection();panel.scrollIntoView({block:'start'});const stage=by('layerStage');stage.tabIndex=-1;stage.focus({preventScroll:true});return true;
}
by('continueLayerEditing')?.addEventListener('click',focusEditing);
by('saveEditableProject')?.addEventListener('click',()=>by('layerSave').click());
by('layerOutputSizeOpen').onclick=()=>{try{show();const target=by('outputSizeControls');target.scrollIntoView({block:'center'});by('wInput').focus({preventScroll:true});}catch(error){say(error.message,true);}};

let independentBgUndo=null;
const bgTransformKeys=['left','top','scaleX','scaleY','originX','originY','angle','skewX','skewY','flipX','flipY','cropX','cropY','width','height'];
const bgTransform=o=>Object.fromEntries(bgTransformKeys.map(k=>[k,o[k]]));
function validBgUndo(o){return !!independentBgUndo&&o===independentBgUndo.object&&epoch===independentBgUndo.epoch&&revision===independentBgUndo.revision&&JSON.stringify(bgTransform(o))===JSON.stringify(independentBgUndo.after);}
function list(){
 const texts=by('layerTextList'),visuals=by('layerVisualList'),scrolls=[texts.scrollTop,visuals.scrollTop];
 texts.replaceChildren();visuals.replaceChildren();
 const query=searchText(by('layerTextSearch').value),all=canvas?.getObjects()||[];
 const textTotal=all.filter(isTextLayer).length,visualTotal=all.length-textTotal;
 let matched=0;
 by('layerTextCount').textContent=textTotal;by('layerVisualCount').textContent=visualTotal;
 by('layerTextClear').hidden=!by('layerTextSearch').value;
 if(!canvas){by('layerSelectionCount').textContent='0개 선택';}

 for(const o of marked)if(!all.includes(o))marked.delete(o);
 by('layerSelectionCount').textContent=selected().length+'개 선택';const first=selected()[0];by('independentBgControls').hidden=!(selected().length===1&&first?.visible!==false&&first?.layerRole==='background'&&first?.photoInstanceKind==='background'&&!first?.layerLocked);if(independentBgUndo&&!validBgUndo(first))independentBgUndo=null;by('independentBgUndo').disabled=!validBgUndo(first);const labels={title:'제목',body:'설명',details:'영업·필수정보',subject:'주요 이미지',logo:'브랜드정보',decoration:'장식'};if(first?.layoutManualGroup||first?.layoutUnit)by('layerSelectionCount').textContent+=' · 의미 묶음: '+(first.layoutManualGroup||labels[first.layoutRole]||first.layoutRole);
 for(const o of [...all].reverse()){
  const isText=isTextLayer(o);
  if(isText&&query&&!searchText((textObject(o)?o.text:o.sourceText||'')+' '+(o.layerName||'')).includes(query))continue;
  if(isText)++matched;
  const target=isText?texts:visuals;
  const li=document.createElement('li'),check=document.createElement('input'),b=document.createElement('button');check.type='checkbox';check.checked=marked.has(o);check.disabled=!!o.layerLocked||!o.visible;check.setAttribute('aria-label','함께 선택: '+(o.layerName||o.type));check.onchange=()=>{const items=selected().filter(item=>item!==o&&!item.layerLocked&&item.visible);if(check.checked)items.push(o);selectItems(items);};
  b.type='button';b.textContent=(o.visible?'':'숨김 · ')+(o.layerLocked?'잠금 · ':'')+typeName(o)+' · '+(all.indexOf(o)+1)+' · '+(o.layerName||o.type);b.setAttribute('aria-pressed',String(marked.has(o)||o===current()));b.title=(textObject(o)?o.text:o.sourceText)||o.layerName||o.type;
  b.onclick=e=>{if(e.shiftKey){if(o.layerLocked||!o.visible)return;const items=editableSelection();selectItems(items.includes(o)?items.filter(item=>item!==o):[...items,o]);}else selectItems([o]);};li.append(check,b);target.append(li);
 }
 by('layerTextResult').textContent=query?matched+' / '+textTotal+'개 글씨 일치':textTotal+'개 글씨';
 by('layerTextEmpty').hidden=matched>0;by('layerTextEmpty').textContent=query?'일치하는 글씨가 없습니다.':'글씨 요소가 없습니다.';
 by('layerVisualEmpty').hidden=visualTotal>0;texts.scrollTop=scrolls[0];visuals.scrollTop=scrolls[1];
 if(!canvas)return;
 updateEditingBridge();
 by('layerSummary').textContent=width+' × '+height+' px · '+canvas.size()+'개 요소 · 편집 '+revision+' · JSON은 레이어 유지 / SVG는 글자·도형 벡터 / PNG·SNS는 합성 이미지';
}

function changed(refresh=true){
 queueMicrotask(()=>window.dispatchEvent(new Event('coex:history-change')));
 window.dispatchEvent(new Event('coex:layer-edit'));
 ++revision;canvas.requestRenderAll();if(refresh)selection();else list();
 if(linked){if(sceneOutputCurrent()){globalThis.invalidate?.();queueEditedPreview();say('편집 화면을 갱신 중입니다. 이전 미리보기는 저장할 수 없습니다.');}else say('새 파일 또는 슬라이드가 열리는 중입니다. 이전 편집 화면은 자동 적용하지 않았습니다.',true);}
}
function stopWorker(){const reject=workerReject;workerReject=null;worker?.terminate();worker=null;reject?.(Error('CANCELLED'));}
function cancelImport(){cancelEditedPreview();++epoch;stopWorker();loading=false;by('layerFields').disabled=false;}
function psdRead(buffer){return new Promise((resolve,reject)=>{
 const active=new Worker('./psd-worker.js');worker=active;let settled=false;
 const done=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);active.terminate();if(worker===active){worker=null;workerReject=null;}error?reject(error):resolve(value);};
 const timer=setTimeout(()=>done(Error('PSD 읽기 시간이 초과되었습니다. 레이어 수와 크기를 줄여 주세요.')),20000);workerReject=error=>done(error);
 active.onmessage=e=>e.data.error?done(Error(e.data.error)):done(null,e.data);active.onerror=()=>done(Error('PSD를 읽지 못했습니다. RGB 8비트 PSD인지 확인해 주세요.'));
 active.postMessage(buffer,[buffer]);
 });}
function validateJson(doc){
 if(doc?.format!=='coex-layer-project'||![1,2].includes(doc.version)||!dims(doc.width,doc.height)||!Array.isArray(doc.scene?.objects))fail('이 편집기에서 저장한 버전 1 또는 2 레이어 JSON을 선택해 주세요.');
 if(Object.keys(doc.scene).some(k=>!['objects','version'].includes(k)))fail('지원하지 않는 프로젝트 속성입니다.');
 if(doc.outsideRecoveryReport){if(doc.version!==2)fail('바깥 요소 확인 기록에는 프로젝트 버전 2가 필요합니다.');validateOutsideReport(doc.outsideRecoveryReport);}
 let count=0,nodes=0,strings=0;const allowed=new Set(['Rect','Circle','Ellipse','Triangle','Line','Path','Polyline','Polygon','Text','Textbox','IText','Image','Group']);
 const inspect=(value,depth=0,key='')=>{
  if(++nodes>1000000||depth>35)fail('프로젝트 구조가 너무 복잡합니다.');
  if(typeof value==='number'&&(!Number.isFinite(value)||Math.abs(value)>1e8))fail('잘못된 숫자가 있습니다.');
  if(typeof value==='string'){
   strings+=value.length;if(strings>70*1024*1024)fail('프로젝트 데이터가 너무 큽니다.');
   if(/(?:https?:|blob:|file:|javascript:|url\s*\()/i.test(value)&&!['text','layerName','sourceText','fontFamily','layoutOriginalText'].includes(key))fail('외부 자료 링크는 불러올 수 없습니다.');
   if(key==='src'&&!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=\r\n]+$/.test(value))fail('그림은 내장 PNG·JPG·WebP만 지원합니다.');
  }
  if(!value||typeof value!=='object')return;
  if(value.textureBackgroundFrame&&!validTextureFrame(value.textureBackgroundFrame))fail('잘못된 질감 원본 영역입니다.');
  if(Array.isArray(value)){if(value.length>200000)fail('배열이 너무 큽니다.');for(const v of value)inspect(v,depth+1,key);return;}
  for(const [k,v] of Object.entries(value)){
   if(['__proto__','prototype','constructor','canvas','group','parent','backgroundImage','overlayImage','clipPath','layoutManager','resizeFilter','trialOutsideRestore','__outsideTrialVisible','__outsideTrialImage','__outsideRenderInstalled'].includes(k))fail('지원하지 않는 프로젝트 속성: '+k);
   if(k==='type'&&typeof v==='string'&&!allowed.has(v)&&!['linear','radial','shadow'].includes(v))fail('지원하지 않는 요소 종류: '+v);
   if(k==='filters'&&(!Array.isArray(v)||v.length))fail('이미지 필터는 지원하지 않습니다.');
   inspect(v,depth+1,k);
  }
  if(allowed.has(value.type)){if(++count>10000)fail('요소 구조가 현재 편집기의 처리 범위를 넘습니다.');if(value.width>12000||value.height>12000||value.width*value.height>24000000)fail('요소 크기가 너무 큽니다.');if(textObject(value)&&(value.text?.length>20000||value.fontSize>2000||value.fontSize<1))fail('글자 길이 또는 크기가 지원 범위를 넘습니다.');}
 };
 inspect(doc.scene);
 // Require concrete safe classes at every object position before Fabric's class registry runs.
 const objectCheck=(objects,depth=0)=>{let countOutside=0;for(const o of objects){if(!o||!allowed.has(o.type))fail('잘못된 요소입니다.');if(o.outsideRecoveryReview&&(doc.version!==2||o.outsideRecoveryReview!=='source-changed'||o.outsideRecovery))fail('잘못된 복원 검토 상태입니다.');if(o.outsideRecovery){if(doc.version!==2||depth||++countOutside>12)fail('복원 요소가 너무 많거나 그룹 안에 있습니다.');validateOutside(o.outsideRecovery,o);}if(o.type==='Group'){if(!Array.isArray(o.objects))fail('잘못된 그룹입니다.');objectCheck(o.objects,depth+1);}}};objectCheck(doc.scene.objects);
 assertProjectFontReferences(doc.scene.objects,doc.fonts||[]);
 return doc;
}
function safeSvg(source){
 if(source.length>8*1024*1024||/<!DOCTYPE|<!ENTITY/i.test(source))fail('SVG는 8MB 이하이며 외부 엔티티를 포함하지 않아야 합니다.');
 const doc=new DOMParser().parseFromString(source,'image/svg+xml'),root=doc.documentElement;
 if(root.localName!=='svg'||doc.querySelector('parsererror'))fail('올바른 SVG가 아닙니다.');
 const tags=new Set(['svg','g','defs','rect','circle','ellipse','line','polyline','polygon','path','text','tspan','linearGradient','radialGradient','stop','title','desc']);
 let n=0;
 for(const el of [root,...root.querySelectorAll('*')]){
  if(++n>1000||!tags.has(el.localName)&&el.localName!=='image')fail('지원하지 않는 SVG 요소입니다: '+el.localName+' (기본 벡터·텍스트·내장 그림을 사용해 주세요.)');
  for(const a of [...el.attributes]){
   const v=a.value;
   if(/^on/i.test(a.localName)||a.localName==='style'||a.localName==='filter'||a.localName==='mask'||a.localName==='clip-path'||a.localName==='cursor')fail('SVG의 스크립트·스타일·필터·마스크는 지원하지 않습니다.');
   if(a.localName==='href'&&!(el.localName==='image'&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=\r\n]+$/.test(v)))fail('외부 이미지나 참조는 불러오지 않습니다.');
   if(a.localName!=='href'&&!/^xmlns/.test(a.name)&&(/(?:https?:|javascript:|file:|blob:|data:)/i.test(v)||/url\s*\(/i.test(v)&&!/^url\(#[a-zA-Z_][\w.-]*\)$/.test(v)))fail('SVG 외부 링크는 지원하지 않습니다.');
  }
 }
 const vb=(root.getAttribute('viewBox')||'').trim().split(/[\s,]+/).map(Number);
 const svgDimension=(v,fallback)=>{if(v==null)return fallback;if(!/^\d+(?:\.\d+)?(?:px)?$/.test(v))fail('SVG 크기는 px 또는 viewBox로 지정해 주세요.');return Number.parseFloat(v);};
 const w=Math.round(svgDimension(root.getAttribute('width'),vb[2])),h=Math.round(svgDimension(root.getAttribute('height'),vb[3]));
 if(!dims(w,h))fail('SVG 캔버스 크기를 확인해 주세요. 한 변 12,000px, 2,400만 픽셀 이하입니다.');
 return {source:new XMLSerializer().serializeToString(root),width:w,height:h,images:[...root.querySelectorAll('image')].map(el=>({type:'Image',src:el.getAttribute('href')||el.getAttributeNS('http://www.w3.org/1999/xlink','href')}))};
}
async function validateAssets(objects){
 let pixels=0;const images=[];
 const visit=items=>{for(const o of items){if(o.type==='Image')images.push(o);if(o.outsideRecovery){const p=validateOutside(o.outsideRecovery,o);images.push({src:p.src,expectedWidth:p.width,expectedHeight:p.height});}if(o.objects)visit(o.objects);}};visit(objects);
 // Decode once before Fabric to bound all embedded raster assets, including hidden layers.
 for(const o of images){if(!o.src)fail('그림 데이터가 없습니다.');const blob=await(await fetch(o.src)).blob(),bitmap=await createImageBitmap(blob);pixels+=bitmap.width*bitmap.height;const valid=dims(bitmap.width,bitmap.height)&&(!o.expectedWidth||(bitmap.width===o.expectedWidth&&bitmap.height===o.expectedHeight));bitmap.close();if(!valid||pixels>64000000)fail('내장 그림 픽셀 합계가 너무 큽니다.');}
}
async function openFile(file,{signal,beforeCommit,origin,sourceKey}={}){
 if(!file)return;if(origin!=='auto')window.dispatchEvent(new Event('coex:layer-source'));if(file.size>MAX_FILE){say('레이어 원본은 50MB 이하로 선택해 주세요.',true);return;}
 cancelImport();const token=epoch;const abort=()=>{if(token===epoch){cancelImport();say('레이어 열기를 취소했습니다.');}};if(signal?.aborted)return false;signal?.addEventListener('abort',abort,{once:true});loading=true;by('layerFields').disabled=true;say('원본의 요소와 레이어를 읽는 중…');let objects=[],pendingFonts=[],pendingFontHandle=null,pendingOutsideReport=null;
 try{
  await init();if(token!==epoch)return;
  const ext=file.name.split('.').pop().toLowerCase();let w,h,notes='',inputKind='layered',sourceFormat=ext;
  if(ext==='psd'){
   const buffer=await file.arrayBuffer();if(token!==epoch)return;const data=await psdRead(buffer);if(token!==epoch)return;w=data.width;h=data.height;
   for(const layer of data.layers){const c=document.createElement('canvas');c.width=layer.width;c.height=layer.height;c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(layer.rgba),layer.width,layer.height),0,0);
    objects.push(normalize(new F.FabricImage(c,{left:layer.left,top:layer.top,opacity:layer.opacity,visible:layer.visible,layerName:layer.name,sourceText:layer.sourceText})));}
   notes=' PSD의 글자는 픽셀 상태입니다. 텍스트 속성이 있는 레이어는 선택 후 편집 글자로 교체할 수 있습니다. 합성 결과가 원본과 다를 수 있으므로 비교해 주세요. '+data.warnings.join(' ');
  }else if(ext==='svg'){
   const safe=safeSvg(await file.text());w=safe.width;h=safe.height;await validateAssets(safe.images);if(token!==epoch)return;
   // All URLs are already checked before Fabric is allowed to parse them.
   const data=await F.loadSVGFromString(safe.source);objects=data.objects.filter(Boolean).map((o,i)=>normalize(o,'SVG 요소 '+(i+1)));if(!objects.length)fail('편집 가능한 SVG 요소가 없습니다.');
   if(objects.length>200)fail('SVG 최상위 요소는 200개까지 지원합니다.');
   notes=' SVG 텍스트는 설치된 글꼴로 표시됩니다. 원본과 비교해 주세요.';
  }else if(ext==='json'){
   const doc=validateJson(JSON.parse(await file.text()));pendingOutsideReport=doc.outsideRecoveryReport||null;inputKind=origin==='auto'?(doc.inputKind||'raster'):'layered';sourceFormat=origin==='auto'?(doc.sourceFormat||'image'):ext;w=doc.width;h=doc.height;pendingFonts=doc.fonts||[];pendingFontHandle=await loadProjectFonts(pendingFonts);for(const font of pendingFonts)F.cache.clearFontCache(font.family);await validateAssets(doc.scene.objects);objects=await F.util.enlivenObjects(doc.scene.objects);await installOutside(objects,doc.scene.objects);if(doc.scene.objects.some(o=>o.outsideRecoveryReview))notes+=' 일부 요소는 원본 변경으로 바깥 연결이 중지되었습니다. 확인해 주세요.';objects.forEach((o,i)=>normalize(o,'요소 '+(i+1)));
  }else fail('PSD·SVG·이 편집기의 레이어 JSON을 선택해 주세요.');
  if(token!==epoch||signal?.aborted||(beforeCommit&&!beforeCommit())){objects.forEach(o=>o.dispose());if(token===epoch)say('원본이 바뀌어 레이어 열기를 취소했습니다.');return false;}
  replace(objects,w,h,file.name.replace(/\.[^.]+$/,''),origin==='auto'?(sourceKey||null):null,{fonts:pendingFonts,handle:pendingFontHandle,inputKind,sourceFormat,manualSource:origin!=='auto',outsideReport:pendingOutsideReport});pendingFontHandle=null;objects=[];say('레이어를 유지해 열었습니다. '+canvas.size()+'개 요소를 선택하고 이동하세요.'+notes);return true;
 }catch(e){objects.forEach(o=>o.dispose());if(token===epoch)say(e instanceof SyntaxError?'JSON 파일을 읽지 못했습니다.':e.message,true);}
 finally{pendingFontHandle?.dispose();signal?.removeEventListener('abort',abort);if(token===epoch){loading=false;by('layerFields').disabled=false;}}
}
function replace(objects,w,h,name,sourceKey=null,bundle=null){
 cancelEditedPreview();
 marked.clear();if(bundle){fontHandle?.dispose();fontHandle=bundle.handle;projectFonts=bundle.fonts;}
 outsideRecoveryReport=bundle?.outsideReport||null;window.dispatchEvent(new Event('coex:outside-recovery-change'));sceneSourceKey=sourceKey;sceneManual=bundle?.manualSource===true;if(bundle?.inputKind)sceneInputKind=bundle.inputKind;if(bundle?.sourceFormat)sceneSourceFormat=bundle.sourceFormat;
 if(linked){if(sceneOutputCurrent())globalThis.invalidateLayerSnapshot?.();linked=false;}
 sceneOutputKey=globalThis.getLayerOutputContextKey?.()||null;canvas.discardActiveObject();const old=canvas.getObjects();canvas.remove(...old);old.forEach(o=>o.dispose());width=w;height=h;projectName=(name||'새 프로젝트').slice(0,120);revision=0;
 by('layerName').textContent=projectName;by('layerWidth').value=w;by('layerHeight').value=h;canvas.add(...objects);show();selection();fit();if(!historyRestoring)queueMicrotask(()=>window.dispatchEvent(new Event('coex:history-source')));
}
function save(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
function scene(){
 ensureProjectTypography();
 if(canvas.getObjects().some(hasNestedOutsideRecovery))fail('바깥 연결 요소가 들어 있는 그룹은 아직 저장할 수 없습니다. 원본 파일을 다시 열어 주세요.');
 // Fixed metadata format, embedded images. Remove layout managers so imports cannot invoke arbitrary strategies.
 const clean=value=>{if(Array.isArray(value))return value.map(clean);if(!value||typeof value!=='object')return value;const out={};for(const [k,v] of Object.entries(value)){if(k==='layoutManager'||k==='clipPath')continue;out[k]=clean(v);}return out;};
 const previousPrecision=F.config.NUM_FRACTION_DIGITS;let serialized;try{F.config.NUM_FRACTION_DIGITS=15;serialized=canvas.toObject(extra).objects.map(clean);}finally{F.config.NUM_FRACTION_DIGITS=previousPrecision;}const live=canvas.getObjects();if(serialized.length!==live.length)fail('복원 요소를 저장하지 못했습니다.');for(let i=0;i<live.length;i++){const o=live[i],m=canonicalOutside(o);if(m){delete serialized[i].outsideRecoveryReview;serialized[i].outsideRecovery=m;}else if(outsideSourceChanged(o))serialized[i].outsideRecoveryReview='source-changed';}return {format:'coex-layer-project',version:serialized.some(o=>o.outsideRecovery||o.outsideRecoveryReview)||outsideRecoveryReport?2:1,...(outsideRecoveryReport?{outsideRecoveryReport}:{}),inputKind:sceneInputKind,sourceFormat:sceneSourceFormat,width,height,name:projectName,fonts:projectFonts,scene:{version:F.version,objects:serialized}};
}
function snapshot(){ensureProjectTypography();canvas.discardActiveObject();const previous=canvas.viewportTransform;try{canvas.setViewportTransform([1,0,0,1,0,0]);return canvas.toCanvasElement(1,{left:0,top:0,width,height});}finally{canvas.setViewportTransform(previous);canvas.requestRenderAll();selection();}}
function resize(){if(!canvas||loading)return;const w=Number(by('layerWidth').value),h=Number(by('layerHeight').value);if(!dims(w,h)){say('크기는 양의 정수, 한 변 12,000px / 합계 2,400만 픽셀 이하로 입력하세요.',true);return;}width=w;height=h;fit();changed();say('캔버스 크기를 바꿨습니다. 요소를 직접 재배치한 뒤 리사이징에 적용하세요.');}
function add(o){if(canvas.size()>=200){o.dispose();say('최상위 요소는 200개까지 추가할 수 있습니다.',true);return;}canvas.add(normalize(o));canvas.setActiveObject(o);changed();}
by('layerOpen').onclick=()=>by('layerFile').click();by('layerFile').onchange=e=>{void openFile(e.target.files[0]);e.target.value='';};
by('layerDemo').onclick=async()=>{window.dispatchEvent(new Event('coex:layer-source'));cancelImport();const token=epoch;await init();if(token!==epoch)return;const objects=[
 new F.Rect({width:1080,height:1350,fill:'#f7f0df',layerName:'배경',layerRole:'background',layerLocked:true}),
 new F.Rect({left:80,top:90,width:160,height:80,rx:12,ry:12,fill:'#3d6b5e',layerName:'로고 배경',layerRole:'logo'}),
 new F.Textbox('COEX',{left:97,top:112,width:140,fontSize:35,fill:'#ffffff',layerName:'로고 글자',layerRole:'logo'}),
 new F.Textbox('COFFEE\n& DESIGN',{left:80,top:260,width:900,fontSize:118,fontWeight:'bold',fill:'#284b40',layerName:'행사명',layerRole:'title'}),
 new F.Circle({left:400,top:650,radius:245,fill:'#cf9872',layerName:'주요 비주얼',layerRole:'subject'}),
 new F.Textbox('2026. 10. 17 — 19\n서울 코엑스',{left:80,top:1120,width:900,fontSize:46,fill:'#284b40',layerName:'날짜와 장소',layerRole:'details'})
 ].map(o=>normalize(o));replace(objects,1080,1350,'COEX 샘플 포스터',null,{fonts:[],handle:null,manualSource:true});say('6개 요소로 만든 샘플입니다. 규격을 바꾸고 글자·도형을 따로 이동해 보세요.');};
by('layerToggle').onclick=()=>{by('layerWork').hidden=!by('layerWork').hidden;mountSizeControls(!by('layerWork').hidden);by('layerToggle').textContent=by('layerWork').hidden?'편집 화면 펼치기':'편집 화면 접기';fit();};
by('layerSave').onclick=()=>{if(!canvas||loading)return;try{const doc=scene();validateJson(doc);const blob=new Blob([JSON.stringify(doc)],{type:'application/json'});if(blob.size>MAX_FILE)fail('저장 프로젝트가 50MB를 넘습니다. 그림 크기를 줄여 주세요.');save(blob,projectName+'.coex.json');say('레이어 JSON을 저장했습니다. 다시 열면 개별 요소를 편집할 수 있습니다.');}catch(e){say(e.message,true);}};
by('layerResize').onclick=resize;
for(const p of globalThis.SNS_CATALOG?.presets||[]){const option=document.createElement('option');option.value=p.w+'x'+p.h;option.textContent=p.platform+' · '+(p.name.ko||p.name)+' · '+p.w+'×'+p.h;by('layerPreset').append(option);}
by('layerPreset').onchange=()=>{if(!by('layerPreset').value)return;const [w,h]=by('layerPreset').value.split('x');by('layerWidth').value=w;by('layerHeight').value=h;resize();};
by('layerTextAdd').onclick=()=>add(new F.Textbox('새 글자',{left:width*.1,top:height*.1,width:Math.min(600,width*.8),fontSize:Math.min(80,width*.08),fill:'#284b40',layerName:'새 글자'}));
by('layerShapeAdd').onclick=()=>add(new F.Rect({left:width*.1,top:height*.1,width:width*.3,height:height*.2,fill:'#3d6b5e',layerName:'새 사각형'}));
let uploadedAssetRole='subject';
by('layerImageAdd').onclick=()=>{uploadedAssetRole='subject';by('layerAsset').click();};
by('layerLogoAdd').onclick=()=>{uploadedAssetRole='logo';by('layerAsset').click();};
by('layerAsset').onchange=async e=>{const file=e.target.files[0],assetRole=uploadedAssetRole;e.target.value='';if(!file)return;const token=epoch;try{if(loading)fail('원본을 읽은 뒤 그림을 추가해 주세요.');if(file.size>30*1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type))fail('30MB 이하 PNG·JPG·WebP를 선택해 주세요.');const bitmap=await createImageBitmap(file);const w=bitmap.width,h=bitmap.height;bitmap.close();if(!dims(w,h))fail('그림은 2,400만 픽셀 이하로 선택해 주세요.');const reader=new FileReader(),src=await new Promise((resolve,reject)=>{reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('그림을 읽지 못했습니다.'));reader.readAsDataURL(file);});const o=await F.FabricImage.fromURL(src);if(token!==epoch){o.dispose();return;}const scale=Math.min(1,width*.6/w,height*.6/h);o.set({left:width*.1,top:height*.1,scaleX:scale,scaleY:scale,layerName:file.name,layerRole:assetRole,sourceElementId:'upload:'+crypto.randomUUID(),sourceElementType:'uploaded-'+assetRole});add(o);}catch(e){say(e.message,true);}};
by('layerUngroup').onclick=()=>{const group=current();if(group?.type!=='group'){say('먼저 그룹 요소를 선택하세요.');return;}if(group.layerLocked){say('잠금을 해제한 뒤 그룹을 풀어 주세요.');return;}if(hasNestedOutsideRecovery(group)){say('바깥 연결 요소가 포함된 그룹은 아직 안전하게 풀 수 없습니다. 원본 파일을 다시 열어 주세요.',true);return;}if(canvas.size()+group.size()-1>200){say('그룹을 풀면 요소가 200개를 넘습니다.',true);return;}const items=group.getObjects().map(o=>({o,matrix:o.calcTransformMatrix(),opacity:o.opacity*group.opacity,visible:o.visible&&group.visible})),at=canvas.getObjects().indexOf(group);canvas.discardActiveObject();canvas.remove(group);group.removeAll();for(let i=0;i<items.length;i++){const {o,matrix,opacity,visible}=items[i];F.util.applyTransformToObject(o,matrix);o.set({opacity,visible});canvas.insertAt(at+i,normalize(o));}group.dispose();changed();};
function stack(mode){
 if(!canvas||loading)return;const all=canvas.getObjects(),items=selected().filter(o=>!o.layerLocked);if(!items.length){say('잠기지 않은 요소를 선택하세요.',true);return;}
 canvas.discardActiveObject();
 const picked=new Set(items),protectedItems=all.filter(o=>o.layerRole==='background'&&o.layerLocked),normal=all.filter(o=>!protectedItems.includes(o));let order;
 if(mode==='delete'){for(const o of items){canvas.remove(o);marked.delete(o);o.dispose();}canvas.discardActiveObject();changed();return;}
 if(mode==='front')order=[...normal.filter(o=>!picked.has(o)),...normal.filter(o=>picked.has(o))];
 else if(mode==='back')order=[...normal.filter(o=>picked.has(o)),...normal.filter(o=>!picked.has(o))];
 else{order=[...normal];if(mode==='forward'){for(let i=order.length-2;i>=0;i--)if(picked.has(order[i])&&!picked.has(order[i+1]))[order[i],order[i+1]]=[order[i+1],order[i]];}else for(let i=1;i<order.length;i++)if(picked.has(order[i])&&!picked.has(order[i-1]))[order[i-1],order[i]]=[order[i],order[i-1]];}
 [...protectedItems,...order].forEach((o,i)=>canvas.moveObjectTo(o,i));selectItems(items);changed();say('선택 요소의 앞뒤 순서를 변경했습니다.');
}
for(const [id,mode]of [['layerFront','forward'],['layerBack','backward'],['layerToFront','front'],['layerToBack','back'],['layerDelete','delete']])by(id).onclick=()=>stack(mode);
function align(mode){
 if(!canvas||loading)return;const items=selected().filter(o=>!o.layerLocked&&o.visible);if(!items.length){say('잠기지 않은 표시 요소를 선택하세요.',true);return;}
 releaseSelection();
 const rects=items.map(o=>({o,b:o.getBoundingRect()}));
 if(mode==='spaceX'||mode==='spaceY'){
  if(items.length<3){say('간격 맞춤은 요소를 3개 이상 선택하세요.',true);return;}
  const x=mode==='spaceX',pos=x?'left':'top',size=x?'width':'height';rects.sort((a,b)=>a.b[pos]-b.b[pos]);const first=rects[0].b,last=rects.at(-1).b,gap=(last[pos]+last[size]-first[pos]-rects.reduce((sum,r)=>sum+r.b[size],0))/(rects.length-1);
  if(gap<0){say('선택 영역에 요소를 겹치지 않고 배치할 공간이 부족합니다.',true);return;}let cursor=first[pos];for(const r of rects){r.o.set(pos,r.o[pos]+cursor-r.b[pos]);r.o.setCoords();cursor+=r.b[size]+gap;}
 }else{
  const canvasTarget=items.length===1||by('layerAlignTarget').value==='canvas',left=canvasTarget?0:Math.min(...rects.map(r=>r.b.left)),top=canvasTarget?0:Math.min(...rects.map(r=>r.b.top)),right=canvasTarget?width:Math.max(...rects.map(r=>r.b.left+r.b.width)),bottom=canvasTarget?height:Math.max(...rects.map(r=>r.b.top+r.b.height));
  for(const {o,b}of rects){const dx=mode==='left'?left-b.left:mode==='right'?right-b.left-b.width:mode==='center'?(left+right-b.width)/2-b.left:0,dy=mode==='top'?top-b.top:mode==='bottom'?bottom-b.top-b.height:mode==='middle'?(top+bottom-b.height)/2-b.top:0;o.set({left:o.left+dx,top:o.top+dy});o.setCoords();}
 }selectItems(items);changed();say('선택한 요소를 정렬했습니다.');
}
for(const [id,mode]of [['layerAlignLeft','left'],['layerAlignCenter','center'],['layerAlignRight','right'],['layerAlignTop','top'],['layerAlignMiddle','middle'],['layerAlignBottom','bottom'],['layerDistributeX','spaceX'],['layerDistributeY','spaceY']])by(id).onclick=()=>align(mode);


function updateRelation(clear=false){if(!canvas||loading)return;const items=selected().filter(o=>!o.layerLocked);if(!items.length){say('먼저 함께 읽을 요소를 선택하세요.');return;}const name=by('layerRelationName').value.trim();if(!clear&&!name){say('묶음 이름을 입력하세요.');return;}for(const o of items){o.set({layoutManualGroup:clear?'':name,layoutManualRole:clear?'':by('layerRelationRole').value});for(const key of ['layoutUnit','layoutRole','layoutBand'])delete o[key];}window.dispatchEvent(new CustomEvent('coex:semantic-reset',{detail:items}));changed();say(clear?'선택 요소의 직접 지정 묶음을 해제했습니다.':'선택 요소의 의미 묶음을 지정했습니다. 요소 재배치를 눌러 확인하세요.');}
by('layerRelationApply').onclick=()=>updateRelation();by('layerRelationClear').onclick=()=>updateRelation(true);
by('layerRelationSelect').onclick=()=>{const first=selected()[0],key=first?.layoutManualGroup||first?.layoutUnit;if(!key){say('먼저 재배치된 요소를 하나 선택하세요.');return;}selectItems(canvas.getObjects().filter(o=>!o.layerLocked&&o.visible&&(first.layoutManualGroup?o.layoutManualGroup===key:o.layoutUnit===key)));say('같은 의미 묶음을 선택했습니다. 함께 이동하거나 크기를 조절할 수 있습니다.');};
function fitIndependentBackground(mode){
 const o=current();if(!o||selected().length!==1||o.photoInstanceKind!=='background'||o.layerRole!=='background'||o.layerLocked||o.visible===false){say('분리된 배경 한 개를 선택하고 잠금을 해제하세요.',true);return;}
 if(String(o.type).toLowerCase()!=='image'||o.angle||o.skewX||o.skewY||o.flipX||o.flipY||o.cropX||o.cropY||o.clipPath||!(o.width>0&&o.height>0)){say('회전·자르기·마스크가 있는 배경은 직접 조절해 주세요.',true);return;}
 const before=bgTransform(o),k=(mode==='cover'?Math.max:Math.min)(width/o.width,height/o.height);
 o.set({originX:'left',originY:'top',left:(width-o.width*k)/2,top:(height-o.height*k)/2,scaleX:k,scaleY:k});o.setCoords();changed();
 independentBgUndo={object:o,before,after:bgTransform(o),epoch,revision};selection();
 say(mode==='cover'?'배경 사진을 화면에 맞췄습니다. 가장자리 잘림과 투명 영역을 확인하세요. 새 배경은 생성하지 않습니다.':'배경 전체가 보이도록 맞췄습니다. 여백을 확인하세요.');
}
by('independentBgCover').onclick=()=>fitIndependentBackground('cover');
by('independentBgContain').onclick=()=>fitIndependentBackground('contain');
by('independentBgUndo').onclick=()=>{const o=current();if(!validBgUndo(o)){independentBgUndo=null;selection();say('배경이 변경되어 되돌릴 수 없습니다.',true);return;}const before=independentBgUndo.before;independentBgUndo=null;o.set(before);o.setCoords();changed();say('방금 적용한 배경 맞춤을 되돌렸습니다.');};
by('layerSelectAll').onclick=()=>{if(!canvas||loading)return;selectItems(canvas.getObjects().filter(o=>o.visible&&!o.layerLocked));say(selected().length+'개 요소를 선택했습니다. 선택 테두리 안을 드래그하면 함께 이동합니다.');};
by('layerDeselect').onclick=()=>{if(canvas)selectItems([]);};
let duplicating=false;
by('layerDuplicate').onclick=async()=>{
 if(!canvas||loading||duplicating)return;const items=editableSelection();if(!items.length){say('복제할 요소를 선택하세요.');return;}
 if(items.some(o=>containsOutsideRecovery(o))){say('바깥 연결이 있는 요소는 아직 복제할 수 없습니다. 원본 요소를 그대로 사용해 주세요.',true);return;}
 // The same recursive count limit as project loading also applies to copies.
 const count=o=>1+(o.getObjects?.()||[]).reduce((n,x)=>n+count(x),0);
 if(canvas.getObjects().reduce((n,o)=>n+count(o),0)+items.reduce((n,o)=>n+count(o),0)>200){say('복제하면 요소가 200개를 넘습니다.',true);return;}
 const token=epoch,before=revision;duplicating=true;by('layerDuplicate').disabled=true;
 try{releaseSelection();const copies=await Promise.all(items.map(o=>o.clone(extra)));
  if(token!==epoch||before!==revision||loading){copies.forEach(o=>o.dispose());return;}
  for(const o of copies){o.set({left:o.left+20,top:o.top+20,layerName:(o.layerName||o.type)+' 복사본'});normalize(o);}
  canvas.add(...copies);selectItems(copies);changed();say(copies.length+'개 요소를 복제했습니다.');
 }catch(error){say('복제하지 못했습니다: '+error.message,true);}finally{duplicating=false;by('layerDuplicate').disabled=false;}
};
by('layerGroup').onclick=()=>{
 if(!canvas||loading)return;const items=editableSelection();if(items.length<2){say('그룹으로 묶을 요소를 2개 이상 선택하세요.');return;}
 if(items.some(o=>containsOutsideRecovery(o))){say('바깥 연결이 있는 요소는 아직 그룹으로 묶을 수 없습니다. 개별 요소로 편집해 주세요.',true);return;}
 const all=canvas.getObjects(),ordered=all.filter(o=>items.includes(o));
 // Grouping changes interleaved paint order; require a contiguous stack.
 const indices=ordered.map(o=>all.indexOf(o));if(indices.at(-1)-indices[0]+1!==ordered.length){say('사이에 다른 요소가 있습니다. 앞뒤 순서를 연속으로 맞춘 뒤 묶어 주세요.');return;}
 releaseSelection();canvas.remove(...ordered);const group=normalize(new F.Group(ordered,{layerName:'새 그룹',layerRole:'other',objectCaching:false}));canvas.insertAt(indices[0],group);selectItems([group]);changed();say('선택 요소를 그룹으로 묶었습니다. 그룹 풀기로 다시 나눌 수 있습니다.');
};
// Shortcuts are scoped to the editor; native text editing and form inputs keep their keys.
panel.addEventListener('pointerdown',()=>{panel.dataset.keyboard='true';});
document.addEventListener('pointerdown',e=>{if(!panel.contains(e.target))delete panel.dataset.keyboard;});
for(const event of ['click','focusin'])document.addEventListener(event,e=>{if((!panel.contains(e.target)||e.target.closest('#layerWidth,#layerHeight,#layerPreset,#layerResize'))&&current()?.isType('ActiveSelection')){canvas.discardActiveObject();selection();}},true);
document.addEventListener('keydown',e=>{
 if(!canvas||loading||by('layerWork').hidden||!panel.dataset.keyboard||e.defaultPrevented||e.isComposing)return;
 if(e.target.closest('input,textarea,select,[contenteditable="true"]')||current()?.isEditing)return;
 const key=e.key.toLowerCase(),mod=e.ctrlKey||e.metaKey;
 let action=null;
 if(mod&&!e.altKey){if(key==='a')action=()=>by('layerSelectAll').click();else if(key==='d')action=()=>by('layerDuplicate').click();else if(key==='g')action=()=>by(e.shiftKey?'layerUngroup':'layerGroup').click();else if(key==='z')action=()=>by(e.shiftKey?'workspaceRedo':'workspaceUndo')?.click();else if(key==='y')action=()=>by('workspaceRedo')?.click();}
 else if(!e.altKey){if(key==='escape')action=()=>selectItems([]);else if(key==='delete'||key==='backspace')action=()=>stack('delete');else if(['arrowleft','arrowright','arrowup','arrowdown'].includes(key))action=()=>{const items=editableSelection();if(!items.length)return;releaseSelection();const step=e.shiftKey?10:1;for(const o of items){o.set({left:o.left+(key==='arrowleft'?-step:key==='arrowright'?step:0),top:o.top+(key==='arrowup'?-step:key==='arrowdown'?step:0)});o.setCoords();}selectItems(items);changed();};}
 if(action){e.preventDefault();action();}
});

function prop(id,handler,event='change'){by(id).addEventListener(event,()=>{let o=current();if(!o)return;if(o.layerLocked&&!['layerLocked','layerVisible','layerObjectName','layerRole','layerPriority'].includes(id)){selection();say('잠금을 해제한 뒤 변경해 주세요.');return;}const result=handler(o,by(id));if(result&&typeof result.setCoords==='function')o=result;o.setCoords();changed(id!=='layerText');});}
prop('layerObjectName',(o,e)=>o.set('layerName',e.value||o.type));prop('layerRole',(o,e)=>{o.set({layerRole:e.value,layerRoleInferred:false,layoutManualRole:e.value});window.dispatchEvent(new CustomEvent('coex:semantic-reset',{detail:[o]}));return o;});prop('layerPriority',(o,e)=>o.set('layerPriority',e.value));
prop('layerX',(o,e)=>{const n=Number(e.value);if(Number.isFinite(n)&&Math.abs(n)<=24000)o.set('left',n);});prop('layerY',(o,e)=>{const n=Number(e.value);if(Number.isFinite(n)&&Math.abs(n)<=24000)o.set('top',n);});
prop('layerVisible',(o,e)=>o.set({visible:e.checked,autoOmitted:false}));prop('layerLocked',(o,e)=>lock(o,e.checked));prop('layerOpacity',(o,e)=>o.set('opacity',Number(e.value)/100),'input');
prop('layerText',(o,e)=>{const value=e.value;if(!textObject(o)&&(o.sourceText||o.nativeKind==='text'))o=rebuildText(o);if(textObject(o)){o.set({text:value,styles:{}});e.value=value;return o;}},'input');prop('layerFontSize',(o,e)=>{const n=Number(e.value);if(n>=1&&n<=2000&&textObject(o)){const scale=n/o.fontSize;for(const row of Object.values(o.styles||{}))for(const st of Object.values(row))if(st.fontSize)st.fontSize*=scale;o.set('fontSize',n);}});prop('layerColor',(o,e)=>{if(textObject(o)){for(const row of Object.values(o.styles||{}))for(const st of Object.values(row))delete st.fill;o.set('fill',e.value);}},'input');
prop('layerFontFamily',(o,e)=>{if(textObject(o)&&e.value.trim()){for(const row of Object.values(o.styles||{}))for(const st of Object.values(row))delete st.fontFamily;o.set('fontFamily',e.value.trim());}});
for(const [id,key]of [['layerTextAlign','textAlign'],['layerLineHeight','lineHeight'],['layerCharSpacing','charSpacing'],['layerBold','fontWeight'],['layerItalic','fontStyle']])prop(id,(o,e)=>{if(!textObject(o))return;let value=e.value;if(key==='lineHeight'||key==='charSpacing'){value=Number(value);if(!Number.isFinite(value)||(key==='lineHeight'?(value<.5||value>5):(value< -200||value>2000)))return;}else if(key==='fontWeight')value=e.checked?'bold':'normal';else if(key==='fontStyle')value=e.checked?'italic':'normal';if(key==='fontWeight'||key==='fontStyle')for(const row of Object.values(o.styles||{}))for(const style of Object.values(row))delete style[key];o.set(key,value);});
by('layerFontLoad').onclick=()=>by('layerFontFile').click();
// Register uploaded font bytes in this project without requiring a selected text.
// The font travels with project JSON; no system install or remote fetch is used.
globalThis.coexProjectAssets={
 fonts:()=>projectFonts.map(f=>({family:f.family,name:f.originalFamily||f.family})),
 async addFont(file){
  if(!canvas||loading)throw Error('원본을 연 뒤 글꼴 파일을 추가해 주세요.');
  if(!file||file.size>32*1024*1024||!/[.](ttf|otf|woff2?)$/i.test(file.name))throw Error('32MB 이하 TTF·OTF·WOFF·WOFF2 글꼴을 선택하세요.');
  if(projectFonts.length>=64||projectFonts.reduce((n,f)=>n+f.src.length,0)+Math.ceil(file.size*4/3)>48*1024*1024)throw Error('프로젝트 글꼴 용량 또는 개수 한도를 넘습니다.');
  const ticket=epoch,font={family:'CoexFont-'+crypto.randomUUID(),originalFamily:file.name,weight:'400',style:'normal',src:fontDataUrl(new Uint8Array(await file.arrayBuffer()))};
  const handle=await loadProjectFonts([font]);if(ticket!==epoch||!canvas){handle.dispose();throw Error('원본이 바뀌어 글꼴 추가를 취소했습니다.');}
  const previous=fontHandle;fontHandle={dispose(){previous?.dispose();handle.dispose();}};projectFonts=[...projectFonts,font];F.cache.clearFontCache(font.family);changed();return font.family;
 }
};
by('layerFontFile').onchange=async e=>{const file=e.target.files[0];e.target.value='';const o=current(),ticket=epoch;if(!file||!textObject(o)||o.layerLocked)return;try{if(file.size>32*1024*1024)fail('글꼴은 32MB 이하로 선택하세요.');const font={family:'CoexFont-'+crypto.randomUUID(),originalFamily:file.name,weight:'400',style:'normal',src:fontDataUrl(new Uint8Array(await file.arrayBuffer()))},handle=await loadProjectFonts([font]);if(ticket!==epoch||!canvas.getObjects().includes(o)){handle.dispose();return;}const previous=fontHandle;fontHandle={dispose(){previous?.dispose();handle.dispose();}};projectFonts=[...projectFonts,font];for(const row of Object.values(o.styles||{}))for(const st of Object.values(row))delete st.fontFamily;F.cache.clearFontCache(font.family);o.set('fontFamily',font.family);changed();say('선택 글자에 글꼴을 적용했습니다. 프로젝트 JSON에 글꼴도 저장합니다.');}catch(error){say(error.message,true);}};
function rebuildText(o){
 if(!o||( !o.sourceText&&o.nativeKind!=='text')||o.layerLocked)return o;const r=o.getBoundingRect(),at=canvas.getObjects().indexOf(o);let fill='#1a1814';
 try{const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(o.getElement(),0,0,64,64);const data=ctx.getImageData(0,0,64,64).data,colors=new Map();for(let i=0;i<data.length;i+=4)if(data[i+3]>200){const color='#'+[data[i],data[i+1],data[i+2]].map(v=>v.toString(16).padStart(2,'0')).join('');colors.set(color,(colors.get(color)||0)+1);}fill=[...colors].sort((a,b)=>b[1]-a[1])[0]?.[0]||fill;}catch{}
 const t=normalize(new F.Textbox((o.sourceText||'').replace(/\r/g,'\n'),{left:r.left,top:r.top,width:Math.max(20,r.width),fontSize:Math.max(8,Math.min(2000,r.height/(1.16*Math.max(1,(o.sourceText||'').split(/\r|\n/).length)))),fontFamily:'"Malgun Gothic","Apple SD Gothic Neo",sans-serif',fill,opacity:o.opacity,visible:o.visible,layerName:o.layerName,layerRole:o.layerRole,layerPriority:o.layerPriority,sourceText:o.sourceText,sourceElementId:o.sourceElementId,sourceElementType:o.sourceElementType,nativeKind:'text'}));
 canvas.discardActiveObject();canvas.remove(o);marked.delete(o);o.dispose();canvas.insertAt(at,t);canvas.setActiveObject(t);selection();say('인식 글자를 편집 글자로 바꿨습니다. 이미지 원본의 글꼴은 추정이므로 모양과 줄바꿈을 확인하세요.');return t;
}
by('layerTextRebuild').onclick=()=>{const o=current();if(!o||(!o.sourceText&&o.nativeKind!=='text')||o.layerLocked)return;rebuildText(o);changed();};

by('layerApply').onclick=()=>{if(!canvas||loading)return;try{if(!sceneOutputCurrent())fail('새 파일이나 슬라이드의 편집 요소가 준비된 뒤 적용하세요.');const c=snapshot();acceptWorkingSnapshot(c,projectName);say('현재 편집 화면을 리사이징에 적용했습니다. 아래에서 SNS 규격·맞춤 방식·ZIP 출력을 선택하세요. 요소를 수정하면 다시 적용해야 합니다.');}catch(e){say('화면을 적용하지 못했습니다: '+e.message,true);}};
by('layerPng').onclick=()=>{if(!canvas||loading)return;try{const c=snapshot();c.toBlob(blob=>{c.width=c.height=0;if(blob)save(blob,projectName+'.png');else say('PNG 저장에 실패했습니다.',true);},'image/png');}catch(e){say('PNG 저장에 실패했습니다: '+e.message,true);}};
by('layerSvg').onclick=()=>{if(!canvas||loading)return;if(canvas.getObjects().some(o=>o.__outsideTrialVisible)){say('복원된 바깥 요소는 아직 SVG로 저장할 수 없습니다. PNG로 저장해 주세요.',true);return;}try{ensureProjectTypography();}catch(error){say(error.message,true);return;}canvas.discardActiveObject();const previous=canvas.svgViewportTransformation;try{canvas.svgViewportTransformation=false;let svg=canvas.toSVG({width,height,viewBox:{x:0,y:0,width,height}});const fontCss=projectFonts.map(f=>'@font-face{font-family:'+JSON.stringify(f.family)+';src:url('+f.src+');font-weight:'+(/^(normal|bold|[1-9]00)$/.test(String(f.weight))?f.weight:'400')+';font-style:'+(['normal','italic','oblique'].includes(f.style)?f.style:'normal')+';}').join('');if(fontCss)svg=svg.replace('<defs>','<defs><style type="text/css"><![CDATA['+fontCss+']]></style>');const xml=new DOMParser().parseFromString(svg,'image/svg+xml');if(xml.querySelector('parsererror,script,foreignObject')||[...xml.querySelectorAll('*')].some(e=>[...e.attributes].some(a=>/^on/i.test(a.name))))fail('안전한 SVG로 저장할 수 없는 내용이 있습니다.');save(new Blob([svg],{type:'image/svg+xml'}),projectName+'.svg');say('글자·도형은 벡터로 SVG 저장했습니다. 사진과 효과 보존 이미지는 픽셀입니다.');}catch(error){say('SVG 저장을 완료하지 못했습니다: '+error.message,true);}finally{canvas.svgViewportTransformation=previous;selection();}};
globalThis.layerFileImport=openFile;
globalThis.getLayerSceneSourceKey=()=>sceneSourceKey;
globalThis.layerSnapshotDetached=()=>{cancelEditedPreview();linked=false;};
window.addEventListener('pagehide',e=>{if(!e.persisted){cancelImport();fontHandle?.dispose();canvas?.dispose();}});

// Layout bridge: only this module owns scene dimensions and the editor revision.
function layoutRead(){if(!canvas||loading)return null;let fontError=null;try{ensureProjectTypography();}catch(error){fontError=error.message;say(error.message,true);}return {F,objects:canvas.getObjects(),width,height,epoch,revision,linked,sourceKey:sceneSourceKey,inputKind:sceneInputKind,sourceFormat:sceneSourceFormat,sceneOutputKey,sceneManual,fontError};}
// Capture all Fabric-rendered properties recursively without duplicating large image data strings.
function atomicSceneSignature(){
 const visit=(o,refs)=>{refs.push(o,o.getElement?.());for(const child of o.getObjects?.()||[])visit(child,refs);};
 return canvas.getObjects().map(o=>{const refs=[],sources=[];visit(o,refs);const rendered=o.toObject(['textureBackgroundFrame','readabilityPanelBox']);const json=JSON.stringify(rendered,(key,value)=>{if(key==='src'&&typeof value==='string'){sources.push(value);return '@image-source:'+sources.length;}return value;});return {json,refs,sources};});
}
function atomicSceneMatches(saved){const current=atomicSceneSignature();return saved.length===current.length&&saved.every((a,i)=>{const b=current[i];return a.json===b.json&&a.refs.length===b.refs.length&&a.refs.every((v,j)=>v===b.refs[j])&&a.sources.length===b.sources.length&&a.sources.every((v,j)=>v===b.sources[j]);});}
function atomicMultiSelection(){return String(canvas?.getActiveObject?.()?.type||'').toLowerCase()==='activeselection';}
globalThis.coexLayerLayout={
 read:layoutRead,
 captureAtomicLiveGuard(){
  if(!canvas||loading||!sceneOutputCurrent()||atomicMultiSelection()||canvas._currentTransform||canvas._groupSelector||canvas._isCurrentlyDrawing)return null;
  try{return {canvas,epoch,revision,context:sceneOutputKey,scene:atomicSceneSignature()};}catch{return null;}
 },
 matchesAtomicLiveGuard(guard){
  if(!guard||!canvas||loading||guard.canvas!==canvas||guard.epoch!==epoch||guard.revision!==revision||guard.context!==sceneOutputKey||!sceneOutputCurrent()||atomicMultiSelection()||canvas._currentTransform||canvas._groupSelector||canvas._isCurrentlyDrawing)return false;
  try{return atomicSceneMatches(guard.scene);}catch{return false;}
 },
 reorder(objects){if(!canvas||loading)return false;const current=canvas.getObjects();if(objects.length!==current.length||new Set(objects).size!==current.length||!objects.every(o=>current.includes(o)))return false;objects.forEach((o,i)=>canvas.moveObjectTo(o,i));return true;},
 applyDesign(objects,w,h,expected){
  if(!canvas||loading||!sceneOutputCurrent()||epoch!==expected.epoch||revision!==expected.revision||!dims(w,h))fail('원본이나 크기가 바뀌었습니다. 시안을 다시 만들어 주세요.');
  const old=canvas.getObjects(),previous={width,height};let output;
  marked.clear();
  canvas.discardActiveObject();canvas.remove(...old);canvas.add(...objects.map(o=>normalize(o)));width=w;height=h;
  try{output=snapshot();}catch(error){canvas.remove(...objects);canvas.add(...old);width=previous.width;height=previous.height;fit();throw error;}
  const outputFormat=by('fmtSelect').value;by('layerWidth').value=w;by('layerHeight').value=h;fit();changed();acceptWorkingSnapshot(output,projectName);if(by('fmtSelect').value!==outputFormat){by('fmtSelect').value=outputFormat;globalThis.syncQualityVisibility?.();globalThis.scheduleRender?.();}
  old.forEach(o=>o.dispose());say('선택한 디자인 시안을 적용했습니다. 글자·도형을 계속 편집하거나 실행 취소할 수 있습니다.');return layoutRead();
 },
 refresh(){canvas?.getObjects().forEach(o=>o.setCoords());canvas?.requestRenderAll();selection();},
 snapshot(w,h){if(!dims(w,h)||!canvas||loading)fail('출력 크기를 확인해 주세요.');ensureProjectTypography();const previous=canvas.viewportTransform;try{canvas.setViewportTransform([1,0,0,1,0,0]);return canvas.toCanvasElement(1,{left:0,top:0,width:w,height:h});}finally{canvas.setViewportTransform(previous);canvas.requestRenderAll();}},
 snapshotThumbnail(maxSide=512){if(!canvas||loading||!Number.isInteger(maxSide)||maxSide<64||maxSide>1024)fail('분리 미리보기 크기를 확인해 주세요.');ensureProjectTypography();const scale=Math.min(1,maxSide/Math.max(width,height),Math.sqrt(400000/(width*height))),previous=canvas.viewportTransform;try{canvas.setViewportTransform([1,0,0,1,0,0]);return canvas.toCanvasElement(scale,{left:0,top:0,width,height});}finally{canvas.setViewportTransform(previous);canvas.requestRenderAll();}},
 focusEditing,
 async prepareAtomicSnapshot(w,h,expected){
  if(!canvas||loading||epoch!==expected?.epoch||revision!==expected?.revision||!sceneOutputCurrent()||!dims(w,h))fail('원본이나 크기가 바뀌었습니다.');
  const context=sceneOutputKey,output=nativeSnapshot(w,h),scene=atomicSceneSignature();let prepared;
  try{prepared=await globalThis.coexPrepareLayerSnapshotAtomic(output,projectName,context,expected.decision);if(!canvas||loading||epoch!==expected.epoch||revision!==expected.revision||!sceneOutputCurrent()||sceneOutputKey!==context)fail('원본이나 요소가 변경되었습니다.');prepared.layerGuard={epoch,revision,context,w,h,scene};return prepared;}
  catch(error){if(prepared)globalThis.coexDiscardLayerSnapshotAtomic?.(prepared);else output.width=output.height=0;throw error;}
 },
 commitAtomic(w,h,expected,prepared){
  if(!canvas||loading||epoch!==expected?.epoch||revision!==expected?.revision||!sceneOutputCurrent()||!dims(w,h)||!prepared||prepared.layerGuard?.epoch!==epoch||prepared.layerGuard?.revision!==revision||prepared.layerGuard?.context!==sceneOutputKey||prepared.layerGuard?.w!==w||prepared.layerGuard?.h!==h||!atomicSceneMatches(prepared.layerGuard?.scene||[]))fail('원본이나 요소가 변경되어 적용을 취소했습니다.');
  const previous={width,height,revision,linked,sceneOutputKey};let context;
  try{width=w;height=h;show();context=globalThis.coexCommitLayerSnapshotAtomic(prepared);}
  catch(error){width=previous.width;height=previous.height;revision=previous.revision;linked=previous.linked;sceneOutputKey=previous.sceneOutputKey;try{show();}catch{}throw error;}
  // The output is committed: subsequent notification errors cannot roll it back.
  sceneOutputKey=context;linked=true;++revision;cancelEditedPreview();
  try{canvas.requestRenderAll();}catch{}try{selection();}catch{}try{queueMicrotask(()=>window.dispatchEvent(new Event('coex:history-change')));}catch{}try{window.dispatchEvent(new Event('coex:layer-edit'));}catch{}try{updateEditingBridge();}catch{}
  try{return layoutRead();}catch{return {F,objects:canvas.getObjects(),width,height,epoch,revision,linked,sourceKey:sceneSourceKey,inputKind:sceneInputKind,sourceFormat:sceneSourceFormat,sceneOutputKey,sceneManual,fontError:null};}
 },
 commit(w,h,expected){
  if(!canvas||loading||!sceneOutputCurrent()||epoch!==expected.epoch||revision!==expected.revision)fail('원본이나 요소가 변경되어 재배치를 취소했습니다.');
  if(!dims(w,h))fail('출력 크기를 확인해 주세요.');
  if(expected.paintOrder)globalThis.coexLayerLayout.reorder(expected.paintOrder);
  width=w;height=h;by('layerWidth').value=w;by('layerHeight').value=h;show();changed();
  if(expected.apply)publishWorkingScene();
  return layoutRead();
 }
};

// Restore through the scene owner, rejecting asynchronous work after a source change.
let historyRestore=0,historyRestoring=false;
globalThis.coexLayerHistory={
 pause(){cancelImport();},
 capture(){if(!canvas||loading)return null;try{return scene();}catch(error){say(error.message,true);return null;}},
 async restore(doc){
  if(!canvas||loading||!sceneOutputCurrent())return false;
  const token=epoch,ticket=++historyRestore,before=revision;
  assertProjectFontReferences(doc.scene.objects,doc.fonts||[]);const restoredFonts=await loadProjectFonts(doc.fonts||[]);F.cache.clearFontCache();let objects;try{if(doc.scene.objects.some(o=>o.outsideRecovery)){validateJson(doc);await validateAssets(doc.scene.objects);}objects=await F.util.enlivenObjects(doc.scene.objects);await installOutside(objects,doc.scene.objects);}catch(error){objects?.forEach(o=>o.dispose());restoredFonts.dispose();throw error;}
  if(token!==epoch||ticket!==historyRestore||before!==revision||loading||!sceneOutputCurrent()){objects.forEach(o=>o.dispose());restoredFonts.dispose();return false;}
  historyRestoring=true;
  try{replace(objects.map((o,i)=>normalize(o,'요소 '+(i+1))),doc.width,doc.height,doc.name,sceneSourceKey,{fonts:doc.fonts||[],handle:restoredFonts,inputKind:doc.inputKind||'layered',sourceFormat:doc.sourceFormat||'layer-json',manualSource:sceneManual,outsideReport:doc.outsideRecoveryReport||null});revision=before+1;}
  finally{historyRestoring=false;}
  window.dispatchEvent(new Event('coex:layer-edit'));linked=true;globalThis.invalidateLayerSnapshot?.({keepEditing:true});sceneOutputKey=globalThis.getLayerOutputContextKey?.()||null;if(doc.scene.objects.some(o=>o.outsideRecoveryReview))say('원본이 바뀐 요소의 바깥 연결을 중지했습니다. 결과를 확인해 주세요.',true);queueEditedPreview();return true;
 },
 clear(){
  marked.clear();fontHandle?.dispose();fontHandle=null;projectFonts=[];
  ++historyRestore;window.dispatchEvent(new Event('coex:layer-source'));cancelImport();
  if(linked){globalThis.invalidateLayerSnapshot?.();linked=false;}
  if(canvas){canvas.discardActiveObject();const old=canvas.getObjects();canvas.remove(...old);old.forEach(o=>o.dispose());canvas.requestRenderAll();}
  outsideRecoveryReport=null;window.dispatchEvent(new Event('coex:outside-recovery-change'));sceneSourceKey=null;sceneOutputKey=null;sceneManual=false;revision=0;width=height=1080;projectName='새 프로젝트';
  mountSizeControls(false);by('layerWork').hidden=true;by('layerToggle').hidden=true;by('layerFile').value='';by('layerAsset').value='';
  by('layerPreset').value='';by('layerWidth').value=width;by('layerHeight').value=height;
  if(canvas)selection();say('새 파일을 선택해 시작하세요.');
  window.dispatchEvent(new Event('coex:history-source'));
 }
};


