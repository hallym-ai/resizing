/* Decode in a terminable worker; no linked assets or composite bitmap. */
importScripts('./vendor/layers/ag-psd.js');
agPsd.initializeCanvas((w,h)=>new OffscreenCanvas(w,h),(w,h)=>new ImageData(w,h));
self.onmessage=({data:buffer})=>{
 try{
  const h=new DataView(buffer);
  if(buffer.byteLength<26||h.getUint32(0)!==0x38425053||h.getUint16(4)!==1)throw Error('PSD 형식의 파일을 선택해 주세요. PSB는 지원하지 않습니다.');
  const height=h.getUint32(14),width=h.getUint32(18);
  if(!width||!height||width>12000||height>12000||width*height>24000000)throw Error('PSD 캔버스는 한 변 12,000px, 2,400만 픽셀 이하여야 합니다.');
  if(h.getUint16(22)!==8||h.getUint16(24)!==3)throw Error('Photoshop에서 RGB / 8비트 PSD로 저장한 뒤 사용해 주세요.');
  const psd=agPsd.readPsd(buffer,{useImageData:true,skipCompositeImageData:true,skipThumbnail:true,skipLinkedFilesData:true,totalMemoryLimit:256*1024*1024});
  const layers=[],warnings=new Set();let pixels=0,visited=0;
  const walk=(items,path='',opacity=1,visible=true,depth=0)=>{
   if(depth>24)throw Error('PSD 그룹 깊이는 24단계 이하여야 합니다.');
   for(const layer of items||[]){
    if(++visited>400)throw Error('PSD 레이어와 그룹은 합계 400개 이하여야 합니다.');
    const name=(path+(layer.name||'레이어')).slice(0,200),alpha=opacity*(layer.opacity??1),shown=visible&&!layer.hidden;
    if(layer.mask||layer.vectorMask||layer.effects||layer.clipping||layer.adjustment||!['normal','pass through',undefined].includes(layer.blendMode))warnings.add('마스크·클리핑·조정·블렌딩·레이어 효과는 재현하지 않습니다.');
    if(layer.children){walk(layer.children,name+' / ',alpha,shown,depth+1);continue;}
    const image=layer.imageData;
    if(!image?.width||!image?.height){warnings.add('픽셀 미리보기가 없는 레이어는 제외했습니다.');continue;}
    if(image.width>12000||image.height>12000||image.width*image.height>24000000)throw Error('개별 PSD 레이어는 한 변 12,000px, 2,400만 픽셀 이하여야 합니다.');
    pixels+=image.width*image.height;
    if(layers.length>=200||pixels>64000000)throw Error('PSD는 픽셀 레이어 200개, 레이어 픽셀 합계 6,400만까지 지원합니다.');
    layers.push({name,left:layer.left||0,top:layer.top||0,width:image.width,height:image.height,opacity:alpha,visible:shown,rgba:image.data,sourceText:layer.text?.text?.slice(0,20000)||''});
   }
  };
  walk(psd.children);
  if(!layers.length)throw Error('분리된 픽셀 레이어가 없습니다. 레이어를 유지한 PSD를 사용해 주세요.');
  const transfers=layers.map(x=>x.rgba.buffer);
  self.postMessage({width,height,layers,warnings:[...warnings]},transfers);
 }catch(e){self.postMessage({error:e.message||'PSD를 읽지 못했습니다.'});}
};
