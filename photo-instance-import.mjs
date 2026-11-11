// Each supplied instance mask becomes its own editable image. No model runs here.
import './layers.mjs';
import './photo-mask-import.mjs';
const by=id=>document.getElementById(id),api=()=>globalThis.coexLayerLayout;
const panel=document.createElement('details');panel.id='photoInstancesPanel';panel.innerHTML=`<summary>사진 속 물체를 각각의 레이어로 적용</summary><p class="layer-help">같은 사진에서 분리한 물체별 PNG를 함께 선택하세요. 확인 후 각 물체와 남은 배경을 따로 선택·이동할 수 있습니다. 상품 뒤의 가려진 영역은 투명하게 남습니다. 이 입력은 준비된 분리 결과를 사용하며 가려진 부분을 새로 그리지 않습니다.</p><button type="button" id="photoInstancesOpen" class="doc-btn">물체별 PNG 여러 개 불러오기</button><button type="button" id="photoInstancesRestore" class="doc-btn">분리 전 사진으로 복원</button><input type="file" id="photoInstancesFile" accept="image/png,.png" multiple hidden><p id="photoInstancesStatus" class="layer-help" role="status" aria-live="polite">먼저 원본 사진 또는 분리할 전경 사진 한 개를 선택하세요.</p><div id="photoInstancesCards" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px"></div><button type="button" id="photoInstancesApply" class="doc-btn" hidden>확인 후 각각의 레이어로 적용</button>`;
by('photoMaskPanel').after(panel);
let pending=null,ticket=0;
const say=t=>by('photoInstancesStatus').textContent=t;
function selected(includeBackground=false){const s=api()?.read(),o=s?.objects.find(o=>o.canvas)?.canvas?.getActiveObject();return o&&String(o.type).toLowerCase()==='image'&&o.visible!==false&&!o.layerLocked&&(includeBackground||o.layerRole!=='background')?o:null;}
function current(p){const s=api()?.read();return s&&s.epoch===p.state.epoch&&s.revision===p.state.revision&&s.objects.includes(p.object);}
function clear(){ticket++;pending=null;by('photoInstancesApply').hidden=true;by('photoInstancesCards').replaceChildren();by('photoInstancesFile').value='';}
async function decode(src){const im=new Image();im.src=src;await im.decode();return im;}
function raster(el,w,h){const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d',{willReadFrequently:true}).drawImage(el,0,0,w,h);return c;}
by('photoInstancesOpen').onclick=()=>by('photoInstancesFile').click();
by('photoInstancesFile').onchange=async()=>{
 const files=[...by('photoInstancesFile').files];clear();panel.open=true;if(!files.length)return;
 const state=api()?.read(),o=selected(),token=ticket;if(!state||!o){say('먼저 분리할 사진 한 개를 선택하세요.');return;}
 if(o.photoInstanceKind){say('이미 개체별로 나눈 사진입니다. 먼저 분리 전 사진으로 복원하세요.');return;}
 if(files.length<2||files.length>8||files.some(f=>f.size>30*1024*1024)){say('물체별 PNG를 2~8개, 파일당 30MB 이내로 선택하세요.');return;}
 let orig=null;
 try{
  say('사진과 각 물체의 색상·위치·중복 영역을 확인하고 있습니다…');
  const el=/^data:image\/(png|jpeg|webp);base64,/.test(o.originalPhotoSource||'')?await decode(o.originalPhotoSource):o.getElement(),w=el.naturalWidth||el.width,h=el.naturalHeight||el.height;
  if(w*h>4000000||o.cropX||o.cropY||o.clipPath||o.sourceText)throw Error('사진의 크기·자르기 방식이 개체별 분리 적용 범위 밖입니다.');
  orig=raster(el,w,h);const rgb=orig.getContext('2d').getImageData(0,0,w,h).data,occupied=new Uint8Array(w*h),parts=[];
  let union=0;
  for(const file of files){
   const url=URL.createObjectURL(file);let c=null;
   try{
    const mask=await decode(url);if(mask.naturalWidth!==w||mask.naturalHeight!==h)throw Error('모든 물체 PNG는 원본 사진과 같은 '+w+' × '+h+' px여야 합니다.');
    c=raster(mask,w,h);const ctx=c.getContext('2d'),data=ctx.getImageData(0,0,w,h),a=data.data;let area=0,overlap=0,samples=0,error=0,bad=0,l=w,t=h,r=-1,b=-1;const colors=new Set(),step=Math.max(1,Math.floor(w*h/65536));
    for(let i=0;i<w*h;i++){const j=i*4;if(a[j+3]>0){const x=i%w,y=Math.floor(i/w);l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}if(a[j+3]>24){area++;if(occupied[i])overlap++;}if(a[j+3]>240&&i%step===0){samples++;const d=Math.max(...[0,1,2].map(k=>Math.abs(a[j+k]-rgb[j+k])));error+=d;if(d>12)bad++;colors.add((rgb[j]>>4)*256+(rgb[j+1]>>4)*16+(rgb[j+2]>>4));}}
    if(area<w*h*.005||samples<30||colors.size<8||error/samples>3||bad/samples>.03)throw Error('물체 PNG의 충분한 영역 또는 원본 사진과의 일치를 확인하지 못했습니다.');
    if(overlap>area*.02)throw Error('물체 PNG가 서로 크게 겹칩니다. 같은 상품이 중복되지 않도록 분리 결과를 확인하세요.');
    l=w;t=h;r=-1;b=-1;let ownedPixels=0;for(let i=0;i<w*h;i++){const j=i*4,owns=a[j+3]>=128&&rgb[j+3]>0&&!occupied[i];if(owns){occupied[i]=1;union++;ownedPixels++;const x=i%w,y=Math.floor(i/w);l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}a[j]=a[j+1]=a[j+2]=0;a[j+3]=owns?255:0;}if(!ownedPixels)throw Error('이 물체에 독립적으로 배정할 픽셀이 없습니다. 중복 후보를 해제하세요.');ctx.putImageData(data,0,0);ctx.globalCompositeOperation='source-in';ctx.drawImage(orig,0,0);ctx.globalCompositeOperation='source-over';
    const crop=document.createElement('canvas');crop.width=r-l+1;crop.height=b-t+1;crop.getContext('2d').drawImage(c,l,t,crop.width,crop.height,0,0,crop.width,crop.height);const src=crop.toDataURL('image/png');parts.push({src,x:l,y:t,w:crop.width,h:crop.height,name:file.name.replace(/\.png$/i,'').slice(0,100),area});crop.width=crop.height=0;
   }finally{URL.revokeObjectURL(url);if(c)c.width=c.height=0;}
  }
  let coverage=null;if(o.originalPhotoSource){const source=raster(o.getElement(),w,h),a=source.getContext('2d').getImageData(0,0,w,h).data;let total=0,kept=0;for(let i=0;i<w*h;i++)if(a[i*4+3]>24){total++;if(occupied[i])kept++;}source.width=source.height=0;coverage=kept/Math.max(1,total);if(coverage<.99)throw Error('기존 전경 중 '+((1-coverage)*100).toFixed(1)+'%가 빠집니다. 누락된 물체 영역을 보완하세요.');}
  const original=orig.toDataURL('image/png'),backgroundCanvas=document.createElement('canvas');backgroundCanvas.width=w;backgroundCanvas.height=h;const bg=backgroundCanvas.getContext('2d'),data=bg.createImageData(w,h);for(let i=0;i<w*h;i++)data.data[i*4+3]=occupied[i]?0:255;bg.putImageData(data,0,0);bg.globalCompositeOperation='source-in';bg.drawImage(orig,0,0);bg.globalCompositeOperation='source-over';const background={src:backgroundCanvas.toDataURL('image/png'),x:0,y:0,w,h,name:'남은 배경 · 가려진 영역 투명'};backgroundCanvas.width=backgroundCanvas.height=0;
  const proposal={state,object:o,parts,background,original,coverage,token};if(ticket!==token||!current(proposal))throw Error('사진 또는 편집 상태가 바뀌었습니다. 다시 불러오세요.');pending=proposal;
  for(const part of [...parts,background]){const card=document.createElement('figure');card.style.margin='0';const image=new Image();image.src=part.src;image.alt=part.name;image.style.cssText='width:100%;height:130px;object-fit:contain;background:repeating-conic-gradient(#ddd 0 25%,#fff 0 50%) 0/16px 16px';const caption=document.createElement('figcaption');caption.textContent=part.name;card.append(image,caption);by('photoInstancesCards').append(card);}
  by('photoInstancesApply').hidden=false;say(parts.length+'개 독립 물체와 배경 1개를 확인했습니다.'+(coverage===null?' 전체 상품 보존은 미리보기에서 확인하세요.':' 기존 전경 보존 '+(coverage*100).toFixed(1)+'%.')+' 각 물체의 가장자리를 확인한 뒤 적용하세요.');
 }catch(e){say(e.message);}finally{if(orig)orig.width=orig.height=0;}
};
by('photoInstancesApply').onclick=async()=>{
 const p=pending;if(!p||!current(p)||selected()!==p.object){clear();say('대상 선택이나 편집 상태가 바뀌었습니다. 다시 불러오세요.');return;}
 try{
  const elements=await Promise.all([p.background,...p.parts].map(part=>decode(part.src)));if(pending!==p||!current(p)||selected()!==p.object)return;
  const o=p.object,canvas=o.canvas,id=crypto.randomUUID(),matrix=o.calcTransformMatrix(),F=p.state.F;if(canvas.size()+p.parts.length+1>200)throw Error('편집 요소가 200개를 넘습니다.');
  const objects=[p.background,...p.parts].map((part,i)=>{const image=new F.FabricImage(elements[i],{originX:'left',originY:'top',scaleX:o.scaleX,scaleY:o.scaleY,angle:o.angle,skewX:o.skewX,skewY:o.skewY,flipX:o.flipX,flipY:o.flipY,opacity:o.opacity,strokeWidth:0,layerName:part.name,layerRole:i===0?'background':'subject',layerRoleInferred:i!==0,layerLocked:false,sourceElementId:(o.sourceElementId||'photo')+':part:'+i,sourceElementType:'picture',cutoutMethod:i===0?'instance-residual-background':'verified-instance-mask',perPixelTargetFind:true,photoInstanceGroup:id,photoInstanceKind:i===0?'background':'part',photoInstanceCrop:{x:part.x,y:part.y,w:part.w,h:part.h}});const center=F.util.transformPoint(new F.Point(part.x+part.w/2-o.width/2,part.y+part.h/2-o.height/2),matrix);image.setPositionByOrigin(center,'center','center');image.setCoords();return image;});
  o.photoInstanceGroup=id;o.photoInstanceKind='source';o.photoInstanceWasLocked=!!o.layerLocked;o.photoInstanceWasVisible=o.visible!==false;o.originalPhotoSource=o.originalPhotoSource||p.original;o.originalPhotoCutoutMethod=o.originalPhotoCutoutMethod||o.cutoutMethod;
  o.visible=false;o.layerLocked=true;const at=canvas.getObjects().indexOf(o);objects.forEach((part,i)=>canvas.insertAt(at+1+i,part));canvas.setActiveObject(objects[0]);api().commit(p.state.width,p.state.height,{epoch:p.state.epoch,revision:p.state.revision,apply:true});clear();say(p.parts.length+'개 물체와 남은 배경을 독립 레이어로 적용했습니다. 각 레이어를 따로 선택·이동할 수 있습니다. 가려진 영역은 투명하며 생성 복원하지 않았습니다.');
 }catch(e){say(e.message);}
};
by('photoInstancesRestore').onclick=async()=>{const state=api()?.read(),active=selected(true),group=active?.photoInstanceGroup,original=state?.objects.find(o=>o.photoInstanceGroup===group&&o.photoInstanceKind==='source');if(!group||!original){say('복원할 물체 레이어 한 개를 선택하세요.');return;}try{const image=await decode(original.originalPhotoSource);if(api()?.read()?.epoch!==state.epoch||api()?.read()?.revision!==state.revision)return;const canvas=original.canvas,parts=state.objects.filter(o=>o.photoInstanceGroup===group&&['part','background','support'].includes(o.photoInstanceKind));canvas.discardActiveObject();parts.forEach(o=>{canvas.remove(o);o.dispose();});original.setElement(image);original.visible=original.photoInstanceWasVisible!==false;original.layerLocked=!!original.photoInstanceWasLocked;original.cutoutMethod=original.originalPhotoCutoutMethod||'pptx-original-object';for(const key of ['photoInstanceGroup','photoInstanceKind','photoInstanceWasLocked','photoInstanceWasVisible','originalPhotoSource','originalPhotoCutoutMethod'])delete original[key];canvas.setActiveObject(original);api().commit(state.width,state.height,{epoch:state.epoch,revision:state.revision,apply:true});clear();say('분리 전 사진을 복원했습니다.');}catch(e){say(e.message);}};
for(const event of ['coex:layer-source','coex:layer-edit'])window.addEventListener(event,()=>{if(pending)clear();});
globalThis.coexLoadInstanceMasks=async files=>{const transfer=new DataTransfer();files.forEach(file=>transfer.items.add(file));by('photoInstancesFile').files=transfer.files;await by('photoInstancesFile').onchange();};
