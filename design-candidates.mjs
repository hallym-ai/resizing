import './preserved-source.mjs';
import {mountResizeSystem,analyzeSourceDesign,publishSourceProfile,invalidateSourceProfile,auditDesignCandidate} from './resize-system.mjs';
import {styleSettings,automaticFont,systemFonts,composition,decorate,brandBackplates} from './design-styles.mjs';
import {composeReflow,captureDesignSemantics,capturePreservedDesignSource,composePreservedDesign} from './responsive-layout.mjs';
import {inferRoles,validLayoutSize} from './layout-engine.mjs';
import {parseBrief,palette,readable,accessible} from './design-brief.mjs';
const $=id=>document.getElementById(id),api=()=>globalThis.coexLayerLayout;
const section=document.createElement('section');section.id='designCandidates';section.className='design-candidates';
section.innerHTML=`<h3>규격에 맞춰 새로 디자인하기</h3><p>출력 규격을 바꾸면 그 크기에 맞춰 글씨·그림을 재배치한 후보가 자동으로 나옵니다. 원하는 분위기와 색상을 추가로 지정할 수 있습니다.</p>
<label for="designBrief">디자인 요청<textarea id="designBrief" maxlength="1000" placeholder="예: 배경은 네이비, 글씨는 흰색. 제목은 크게, 이미지는 오른쪽으로."></textarea></label>
<div class="design-settings"><label>색상 기준<select id="designTheme"><option value="faithful" selected>원본 디자인 유지 · 구성 1개 + 재배치 3개</option><option value="source">원본 구성 1개 + 색감 변형 3개</option><option value="varied">기본 색감 4개 비교</option><option value="brand">직접 선택한 포인트색</option><option value="original">원본 색상 유지</option><option value="navy">네이비</option><option value="warm">따뜻한 브라운</option><option value="mint">차분한 그린</option><option value="mono">모노톤</option></select></label><label>포인트색<input type="color" id="designPrimary" value="#3d6b5e"></label><label><span class="design-check"><input type="checkbox" id="designBackgroundUse">배경색 지정</span><input type="color" id="designBackground" value="#f7f1e5" aria-label="시안 배경색"></label><label><span class="design-check"><input type="checkbox" id="designForegroundUse">글자색 지정</span><input type="color" id="designForeground" value="#171a1c" aria-label="시안 글자색"></label><label class="design-check"><input id="designKeepLogo" type="checkbox" checked>원본 로고 색 유지</label><label class="design-check"><input id="designKeepBackground" type="checkbox">원본 배경 이미지 유지</label></div>
<details open><summary>글꼴·글자 크기·추가 자산</summary><p>직접 올린 사진과 로고는 편집기의 ‘+ 사진·그림 파일’, ‘+ 로고 파일’로 추가하세요. 추가한 자산도 시안에 포함합니다. 글꼴 파일은 프로젝트 JSON에 함께 저장됩니다.</p><div class="design-settings"><label>제목 글꼴<select id="designTitleFont"><option value="auto" selected>시안별 로컬 글꼴</option><option value="">원본 글꼴 유지</option></select></label><label>본문·안내 글꼴<select id="designBodyFont"><option value="auto" selected>시안별 로컬 글꼴</option><option value="">원본 글꼴 유지</option></select></label><label>제목 목표 크기(px)<input id="designTitleSize" type="number" min="6" max="2000" placeholder="규격에 맞게 자동"></label><label>본문 목표 크기(px)<input id="designBodySize" type="number" min="6" max="2000" placeholder="규격에 맞게 자동"></label></div><button id="designFontAdd" type="button" class="doc-btn">내 글꼴 파일 추가</button><input id="designFontFile" type="file" accept=".ttf,.otf,.woff,.woff2" hidden><p>목표 크기는 실제 글자 폭·줄바꿈·공간을 측정해 맞춥니다. 좁은 규격에서는 잘림을 피하도록 줄일 수 있습니다. 로고 내부 글꼴은 유지합니다. AI 생성 없이 브라우저에서 계산하며, 적용 전 원본은 바뀌지 않습니다.</p></details><details><summary>특정 요소 바꾸기</summary><div class="design-element"><label>변경할 요소<select id="designTarget"><option value="none">선택 안 함</option></select></label><label>변경 방식<select id="designAction"><option value="keep">입력한 요청에서 반영</option><option value="color">색상 변경</option><option value="hide">숨기기</option></select></label><label>요소 색상<input id="designElementColor" type="color" value="#c83436"></label><label>요소 변경 요청<input id="designElementBrief" maxlength="300" placeholder="예: 빨간색으로 변경 / 숨기기"></label></div></details>
<div class="design-actions"><button id="designGenerate" type="button" class="btn-primary">디자인 시안 4개 만들기</button><span id="designSize" class="layer-help"></span></div><p class="design-status" id="designStatus" role="status" aria-live="polite">원본을 열고 규격을 설정하면 시안을 만들 수 있습니다.</p><p class="design-note">입력한 요청 중 색상·제목 강조·이미지 좌우 위치·선택 요소 색상/숨기기를 반영합니다. 상품·로고·문구는 유지하고 색감·배경·글꼴·구도를 비교합니다. 로고·상품 위에 글자를 덮지 않도록 장식은 뒤에 배치합니다. 이미지형 글씨·표·차트 내부는 원본 상태이며 사진 배경 AI 확장은 실행하지 않습니다. 후보를 눌러 크게 보고 적용한 뒤 계속 편집할 수 있습니다.</p><div id="designResults" class="design-results" aria-label="디자인 시안 후보"></div>`;
$('reflowControls').after(section);mountResizeSystem(section);
const dialog=document.createElement('dialog');dialog.className='design-dialog';dialog.id='designDialog';dialog.innerHTML='<header><strong id="designDialogTitle"></strong><button id="designDialogClose" type="button" class="doc-btn">닫기</button></header><img id="designDialogImage" alt="선택한 디자인 시안 확대 미리보기">';document.body.append(dialog);$('designDialogClose').onclick=()=>dialog.close();dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
let job=0,busy=false,base=null,expected=null,candidates=[],applying=false,lastSignature='',targetSignature='';
const say=(text,error=false)=>{$('designStatus').textContent=text;$('designStatus').classList.toggle('error',error);};
const text=o=>['text','textbox','itext'].includes(String(o.type).toLowerCase()),image=o=>String(o.type).toLowerCase()==='image';
const signature=s=>s?`${s.epoch}:${s.revision}:${s.width}:${s.height}`:'none';
const fresh=()=>expected&&signature(api()?.read())===expected.signature;
function invalidate(message='원본·규격·요청이 바뀌었습니다. 시안을 다시 만들어 주세요.',clear=false){
 invalidateSourceProfile();++job;busy=false;expected=null;base=null;section.setAttribute('aria-busy','false');for(const b of section.querySelectorAll('[data-design-apply]'))b.disabled=true;if(candidates.length)say(message);$('designGenerate').disabled=!api()?.read();
 if(clear){candidates=[];$('designResults').replaceChildren();dialog.close();$('designDialogImage').removeAttribute('src');say('원본을 열고 원하는 디자인을 입력해 시안을 만들어 주세요.');}
}
function settings(){updateFontChoices();return{theme:$('designTheme').value,primary:$('designPrimary').value,background:$('designBackground').value,foreground:$('designForeground').value,useBackground:$('designBackgroundUse').checked,useForeground:$('designForegroundUse').checked,keepLogo:$('designKeepLogo').checked,keepBackground:$('designKeepBackground').checked,titleFont:$('designTitleFont').value,bodyFont:$('designBodyFont').value,titleSize:Number($('designTitleSize').value)||null,bodySize:Number($('designBodySize').value)||null,target:$('designTarget').value,action:$('designAction').value,elementColor:$('designElementColor').value};}
function describes(objects){return objects.map((o,id)=>{const b=o.getBoundingRect();return{id,x:b.left,y:b.top,w:b.width,h:b.height,role:o.layerRole,text:text(o)?o.text:o.sourceText||'',sourceGroup:o.sourceElementId,name:o.layerName,shapeType:String(o.type).toLowerCase(),hidden:!o.visible};});}
function paint(o,color){if(image(o))return false;if(o.getObjects){for(const child of o.getObjects())paint(child,color);}else if(text(o)){const styles=structuredClone(o.styles||{});for(const row of Object.values(styles))for(const st of Object.values(row))delete st.fill;o.set({fill:color,styles});}else{if(o.fill&&o.fill!=='transparent')o.set('fill',color);if(o.stroke)o.set('stroke',color);}o.set('objectCaching',false);return true;}
function cleanCache(o){o.set('objectCaching',false);o.getObjects?.().forEach(cleanCache);}
const variants=[{key:'preserved',name:'원본 구성 유지',description:'원본 글씨·색·요소의 상대 배치를 유지한 비율 맞춤',align:'center'},{key:'editorial',name:'제목 강조형',description:'글자에 비중을 두고 정렬선을 맞춘 구성',align:'left'},{key:'visual',name:'비주얼 강조형',description:'그림과 사진이 먼저 보이는 구성',align:'center'},{key:'minimal',name:'여백형',description:'여백을 넓히고 색상을 정돈한 구성',align:'left'}];
function selected(o,id,s){return s.target===`layer:${id}`||s.target==='title'&&o.layerRole==='title'||s.target==='details'&&o.layerRole==='details'||s.target==='shapes'&&!image(o)&&!text(o)&&o.layerRole!=='background'||s.target==='images'&&image(o)&&o.layerRole!=='background';}
async function build(doc,s,brief,variant,index,w,h,F){
 if(index===0){
  const source=doc.preservedSource||doc,objects=await F.util.enlivenObjects(source.scene.objects),indices=new Map(objects.map((o,i)=>[o,i]));
  try{objects.forEach(cleanCache);const plan=composePreservedDesign({objects,width:source.width,height:source.height,F},w,h),audit=auditDesignCandidate(objects,source,indices),profile=doc.sourceProfile;
   const background=(document.getElementById('extendSourceBackground')?.checked!==false?profile?.palette.background:null)||document.getElementById('backgroundColor')?.value||'#ffffff';
   if(document.getElementById('transparentBg')?.checked!==true)objects.unshift(new F.Rect({left:-1,top:-1,width:w+2,height:h+2,fill:background,layerName:'원본 리사이징 여백',layerRole:'background',layerLocked:true}));
   const warnings=['원본 구성·글꼴·색·문구를 유지하고 전체를 같은 비율로 확대·축소했습니다.'];
   if(objects.some(o=>o.visible&&text(o)&&o.fontSize*Math.abs(o.scaleY)<12))warnings.push('원본 전체를 유지해 일부 글씨가 작아질 수 있습니다.');
   return {objects,plan,audit,colors:{background,primary:profile?.palette.primary||'#303030'},warnings};
  }catch(error){objects.forEach(o=>o.dispose());throw error;}
 }
 if(['unseparated','review'].includes(doc.sourceProfile?.confidence))throw Error('조정 필요: 원본 요소 분리가 불확실해 원본 구성 유지 시안만 제공합니다.');
 s=styleSettings(s,index);
 await document.fonts.ready;
 let objects=await F.util.enlivenObjects(doc.scene.objects),result;const originalIndices=new Map(objects.map((o,i)=>[o,i]));
 try{
  objects=objects.filter(o=>{if(o.layerName?.startsWith('시안 장식 ·')||o.layerName==='시안 배경'){o.dispose();return false;}return true;});objects.forEach(cleanCache);
  const roles=inferRoles(describes(objects),doc.width,doc.height);objects.forEach((o,i)=>{const role=doc.designSemantics?.[originalIndices.get(o)]?.semanticRole||roles.get(i);if(['title','details','subject','logo','background'].includes(role))o.set('layerRole',role);});
  const logoFrames=objects.filter(o=>image(o)&&o.visible&&(o.layerRole==='logo'||['header','footer'].includes(doc.designSemantics?.[originalIndices.get(o)]?.semanticBand))).filter(o=>{const b=o.getBoundingRect();return b.width/b.height>1.8&&b.width/b.height<4;});
  const brandMembers=new Set(objects.filter(o=>o.layerRole==='logo'||text(o)&&logoFrames.some(frame=>{const b=frame.getBoundingRect(),p=o.getCenterPoint();return p.x>=b.left&&p.x<=b.left+b.width&&p.y>=b.top&&p.y<=b.top+b.height;})));
  const fonts=new Set([...systemFonts,...(doc.fonts||[]).map(f=>f.family)]);
  for(const family of [s.titleFont,s.bodyFont])if(family&&family!=='auto'&&!fonts.has(family))throw Error('선택한 글꼴이 현재 프로젝트에 없습니다. 글꼴 파일을 다시 추가하세요.');
  for(const o of objects)if(text(o)&&o.visible&&!brandMembers.has(o)&&!o.layerLocked){
   const requested=o.layerRole==='title'?s.titleFont:s.bodyFont;
   const family=requested==='auto'?automaticFont(index,o.layerRole==='title'):requested;
   if(family){await document.fonts.load(`16px "${family}"`,o.text||'Aa가');const styles=structuredClone(o.styles||{});for(const row of Object.values(styles))for(const st of Object.values(row))delete st.fontFamily;F.cache.clearFontCache(family);o.set({fontFamily:family,styles});
    if(o.layerRole==='title'&&!o.text.includes('\n')&&o.text.length<=80){
     o.set('width',Math.max(o.width,(o.fontSize||30)*Math.max(1,o.text.length)*3));o.initDimensions();
     o.set('width',Math.max(1,o.calcTextWidth()*1.03));
    }
    o.initDimensions();o.setCoords();}
  }
  const colors=palette(index,s,brief),warnings=[...brief.warnings,...(doc.sourceProfile?.warnings||[])],hiddenGroups=new Set(),hidden=new Set();let rasterColor=false;
  objects.forEach(o=>{if(!o.visible||o.layerRole==='background')return;const picked=selected(o,originalIndices.get(o),s),hide=picked&&(s.action==='hide'||s.action==='keep'&&brief.elementHide)||brief.hideShapes&&!image(o)&&!text(o);if(hide&&!o.layerLocked){hidden.add(o);if(o.sourceElementId)hiddenGroups.add(o.sourceElementId);}});
  for(const o of objects)if(hidden.has(o)||hiddenGroups.has(o.sourceElementId)){if(o.layerLocked)throw Error('숨기려는 원본 묶음에 잠긴 요소가 있습니다. 잠금을 해제하고 다시 만드세요.');o.set('visible',false);}
  if(s.theme!=='original'||brief.background||s.useBackground){
   if(!s.keepBackground){for(const o of objects)if(o.visible&&o.layerRole==='background')o.set('visible',false);objects.unshift(new F.Rect({left:0,top:0,width:w,height:h,fill:colors.background,layerName:'시안 배경',layerRole:'background',layerLocked:true}));}
   else warnings.push('원본 배경 이미지를 유지했습니다. 실제 배경 위의 글자 대비를 확인하세요.');
  }
  const filledGroups=new Map();for(const o of objects)if(o.visible&&!text(o)&&!image(o)&&o.sourceElementId&&o.layerRole!=='background')filledGroups.set(o.sourceElementId,o);
  // Selection ids refer to the original scene, not an inserted background.
  for(const o of [...objects].sort((a,b)=>Number(text(a))-Number(text(b)))){
   if(!o.visible||o.layerRole==='background')continue;if(o.layerLocked){warnings.push('잠긴 요소는 색상과 위치를 유지했습니다.');continue;}
   if(s.keepLogo&&brandMembers.has(o))continue;
   const originalIndex=originalIndices.get(o);
   const picked=selected(o,originalIndex,s),elementColor=picked&&(s.action==='color'?s.elementColor:s.action==='keep'?brief.elementColor:null);
   if(elementColor){if(!paint(o,elementColor))rasterColor=true;else if(text(o)){const groupFill=filledGroups.get(o.sourceElementId)?.fill,bg=typeof groupFill==='string'&&/^#[a-f0-9]{6}$/i.test(groupFill)?groupFill:colors.background;if(accessible(elementColor,bg)!==elementColor)warnings.push('선택한 글자색은 배경과 대비가 낮습니다. 적용 후 색상 대비를 확인하세요.');}continue;}
   const backgroundChanged=!!brief.background||s.useBackground;
   if(s.theme==='original'&&!brief.foreground&&!brief.titleColor&&!brief.shapeColor&&!s.useForeground&&!backgroundChanged)continue;
   if(text(o)){
    const onShape=filledGroups.has(o.sourceElementId),shapeFill=filledGroups.get(o.sourceElementId)?.fill,background=typeof shapeFill==='string'&&/^#[a-f0-9]{6}$/i.test(shapeFill)?shapeFill:colors.shape;
    if(s.theme==='original'&&!brief.foreground&&!s.useForeground&&!(o.layerRole==='title'&&brief.titleColor)&&!(onShape&&brief.shapeColor)){
     if(backgroundChanged&&!s.keepBackground){const bg=onShape?background:colors.background,toHex=v=>{try{return '#'+new F.Color(v).toHex();}catch{return null;}},original=toHex(o.fill),styles=structuredClone(o.styles||{});let changed=false;if(original){const next=accessible(original,bg);if(next!==original){o.set('fill',next);changed=true;}}for(const row of Object.values(styles))for(const st of Object.values(row))if(st.fill){const old=toHex(st.fill);if(old){const next=accessible(old,bg);if(next!==old){st.fill=next;changed=true;}}}if(changed){o.set('styles',styles);warnings.push('새 배경 위에서 원본 글자색의 대비가 낮아 읽기 좋게 조정했습니다.');}}
     continue;
    }
    const fill=onShape?accessible(brief.foreground||(s.useForeground?s.foreground:readable(background)),background):o.layerRole==='title'?colors.title:colors.foreground;paint(o,fill);
   }else if(!image(o)&&(s.theme!=='original'||brief.shapeColor))paint(o,colors.shape);
  }
  if(colors.adjusted)warnings.push('지정한 글자색의 대비가 낮아 읽기 좋은 색으로 조정했습니다.');if(rasterColor)warnings.push('선택한 요소는 이미지이므로 내부 색상을 바꾸지 않았습니다.');
  if(brief.elementColor&&s.target==='none'||brief.elementHide&&s.target==='none')warnings.push('요소 변경 요청을 반영하려면 변경할 요소를 선택하세요.');
  const design={adaptiveTypography:true,semanticSeed:objects.map(o=>doc.designSemantics?.[originalIndices.get(o)]||null),titleSize:s.titleSize,bodySize:s.bodySize,variant:variant.key,align:variant.align,titleScale:brief.titleScale*(variant.key==='editorial'?1.15:1),imageSide:brief.imageSide};
  let plan;
  const source=objects.map(o=>({o,left:o.left,top:o.top,width:o.width,height:o.height,scaleX:o.scaleX,scaleY:o.scaleY,textAlign:o.textAlign}));
  const profiles=[{variant:'measured',regionVariant:Math.max(0,index-1),id:'design-measured-'+index},{variant:'family',familyVariant:Math.max(0,index-1),id:'design-family-'+index},composition(index,w,h),...Array.from({length:4},(_,i)=>composition(i,w,h))];
  let failure;
  for(const jointLayout of profiles){for(const a of source){const {o,...v}=a;o.set(v);o.initDimensions?.();o.setCoords();}try{plan=composeReflow({objects,width:doc.width,height:doc.height,F},w,h,{...design,jointLayout});break;}catch(error){failure=error;}}
  if(!plan)throw failure;
  if(plan.candidate&&plan.candidate!==profiles[0].id)warnings.push('선호 구도가 좁아 실제 글자 크기를 통과한 대체 구도를 사용했습니다.');
  objects.forEach(o=>{const seed=doc.designSemantics?.[originalIndices.get(o)];if(seed)o.set('layerRole',seed.originalRole);});
  if(s.theme!=='original'&&!s.keepBackground){brandBackplates(objects,plan,w,h,colors,F);decorate(objects,w,h,index,colors,F);}
  const small=objects.filter(o=>o.visible&&text(o)&&o.fontSize*Math.abs(o.scaleY)<12).length;if(small)warnings.push(`12px보다 작은 글자 ${small}개가 있습니다. 확대해서 확인하세요.`);
  if(plan.paintOrder){const order=plan.paintOrder.map(id=>objects[id]),known=new Set(order);objects=[...order,...objects.filter(o=>!known.has(o))];}
  const audit=auditDesignCandidate(objects,doc,originalIndices);
  if(audit.hiddenWords.length)warnings.push('명시적으로 숨긴 문구 '+audit.hiddenWords.length+'개가 있습니다. 표시 내용을 확인하세요.');
  result={objects,plan,colors,audit,warnings:[...new Set([...warnings,...plan.warnings.map(w=>s.theme!=='original'&&!s.keepBackground&&w.startsWith('원본 단색 배경을')?'선택한 색감의 배경을 새 규격에 채웠습니다. 사진 AI는 실행하지 않았습니다.':w)])],hidden:objects.filter(o=>!o.visible&&o.layerRole!=='background').length};return result;
 }catch(error){objects.forEach(o=>o.dispose());throw error;}
}
function preview(objects,w,h,F){const scale=Math.min(1,900/Math.max(w,h)),c=new F.StaticCanvas(null,{width:Math.max(1,Math.round(w*scale)),height:Math.max(1,Math.round(h*scale)),enableRetinaScaling:false,renderOnAddRemove:false});try{c.setViewportTransform([scale,0,0,scale,0,0]);c.add(...objects);c.renderAll();return c.toDataURL({format:'png',multiplier:1});}finally{c.remove(...objects);c.dispose();}}
function drawCard(candidate){
 const card=document.createElement('article');card.className='design-card';card.dataset.variant=candidate.variant.key;card.dataset.width=String(candidate.w);card.dataset.height=String(candidate.h);
 const open=document.createElement('button');open.type='button';open.className='design-image-button';open.setAttribute('aria-label',candidate.variant.name+' 크게 보기');const img=new Image();img.src=candidate.preview;img.alt=candidate.variant.name+' 디자인 시안';open.append(img);open.onclick=()=>{$('designDialogTitle').textContent=candidate.variant.name+` · ${candidate.w} × ${candidate.h}`;$('designDialogImage').src=candidate.preview;dialog.showModal();};
 const info=document.createElement('div');info.className='design-card-info';const title=document.createElement('h4');title.textContent=candidate.variant.name+` · ${candidate.w} × ${candidate.h}px`;const detail=document.createElement('p');detail.textContent=(candidate.index===0?'원본 색상·글꼴 유지':styleSettings(candidate.settings,candidate.index).styleName)+' · '+candidate.variant.description;const swatches=document.createElement('div');swatches.className='design-swatches';for(const color of Object.values(candidate.colors).filter(v=>typeof v==='string')){const dot=document.createElement('span');dot.style.background=color;dot.title=color;swatches.append(dot);}
 const validation=document.createElement('p');validation.className='design-validation';validation.textContent=candidate.index===0?'원본 배치 보존 · 새 안전 영역·겹침 규칙 적용 제외 · 작은 글씨 확인 필요':candidate.validation?.geometry==='passed'?'좌표·글자 크기 측정 완료 · 원본 인식 장식 간격 검사 · 실제 가림·미관 확인 필요':'구도 준비 · 실제 가림·미관 확인 필요';
 const note=document.createElement('p');note.textContent=candidate.warnings.length?candidate.warnings.join(' '):'원문·에셋 보존 검사 완료. 실제 사용 크기에서 내용을 확인하세요.';const apply=document.createElement('button');apply.type='button';apply.className='doc-btn';apply.dataset.designApply='true';apply.textContent='이 시안 적용';apply.onclick=()=>void applyCandidate(candidate,card);
 info.append(title,detail,swatches,validation,note,apply);card.append(open,info);$('designResults').append(card);
}
async function applyCandidate(candidate,card){
 if(!fresh()){invalidate();return;}if(busy)return;busy=true;applying=true;section.setAttribute('aria-busy','true');$('designGenerate').disabled=true;for(const b of section.querySelectorAll('[data-design-apply]'))b.disabled=true;const before=expected,doc=base;let result;
 try{result=await build(doc,candidate.settings,candidate.brief,candidate.variant,candidate.index,candidate.w,candidate.h,api().read().F);if(!fresh()||expected!==before)throw Error('원본이 바뀌었습니다. 시안을 다시 만들어 주세요.');const state=api().applyDesign(result.objects,candidate.w,candidate.h,before);result=null;expected={epoch:state.epoch,revision:state.revision,signature:signature(state)};lastSignature=expected.signature;section.querySelectorAll('.design-card').forEach(c=>c.dataset.applied=String(c===card));say(candidate.variant.name+'을 적용했습니다. 글자·도형을 계속 편집할 수 있으며 실행 취소로 돌아갈 수 있습니다.');}
 catch(error){result?.objects.forEach(o=>o.dispose());say(error.message,true);}
 finally{busy=false;applying=false;section.setAttribute('aria-busy','false');$('designGenerate').disabled=!api()?.read();for(const b of section.querySelectorAll('[data-design-apply]'))b.disabled=!fresh();}
}
$('designGenerate').onclick=async()=>{
 if(busy)return;const state=api()?.read(),w=Number($('layerWidth').value),h=Number($('layerHeight').value);if(!state){say('먼저 원본의 요소 인식이 끝나거나 레이어 원본을 열어 주세요.',true);return;}if(!validLayoutSize(w,h)){say('너비·높이를 확인하세요. 한 변 12,000px, 전체 2,400만 픽셀까지 지원합니다.',true);return;}
 const ticket=++job,s=settings();if([s.titleSize,s.bodySize].some(n=>n!==null&&(!Number.isFinite(n)||n<6||n>2000))){say('목표 글자 크기는 6~2,000px 또는 자동으로 지정하세요.',true);return;}const brief=parseBrief($('designBrief').value,$('designElementBrief').value);base=globalThis.coexLayerHistory.capture();state.objects.forEach((o,i)=>{for(const key of ['left','top','width','height','scaleX','scaleY','angle','skewX','skewY'])if(Number.isFinite(o[key]))base.scene.objects[i][key]=o[key];});base.designSemantics=captureDesignSemantics();base.preservedSource=capturePreservedDesignSource(base,state);expected={epoch:state.epoch,revision:state.revision,signature:signature(state)};busy=true;candidates=[];$('designResults').replaceChildren();$('designGenerate').disabled=true;section.setAttribute('aria-busy','true');const failures=[];
 try{say('원본 색감·글자·보호 대상을 분석하는 중…');const profile=await analyzeSourceDesign(state,base,base.designSemantics,s);if(ticket!==job||!fresh())return;base.sourceProfile=profile;s.sourceProfile=profile;publishSourceProfile(profile);for(let i=0;i<variants.length;i++){if(ticket!==job||!fresh())return;say(`${i+1} / 4 · ${variants[i].name}을 만들고 잘림·겹침을 검사하는 중…`);await new Promise(r=>setTimeout(r,0));let result;try{result=await build(base,s,brief,variants[i],i,w,h,state.F);if(ticket!==job||!fresh())return;const candidate={variant:variants[i],index:i,settings:s,brief,w,h,preview:preview(result.objects,w,h,state.F),colors:result.colors,audit:result.audit,layout:result.plan.candidate,validation:result.plan.validation||{status:'needs_review',geometry:'not_run',aesthetic:'not_run',note:i===0?'원본 전체 균등 배율. 새 안전 영역·겹침 규칙 적용 제외.':'자동 가독성·미관 확인 필요.'},warnings:result.warnings};candidates.push(candidate);drawCard(candidate);}catch(error){failures.push(variants[i].name+': '+error.message);}finally{result?.objects.forEach(o=>o.dispose());}}
  if(ticket!==job)return;profile.designs=candidates.map(c=>({index:c.index,layout:c.layout,colors:c.colors,audit:c.audit,validation:c.validation,paletteProvenance:c.index===0?{origin:'source-preserved',method:'uniform-fit'}:styleSettings(c.settings,c.index).paletteProvenance||{origin:c.settings.theme==='original'?'source-preserved':'preset-or-user'}}));const labels=[...brief.labels,brief.elementColor?'선택 요소 색상 변경':'',brief.elementHide?'선택 요소 숨김':''].filter(Boolean);say(candidates.length?`${w} × ${h} · ${candidates.length}개 후보를 준비했습니다. 현재 편집본은 유지됩니다.${labels.length?' 반영: '+labels.join(' · ')+'.':''}${failures.length?' 적용할 수 없는 후보: '+failures.join(' '):''}`:'안전하게 배치할 후보를 만들지 못했습니다. '+failures.join(' '),!candidates.length);
 }catch(error){say('시안을 만들지 못했습니다. '+error.message,true);}finally{if(ticket===job){busy=false;$('designGenerate').disabled=!api()?.read();section.setAttribute('aria-busy','false');}}
};
let fontSignature='';
function updateFontChoices(){
 const fonts=globalThis.coexProjectAssets?.fonts()||[],sig=JSON.stringify(fonts);if(sig===fontSignature)return;fontSignature=sig;
 for(const id of ['designTitleFont','designBodyFont']){const select=$(id),previous=select.value;select.replaceChildren(new Option('시안별 로컬 글꼴','auto'),new Option('원본 글꼴 유지',''));systemFonts.forEach(f=>select.add(new Option(f,f)));fonts.forEach(f=>select.add(new Option(f.name,f.family)));if(previous===''||previous==='auto'||systemFonts.includes(previous)||fonts.some(f=>f.family===previous))select.value=previous;}
}
$('designFontAdd').onclick=()=>$('designFontFile').click();
$('designFontFile').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;$('designFontAdd').disabled=true;try{const family=await globalThis.coexProjectAssets.addFont(file);updateFontChoices();$('designTitleFont').value=family;say('글꼴을 추가했습니다. 제목·본문 적용 범위를 선택하고 시안을 만들어 비교하세요.');}catch(error){say('글꼴 추가 실패: '+error.message,true);}finally{$('designFontAdd').disabled=false;}};
function updateTargets(state){const select=$('designTarget'),previous=select.value;select.replaceChildren();for(const [value,label]of [['none','선택 안 함'],['title','제목 전체'],['details','날짜·장소 전체'],['shapes','도형 전체'],['images','그림·사진 전체']]){const o=new Option(label,value);select.add(o);}state?.objects.forEach((o,i)=>{if(o.visible&&o.layerRole!=='background')select.add(new Option(`${i+1}. ${o.layerName||o.text||o.type}`.slice(0,100),`layer:${i}`));});if([...select.options].some(o=>o.value===previous))select.value=previous;}
for(const control of section.querySelectorAll('input,textarea,select'))control.addEventListener('input',()=>invalidate('디자인 요청이 바뀌었습니다. 시안을 다시 만들어 주세요.'));
for(const id of ['layerWidth','layerHeight','wInput','hInput','reflowCustomX','reflowCustomY'])$(id)?.addEventListener('input',()=>invalidate('출력 규격이 바뀌었습니다. 시안을 다시 만들어 주세요.'));
for(const name of ['coex:layer-source','coex:layer-edit','coex:history-source'])window.addEventListener(name,()=>{if(!applying)queueMicrotask(()=>{if(!applying){invalidate(undefined,name!=='coex:layer-edit');lastSignature=signature(api()?.read());updateTargets(api()?.read());}});});
const timer=setInterval(()=>{updateFontChoices();const s=api()?.read(),sig=signature(s);if(sig!==lastSignature&&!applying){if(expected&&sig!==expected.signature)invalidate();lastSignature=sig;}const ts=s?`${s.epoch}:${s.objects.length}`:'none';if(ts!==targetSignature&&!busy){updateTargets(s);targetSignature=ts;}$('designSize').textContent=s?`출력 ${$('layerWidth').value} × ${$('layerHeight').value}px`:'';if(!busy)$('designGenerate').disabled=!s;},300);
window.addEventListener('pagehide',e=>{if(!e.persisted){++job;clearInterval(timer);dialog.remove();}});
