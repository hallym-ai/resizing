import {relationshipPlan} from './relationship-layout.mjs';
import {inspectLayout,solverInfo} from './design-layout.mjs';

const area=b=>b.w*b.h;
const bounds=items=>{const x=Math.min(...items.map(e=>e.x)),y=Math.min(...items.map(e=>e.y));return{x,y,w:Math.max(...items.map(e=>e.x+e.w))-x,h:Math.max(...items.map(e=>e.y+e.h))-y};};
const distance=(a,b)=>Math.max(0,Math.max(a.y,b.y)-Math.min(a.y+a.h,b.y+b.h));
const font=a=>Math.max(0,...a.items.filter(e=>e.text).map(e=>e.fontSize||e.h/Math.max(1,e.text.split('\n').length)*.8));

// Compact only separated short editable headline words. Keep each original
// object and its reading row; never pack logos, pictures or decorative marks.
function compactHeadline(u,adaptive=false){
 if(u.role!=='title'||u.readableTitle||u.items.length<2||u.items.some(e=>e.kind!=='text'||e.angle||!e.text.trim()||e.text.includes('\n')||e.text.length>32))return u;
 const glyphs=u.items.map(e=>{const w=Number.isFinite(e.inkWidth)?Math.min(e.w,e.inkWidth*1.02):e.w;return {...e,x:e.x+(e.w-w)*(e.textAlign==='right'?1:e.textAlign==='center'?.5:0),w,compactWidth:w};});
 const rows=[];
 for(const e of glyphs.sort((a,b)=>a.y-b.y||a.x-b.x)){
  let row=rows.find(r=>Math.abs(r[0].y+r[0].h/2-e.y-e.h/2)<=Math.min(r[0].h,e.h)*.35);
  if(!row){row=[];rows.push(row);}row.push(e);
 }
 let changed=adaptive||glyphs.some(e=>e.w<u.items.find(item=>item.id===e.id).w*.9);
 const packed=rows.map(row=>{
  row.sort((a,b)=>a.x-b.x);let x=row[0].x;
  return row.map((e,i)=>{
   if(i){const previous=row[i-1],gap=e.x-previous.x-previous.w,space=Math.min(e.fontSize||e.h,previous.fontSize||previous.h)*.35;
    if(gap>space*4){x+=space;changed=true;}else x+=gap;
   }
   const copy={...e,x};x+=e.w;return copy;
  });
 });
 if(!changed)return u;
 const maxWidth=Math.max(...packed.map(row=>bounds(row).w));
 let nextY=u.b.y;
 const items=packed.flatMap(row=>{const b=bounds(row),dx=u.b.x+(maxWidth-b.w)/2-b.x,dy=adaptive?nextY-b.y:0;if(adaptive)nextY+=b.h+Math.max(...row.map(e=>e.fontSize||e.h))*.08;return row.map(e=>({...e,x:e.x+dx,y:e.y+dy}));});
 return {...u,items,b:bounds(items)};
}

// A native poster contains many drawing objects, but only a few semantic units.
// Keep its brand rows and related headline words together instead of giving a
// product photograph and each separator line equal-sized image cells.
export function semanticPlan(elements,{sourceWidth,sourceHeight,width,height,design=null}){
 const relational=relationshipPlan(elements,{sourceWidth,sourceHeight,width,height,design});if(relational)return relational;
 const visible=elements.filter(e=>!e.hidden),backgrounds=visible.filter(e=>e.role==='background'),foreground=visible.filter(e=>e.role!=='background');
 if(Math.min(width,height)<64||foreground.length<10||foreground.some(e=>e.locked)||foreground.some(e=>e.kind==='text'&&e.role!=='other')||foreground.filter(e=>e.sourceGroup).length<foreground.length*.7)return null;
 const continuation=foreground.every(e=>typeof e.semanticUnit==='string'&&['logo','title','subject','body','details'].includes(e.semanticRole))&&foreground.some(e=>e.semanticRole==='subject'&&e.kind==='image');
 const grouped=new Map();
 for(const e of foreground){const key=e.sourceGroup?'native:'+e.sourceGroup:'single:'+e.id;if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(e);}
 const atoms=[...grouped].map(([key,items])=>({key,items,b:bounds(items),text:items.map(e=>e.text||'').join('\n'),image:items.some(e=>e.kind==='image'&&!e.text)}));
 const pictures=atoms.filter(a=>a.image).sort((a,b)=>area(b.b)-area(a.b));
 const maxFont=Math.max(0,...atoms.map(font)),major=atoms.filter(a=>a.text.trim()&&font(a)>=maxFont*.5);
 if(!continuation&&(major.length<2||!pictures.length||area(pictures[0].b)<sourceWidth*sourceHeight*.08||pictures[1]&&area(pictures[0].b)<area(pictures[1].b)*2.5))return null;
 const used=new Set(),units=[],layoutGroups={},roles={};let sequence=0;
 const unit=(role,list)=>{
  list=list.filter(a=>!used.has(a.key));if(!list.length)return null;
  const items=list.flatMap(a=>a.items),u={id:'poster-unit-'+sequence++,role,items,b:bounds(items)};
  list.forEach(a=>used.add(a.key));units.push(u);
  for(const e of items){layoutGroups[e.id]=u.id;roles[e.id]=role;}
  return u;
 };
 for(const e of backgrounds)roles[e.id]='background';
 let header=null,footer=null,hero=null,details=null;const body=[],extraHeaders=[],extraSubjects=[];
 if(continuation){
  // A successful native layout remains the same poster after an edit. Do not
  // reclassify its smaller rendered photograph or captions as a new document.
  const ids=[...new Set(foreground.map(e=>e.semanticUnit))];
  for(const id of ids){
   const list=atoms.filter(a=>a.items.every(e=>e.semanticUnit===id));
   if(!list.length)return null;
   const first=list[0].items[0],role=first.semanticRole;
   if(list.some(a=>a.items.some(e=>e.semanticRole!==role)))return null;
   const changed=role==='title'?list.filter(a=>a.items.length===1&&a.items[0].kind==='text'&&a.items[0].text!==a.items[0].semanticOriginalText):[];
   for(const a of changed){const u=unit(role,[a]);u.readableTitle=true;}
   const u=unit(role,list.filter(a=>!changed.includes(a)));
   if(!u)continue;
   if(first.semanticBand==='extra-header')extraHeaders.push(u);
   else if(first.semanticBand==='extra-subject')extraSubjects.push(u);
   else if(first.semanticBand==='header')header=u;
   else if(first.semanticBand==='footer')footer=u;
   else if(role==='subject')hero=u;
   else if(role==='body')body.push(u);
   else if(role==='details')details=u;
  }
 }else{
 header=unit('logo',atoms.filter(a=>a.b.y+a.b.h<=sourceHeight*.14&&font(a)<maxFont*.4));
 footer=unit('details',atoms.filter(a=>a.b.y>=sourceHeight*.88&&font(a)<maxFont*.4));
 const heroBounds=pictures[0].b,heroAtoms=atoms.filter(a=>a===pictures[0]||!a.text.trim()&&a.b.x>=heroBounds.x-1&&a.b.y>=heroBounds.y-1&&a.b.x+a.b.w<=heroBounds.x+heroBounds.w+1&&a.b.y+a.b.h<=heroBounds.y+heroBounds.h+1);
 // Connected words on the same or adjacent heading lines form one phrase.
 const remainingMajor=new Set(major.filter(a=>!used.has(a.key)));
 while(remainingMajor.size){
  const first=[...remainingMajor].sort((a,b)=>a.b.y-b.b.y||a.b.x-b.b.x)[0],cluster=[first];remainingMajor.delete(first);
  let changed=true;
  while(changed){changed=false;for(const a of remainingMajor)if(cluster.some(b=>distance(a.b,b.b)<=Math.min(a.b.h,b.b.h)*.3&&Math.max(font(a),font(b))/Math.max(1,Math.min(font(a),font(b)))<1.8)){cluster.push(a);remainingMajor.delete(a);changed=true;}}
  // Preserve small separators that were embedded in this phrase.
  const b=bounds(cluster.map(a=>({...a.b}))),cx=b.x+b.w/2;
  const accents=atoms.filter(a=>!used.has(a.key)&&!a.text.trim()&&!heroAtoms.includes(a)&&Math.min(a.b.w,a.b.h)/Math.max(a.b.w,a.b.h)<.08&&a.b.y+a.b.h/2>=b.y&&a.b.y+a.b.h/2<=b.y+b.h&&Math.abs(a.b.x+a.b.w/2-cx)<=b.w/2);
  unit('title',[...cluster,...accents]);
 }
 hero=unit('subject',heroAtoms);

 for(const a of atoms)if(!used.has(a.key)&&a.text.trim().length>70&&a.b.w>sourceWidth*.55){const u=unit('body',[a]);if(u)body.push(u);}
 details=unit('details',atoms.filter(a=>!used.has(a.key)));
 }
 const titles=units.filter(u=>u.role==='title').sort((a,b)=>a.b.y-b.b.y),short=Math.min(width,height),margin=Math.max(.5,short*(design?.adaptiveTypography&&design.variant==='minimal'?.075:.045)),gap=short*(design?.adaptiveTypography&&design.variant==='minimal'?.032:.026);
 const W=width-2*margin,H=height-2*margin,placements=[];
 const place=(u,cell)=>{
  if(!u)return;
  if(u===details&&placeSchedule(u,cell))return;
  u=compactHeadline(u,!!design?.adaptiveTypography);
  const typography=design?.adaptiveTypography,requested=u.role==='title'?design?.titleSize:design?.bodySize;
  const textScale=u.items.filter(e=>e.text).map(e=>(typography&&Number.isFinite(requested)&&requested>0?requested:short*({title:.14*(typography?design.titleScale||1:1),body:.044,details:.055,logo:.045}[u.role]||.05))/Math.max(1,e.fontSize||e.h));
  const scale=Math.min(cell.w/u.b.w,cell.h/u.b.h,...textScale,...u.items.filter(e=>e.kind==='image').map(e=>e.semanticMaxScale||1));
  const x=cell.x+(cell.w-u.b.w*scale)/2,y=cell.y+(cell.h-u.b.h*scale)/2;
  for(const e of u.items)placements.push({id:e.id,role:u.role,groupRole:u.role,layoutGroup:u.id,scale,headlineWidth:e.compactWidth,x:x+(e.x-u.b.x)*scale,y:y+(e.y-u.b.y)*scale,w:e.w*scale,h:e.h*scale,zone:u.role==='body'||u.readableTitle?{...cell}:null,readableBody:u.role==='body'||!!u.readableTitle,readableTitle:!!u.readableTitle,readableSize:u.readableTitle?(design?.titleSize||short*.09):u.role==='body'&&design?.adaptiveTypography?(design.bodySize||Math.max(8,Math.min(42,short*.027))):undefined,align:design?.adaptiveTypography?design.align||'center':'center'});
 };
 const stack=(entries,cell)=>{
  entries=entries.filter(e=>e.u);if(!entries.length)return;
  const g=Math.min(gap,cell.h/(entries.length*10)),available=cell.h-g*(entries.length-1),sum=entries.reduce((n,e)=>n+e.weight,0);let y=cell.y;
  for(const {u,weight}of entries){const h=available*weight/sum;place(u,{x:cell.x,y,w:cell.w,h});y+=h+g;}
 };
 const smallLandscape=width/height>=1.15&&short>=180&&short<500,smallScale=short/212;
 const placeSchedule=(u,cell)=>{
  const times=u.items.filter(e=>e.kind==='text'&&/^\d{1,2}:\d{2}$/.test(e.text.trim())).sort((a,b)=>a.x-b.x);
  const suffixes=u.items.filter(e=>e.kind==='text'&&/^[ap]\.?m\.?$/i.test(e.text.trim()));
  const separators=u.items.filter(e=>e.kind==='text'&&/^[/–—-]$/.test(e.text.trim()));
  const captions=u.items.filter(e=>!times.includes(e)&&!suffixes.includes(e)&&!separators.includes(e));
  if(times.length!==2||suffixes.length!==2||separators.length!==1||captions.length!==1||captions[0].kind!=='text')return false;
  const add=(e,zone,size)=>placements.push({id:e.id,role:u.role,groupRole:u.role,layoutGroup:u.id,scale:1,x:zone.x,y:zone.y,w:zone.w,h:zone.h,readableBody:true,readableSize:size,zone,align:'center'});
  const labelH=cell.h*.4,rowY=cell.y+labelH,rowH=cell.h-labelH,sepW=12*smallScale,separatorGap=Math.min(cell.w*.025,short*.012),pairW=(cell.w-sepW-2*separatorGap)/2,unused=new Set(suffixes);
  add(captions[0],{x:cell.x,y:cell.y,w:cell.w,h:labelH},8*smallScale);
  for(let i=0;i<2;i++){
   const time=times[i],suffix=[...unused].sort((a,b)=>Math.abs(a.x-time.x)-Math.abs(b.x-time.x))[0];unused.delete(suffix);
   const x=cell.x+i*(pairW+sepW+2*separatorGap);
   add(time,{x,y:rowY,w:pairW*.72,h:rowH},12*smallScale);
   add(suffix,{x:x+pairW*.72,y:rowY,w:pairW*.28,h:rowH},7*smallScale);
  }
  add(separators[0],{x:cell.x+pairW+separatorGap,y:rowY,w:sepW,h:rowH},12*smallScale);
  return true;
 };
 // Preserve the oval and its embedded brand text together, while allowing
 // small contact captions to use readable sizes in independent columns.
 const placeBand=(u,cell)=>{
  if(!smallLandscape){place(u,cell);return;}
  const images=u.items.filter(e=>e.kind==='image'&&e.h/e.w>.08);
  if(images.length!==1){place(u,cell);return;}
  const logo=images[0],center=e=>e.x+e.w/2;
  const inside=e=>e===logo||e.kind==='text'&&center(e)>=logo.x&&center(e)<=logo.x+logo.w&&e.y+e.h/2>=logo.y&&e.y+e.h/2<=logo.y+logo.h;
  const brand=u.items.filter(inside),decor=u.items.filter(e=>!inside(e)&&e.kind==='image'&&e.h/e.w<=.08),rest=u.items.filter(e=>!inside(e)&&!decor.includes(e)),columns=[[],[]];
  if(rest.some(e=>e.kind!=='text')){place(u,cell);return;}
  for(const e of decor){const h=Math.min(2,cell.w*e.h/e.w);place({...u,items:[e],b:bounds([e])},{x:cell.x,y:e.y<logo.y?cell.y:cell.y+cell.h-h,w:cell.w,h});}
  cell={...cell,y:cell.y+2,h:cell.h-4};
  rest.forEach(e=>columns[center(e)<center(logo)?0:1].push(e));
  const col=cell.w/3;
  place({...u,items:brand,b:bounds(brand)},{x:cell.x+col,y:cell.y,w:col,h:cell.h});
  const maxFont=Math.max(...rest.map(e=>e.fontSize||0));
  for(let i=0;i<2;i++){
   const list=columns[i].sort((a,b)=>a.y-b.y),row=cell.h/Math.max(1,list.length);
   list.forEach((e,j)=>placements.push({id:e.id,role:u.role,groupRole:u.role,layoutGroup:u.id,scale:1,x:cell.x+(i?2:0)*col,y:cell.y+j*row,w:col,h:row,readableBody:true,readableSize:(e.fontSize<maxFont*.75?7:8)*smallScale,zone:{x:cell.x+(i?2:0)*col,y:cell.y+j*row,w:col,h:row},align:'center'}));
  }
 };
 let top=margin,bottom=height-margin;
 if(header){const h=(smallLandscape?22*smallScale:Math.min(H*.14,W*header.b.h/header.b.w));placeBand(header,{x:margin,y:top,w:W,h});top+=h+gap;}
 if(footer){const h=(smallLandscape?22*smallScale:Math.min(H*.12,W*footer.b.h/footer.b.w));placeBand(footer,{x:margin,y:bottom-h,w:W,h});bottom-=h+gap;}
 for(const u of extraHeaders){const h=Math.min(H*.09,W*u.b.h/u.b.w);place(u,{x:margin,y:top,w:W,h});top+=h+gap;}
 const main={x:margin,y:top,w:W,h:bottom-top},landscape=width/height>=1.15,columns=width/height>=.85;
 // Give long copy its own full-width strip at small landscape sizes.
 const readableSmall=smallLandscape&&body.length>0;
 if(readableSmall){
  const bodyHeight=Math.min(main.h*.25,Math.max(24,short*.115));
  const strip={x:main.x,y:main.y+main.h-bodyHeight,w:main.w,h:bodyHeight};
  main.h-=bodyHeight+gap;
  stack(body.map(u=>({u,weight:1})),strip);
 }
 if(columns){
  const share=Number.isFinite(design?.copyShare)?Math.max(.35,Math.min(.65,design.copyShare)):design?.adaptiveTypography?({editorial:.63,visual:.40,minimal:.56}[design.variant]||.52):.54,cw=(main.w-gap)*share,iw=main.w-gap-cw,left=design?.imageSide==='left'||!design?.imageSide&&design?.adaptiveTypography&&design.variant==='visual';
  const copy={x:left?main.x+iw+gap:main.x,y:main.y,w:cw,h:main.h},art={x:left?main.x:main.x+cw+gap,y:main.y,w:iw,h:main.h};
  stack([...titles.map(u=>({u,weight:(design?.adaptiveTypography?({editorial:.70,visual:.44,minimal:.50}[design.variant]||.56):.56)/titles.length})),...(readableSmall?[]:body.map(u=>({u,weight:(design?.adaptiveTypography?({editorial:.18,visual:.25,minimal:.28}[design.variant]||.24):.24)/Math.max(1,body.length)}))),{u:details,weight:readableSmall?.32:design?.adaptiveTypography?({editorial:.12,visual:.31,minimal:.22}[design.variant]||.20):.20}],copy);stack([{u:hero,weight:3},...extraSubjects.map(u=>({u,weight:1}))],art);
 }else{
  stack([{u:titles[0],weight:design?.adaptiveTypography?({editorial:.22,visual:.12,minimal:.18}[design.variant]||.15):.15},{u:hero,weight:design?.adaptiveTypography&&design.variant==='editorial'?.39:design?.adaptiveTypography&&design.variant==='visual'?.60:.49},...extraSubjects.map(u=>({u,weight:.18})),...titles.slice(1).map(u=>({u,weight:(design?.adaptiveTypography?({editorial:.29,visual:.17,minimal:.22}[design.variant]||.21):.21)/Math.max(1,titles.length-1)})),{u:details,weight:.08},...body.map(u=>({u,weight:.09/Math.max(1,body.length)}))],main);
 }
 if(placements.length!==foreground.length)return null;
 const actual=foreground.map(e=>({...e,...placements.find(p=>p.id===e.id),sourceGroup:layoutGroups[e.id]})),quality=inspectLayout(actual,width,height,margin);
 if(quality.outside.length||quality.overlaps.length)return null;
 return{width,height,mode:landscape?'landscape':width/height<=.8?'portrait':'square',design,solver:solverInfo,roles,placements,backgrounds:backgrounds.map(e=>e.id),layoutGroups,margin,gap,quality,warnings:['원본 문구·브랜드 줄·상품을 의미 있는 묶음으로 유지해 재배치했습니다.',...(short<500?['작은 출력에서는 세부 연락처와 긴 설명을 확대해 확인하세요.']:[])],counts:Object.fromEntries(['logo','title','subject','body','details'].map(role=>[role,foreground.filter(e=>roles[e.id]===role).length])),semanticUnits:units.map(u=>({id:u.id,role:u.role,band:u===header?'header':u===footer?'footer':extraHeaders.includes(u)?'extra-header':extraSubjects.includes(u)?'extra-subject':null,ids:u.items.map(e=>e.id)}))};
}
