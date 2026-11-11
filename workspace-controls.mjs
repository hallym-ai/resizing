import './layers.mjs';
const RELEASE='protected-background-20261018-2',PRODUCTION='https://coex-image-resize-20261017.shrewd-tapir-9956.chatgpt.site';
const $=id=>document.getElementById(id),bar=document.createElement('nav');
bar.className='workspace-controls';bar.setAttribute('aria-label','작업 및 게시 확인');
bar.innerHTML=`<div class="workspace-buttons"><button id="workspaceBack" type="button">← 뒤로 가기</button><button id="workspaceResume" type="button" hidden>편집 계속</button><button id="workspaceUndo" type="button" disabled>↶ 실행 취소</button><button id="workspaceRedo" type="button" disabled>↷ 다시 실행</button><button id="workspaceReset" type="button">초기화</button></div><div class="workspace-release"><span id="workspaceRelease" role="status">실행 버전 확인 중…</span><button id="workspaceCheck" type="button">업데이트 확인</button></div><p id="workspaceStatus" role="status" aria-live="polite"></p>`;
document.querySelector('main').prepend(bar);
const api=()=>globalThis.coexLayerHistory;
let entries=[],cursor=-1,busy=false,source=0,backState=null;
const notice=text=>$('workspaceStatus').textContent=text;
function buttons(){ $('workspaceUndo').disabled=busy||cursor<=0;$('workspaceRedo').disabled=busy||cursor<0||cursor>=entries.length-1; }
function capture(fresh=false){
 const doc=api()?.capture();
 if(fresh){++source;entries=[];cursor=-1;backState=null;$('workspaceResume').hidden=true;}
 if(!doc||$('layerToggle').hidden){buttons();return;}
 const json=JSON.stringify(doc);
 if(entries[cursor]===json){buttons();return;}
 entries=entries.slice(0,cursor+1);entries.push(json);
 // Bound retained serialized history; a large current scene remains usable without history.
 let bytes=entries.reduce((n,s)=>n+s.length*2,0);
 while(entries.length>1&&(entries.length>20||bytes>48*1024*1024))bytes-=entries.shift().length*2;
 cursor=entries.length-1;buttons();
}
window.addEventListener('coex:history-source',()=>capture(true));
window.addEventListener('coex:history-change',()=>{if(!busy)capture();});
async function travel(delta){
 if(busy||cursor+delta<0||cursor+delta>=entries.length)return;
 const ticket=source,target=cursor+delta;busy=true;buttons();
 try{if(await api().restore(JSON.parse(entries[target]))&&ticket===source){cursor=target;notice(delta<0?'이전 편집으로 되돌렸습니다.':'편집을 다시 적용했습니다.');}}
 catch{notice('편집을 복원하지 못했습니다. 현재 작업을 확인해 주세요.');}
 finally{busy=false;buttons();}
}
$('workspaceUndo').onclick=()=>travel(-1);$('workspaceRedo').onclick=()=>travel(1);
$('workspaceBack').onclick=()=>{
 if(backState&&$('layerWork').hidden&&!$('editor').classList.contains('show')){$('dropzone').focus();return;}
 window.dispatchEvent(new Event('coex:layer-source'));api().pause();globalThis.pauseWorkspaceLoad?.();globalThis.cancelBatch?.();
 backState={layer:!$('layerWork').hidden,raster:$('editor').classList.contains('show')};
 $('layerWork').hidden=true;$('editor').classList.remove('show');$('dropzone').style.display='';
 $('workspaceResume').hidden=!(backState.layer||backState.raster);$('dropzone').focus();
 notice('파일 선택 화면입니다. 현재 작업은 보존했습니다. 편집 계속을 누르면 돌아갑니다.');
};
$('workspaceResume').onclick=()=>{
 if(!backState)return;if(backState.layer&&$('layerWork').hidden)$('layerToggle').click();
 if(backState.raster){$('editor').classList.add('show');$('dropzone').style.display='none';}
 backState=null;$('workspaceResume').hidden=true;notice('보존한 편집을 계속합니다.');
};
$('resetBtn').addEventListener('click',()=>{
 api().clear();$('batchClearBtn')?.click();$('freeSizeBtn')?.click();globalThis.clearPhotoAIResult?.();$('dropzone').focus();
 backState=null;$('workspaceResume').hidden=true;notice('파일·요소·편집 기록을 초기화했습니다. 새 파일을 선택하세요.');
});
$('workspaceReset').onclick=()=>$('resetBtn').click();
async function check(){
 const button=$('workspaceCheck');button.disabled=true;
 try{
  const response=await fetch(new URL('./release-info.json',import.meta.url),{cache:'no-store'});if(!response.ok)throw Error();
  const info=await response.json();const online=location.origin===PRODUCTION;
  $('workspaceRelease').textContent=info.release===RELEASE?`${online?'온라인 실행 확인':'로컬 실행'} · ${RELEASE}`:`현재 ${RELEASE} · 새 버전 ${String(info.release).slice(0,80)} (새로고침 필요)`;
 }catch{$('workspaceRelease').textContent=`실행 ${RELEASE} · 서버 버전 확인 실패`;}
 finally{button.disabled=false;}
}
$('workspaceCheck').onclick=check;void check();
