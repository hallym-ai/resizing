import {sourceStyle} from './source-design.mjs';
// Local style systems over the original editable assets. No remote font,
// image synthesis or automatic alteration of product/logo pixels.
import {mix,contrast} from './design-brief.mjs';
export const systemFonts=['Arial','Georgia','Verdana','Trebuchet MS'];
const themes=[
 {name:'크림 · 에디토리얼',primary:'#a9482c',background:'#fff2df',font:'Georgia'},
 {name:'옐로 · 팝',primary:'#be252b',background:'#ffce32',font:'Trebuchet MS'},
 {name:'네이비 · 포커스',primary:'#8ee3d2',background:'#152c43',font:'Arial'},
 {name:'그린 · 미니멀',primary:'#20594b',background:'#e9f1e7',font:'Verdana'}
];
export function styleSettings(settings,index){
 if(settings.theme==='faithful')return {...settings,theme:'original',primary:settings.sourceProfile?.palette.primary||settings.primary,background:settings.useBackground?settings.background:settings.sourceProfile?.palette.background||settings.background,useBackground:true,keepBackground:true,titleFont:settings.titleFont==='auto'?'':settings.titleFont,bodyFont:settings.bodyFont==='auto'?'':settings.bodyFont,styleName:'원본 디자인 유지 · 새 구도',paletteProvenance:{origin:'source-preserved',method:'reflow-only'}};
 if(settings.theme==='source'){const resolved=sourceStyle(settings,index);if(resolved)return resolved;}
 if(settings.theme!=='varied')return {...settings,styleName:settings.theme==='original'?'원본 색상':'선택 색상'};
 const t=themes[index];
 return {...settings,theme:'brand',primary:t.primary,background:settings.useBackground?settings.background:t.background,useBackground:true,styleName:t.name};
}
export function automaticFont(index,title){return title?themes[index].font:['Arial','Verdana','Arial','Verdana'][index];}
export function composition(index,w,h){
 const mode=w/h>=1.25?'wide':w/h<=.8?'tall':'square';
 const profiles={wide:[{variant:'columns',copyShare:.52},{variant:'columns',copyShare:.64},{variant:'columns',copyShare:.42},{variant:'headline',headShare:.34,imageShare:.44}],square:[{variant:'headline',headShare:.30,imageShare:.50},{variant:'columns',copyShare:.58},{variant:'hero-first',headShare:.25,imageShare:.38},{variant:'stack',headShare:.25,imageShare:.38}],tall:[{variant:'stack',headShare:.24,imageShare:.40},{variant:'stack',headShare:.31,imageShare:.32},{variant:'hero-first',headShare:.24,imageShare:.40},{variant:'stack',headShare:.25,imageShare:.35}]};
 return {...profiles[mode][index],anchor:['top','bottom','bottom','top'][index],id:`design-${mode}-${index}`};
}
export function decorate(objects,w,h,index,colors,F){
 // Decoration stays behind every original object: overlap is allowed without
 // covering the product, logo or readable information. All shapes are opaque.
 const short=Math.min(w,h),items=[],base={layerRole:'background',layerLocked:true,selectable:false,evented:false};
 const add=o=>items.push(o);
 if(index===0)add(new F.Rect({...base,left:short*.025,top:short*.025,width:w-short*.05,height:h-short*.05,fill:'transparent',stroke:mix(colors.primary,colors.background,.6),strokeWidth:Math.max(1,short*.003),designAccent:'style-frame',layerName:'시안 장식 · 테두리'}));
 if(index===1)add(new F.Circle({...base,left:w*.54,top:h*.15,radius:Math.min(w*.21,h*.32),fill:mix(colors.primary,colors.background,.85),designAccent:'style-circle',layerName:'시안 장식 · 원형 포인트'}));
 if(index===2)add(new F.Rect({...base,left:w*.48,top:0,width:w*.52,height:h,fill:mix(colors.background,colors.primary,.07),designAccent:'style-panel',layerName:'시안 장식 · 투톤 패널'}));
 if(index===3)add(new F.Rect({...base,left:0,top:h-short*.025,width:w,height:short*.025,fill:colors.primary,designAccent:'style-bottom',layerName:'시안 장식 · 하단 포인트'}));
 const insertion=objects.findIndex(o=>o.visible&&o.layerRole!=='background');objects.splice(insertion<0?objects.length:insertion,0,...items);
}
export function brandBackplates(objects,plan,w,h,colors,F){
 const plates=[];
 for(const unit of plan.semanticUnits||[]){
  if(unit.role!=='logo')continue;
  const members=unit.ids.map(id=>objects[id]).filter(o=>o?.visible),ink=[];
  for(const o of members)if(typeof o.text==='string'){
   for(const fill of [o.fill,...Object.values(o.styles||{}).flatMap(row=>Object.values(row).map(s=>s.fill))]){
    if(!fill)continue;try{ink.push('#'+new F.Color(fill).toHex());}catch{}
   }
  }
  if(!ink.length||ink.every(c=>contrast(c,colors.background)>=4.5))continue;
  const backgrounds=['#142b49','#ffffff',colors.background],score=bg=>Math.min(...ink.map(c=>contrast(c,bg)));
  backgrounds.sort((a,b)=>score(b)-score(a));
  const boxes=members.map(o=>o.getBoundingRect()),pad=Math.min(w,h)*.008;
  const x=Math.max(0,Math.min(...boxes.map(b=>b.left))-pad),y=Math.max(0,Math.min(...boxes.map(b=>b.top))-pad),right=Math.min(w,Math.max(...boxes.map(b=>b.left+b.width))+pad),bottom=Math.min(h,Math.max(...boxes.map(b=>b.top+b.height))+pad);
  plates.push(new F.Rect({left:x,top:y,width:right-x,height:bottom-y,rx:pad,ry:pad,fill:backgrounds[0],designAccent:'style-brand:'+unit.id,layerName:'시안 장식 · 브랜드 대비판',layerRole:'background',layerLocked:true}));
 }
 // Compute every unit by the original plan indexes before inserting anything.
 const i=objects.findIndex(o=>o.visible&&o.layerRole!=='background');objects.splice(i<0?objects.length:i,0,...plates);
}
export function refreshStyleDecorations(objects,plan){
 const w=plan.width,h=plan.height,short=Math.min(w,h);
 for(const o of objects){const key=o.designAccent;if(!key?.startsWith('style-'))continue;
  const common={originX:'left',originY:'top',scaleX:1,scaleY:1};
  if(key==='style-frame')o.set({...common,left:short*.025,top:short*.025,width:w-short*.05,height:h-short*.05,strokeWidth:Math.max(1,short*.003)});
  if(key==='style-circle')o.set({...common,left:w*.54,top:h*.15,radius:Math.min(w*.21,h*.32)});
  if(key==='style-panel')o.set({...common,left:w*.48,top:0,width:w*.52,height:h});
  if(key==='style-bottom')o.set({...common,left:0,top:h-short*.025,width:w,height:short*.025});
  if(key.startsWith('style-brand:')){
   const unit=plan.semanticUnits?.find(u=>u.id===key.slice(12)),boxes=unit?.ids.map(id=>objects[id]).filter(x=>x?.visible).map(x=>x.getBoundingRect());
   if(!boxes?.length){o.set('visible',false);continue;}
   const pad=short*.008,x=Math.max(0,Math.min(...boxes.map(b=>b.left))-pad),y=Math.max(0,Math.min(...boxes.map(b=>b.top))-pad);
   o.set({...common,visible:true,left:x,top:y,width:Math.min(w,Math.max(...boxes.map(b=>b.left+b.width))+pad)-x,height:Math.min(h,Math.max(...boxes.map(b=>b.top+b.height))+pad)-y,rx:pad,ry:pad});
  }
  o.setCoords();
 }
}
