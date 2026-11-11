// A failed/paused split is still a valid original-preserving resize input.
// Keep one complete raster object; never describe it as editable text/assets.
let ticket=0;
window.addEventListener('coex:layer-unavailable',async e=>{
 const source=globalThis.getLayerAnalysisSource?.();
 if(!source||e.detail?.key!==source.key||globalThis.coexLayerLayout?.read()?.sourceKey===source.key)return;
 const job=++ticket,same=()=>job===ticket&&globalThis.getLayerAnalysisSource?.()?.key===source.key;
 try{
  const w=source.source.naturalWidth||source.source.width,h=source.source.naturalHeight||source.source.height;
  if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w>12000||h>12000||w*h>24000000)return;
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;canvas.getContext('2d').drawImage(source.source,0,0,w,h);
  const src=canvas.toDataURL('image/png');canvas.width=canvas.height=1;
  const doc={format:'coex-layer-project',version:1,width:w,height:h,name:source.name,scene:{version:'7.4.0',objects:[{type:'Image',version:'7.4.0',originX:'left',originY:'top',left:0,top:0,width:w,height:h,scaleX:1,scaleY:1,src,visible:true,layerRole:'other',layerName:'원본 전체 · 분리 미확인'}]}};
  const file=new File([JSON.stringify(doc)],'preserved-original.json',{type:'application/json'});
  if(file.size>48*1024*1024||!same())return;
  const loaded=await globalThis.layerFileImport(file,{origin:'auto',sourceKey:source.key,beforeCommit:same});
  if(!loaded||!same())return;
  const status=document.getElementById('autoStatus');if(status)status.textContent='원본 전체를 한 장으로 보존했습니다. 원본 구성 유지 시안을 만들 수 있습니다. 글씨·상품의 개별 재배치는 분리 확인이 필요합니다.';
  const panel=document.getElementById('autoLayerPanel');if(panel){panel.dataset.completedKey=source.key;panel.dataset.sourceEngine='preserved-raster';}
 }catch{ /* The normal image resize remains available; no speculative split. */ }
});
