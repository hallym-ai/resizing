import {outsideSourceChanged} from './outside-recovery.mjs';
// Independent scratch: no claim that an attempted patch is visually seamless.
const reasons=new Set(['unsupported','limit','off-slide','ambiguous','other']);
const keys=(o,k)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===k.length&&k.every(x=>Object.hasOwn(o,x));
export function validateOutsideReport(report){
 if(report==null)return null;
 if(!keys(report,['version','records','omitted'])||report.version!==1||!Array.isArray(report.records)||report.records.length>200||!Number.isInteger(report.omitted)||report.omitted<0||report.omitted>10000)throw Error('바깥 요소 확인 기록이 올바르지 않습니다.');
 for(const r of report.records){if(!keys(r,['id','name','candidate','reason'])||typeof r.id!=='string'||!r.id||r.id.length>120||typeof r.name!=='string'||r.name.length>170||typeof r.candidate!=='boolean'||(r.candidate?r.reason!=='':!reasons.has(r.reason)))throw Error('바깥 요소 확인 기록이 올바르지 않습니다.');}
 return report;
}
export function outsideItems(report,objects){
 validateOutsideReport(report);if(!report)return [];
 return report.records.map(r=>{const matches=objects.filter(x=>String(x.sourceElementId||'')===r.id),o=matches[0];let status;
  if(!r.candidate)status=r.reason==='limit'?'보류 · 분석 한도':r.reason==='off-slide'?'보류 · 원본 밖 요소':r.reason==='ambiguous'?'보류 · 배경 또는 띠 확인':'보류 · 원본 형태 확인';
  else if(matches.length>1||report.records.filter(x=>x.id===r.id).length>1)status='보류 · 식별 중복';
  else if(!o)status='보류 · 요소 없음';
  else if(o.outsideRecoveryReview||o.__outsideReview||outsideSourceChanged(o))status='보류 · 원본 또는 효과 확인';
  else if(!o.trialOutsideRestore)status='보류 · 복원 정보 없음';
  else if(o.angle||o.flipX||o.flipY||o.skewX||o.skewY||o.group||o.clipPath||o.shadow||o.filters?.length||(o.globalCompositeOperation&&o.globalCompositeOperation!=='source-over'))status='보류 · 회전·효과 확인';
  else if(o.visible===false)status='보류 · 숨긴 요소';
  else if(o.__outsideTrialVisible&&o.__outsideRenderInstalled)status='연결 시도 · 결과 확인';
  else status='원본 유지 · 연결 대기';
  return {id:r.id,name:r.name||'요소',status};
 });
}
export function mountOutsideStatus(anchor,getReport,getState){
 const box=document.createElement('details');box.id='outsideRecoveryStatus';box.hidden=true;box.setAttribute('aria-live','polite');
 const title=document.createElement('summary'),note=document.createElement('p'),list=document.createElement('ul');box.append(title,note,list);anchor.after(box);
 let pending=false,cleared=false;
 const render=()=>{pending=false;if(cleared)return;let report,state,items;try{report=getReport();state=getState();items=outsideItems(report,state?.objects||[])}catch{title.textContent='바깥 요소 기록 확인 필요';note.textContent='확인 기록을 읽지 못했습니다.';list.replaceChildren();box.hidden=false;return;}
  if(!report||(!items.length&&!report.omitted)){box.hidden=true;return;}
  const attempts=items.filter(x=>x.status.startsWith('연결 시도')).length,wait=items.filter(x=>x.status.startsWith('원본 유지')).length,held=items.length-attempts-wait;
  title.textContent=`바깥 요소 확인 · 연결 시도 ${attempts} · 보류 ${held} · 대기 ${wait}`;
  note.textContent='요소 사이의 상대 위치는 유지됩니다. 캔버스 바깥은 보이지 않을 수 있습니다. 연결 시도는 완전 복원을 뜻하지 않으니 잘림과 이음새를 확인해 주세요.'+(report.omitted?` 기록을 표시하지 못한 요소 ${report.omitted}개도 확인이 필요합니다.`:'');
  list.replaceChildren(...items.map(item=>{const li=document.createElement('li'),label=document.createElement('span'),button=document.createElement('button');label.textContent=`${item.name}: ${item.status} `;button.type='button';button.textContent='요소 선택';button.setAttribute('aria-label',`${item.name} 요소 선택`);const current=state?.objects?.filter(o=>String(o.sourceElementId||'')===item.id)||[];button.disabled=current.length!==1||!current[0].canvas||current[0].selectable===false;button.onclick=()=>{const matches=getState()?.objects?.filter(o=>String(o.sourceElementId||'')===item.id)||[];if(matches.length!==1||!matches[0].canvas||matches[0].selectable===false)return;const o=matches[0];o.canvas.discardActiveObject();o.canvas.setActiveObject(o);o.canvas.requestRenderAll();globalThis.coexLayerLayout?.focusEditing?.();};li.append(label,button);return li;}));box.hidden=false;
 };
 const request=()=>{cleared=false;if(!pending){pending=true;queueMicrotask(render);}};
 for(const event of ['coex:layer-edit','coex:history-change','coex:outside-recovery-change'])window.addEventListener(event,request);
 // Keep the committed document status while a new file is merely loading or cancelled.
 request();return {render:request};
}
