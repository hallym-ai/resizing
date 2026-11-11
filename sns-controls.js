/* Exact-size canvases, source-aware presets and cancellable local ZIP exports. */
const snsData=globalThis.SNS_CATALOG;
const customStorage='coex_custom_sizes_v1';
let customPresets=[],activePreset=null,batchTargets=[],batchJob=0,batchBusy=false;
const textFor=(ko,en)=>lang==='ko'?ko:en;
const basisNames={brief:['담당자 지정','Provided brief'],recommended:['공식 권장','Official recommended'],minimum:['공식 최소','Official minimum'],specified:['공식 명시','Official specification'],supported:['공식 지원 예시','Official supported example'],ratio:['비율 환산 예시','Ratio-based example'],working:['작업용 예시','Working example'],'range-example':['허용 범위 내 예시','Allowed-range example'],historical:['이전 공지 기준','Historical notice'],custom:['내 규격','My size']};
function basisName(key){return (basisNames[key]||basisNames.working)[lang==='ko'?0:1];}
function presetName(p){return typeof p.name==='string'?p.name:(p.name[lang]||p.name.ko);}
function makeNode(tag,text,cls){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;}
function validPreset(p){return p&&typeof p.id==='string'&&/^custom-[a-z0-9-]+$/i.test(p.id)&&typeof p.name==='string'&&p.name.trim().length>0&&p.name.length<=60&&validDimensions(p.w,p.h);}
try{const saved=JSON.parse(localStorage.getItem(customStorage)||'[]');if(Array.isArray(saved))customPresets=saved.filter(validPreset).slice(0,50);}catch{}
Object.assign(I18N.ko,{
 sns_title:'SNS 규격 또는 자유 크기',sns_intro:'프리셋은 시작점입니다. 너비·높이를 자유롭게 바꾸고 내 규격으로 저장하세요.',sns_platform:'플랫폼',sns_search:'규격 검색',sns_custom_name:'내 규격 이름',sns_save:'현재 크기 저장',sns_free:'자유 크기 입력',sns_add_current:'현재 크기 목록에 추가',
 sns_fit_title:'규격에 맞추는 방법',sns_fit:'맞춤 방식',sns_contain:'여백 추가 · 전체 내용 유지',sns_cover:'잘라내기 · 화면 채우기',sns_stretch:'늘리기 · 비율 변형',sns_bg:'여백 배경색',sns_transparent:'남은 여백 투명 (PNG·WebP)',sns_resize_behavior:'규격 변경 시 배치',sns_auto_layout:'자동 재배치 · 규격 공간 활용',sns_preserve_layout:'원본 배치 유지 · 비율 보존',sns_reflow_layout:'가독성 재배치 · 작은 글씨·줄바꿈 개선',sns_extend_solid:'원본 단색 배경 자동 연장',sns_background_candidates:'사진 배경 확장 후보 열기',sns_background_help:'기본은 원본 글씨·로고·상품 묶음을 새 규격에 자동 재배치하고 단색 배경을 연결합니다. 적합한 원본 요소가 확인되지 않거나 잠금·용도 지정이 있으면 원본 배치를 유지합니다. 원래 배치 그대로 크기만 바꾸려면 원본 배치 유지를 선택하세요. 투명 옵션은 단색 배경을 연장한 뒤 남는 여백에 적용됩니다. 작은 글씨와 단어 줄바꿈을 개선하려면 가독성 재배치를 선택하세요. 편집 가능한 글자와 인식된 요소에 적용되며, 이미지 속 글씨는 원본을 유지합니다. 기본은 원본의 단색 배경 또는 선택한 색으로 여백을 채웁니다. 투명 여백을 직접 켠 경우에만 채우기와 자동 연장을 끕니다. 사진은 배경 후보를 확인해 적용하세요. 투명 여백만 남은 상태는 배경 확장이 아닙니다.',sns_position:'배치 위치',sns_center:'가운데로',sns_pos_x:'가로 위치',sns_pos_y:'세로 위치',
 sns_fit_help:'여백은 내용 전체를 보존하고, 잘라내기는 일부를 제외하며, 늘리기는 글자·이미지 비율을 바꿉니다. 인식한 레이어가 연결되면 규격마다 요소를 재배치합니다.',
 sns_batch:'여러 규격 한 번에 저장',sns_batch_help:'현재 이미지 또는 선택한 문서 한 페이지를 같은 맞춤 방식·위치·배경·형식으로 변환합니다. 연결된 레이어는 규격마다 재배치합니다. 최대 12개, 합계 1억 2천만 픽셀.',sns_zip:'선택 규격 ZIP 다운로드',sns_cancel:'취소',sns_clear:'목록 비우기',sns_sources:'규격 출처와 확인 범위',
 sns_source_help:'2026-10-17 확인. 게시물·광고·프로필을 구분했습니다. 권장·최소·비율 환산·작업용 예시는 서로 다릅니다. 모든 SNS의 모든 지면을 망라하거나 실제 업로드·심사 통과를 보장하지 않습니다. 규격과 파일 제한은 변경될 수 있습니다.',
 sns_saved:'내 규격',sns_current:'현재 크기',sns_empty:'선택한 규격이 없습니다. 카드의 + 목록 버튼 또는 현재 크기 추가를 사용하세요.',
});
Object.assign(I18N.en,{
 sns_title:'SNS presets or any custom size',sns_intro:'Presets are a starting point. Edit width and height freely and save your own sizes.',sns_platform:'Platform',sns_search:'Search presets',sns_custom_name:'My size name',sns_save:'Save current size',sns_free:'Enter a custom size',sns_add_current:'Add current size to list',
 sns_fit_title:'Fit content to the canvas',sns_fit:'Fit mode',sns_contain:'Contain · keep all content',sns_cover:'Cover · crop to fill',sns_stretch:'Stretch · change proportions',sns_bg:'Padding background',sns_transparent:'Transparent remaining space (PNG/WebP)',sns_resize_behavior:'Layout when size changes',sns_auto_layout:'Automatic reflow · use the new canvas',sns_preserve_layout:'Preserve original layout and proportions',sns_reflow_layout:'Readable reflow · improve small text and wrapping',sns_extend_solid:'Extend original solid background',sns_background_candidates:'Open photo background candidates',sns_background_help:'By default, reflow verified original text, logo and product groups to use the new canvas. Preserve the original layout when groups cannot be verified, objects are locked or roles are assigned. Select Preserve original layout for uniform scaling. Transparency applies to space remaining after solid background extension. Select readable reflow to improve small editable text and word wrapping. Text inside images keeps its original appearance. Remaining space is filled with a detected solid background colour or the chosen colour by default. Explicit transparent space disables filling and extension. Review and apply a photo background candidate for complex images. Transparent padding alone is not background extension.',sns_position:'Content position',sns_center:'Center',sns_pos_x:'Horizontal position',sns_pos_y:'Vertical position',
 sns_fit_help:'Contain keeps all content. Cover crops. Stretch distorts text and images. Recognised, linked layers are rearranged for each target size.',
 sns_batch:'Export multiple sizes',sns_batch_help:'Export the current image or selected document page using the same fit, position, background and format. Linked layers reflow for each target. Up to 12 sizes, 120 million total pixels.',sns_zip:'Download sizes as ZIP',sns_cancel:'Cancel',sns_clear:'Clear list',sns_sources:'Sources and coverage',
 sns_source_help:'Checked 2026-10-17. Posts, ads and profiles are distinct. Recommended, minimum, ratio-based and working examples are labeled separately. This is not an exhaustive list of every placement or a guarantee of upload/ad approval. Specs and limits can change.',
 sns_saved:'My sizes',sns_current:'Current size',sns_empty:'No sizes selected. Use + List on a preset or add the current size.',
});
Object.assign(I18N.ko,{sns_fit_title:'규격 자동 맞춤',sns_batch_help:'규격마다 요소 배치를 유지하고 확인된 배경만 조정합니다. 분리 미완료·배경 검토 상태는 ZIP 기록에도 표시합니다.',autoReview:'원본 요소를 보호했습니다. 배경 분리 또는 배경 처리에 검토가 필요합니다.'});
Object.assign(I18N.en,{sns_fit_title:'Automatic canvas adaptation',autoReview:'Dimensions were adapted, but element reflow was not completed. Original text and artwork are protected; review is required.'});
function allPresets(){return [...snsData.presets,...customPresets.map(p=>({...p,platform:'내 규격',basis:'custom'}))];}
function sourceFor(p){return snsData.sources[p.source];}
function renderPresetCards(){
 const platform=$('snsPlatform').value,query=$('snsSearch').value.trim().toLowerCase();
 const filtered=allPresets().filter(p=>(!platform||p.platform===platform)&&(!query||[p.platform,presetName(p),p.w+'',p.h+'',p.note||''].join(' ').toLowerCase().includes(query)));
 const grid=$('snsGrid');grid.replaceChildren();
 for(const p of filtered){
  const card=makeNode('article',undefined,'sns-preset-card'+(activePreset?.id===p.id?' active':''));card.dataset.preset=p.id;
  const label=makeNode('button',undefined,'sns-preset-apply');label.type='button';label.setAttribute('aria-label',textFor('적용: ','Apply: ')+p.platform+' '+presetName(p)+' '+p.w+' × '+p.h);
  label.append(makeNode('span',p.platform==='내 규격'?I18N[lang].sns_saved:p.platform,'sns-platform-name'),makeNode('strong',presetName(p)),makeNode('span',p.w+' × '+p.h+' px','sns-dimension'),makeNode('span',basisName(p.basis),'sns-basis'));
  label.addEventListener('click',()=>applyPreset(p));
  const add=makeNode('button',textFor('+ 목록','+ List'),'doc-btn sns-add');add.type='button';add.setAttribute('aria-label',textFor('목록에 추가: ','Add to list: ')+p.id);add.addEventListener('click',()=>addBatchTarget(p));card.append(label,add);
  if(p.basis==='custom'){const del=makeNode('button',textFor('삭제','Delete'),'sns-delete');del.type='button';del.setAttribute('aria-label',textFor('저장 규격 삭제: ','Delete saved size: ')+presetName(p));del.addEventListener('click',()=>{cancelBatch();customPresets=customPresets.filter(x=>x.id!==p.id);persistCustom();renderPresetCards();});card.append(del);}
  grid.appendChild(card);
 }
 $('snsCount').textContent=textFor('표시 ','Showing ')+filtered.length+' / '+allPresets().length;
 if(!filtered.length)grid.appendChild(makeNode('p',textFor('검색 결과가 없습니다. 직접 크기를 입력할 수 있습니다.','No matching presets. You can enter any dimensions.')));
}
function markFree(){activePreset=null;ratioLock=false;lockBtn.classList.remove('on');lockBtn.setAttribute('aria-checked','false');lockIcon.textContent='🔓';pctInput.value='';}
function applyPreset(p){
 cancelBatch();markFree();activePreset=p;wInput.value=p.w;hInput.value=p.h;
 renderPresetCards();scheduleRender();renderActiveInfo();
}
function renderActiveInfo(){
 const el=$('snsActiveInfo');el.replaceChildren();
 if(activePreset&&(Number(wInput.value)!==activePreset.w||Number(hInput.value)!==activePreset.h)){activePreset=null;renderPresetCards();}
 if(!activePreset){el.textContent=textFor('크기는 자유롭게 입력할 수 있습니다. 원본 비율 고정을 해제하면 너비·높이를 각각 지정합니다.','Enter any dimensions. Unlock the original aspect ratio to set width and height independently.');return;}
 el.appendChild(makeNode('strong',activePreset.platform+' · '+presetName(activePreset)+' · '+basisName(activePreset.basis)));
 const source=sourceFor(activePreset);if(activePreset.note)el.appendChild(makeNode('p',activePreset.note));
 if(source){const link=makeNode('a',textFor('규격 출처 보기','View source'));if(source.url){link.href=source.url;link.target='_blank';link.rel='noopener';el.appendChild(link);}else el.appendChild(makeNode('span',source.note));}
}
function persistCustom(){try{localStorage.setItem(customStorage,JSON.stringify(customPresets));return true;}catch{$('snsStorageStatus').textContent=textFor('브라우저 저장소를 사용할 수 없어 이번 화면에서만 유지합니다.','Browser storage is unavailable; saved sizes last for this session only.');return false;}}
function saveCustomSize(){
 const w=Number(wInput.value),h=Number(hInput.value),name=$('customSizeName').value.trim();
 if(!validDimensions(w,h)){status('dimensions',true);return;}
 if(!name||name.length>60){$('snsStorageStatus').textContent=textFor('규격 이름을 1~60자로 입력해 주세요.','Enter a size name of 1–60 characters.');return;}
 if(customPresets.length>=50){$('snsStorageStatus').textContent=textFor('내 규격은 최대 50개입니다. 필요 없는 항목을 삭제하세요.','You can save up to 50 sizes. Delete an unused size first.');return;}
 const id='custom-'+(crypto.randomUUID?.()||Date.now()+'-'+Math.random().toString(16).slice(2));
 const p={id,name,w,h};customPresets.push(p);const saved=persistCustom();$('customSizeName').value='';
 $('snsPlatform').value='내 규격';renderPresetCards();if(saved)$('snsStorageStatus').textContent=textFor('이 브라우저에 규격을 저장했습니다.','Size saved in this browser.');
}
function readCompositionSettings(){return {mode:'auto',x:.5,y:.5,transparent:$('transparentBg').checked,extendSourceBackground:$('extendSourceBackground').checked,resizeBehavior:'background-only',background:$('backgroundColor').value,type:fmtSelect.value,quality:Number(qInput.value)/100};}
function drawComposition(ctx,source,w,h,s){
 return globalThis.coexAutoResizePolicy.draw(ctx,source,w,h,s);
}
function renderCompositionNotice(){
 $('positionControls').hidden=true;$('backgroundColor').disabled=$('transparentBg').checked;
 $('compositionNotice').textContent=globalThis.coexLastOutputDecision?globalThis.coexAutoResizePolicy.describe(globalThis.coexLastOutputDecision):textFor('규격만 지정하세요. 보호 요소의 배치를 유지하고 확인된 배경만 조정합니다.','Choose dimensions. Reflow, proportions and background treatment are automatic.');renderActiveInfo();
}

function cancelBatch(){
 ++batchJob;
 if(batchBusy){batchBusy=false;$('batchStatus').textContent=textFor('설정이나 파일이 바뀌어 일괄 저장을 취소했습니다.','Batch export cancelled because the settings or file changed.');}
 const btn=$('batchDownloadBtn');if(btn)btn.disabled=!img||!batchTargets.length;
 $('batchCancelBtn').hidden=true;
}
function addBatchTarget(p){
 if(batchTargets.some(t=>t.id===p.id)){ $('batchStatus').textContent=textFor('이미 목록에 있습니다.','Already in the list.');return;}
 if(batchTargets.length>=12){$('batchStatus').textContent=textFor('한 번에 최대 12개 규격을 저장할 수 있습니다.','Export up to 12 sizes at a time.');return;}
 if(batchTargets.reduce((s,t)=>s+t.w*t.h,0)+p.w*p.h>120000000){$('batchStatus').textContent=textFor('선택 규격의 합계는 1억 2천만 픽셀 이하여야 합니다.','Selected sizes must total no more than 120 million pixels.');return;}
 cancelBatch();batchTargets.push({...p});$('batchStatus').textContent='';renderBatchList();
}
function renderBatchList(){
 const list=$('batchList');list.replaceChildren();
 for(const [index,p] of batchTargets.entries()){
  const item=makeNode('li');item.appendChild(makeNode('span',presetName(p)+' · '+p.w+' × '+p.h));
  const remove=makeNode('button',textFor('삭제','Remove'),'sns-delete');remove.type='button';remove.setAttribute('aria-label',textFor('목록에서 삭제: ','Remove from list: ')+p.id);remove.addEventListener('click',()=>{cancelBatch();batchTargets.splice(index,1);renderBatchList();});item.appendChild(remove);list.appendChild(item);
 }
 $('batchEmpty').hidden=!!batchTargets.length;$('batchCount').textContent=batchTargets.length+' / 12';$('batchDownloadBtn').disabled=batchBusy||!img||!batchTargets.length;
}
function uploadWarnings(p,blob){
 const result=[];
 if(p.formats&&!p.formats.includes(blob.type))result.push(textFor('이 지면의 허용 형식과 다릅니다. PNG/JPG 등 출처의 형식을 확인하세요.','This format differs from the placement specification. Check the allowed file types.'));
 if(p.maxBytes&&blob.size>=p.maxBytes)result.push(textFor('출처의 파일 용량 기준 이상입니다. 품질 또는 크기를 낮추세요.','File size meets/exceeds this source limit. Reduce quality or dimensions.'));
 if(p.safeArea?.mode==='advisory')result.push(textFor('스토리 중요 내용은 위아래 각 250px를 피해야 합니다. 현재 안전영역은 안내 기준이며 출력 이미지를 직접 확인하세요.','Keep critical Story content outside the top and bottom 250px. The safe area is advisory; review the exported artwork.'));
 if(p.minBytes&&blob.size<p.minBytes)result.push(textFor('출처의 최소 용량보다 작습니다.','File is below this source’s minimum size.'));
 if(p.recommendedBytes&&blob.size>p.recommendedBytes)result.push(textFor('출처의 권장 용량보다 큽니다.','File exceeds the source’s recommended size.'));
 return result;
}
function showOutputCompatibility(){
 const el=$('snsOutputWarnings');el.textContent=activePreset&&lastBlob?uploadWarnings(activePreset,lastBlob).join(' '):'';el.hidden=!el.textContent;
}
async function encodeTarget(source,p,s){
 const canvas=document.createElement('canvas');canvas.width=p.w;canvas.height=p.h;
 try{const ctx=canvas.getContext('2d');if(!ctx)throw Error('context');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';const automaticDecision=drawComposition(ctx,source,p.w,p.h,s);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,s.type,s.type==='image/png'?undefined:s.quality));
  if(!blob||blob.type!==s.type)throw Error('encode');globalThis.coexAutoResizePolicy.record(blob,automaticDecision);return blob;
 }finally{canvas.width=canvas.height=0;}
}
function cleanFilename(name,ascii=false){const cleaned=name.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').replace(/\.+$/,'').slice(0,70);return (ascii?cleaned.replace(/[^a-zA-Z0-9_-]/g,'_'):cleaned)||'image';}
function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
async function exportBatch(){
 if(batchBusy||!img||!batchTargets.length)return;
 if(typeof JSZip==='undefined'){$('batchStatus').textContent=textFor('ZIP 라이브러리를 불러오지 못했습니다. 새로고침해 주세요.','ZIP library is unavailable. Reload the page.');return;}
 const token=++batchJob,sourceName=origName,settings=readCompositionSettings(),targets=batchTargets.map(p=>({...p,name:typeof p.name==='object'?{...p.name}:p.name}));
 let source=img,frozenCanvas=null;
 const zip=new JSZip(),manifest={checkedAt:snsData.checkedAt,source:sourceName,settings,scope:'current-image-or-selected-document-page',outputs:[]};
 batchBusy=true;$('batchDownloadBtn').disabled=true;$('batchCancelBtn').hidden=false;let bytes=0;
 try{
  // Freeze formats that may animate. JPEG/BMP stay on the same direct-image
  // decoding and scaling path as preview and individual downloads.
  if(source instanceof HTMLImageElement&&!['image/jpeg','image/bmp'].includes(source.dataset.coexRasterType)){frozenCanvas=document.createElement('canvas');frozenCanvas.width=source.naturalWidth;frozenCanvas.height=source.naturalHeight;const ctx=frozenCanvas.getContext('2d');if(!ctx)throw Error('context');ctx.drawImage(source,0,0);globalThis.coexAutoResizePolicy.inherit(source,frozenCanvas);source=frozenCanvas;}
  for(let i=0;i<targets.length;i++){
   if(token!==batchJob)return;
   const p=targets[i];$('batchStatus').textContent=textFor('변환 중 ','Converting ')+(i+1)+' / '+targets.length;
   const blob=await encodeTarget(source,p,settings);if(token!==batchJob)return;bytes+=blob.size;if(bytes>96*1024*1024)throw Error('size');
   const rawStem=String(i+1).padStart(2,'0')+'_'+cleanFilename(sourceName)+'_'+cleanFilename(p.id,true)+'_'+p.w+'x'+p.h;
   const name=(p.asciiFilename?(rawStem.replace(/[^a-zA-Z0-9]/g,'')||'image'):rawStem)+'.'+extOf(blob.type);
   const buffer=await blob.arrayBuffer();if(token!==batchJob)return;zip.file(name,buffer);
   manifest.outputs.push({automaticDecision:globalThis.coexAutoResizePolicy.get(blob)||null,file:name,platform:p.platform||'custom',name:presetName(p),width:p.w,height:p.h,bytes:blob.size,type:blob.type,basis:p.basis||'custom',source:sourceFor(p)||null,safeArea:p.safeArea||null,note:p.note||'',warnings:uploadWarnings(p,blob)});
  }
  zip.file('sizes-and-sources.json',JSON.stringify(manifest,null,2));$('batchStatus').textContent=textFor('ZIP 파일을 만드는 중…','Building ZIP…');
  const blob=await zip.generateAsync({type:'blob',compression:'STORE'});if(token!==batchJob)return;
  downloadBlob(blob,cleanFilename(sourceName)+'_sns_sizes.zip');
  const warn=manifest.outputs.filter(x=>x.warnings.length).length;
  $('batchStatus').textContent=targets.length+textFor('개 규격을 ZIP으로 저장했습니다.',' sizes saved as ZIP.')+(warn?' '+textFor('형식·용량·규격 확인이 필요한 ','Check format, size or source requirements for ')+warn+textFor('개 항목은 ZIP의 sizes-and-sources.json에 기록했습니다.',' outputs in sizes-and-sources.json.'):'');
 }catch{if(token===batchJob)$('batchStatus').textContent=textFor('일괄 저장에 실패했습니다. 규격 수·크기·품질을 낮추고 다시 시도하세요.','Batch export failed. Try fewer/smaller sizes or lower quality.');}
 finally{if(frozenCanvas)frozenCanvas.width=frozenCanvas.height=0;if(token===batchJob){batchBusy=false;$('batchDownloadBtn').disabled=!img||!batchTargets.length;$('batchCancelBtn').hidden=true;}}
}
function renderSources(){
 const list=$('snsSourceList');list.replaceChildren();
 for(const source of Object.values(snsData.sources)){
  const item=makeNode('li');if(source.url){const link=makeNode('a',source.name);link.href=source.url;link.target='_blank';link.rel='noopener';item.appendChild(link);}else item.appendChild(makeNode('strong',source.name));
  item.appendChild(makeNode('p',source.note));list.appendChild(item);
 }
}
function refreshSnsLanguage(){
 $('snsSearch').placeholder=textFor('예: 스토리, 배너, 1080','e.g. Story, banner, 1080');
 $('snsPlatform').options[0].textContent=textFor('전체 플랫폼','All platforms');$('snsPlatform').querySelector('[value="내 규격"]').textContent=I18N[lang].sns_saved;
 renderPresetCards();renderBatchList();renderCompositionNotice();showOutputCompatibility();
}
const originalApplyI18n=applyI18n;
applyI18n=function(){originalApplyI18n();refreshSnsLanguage();};
for(const platform of [...new Set(snsData.presets.map(p=>p.platform)),'내 규격']){const option=makeNode('option',platform);option.value=platform;$('snsPlatform').appendChild(option);}
$('snsPlatform').value='담당자 규격';
$('snsPlatform').addEventListener('change',renderPresetCards);$('snsSearch').addEventListener('input',renderPresetCards);
$('saveCustomSize').addEventListener('click',saveCustomSize);
$('freeSizeBtn').addEventListener('click',()=>{markFree();renderPresetCards();renderActiveInfo();showOutputCompatibility();wInput.focus();});
for(const field of [wInput,hInput])field.addEventListener('input',()=>{activePreset=null;renderPresetCards();renderActiveInfo();showOutputCompatibility();},{capture:true});
$('addCurrentSize').addEventListener('click',()=>{const w=Number(wInput.value),h=Number(hInput.value);if(!validDimensions(w,h)){status('dimensions',true);return;}addBatchTarget(activePreset||{id:'manual-'+w+'x'+h,name:textFor('자유 크기','Custom size'),platform:'custom',w,h,basis:'custom'});});
for(const id of ['fitMode','positionX','positionY','transparentBg','backgroundColor','extendSourceBackground'])$(id).addEventListener(['fitMode','transparentBg','extendSourceBackground'].includes(id)?'change':'input',()=>{if(id==='transparentBg'&&$('transparentBg').checked)$('extendSourceBackground').checked=false;renderCompositionNotice();scheduleRender();});
$('backgroundCandidatesOpen').addEventListener('click',()=>{const panel=$('photoDesign');if(panel){panel.scrollIntoView({behavior:'smooth',block:'start'});$('photoDesignSource')?.focus();}});
$('centerPosition').addEventListener('click',()=>{$('positionX').value=$('positionY').value='50';renderCompositionNotice();scheduleRender();});
$('batchDownloadBtn').addEventListener('click',exportBatch);$('batchCancelBtn').addEventListener('click',()=>{cancelBatch();$('batchStatus').textContent=textFor('일괄 저장을 취소했습니다.','Batch export cancelled.');});
$('batchClearBtn').addEventListener('click',()=>{cancelBatch();batchTargets=[];renderBatchList();$('batchStatus').textContent='';});
renderSources();applyI18n();
