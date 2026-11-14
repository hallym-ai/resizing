// Only objects created by this live resize session are removable by the
// temporary scene transaction. Serialized JSON cannot grant this authority.
export function createPartialPatchManager(){
 const managed=new WeakSet(),initial=new WeakMap();
 const signature=o=>{try{return typeof o.toObject==='function'?JSON.stringify(o.toObject(['layerName','layerRole','layerLocked','cutoutMethod','sourceElementId'])):JSON.stringify(o);}catch{return null;}};
 const mark=o=>{managed.add(o);initial.set(o,{element:o.getElement?.(),signature:signature(o)});return o;};
 const isManaged=o=>managed.has(o);
 const relinquish=objects=>{for(const o of objects||[])managed.delete(o);};
 // Revoke only untouched generated patches after a user edit. If the user
 // unlocked or changed a patch, preserve it as an ordinary editable layer.
 function revokeAfterEdit(objects){
  let removed=0,preserved=0;
  for(const o of [...objects||[]])if(managed.has(o)){
   const before=initial.get(o),same=before&&before.signature!==null&&before.signature===signature(o)&&before.element===o.getElement?.();
   managed.delete(o);initial.delete(o);
   if(same&&o.canvas){o.canvas.remove(o);o.dispose?.();removed++;}else preserved++;
  }
  return {removed,preserved};
 }
 const sameMembers=(saved,live)=>{
  const a=saved.filter(o=>!managed.has(o)),b=live.filter(o=>!managed.has(o));
  return a.length===b.length&&new Set(a).size===a.length&&a.every(o=>b.includes(o));
 };
 // A target scene may differ only in these trusted patches. Never remove a
 // user's object while restoring an async resize trial or a batch render.
 function reconcile(canvas,saved){
  if(!canvas||!Array.isArray(saved)||!sameMembers(saved,canvas.getObjects()))throw Error('편집 요소가 바뀌어 배경 연결을 중지했습니다.');
  const live=[...canvas.getObjects()];
  for(const o of live)if(managed.has(o)&&!saved.includes(o))canvas.remove(o);
  for(let i=0;i<saved.length;i++)if(managed.has(saved[i])&&!canvas.getObjects().includes(saved[i]))canvas.insertAt(i,saved[i]);
  if(canvas.getObjects().length!==saved.length||!saved.every(o=>canvas.getObjects().includes(o)))throw Error('배경 연결 상태를 복원하지 못했습니다.');
  saved.forEach((o,i)=>canvas.moveObjectTo(o,i));
 }
 return {mark,isManaged,relinquish,revokeAfterEdit,sameMembers,reconcile};
}
