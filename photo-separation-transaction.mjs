// Stage candidate layers only for snapshot preparation, restore the live scene
// during asynchronous work, then atomically publish if the source still matches.
export async function applyPhotoSeparation({canvas,object:o,state,F,background,foreground,original,group,backgroundInpainted=false,guard,isCurrent,api}){
 if(!canvas||!o||!state||!F?.FabricImage||!api||!background||!foreground||!/^data:image\/png;base64,/.test(original||'')||typeof group!=='string'||!group||!state.objects.includes(o)||canvas.getObjects().indexOf(o)<0||canvas.size()+2>200||!guard||typeof isCurrent!=='function')throw Error('사진 또는 편집 상태가 바뀌었습니다.');
 const transforms=Object.fromEntries(['originX','originY','left','top','scaleX','scaleY','angle','skewX','skewY','flipX','flipY','opacity'].map(k=>[k,o[k]]));
 const created=[background,foreground].map((el,i)=>new F.FabricImage(el,{...transforms,strokeWidth:0,objectCaching:false,layerName:i?'상품·전경 · AI 추정':backgroundInpainted?'추정 배경 · 검토 필요':'남은 배경 · 가려진 영역 투명',layerRole:i?'subject':'other',layerRoleInferred:false,layerLocked:false,sourceElementId:(o.sourceElementId||'photo')+':photo-part:'+i,sourceElementType:'picture',cutoutMethod:i?'photo-ai-estimated-part':backgroundInpainted?'photo-ai-estimated-inpaint':'photo-ai-residual-background',perPixelTargetFind:true,photoInstanceGroup:group,photoInstanceKind:i?'part':'background',photoInstanceCrop:{x:0,y:0,w:o.width,h:o.height}}));
 const keys=['visible','layerLocked','photoInstanceGroup','photoInstanceKind','photoInstanceWasLocked','photoInstanceWasVisible','originalPhotoSource','originalPhotoCutoutMethod'];
 const previous=keys.map(k=>({key:k,has:Object.hasOwn(o,k),value:o[k]}));
 const decision={policy:'background-only-v1',sourceEpoch:state.epoch,width:state.width,height:state.height,inputKind:state.inputKind||'layered',path:'background-only',method:'photo-separation',status:'review',reason:'사진 전경과 추정 배경을 확인하세요.',backgroundScope:'분리된 배경의 가려진 영역과 경계를 확인하세요.',crop:'none',stretch:false};const expected={epoch:state.epoch,revision:state.revision,decision};let staged=false,prepared,committed=false;
 const stage=()=>{o.photoInstanceGroup=group;o.photoInstanceKind='source';o.photoInstanceWasLocked=!!o.layerLocked;o.photoInstanceWasVisible=o.visible!==false;o.originalPhotoSource=original;o.originalPhotoCutoutMethod=o.cutoutMethod||'';o.visible=false;o.layerLocked=true;const at=canvas.getObjects().indexOf(o);if(at<0)throw Error('사진이 변경되어 분리를 취소했습니다.');staged=true;created.forEach((part,i)=>canvas.insertAt(at+1+i,part));canvas.setActiveObject(created[1]);};
 const unstage=()=>{if(!staged)return;for(const part of created)canvas.remove(part);for(const p of previous)if(p.has)o[p.key]=p.value;else delete o[p.key];canvas.setActiveObject(o);staged=false;canvas.requestRenderAll();};
 try{
  if(!isCurrent()||!api.matchesAtomicLiveGuard(guard))throw Error('사진이나 편집 상태가 바뀌었습니다.');
  let preparing;try{stage();api.validateCompositeProject();preparing=api.prepareAtomicSnapshot(state.width,state.height,expected);}finally{unstage();}
  prepared=await preparing;
  if(!isCurrent()||!api.matchesAtomicLiveGuard(guard))throw Error('사진이나 편집 상태가 바뀌어 분리를 취소했습니다.');
  stage();api.commitAtomic(state.width,state.height,expected,prepared);committed=true;return created;
 }catch(error){
  if(!committed){unstage();if(prepared)globalThis.coexDiscardLayerSnapshotAtomic?.(prepared);for(const part of created)part.dispose?.();}
  throw error;
 }
}
