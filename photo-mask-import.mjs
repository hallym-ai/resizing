// Import an explicitly supplied alpha mask; never infer, upload or recreate a photo.
import './layers.mjs';
const by=id=>document.getElementById(id),api=()=>globalThis.coexLayerLayout;
const panel=document.createElement('details');panel.id='photoMaskPanel';panel.innerHTML=`<summary>사진 분리 PNG 적용</summary><p class="layer-help">분리한 PNG를 불러오면 같은 사진인지 확인한 뒤 투명도만 적용합니다. 사진은 먼저 요소 목록에서 선택하세요. 글씨·로고는 그대로 유지되며, 가려진 배경을 복원하지 않습니다.</p><div class="layer-tools"><button type="button" class="doc-btn" id="photoMaskOpen">분리 PNG 불러오기</button><button type="button" class="doc-btn" id="photoMaskSaveSource">선택 사진 PNG 저장</button><button type="button" class="doc-btn" id="photoMaskRestore">선택 사진 원본 복원</button></div><input type="file" id="photoMaskFile" accept="image/png,.png" hidden><p id="photoMaskStatus" class="layer-help" role="status" aria-live="polite">이 기능은 준비된 분리 결과를 적용합니다. AI 모델을 실행하지 않습니다.</p><img id="photoMaskPreview" alt="분리 PNG 확인" hidden style="max-width:100%;max-height:180px;object-fit:contain;background:repeating-conic-gradient(#ddd 0 25%,#fff 0 50%) 0/16px 16px"><button type="button" id="photoMaskApply" class="doc-btn" hidden>확인 후 이 사진에 적용</button>`;
by('layerProps').before(panel);
const shortcut=document.createElement('button');shortcut.type='button';shortcut.className='doc-btn';shortcut.id='photoMaskShortcut';shortcut.textContent='분리 PNG 적용';by('layerImageAdd').after(shortcut);
let pending=null,ticket=0;
const say=t=>by('photoMaskStatus').textContent=t;
const image=o=>String(o?.type).toLowerCase()==='image'&&o.visible!==false&&!o.layerLocked&&o.layerRole!=='background'&&!o.sourceText;
function selected(){const s=api()?.read();if(!s)return null;const active=s.objects.find(o=>o.canvas)?.canvas?.getActiveObject();return image(active)?active:null;}
function clear(){++ticket;pending=null;by('photoMaskApply').hidden=true;by('photoMaskPreview').hidden=true;by('photoMaskPreview').removeAttribute('src');by('photoMaskFile').value='';}
function valid(s,o,revision){const now=api()?.read();return now&&now.epoch===s.epoch&&now.revision===revision&&now.objects.includes(o);}
async function decode(src){const im=new Image();im.src=src;await im.decode();return im;}
const raster=(element,w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d',{willReadFrequently:true}).drawImage(element,0,0,w,h);return c;};
function source(o){return /^data:image\/(png|jpeg|webp);base64,/.test(o.originalPhotoSource||'')?decode(o.originalPhotoSource):Promise.resolve(o.getElement());}
function download(src,name){const a=document.createElement('a');a.href=src;a.download=name;a.click();}
by('photoMaskSaveSource').onclick=async()=>{const o=selected();if(!o){say('먼저 사진 요소 한 개를 선택하세요.');return;}try{const el=await source(o),c=raster(el,el.naturalWidth||el.width,el.naturalHeight||el.height);download(c.toDataURL('image/png'),'선택사진-분리입력.png');c.width=c.height=0;}catch(e){say(e.message);}};
by('photoMaskOpen').onclick=shortcut.onclick=()=>{panel.open=true;by('photoMaskFile').click();};
by('photoMaskFile').onchange=async()=>{
 const file=by('photoMaskFile').files[0];clear();if(!file)return;panel.open=true;const token=ticket,s=api()?.read(),o=selected();
 if(!s||!o){say('먼저 사진 요소 한 개를 선택한 뒤 분리 PNG를 불러오세요.');return;}
 if(file.size>30*1024*1024){say('분리 PNG는 30MB 이내로 준비하세요.');return;}
 let url=null,c=null,original=null;
 try{
  say('원본 사진과 분리 PNG를 확인하고 있습니다…');url=URL.createObjectURL(file);const mask=await decode(url),el=await source(o),w=el.naturalWidth||el.width,h=el.naturalHeight||el.height;
  if(mask.naturalWidth!==w||mask.naturalHeight!==h)throw Error('사진 크기가 다릅니다. 선택 사진 PNG 저장으로 받은 이미지와 동일한 '+w+' × '+h+' px 분리 결과를 사용하세요. 임의로 늘리지 않습니다.');
  if(w*h>4000000||o.cropX||o.cropY||o.clipPath)throw Error('이 사진의 크기·자르기 방식은 안전한 분리 결과 적용 범위 밖입니다.');
  c=raster(mask,w,h);original=raster(el,w,h);const ctx=c.getContext('2d'),rgba=ctx.getImageData(0,0,w,h),rgb=original.getContext('2d').getImageData(0,0,w,h).data;
  let samples=0,error=0,bad=0,removed=0,kept=0;const colors=new Set(),step=Math.max(1,Math.floor(w*h/65536));
  for(let i=0;i<w*h;i++){const j=i*4,a=rgba.data[j+3];if(a<24)removed++;if(a>240){kept++;if(i%step===0){const d=Math.max(...[0,1,2].map(k=>Math.abs(rgba.data[j+k]-rgb[j+k])));colors.add((rgb[j]>>4)*256+(rgb[j+1]>>4)*16+(rgb[j+2]>>4));samples++;error+=d;if(d>12)bad++;}}}
  if(removed<w*h*.01||kept<w*h*.01||colors.size<8)throw Error('충분한 상품 영역과 색상을 확인할 수 없습니다. 투명도와 사진 크기를 확인하세요.');
  if(samples<50||error/samples>3||bad/samples>.03)throw Error('원본 사진과 색상·위치가 일치하지 않습니다. 같은 사진에서 만든 분리 PNG를 사용하세요.');
  // Preserve original RGB and use only the verified mask alpha.
  for(let i=0;i<w*h;i++){const j=i*4;rgba.data[j]=rgb[j];rgba.data[j+1]=rgb[j+1];rgba.data[j+2]=rgb[j+2];rgba.data[j+3]=Math.round(rgba.data[j+3]*rgb[j+3]/255);}ctx.putImageData(rgba,0,0);
  if(ticket!==token||!valid(s,o,s.revision))throw Error('사진이나 편집 상태가 바뀌었습니다. 분리 결과를 다시 불러오세요.');
  pending={state:s,object:o,revision:s.revision,src:c.toDataURL('image/png'),original:o.originalPhotoSource||original.toDataURL('image/png'),token};by('photoMaskPreview').src=pending.src;by('photoMaskPreview').hidden=false;by('photoMaskApply').hidden=false;say('같은 사진의 분리 결과를 확인했습니다. 가장자리를 살펴본 뒤 적용하세요. 원본으로 복원할 수 있습니다.');
 }catch(e){say(e.message);}finally{if(url)URL.revokeObjectURL(url);if(c)c.width=c.height=0;if(original)original.width=original.height=0;}
};
by('photoMaskApply').onclick=async()=>{
 const p=pending;if(!p||selected()!==p.object||!valid(p.state,p.object,p.revision)){clear();say('사진 선택이나 편집 상태가 바뀌어 적용하지 않았습니다. 다시 불러오세요.');return;}
 try{const el=await decode(p.src);if(pending!==p||!valid(p.state,p.object,p.revision))return;const o=p.object;o.originalPhotoSource=p.original;o.originalPhotoCutoutMethod=o.originalPhotoCutoutMethod||o.cutoutMethod||'';o.setElement(el);o.cutoutMethod='verified-photo-mask';o.setCoords();api().commit(p.state.width,p.state.height,{epoch:p.state.epoch,revision:p.revision,apply:true});clear();say('사진의 배경을 투명하게 적용했습니다. 글씨는 개별 편집 상태로 유지됩니다. 가려졌던 배경은 복원하지 않았습니다.');}catch(e){say(e.message);}
};
by('photoMaskRestore').onclick=async()=>{const s=api()?.read(),o=selected();if(!s||!o||!/^data:image\/(png|jpeg|webp);base64,/.test(o.originalPhotoSource||'')){say('복원할 분리 사진을 선택하세요.');return;}try{const el=await decode(o.originalPhotoSource);if(!valid(s,o,s.revision))return;o.setElement(el);o.cutoutMethod=o.originalPhotoCutoutMethod||'pptx-original-object';delete o.originalPhotoSource;delete o.originalPhotoCutoutMethod;o.setCoords();api().commit(s.width,s.height,{epoch:s.epoch,revision:s.revision,apply:true});clear();say('선택한 사진 원본을 복원했습니다.');}catch(e){say(e.message);}};
for(const event of ['coex:layer-source','coex:layer-edit'])window.addEventListener(event,()=>{if(pending)clear();});
