// Only explicit semantic rearrangement uses this fitting policy. Imported
// source text and its run styles remain intact; Fabric measures every trial.
export function fitReadableBody(object,zone,short,F,requestedSize,align,policy=null){
 if(align)object.set('textAlign',align);if(policy?.textDirection)object.set('direction',policy.textDirection);
 const base=object.fontSize||30,ratio=Math.abs(object.scaleX/object.scaleY)||1;
 const minimumFont=Math.min(base,...Object.values(object.styles||{}).flatMap(row=>Object.values(row).map(style=>style.fontSize).filter(size=>Number.isFinite(size)&&size>0)));
 const desired=requestedSize||(short<500?Math.max(8,short*8/212):Math.min(22,short*.044));
 const setSize=size=>{
  const sy=size/minimumFont,sx=sy*ratio;
  object.set({scaleX:sx,scaleY:sy,width:Math.max(1,zone.w/sx-1),splitByGrapheme:false});
  object.initDimensions();
  if(policy&&object.text.length<64&&!object.text.includes('\n')&&object.calcTextWidth()*sx<zone.w){object.set('width',Math.max(1,object.calcTextWidth()+1));object.initDimensions();}
  // Word wrapping preserves English words and Korean space-separated phrases.
  // An unbroken Korean phrase or URL wider than the cell needs a grapheme
  // fallback. Reset the requested width after Fabric expands to its min width.
  if(object.width*sx>zone.w+.01&&!policy){
   object.set({splitByGrapheme:true,width:Math.max(1,zone.w/sx-1)});
   object.initDimensions();
  }
  object.setCoords();
 };
 let low=.5,high=desired;
 for(let i=0;i<14;i++){
  const size=(low+high)/2;setSize(size);const b=object.getBoundingRect();
  if(b.width<=zone.w+.01&&b.height<=zone.h+.01)low=size;else high=size;
 }
 if(policy?.minimumSize&&low<policy.minimumSize-.1){globalThis.coexLayoutFailure={text:object.text,desired,found:low,minimum:policy.minimumSize,zone};const e=Error('조정 필요: '+String(object.text||object.layerName||'글자').slice(0,35)+' — 최소 글자 크기로 넣을 공간이 부족합니다. 더 큰 규격이나 묶음 배치를 선택하세요.');e.code='LAYOUT_NEEDS_REVIEW';throw e;}
 setSize(low);
 if(policy&&object.textLines.length>1&&object.textLines.at(-1).trim().split(/\s+/).length===1){const savedWidth=object.width,rows=object.textLines.length;let balanced=false;for(const ratio of[.98,.96,.94,.92,.90,.87,.84]){object.set('width',savedWidth*ratio);object.initDimensions();const b=object.getBoundingRect();if(object.textLines.length===rows&&object.textLines.at(-1).trim().split(/\s+/).length>1&&b.height<=zone.h+.01&&b.width<=zone.w+.01){balanced=true;break;}}if(!balanced){object.set('width',savedWidth);object.initDimensions();}}
 object.setCoords();const b=object.getBoundingRect(),center=object.getCenterPoint();
 object.setPositionByOrigin(new F.Point(center.x+zone.x+(align==='left'?0:align==='right'?zone.w-b.width:(zone.w-b.width)/2)-b.left,center.y+zone.y+(policy?.verticalAlign==='top'?0:(zone.h-b.height)/2)-b.top),'center','center');
 object.setCoords();
}
