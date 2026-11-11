import {composeReflow} from './responsive-layout.mjs';
import {inferRoles,validLayoutSize} from './layout-engine.mjs';
const $=id=>document.getElementById(id),api=()=>globalThis.coexLayerLayout;
const attrs=['visible','autoOmitted','left','top','scaleX','scaleY','angle','originX','originY','flipX','flipY','width','height','fontSize','textAlign','layerRole','styles'];
const nativeText=o=>['text','textbox','itext'].includes(String(o.type).toLowerCase());
const describe=s=>s.objects.map((o,id)=>{const b=o.getBoundingRect();return{id,x:b.left,y:b.top,w:Math.max(.001,b.width),h:Math.max(.001,b.height),kind:nativeText(o)?'text':String(o.type).toLowerCase()==='image'?'image':'shape',role:o.layerRole||'other',text:nativeText(o)?o.text:(o.sourceText||''),name:o.layerName||'',sourceGroup:o.sourceElementId,locked:!!o.layerLocked,hidden:!o.visible};});
const capture=s=>({epoch:s.epoch,revision:s.revision,width:s.width,height:s.height,objects:s.objects.map(object=>({object,values:Object.fromEntries(attrs.map(k=>[k,k==='styles'?structuredClone(object[k]):object[k]]))}))});
const restore=s=>{for(const {object,values}of s.objects){object.set({...values,styles:structuredClone(values.styles)});object.setCoords();}};
const matching=(base,s)=>base&&base.epoch===s.epoch&&base.objects.length===s.objects.length&&base.objects.every((e,i)=>e.object===s.objects[i]);
let baseline=null,expectedRevision=-1,committing=false,lastDesign=null;
function baseFor(s){if(!matching(baseline,s)||expectedRevision!==s.revision){baseline=capture(s);expectedRevision=s.revision;}return baseline;}
function adapted(design){return !design?null:{...design,imageSide:design.artSide||design.imageSide,variant:design.variant||(design.weights?.subject>design.weights?.title?'visual':'editorial'),titleScale:Math.max(.85,Math.min(1.5,(design.weights?.title||.23)/.23))};}
function protectBackgrounds(s,plan,w,h){
 if(!$('preserveWholeSource')?.checked)return;
 for(const id of plan.backgrounds){const o=s.objects[id];if(String(o.type).toLowerCase()!=='image')continue;const b=o.getBoundingRect(),scale=Math.min(w/b.width,h/b.height),center=o.getCenterPoint(),left=(w-b.width*scale)/2,top=(h-b.height*scale)/2;o.set({scaleX:o.scaleX*scale,scaleY:o.scaleY*scale});o.setPositionByOrigin(new s.F.Point(left+(center.x-b.left)*scale,top+(center.y-b.top)*scale),'center','center');o.setCoords();}
}
function compose(s,base,w,h,design){
 const ranks={optional:0,normal:1,high:2,keep:3},groups=new Map();restore(base);
 for(const o of s.objects)if(o.autoOmitted)o.set({visible:true,autoOmitted:false});
 const source={...s,width:base.width,height:base.height},items=describe(source),roles=inferRoles(items,base.width,base.height);
 for(const e of items){const key=e.sourceGroup||('single:'+e.id);if(!groups.has(key))groups.set(key,[]);groups.get(key).push({id:e.id,rank:ranks[s.objects[e.id].layerPriority]??3,protected:e.hidden||e.locked||roles.get(e.id)==='background'});}
 const candidates=[...groups.values()].filter(g=>g.every(e=>!e.protected&&e.rank<3)).sort((a,b)=>Math.max(...a.map(e=>e.rank))-Math.max(...b.map(e=>e.rank))),omitted=new Set();
 const enabled=$('allowPriorityOmit')?.checked,minText=Math.max(8,Math.min(72,Number($('priorityMinText')?.value)||12));
 for(let attempt=0;attempt<=Math.min(60,candidates.length);attempt++){
  restore(base);for(const o of s.objects)if(o.autoOmitted)o.set({visible:true,autoOmitted:false});for(const id of omitted)s.objects[id].set({visible:false,autoOmitted:true});
  try{
   const plan=composeReflow(source,w,h,adapted(design));protectBackgrounds(source,plan,w,h);
   const tooSmall=s.objects.some(o=>o.visible&&(nativeText(o)?o.text&&o.fontSize*Math.abs(o.scaleY||1)<minText:o.sourceText&&o.getBoundingRect().height/Math.max(1,o.sourceText.split(/\n/).length)<minText));
   if(enabled&&tooSmall)throw Error('필수 글씨가 최소 크기보다 작습니다. 더 큰 규격을 선택하거나 생략 가능한 요소의 우선순위를 조정하세요.');
   return {...plan,omitted:[...omitted]};
  }catch(error){if(!enabled||attempt>=candidates.length||attempt>=60)throw error;for(const e of candidates[attempt])omitted.add(e.id);}
 }
}
globalThis.coexAiLayout={
 get busy(){return committing;},
 read(){const s=api()?.read();return s?{epoch:s.epoch,revision:s.revision,width:s.width,height:s.height,items:describe(s)}:null;},
 apply(w,h,design=null){
  const s=api()?.read();if(!s||!validLayoutSize(w,h))return false;const original=capture(s),base=baseFor(s);
  committing=true;try{const plan=compose(s,base,w,h,design),next=api().commit(w,h,{epoch:s.epoch,revision:s.revision,apply:true});expectedRevision=next.revision;lastDesign=design;$('layerWidth').value=w;$('layerHeight').value=h;globalThis.setLock?.(false);$('reflowStatus').textContent=w+' × '+h+'px · 잘림·겹침 검사 통과'+(plan.omitted.length?' · 생략: '+plan.omitted.map(id=>s.objects[id].layerName||('요소 '+id)).join(', '):'');return true;}
  catch(error){restore(original);api().refresh();$('reflowStatus').textContent=error.message;return false;}finally{committing=false;}
 },
 preview(w,h,design){
  const s=api()?.read();if(!s||!validLayoutSize(w,h))throw Error('편집할 요소와 출력 크기를 확인해 주세요.');const original=capture(s),base=baseFor(s);let full,small;
  try{const plan=compose(s,base,w,h,design);full=api().snapshot(w,h);small=document.createElement('canvas');const scale=Math.min(1,600/Math.max(w,h));small.width=Math.max(1,Math.round(w*scale));small.height=Math.max(1,Math.round(h*scale));small.getContext('2d').drawImage(full,0,0,small.width,small.height);return{image:small.toDataURL('image/png'),omitted:plan.omitted.map(id=>s.objects[id].layerName||('요소 '+id))};}
  finally{if(full)full.width=full.height=0;if(small)small.width=small.height=0;restore(original);api().refresh();}
 }
};
const priority=document.createElement('div');priority.className='priority-tools';priority.innerHTML='<label><input id="allowPriorityOmit" type="checkbox"> 공간 부족 시 낮은 우선순위부터 생략 허용</label><label>최소 글자 <input id="priorityMinText" type="number" min="8" max="72" value="12"> px</label>';$('reflowStatus').before(priority);
// Keep the existing reflow behavior until the user explicitly enables omission.
$('reflowApply').addEventListener('click',e=>{if(!$('allowPriorityOmit').checked)return;e.stopImmediatePropagation();globalThis.coexAiLayout.apply(Number($('layerWidth').value),Number($('layerHeight').value));},true);
for(const id of ['layerPreset','reflowRatio'])$(id).addEventListener('change',e=>{if(!$('allowPriorityOmit').checked||!$(id).value)return;e.stopImmediatePropagation();const [w,h]=$(id).value.split('x').map(Number);globalThis.coexAiLayout.apply(w,h);},true);
window.addEventListener('coex:layer-edit',()=>{if(!committing)lastDesign=null;});
window.addEventListener('coex:history-source',()=>{baseline=null;expectedRevision=-1;lastDesign=null;});
const encode=globalThis.encodeTarget;
globalThis.encodeTarget=async(source,p,settings)=>{
 if(globalThis.coexAutoResizePolicy)return encode(source,p,{...settings,mode:'auto'});
 const s=api()?.read();if(!s?.linked||!globalThis.isLayerOutputSource?.(source))return encode(source,p,settings);
 if(p.w===s.width&&p.h===s.height){const current=api().snapshot(s.width,s.height);try{return await encode(current,p,{...settings,mode:'contain'});}finally{current.width=current.height=0;}}
 if(!lastDesign&&!$('allowPriorityOmit')?.checked)return encode(source,p,settings);
 const original=capture(s),base=baseFor(s);let image;
 try{compose(s,base,p.w,p.h,lastDesign);image=api().snapshot(p.w,p.h);}finally{restore(original);api().refresh();}
 try{return await encode(image,p,{...settings,mode:'contain'});}finally{if(image)image.width=image.height=0;}
};
