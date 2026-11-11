import {removePhotoBackground,showPhotoResult,markPhotoResult} from './photo-ai.mjs';
export function looksLikePhoto(canvas){
 const {width:w,height:h}=canvas,data=canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,w,h).data,colors=new Set();let n=0,transparent=0;
 const step=Math.max(1,Math.floor(w*h/4096));for(let p=0;p<w*h;p+=step){n++;if(data[p*4+3]<240){transparent++;continue;}colors.add((data[p*4]>>4)*256+(data[p*4+1]>>4)*16+(data[p*4+2]>>4));}
 return transparent/Math.max(1,n)<.1&&colors.size>96;
}
export async function processPhotoSource({source,image,signal,textMixed,current,onProgress}){
 const result=await removePhotoBackground(image,{signal,onProgress});
 try{
  result.stats.sourceWidth=source.source.naturalWidth||source.source.width;result.stats.sourceHeight=source.source.naturalHeight||source.source.height;
  if(!current()||signal.aborted)throw new DOMException('Cancelled','AbortError');
  await showPhotoResult(result,source.name,{textMixed,signal});if(!current())throw new DOMException('Cancelled','AbortError');
  if(textMixed)return{...result.stats,imported:false};
  const b=result.bounds,c=document.createElement('canvas');c.width=b.w;c.height=b.h;c.getContext('2d').drawImage(result.canvas,b.x,b.y,b.w,b.h,0,0,b.w,b.h);
  const w=image.width,h=image.height,ref={type:'Image',version:'7.4.0',originX:'left',originY:'top',left:0,top:0,width:w,height:h,scaleX:1,scaleY:1,opacity:1,visible:false,src:image.toDataURL('image/png'),layerName:'사진 원본 비교용 · 숨김',layerRole:'background',layerLocked:true,crossOrigin:null,filters:[]};
  const foreground={...ref,left:b.x,top:b.y,width:b.w,height:b.h,visible:true,src:c.toDataURL('image/png'),layerName:'AI 사진 전경 · 추정',layerRole:'subject',layerLocked:false,cutoutMethod:'birefnet-photo'};c.width=c.height=0;
  const doc={format:'coex-layer-project',version:1,width:w,height:h,analysis:{...result.stats},scene:{version:'7.4.0',objects:[ref,{type:'Rect',version:'7.4.0',left:0,top:0,width:w,height:h,fill:'transparent',layerName:'투명 배경',layerRole:'background',layerLocked:true},foreground]}};
  const blob=new Blob([JSON.stringify(doc)],{type:'application/json'});if(blob.size>48*1024*1024)throw Error('사진 AI 레이어 용량이 너무 큽니다.');
  const imported=await globalThis.layerFileImport(new File([blob],source.name+'.json',{type:'application/json'}),{origin:'auto',sourceKey:source.key,signal,beforeCommit:current});if(!current())throw new DOMException('Cancelled','AbortError');if(!imported)throw Error('사진 AI 전경 레이어를 열지 못했습니다.');return{...result.stats,imported:true};
 }catch(error){if(current()&&!signal.aborted)markPhotoResult('전경 PNG는 준비했으나 레이어를 열지 못했습니다. PNG를 다운로드하거나 원본 리사이징을 사용하세요.');throw error;}finally{result.canvas.width=result.canvas.height=0;}
}
