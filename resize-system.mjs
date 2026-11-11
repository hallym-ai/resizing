import {analyzeSourceDesign,informationKinds} from './source-design.mjs';
export {analyzeSourceDesign};
// Connected = the actual code path exists, not that every document is supported.
export const resizeCapabilities=[
 {role:'레이어 편집·동일 장면 출력',name:'Fabric.js',license:'MIT',status:'connected',url:'https://github.com/fabricjs/fabric.js',scope:'편집 가능한 텍스트·도형·이미지 및 PNG/JPG/WebP/SVG 출력'},
 {role:'PSD 레이어 입력',name:'ag-psd',license:'MIT',status:'connected',url:'https://github.com/Agamnentzar/ag-psd',scope:'픽셀 레이어 보존. PSD 글자는 자동 편집 텍스트 복원이 아님'},
 {role:'PPTX 객체 입력',name:'pptx-renderer',license:'Apache-2.0 + bundled notices',status:'connected',url:'https://github.com/aiden0z/pptx-renderer',scope:'OOXML·일반 글자/그림 객체. 일부 복잡한 객체는 이미지'},
 {role:'PDF 페이지 입력',name:'PDF.js',license:'Apache-2.0',status:'connected',url:'https://github.com/mozilla/pdf.js',scope:'현재 연결은 페이지 렌더링. 모든 PDF를 원본 편집 객체로 복원하지 않음'},
 {role:'이미지형 글씨 인식',name:'Tesseract.js',license:'Apache-2.0',status:'connected',url:'https://github.com/naptha/tesseract.js',scope:'기존 로컬 OCR 경로. 인식 결과·영역 확인 필요'},
 {role:'대표색 추출',name:'RgbQuant.js 1.1.2',license:'MIT',status:'connected',url:'https://github.com/leeoniya/RgbQuant.js',scope:'192px 샘플의 팔레트만 분석. 원본 픽셀은 변경하지 않음'},
 {role:'원본 색감 변형',name:'Culori 4.0.2',license:'MIT + retained component notice',status:'connected',url:'https://github.com/Evercoder/culori',scope:'OKLCH 색상 파생. 실제 사진 위 대비는 별도 검토'},
 {role:'의미 그룹·비율별 구도',name:'기존 관계 엔진 + Yoga',license:'project code / MIT',status:'connected',url:'https://github.com/facebook/yoga',scope:'관계 엔진이 의미 그룹·구도를 결정, Yoga는 기존 일반 배치 계산. AI 의미 이해 엔진은 아님'},
 {role:'업로드 글꼴 검사',name:'OpenType.js 2.0.0 + FontFace',license:'MIT + retained bundled notices',status:'connected',url:'https://github.com/opentypejs/opentype.js',scope:'지원되는 업로드 글꼴의 실제 사용 문자 cmap 검사. 시스템 글꼴·미지원 형식은 미확인'},
 {role:'자산 보호·검증',name:'기존 보호 검사 + 브라우저 렌더링',license:'project code',status:'connected',url:'./resize-system.mjs',scope:'원문·필수 정보·원본 이미지·종횡비·잘림 검사. 보편적인 미관 평가 아님'},
 {role:'여러 규격 ZIP 저장',name:'JSZip',license:'MIT OR GPL-3.0 (MIT path)',status:'connected',url:'https://github.com/Stuk/jszip',scope:'기존 일괄 출력 경로. 목표별 조정 필요 상태는 별도 확인'},
 {role:'사진 초점·크롭',name:'smartcrop.js',license:'MIT',status:'reference',url:'https://github.com/jwagner/smartcrop.js',scope:'조사만 완료. 상품·로고 자르기를 허용하지 않아 자동 크롭 미연결'},
 {role:'사진 배경 분리',name:'BiRefNet / ONNX 기존 선택 경로',license:'각 코드·고정 모델 고지 별도',status:'paused',url:'https://github.com/ZhengPeng7/BiRefNet',scope:'AI 보류. 이 시스템은 모델 다운로드·추론을 시작하지 않음'},
 {role:'사진 배경 생성·확장',name:'Diffusers / 기존 로컬 인페인트',license:'Apache-2.0 code; weights separate',status:'paused',url:'https://github.com/huggingface/diffusers',scope:'AI 보류. 단색·벡터 배경과 구분. 자연 사진 확장 완료 아님'}
];
const $=id=>document.getElementById(id);
let current=null,stale=true;
export function mountResizeSystem(section){
 const box=document.createElement('details');box.id='resizeSystem';box.open=true;
 const summary=document.createElement('summary');summary.textContent='원본 분석과 지원 범위';
 const status=document.createElement('p');status.id='sourceDesignSummary';status.setAttribute('role','status');status.textContent='시안을 만들면 원본의 색감·글자·보호 대상·분리 상태를 분석합니다.';
 const colors=document.createElement('div');colors.id='sourceDesignPalette';colors.className='design-swatches';
 const warnings=document.createElement('p');warnings.id='sourceDesignWarnings';
 const save=document.createElement('button');save.id='sourceDesignSave';save.type='button';save.className='doc-btn';save.textContent='분석·오픈소스 내역 저장';save.disabled=true;save.onclick=()=>{if(!current||stale)return;const blob=new Blob([JSON.stringify({profile:current,capabilities:resizeCapabilities},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='resize-analysis.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 const support=document.createElement('details'),heading=document.createElement('summary');heading.textContent='역할별 오픈소스 · 연결 / 참고 / AI 보류';support.append(heading);const scope=document.createElement('p');scope.textContent='연결됨은 해당 코드 경로가 있다는 뜻입니다. 모든 입력·규격의 품질 통과를 뜻하지 않습니다. 자동 역할·분리 상태는 추정이며 정확도 수치가 아닙니다.';support.append(scope);
 const table=document.createElement('table');table.style.cssText='width:100%;font-size:.75rem;text-align:left;border-spacing:6px';
 for(const row of resizeCapabilities){const tr=document.createElement('tr');for(const val of [row.role,row.name,({connected:'연결됨',reference:'조사·미연결',paused:'AI 보류'})[row.status],row.license]){const td=document.createElement('td');td.textContent=val;tr.append(td);}const td=document.createElement('td'),link=document.createElement('a');link.href=row.url;link.target='_blank';link.rel='noopener';link.textContent='출처';td.append(link,document.createElement('br'),document.createTextNode(row.scope));tr.append(td);table.append(tr);}support.append(table);const scroll=document.createElement('div');scroll.style.overflowX='auto';scroll.append(support);box.append(summary,status,colors,warnings,save,scroll);section.querySelector('h3').after(box);
 globalThis.coexResizeSystem={capabilities:resizeCapabilities,get profile(){return stale?null:current;},get stale(){return stale;}};
}
export function invalidateSourceProfile(){stale=true;if($('sourceDesignSave'))$('sourceDesignSave').disabled=true;if(current)$('sourceDesignSummary').textContent='원본·요청이 바뀌었습니다. 시안을 다시 만들면 분석을 갱신합니다.';}
export function publishSourceProfile(profile){
 current=profile;stale=false;$('sourceDesignSave').disabled=false;
 const label={native:'편집 텍스트 중심',mixed:'일부 편집 텍스트', 'separated-raster':'분리된 이미지형 글자',review:'분리 확인 필요',unseparated:'독립 요소 확인 필요'}[profile.confidence];
 $('sourceDesignSummary').textContent=`${label} · 편집 글자 ${profile.counts.nativeText} · 이미지형 글자 ${profile.counts.rasterText} · 그림 ${profile.counts.images} · 필수 정보 ${profile.elements.filter(e=>e.information.length).length}개 블록. 자동 역할은 아래 ‘자동 재배치 묶음 수정’에서 수정할 수 있습니다.`;
 const palette=$('sourceDesignPalette');palette.replaceChildren();for(const c of profile.palette.colors.slice(0,8)){const dot=document.createElement('span');dot.style.background=c.color;dot.title=c.color;palette.append(dot);} $('sourceDesignWarnings').textContent=profile.warnings.join(' ');
}
export function auditDesignCandidate(objects,doc,indices){
 const original=doc.scene.objects,failures=[],hiddenWords=[],seen=new Set(),visited=new Set();let texts=0,images=0;
 const protectedTree=source=>source.visible!==false&&(typeof source.text==='string'||['logo','subject'].includes(source.layerRole)||String(source.type).toLowerCase()==='image'&&source.layerRole!=='decoration'||source.objects?.some(protectedTree));
 const effectiveSource=(source,id)=>({...source,layerRole:source.layoutManualRole||doc.designSemantics?.[id]?.semanticRole||source.layerRole});
 const visit=(o,source,parentVisible=true,originalParentVisible=true)=>{
  if(visited.has(o)){failures.push('원본 요소 중복');return;}visited.add(o);
  const visible=parentVisible&&o.visible!==false,expectedVisible=originalParentVisible&&source.visible!==false;
  if(typeof source.text==='string'){texts++;if(o.text!==source.text)failures.push('원문 변경');if(expectedVisible&&!visible){if(informationKinds(source.text).length)failures.push('가격·날짜·연락처·시간 정보 숨김');else hiddenWords.push(source.text);}}
  if(expectedVisible&&['logo','subject'].includes(source.layerRole)&&!visible)failures.push('상품·로고 숨김');
  if(String(source.type).toLowerCase()==='image'){images++;if(o.getSrc?.()!==source.src)failures.push('이미지 원본 변경');if(expectedVisible&&source.layerRole!=='decoration'&&!visible)failures.push('상품·로고 숨김');if(expectedVisible&&visible&&Math.abs(o.scaleX/o.scaleY-(source.scaleX??1)/(source.scaleY??1))>1e-6)failures.push('이미지 비율 변경');}
  if(Array.isArray(source.objects)){const children=o.getObjects?.()||[];if(children.length!==source.objects.length)failures.push('원본 묶음 요소 누락');source.objects.forEach((child,i)=>{if(children[i])visit(children[i],child,visible,expectedVisible);});}
 };
 for(const o of objects){const id=indices.get(o),source=original[id];if(!source||source.layerRole==='background'||source.layerName?.startsWith('시안 장식 ·'))continue;if(seen.has(id)){failures.push('원본 요소 중복');continue;}seen.add(id);visit(o,effectiveSource(source,id));
 }
 original.forEach((source,id)=>{if(source.layerRole!=='background'&&!source.layerName?.startsWith('시안 장식 ·')&&source.layerName!=='시안 배경'&&protectedTree(effectiveSource(source,id))&&!seen.has(id))failures.push('원본 필수 요소 누락');});
 if(failures.length)throw Error('보호 검사: '+[...new Set(failures)].join(' · '));
 return {texts,images,hiddenWords,sourceAssets:'protected-assets-preserved',wording:hiddenWords.length?'content-preserved-but-hidden':'preserved'};
}
