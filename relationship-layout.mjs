import {regionCandidates,adaptDecorativeStrip} from './region-layout.mjs';
// Original, local rules over existing native objects. No text generation.
import {layeredTypeFamilyPlan} from './layered-type-family.mjs';
import {sourceOverlapRelations,paintOrderForRelations,appliedOverlapPairs} from './overlap-relations.mjs';
import {familyMasterPlan} from './family-master.mjs';
import {solverInfo} from './design-layout.mjs';
const rect=items=>{const x=Math.min(...items.map(e=>e.x)),y=Math.min(...items.map(e=>e.y));return{x,y,w:Math.max(...items.map(e=>e.x+e.w))-x,h:Math.max(...items.map(e=>e.y+e.h))-y};};
const area=e=>e.w*e.h,inside=(a,b)=>a.x>=b.x-1&&a.y>=b.y-1&&a.x+a.w<=b.x+b.w+1&&a.y+a.h<=b.y+b.h+1;
const isTime=e=>/^\s*\d{1,2}\s*[:：]\s*\d{2}\s*$/.test(e.text),isSuffix=e=>/^\s*[ap]\.?\s*m\.?\s*$/i.test(e.text),isSeparator=e=>/^\s*[/~–—-]\s*$/.test(e.text);
const isDay=e=>/monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekday|weekend|월요일|화요일|수요일|목요일|금요일|토요일|일요일|평일|주말|영업|운영/i.test(e.text);
const close=(a,b)=>Math.max(0,Math.max(a.y,b.y)-Math.min(a.y+a.h,b.y+b.h));
const overlap=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
const rowsOf=items=>{const rows=[];for(const e of [...items].sort((a,b)=>a.y-b.y||a.x-b.x)){let row=rows.find(r=>Math.abs(r[0].y-e.y)<Math.min(r[0].fontSize||r[0].h,e.fontSize||e.h)*.35);if(!row){row=[];rows.push(row);}row.push(e);}return rows.map(r=>r.sort((a,b)=>a.x-b.x));};
export function relationshipPlan(elements,{sourceWidth,sourceHeight,width,height,design=null}){
 if(!design?.skipRegion&&!design?.jointLayout&&!design?.titleSize&&!design?.bodySize&&!design?.imageSide){const generic=regionCandidates(elements,{sourceWidth,sourceHeight,width,height,design,measureText:design?.measureText});if(generic.plans.length)return generic.plans[0];}
 if(!design?.jointLayout||design.jointLayout.variant==='family'){const family=layeredTypeFamilyPlan(elements,{sourceWidth,sourceHeight,width,height,design})||familyMasterPlan(elements,{sourceWidth,sourceHeight,width,height,design});if(family)return family;if(design?.jointLayout?.variant==='family')throw review('원본 관계 마스터의 판별 조건을 충족하지 않습니다. 기존 구도를 검토합니다.');}
 elements=elements.map(e=>e.cutoutMethod&&!e.manualGroup&&e.role==='subject'?{...e,role:'other'}:e.role==='other'&&!e.manualGroup&&e.kind==='shape'&&e.shapeType==='rect'&&!e.text&&e.x<=sourceWidth*.025&&e.y<=sourceHeight*.025&&e.w>=sourceWidth*.95&&e.h>=sourceHeight*.95?{...e,role:'background'}:e);
 const fg=elements.filter(e=>!e.hidden&&e.role!=='background'),texts=fg.filter(e=>String(e.text||'').trim());
 const explicit=fg.some(e=>(e.manualRole||e.role)==='title')&&fg.some(e=>(e.manualRole||e.role)==='subject');
 const native=texts.filter(e=>e.kind==='text').length>=2;
 const separated=texts.length>=2&&fg.every(e=>['flat-background','original-alpha'].includes(e.cutoutMethod));
 if(!texts.length||fg.some(e=>e.locked)||!native&&!explicit&&!separated)return null;
 const images=fg.filter(e=>e.kind!=='text'&&!e.text&&((e.manualRole||e.role)==='subject'||e.kind==='image'&&e.h/e.w>.12)).sort((a,b)=>area(b)-area(a));
 if(!images.length)return null;
 const fromMemory=fg.every(e=>e.semanticBand?.startsWith('relations:')||e.manualGroup),maxFont=Math.max(...texts.map(e=>e.fontSize||0));
 if(!fromMemory&&!explicit&&(area(images[0])<sourceWidth*sourceHeight*.07||images[1]&&area(images[0])<area(images[1])*2.5))return null;
 const units=[],used=new Set();let seq=0;
 const add=(role,band,items,key)=>{items=items.filter(e=>!used.has(e.id));if(!items.length)return null;const u={id:key||'relations-'+seq++,role,band,items,b:rect(items)};units.push(u);items.forEach(e=>used.add(e.id));return u;};
 const manual=new Map();for(const e of fg)if(e.manualGroup){const k=e.manualGroup;if(!manual.has(k))manual.set(k,[]);manual.get(k).push(e);}
 for(const[key,items]of manual)add(items[0].manualRole||'body',items.some(isCTA)?'cta':items[0].manualRole==='details'?'hours':items[0].manualRole||'body',items,'manual:'+key);
 if(fromMemory){const groups=new Map();for(const e of fg)if(!used.has(e.id)){if(!groups.has(e.semanticUnit))groups.set(e.semanticUnit,[]);groups.get(e.semanticUnit).push(e);}for(const[key,items]of groups)add(items[0].semanticRole,items[0].semanticBand.slice(10),items,key);}
 else{
  // Respect explicit user roles and keep a CTA label with its source frame.
  for(const label of texts.filter(e=>!used.has(e.id)&&isCTA(e)&&(e.manualRole||e.role)!=='logo'))add('details','cta',fg.filter(e=>!used.has(e.id)&&(e===label||label.sourceGroup&&e.sourceGroup===label.sourceGroup||(separated||e.kind==='shape')&&!e.text&&inside(label,e)&&area(e)<sourceWidth*sourceHeight*.15)));
  for(const role of ['logo','title','subject','details','decoration']){
   const selected=fg.filter(e=>!used.has(e.id)&&e.role===role);if(!selected.length)continue;
   if(role==='subject')for(const e of selected)add(role,role,selected.filter(p=>p===e||e.sourceGroup&&p.sourceGroup===e.sourceGroup||!p.text&&inside(p,e)));
   else if(role==='logo')for(const band of ['header','footer'])add(role,band,selected.filter(e=>(e.y+e.h/2<sourceHeight/2?'header':'footer')===band));
   else add(role,role==='details'&&selected.some(isTime)?'hours':role,selected);
  }
  const bandItems=which=>fg.filter(e=>!used.has(e.id)&&e.role==='other'&&(which==='header'?e.y+e.h/2<sourceHeight*.18:e.y>sourceHeight*.82)&&(!e.text||e.text.length<64&&(e.fontSize||0)<maxFont*.36));
  add('logo','header',bandItems('header'));add('logo','footer',bandItems('footer'));
  const hero=images.find(e=>!used.has(e.id));if(!hero&&!units.some(u=>u.role==='subject'))return null;
  if(hero)add('subject','subject',fg.filter(e=>!used.has(e.id)&&(e===hero||!e.text&&inside(e,hero))));
  const large=texts.filter(e=>!used.has(e.id)&&(e.fontSize||0)>=maxFont*.45),families=new Map();
  for(const e of large){const k=e.fontFamily||'';if(!families.has(k))families.set(k,[]);families.get(k).push(e);}
  const major=[...families.values()].sort((a,b)=>b.reduce((n,e)=>n+(e.fontSize||0)*Math.min(24,e.text.length),0)-a.reduce((n,e)=>n+(e.fontSize||0)*Math.min(24,e.text.length),0))[0];
  if(!major?.length&&!units.some(u=>u.role==='title'))return null;
  if(major?.length&&!units.some(u=>u.role==='title'))add('title','title',major);
  for(const e of large.filter(e=>!used.has(e.id)))add('decoration','decoration',[e]);
  // The schedule is one local information block, not one cell per number.
  const times=new Set(texts.filter(e=>!used.has(e.id)&&isTime(e)));
  while(times.size){const group=[[...times][0]];times.delete(group[0]);let changed=true;while(changed){changed=false;for(const e of times)if(group.some(t=>close(e,t)<Math.max(t.h,e.h)*1.5)){group.push(e);times.delete(e);changed=true;}}
   const b=rect(group),near=texts.filter(e=>!used.has(e.id)&&(group.includes(e)||(isDay(e)||isSuffix(e)||isSeparator(e))&&close(e,b)<Math.max(b.h*2,sourceHeight*.06)&&e.x+e.w>b.x-sourceWidth*.15&&e.x<b.x+b.w+sourceWidth*.15));add('details','hours',near);}
  const remaining=texts.filter(e=>!used.has(e.id));
  for(const e of remaining){if(used.has(e.id))continue;const peers=remaining.filter(p=>!used.has(p.id)&&p.fontFamily===e.fontFamily&&close(p,e)<Math.min(p.h,e.h)*.5&&Math.abs(p.x-e.x)<sourceWidth*.08);add('body','body',peers);}
  for(const e of fg)if(!used.has(e.id))add(e.text?'body':'decoration',e.text?'body':'decoration',[e]);
 }
 const titles=units.filter(u=>u.role==='title'),subjects=units.filter(u=>u.role==='subject');if(!titles.length||!subjects.length)return null;
 const rtl=design?.direction==='rtl'||texts.reduce((n,e)=>n+((e.text.match(/[\u0590-\u08ff]/g)||[]).length),0)>texts.reduce((n,e)=>n+((e.text.match(/[A-Za-z\uac00-\ud7af]/g)||[]).length),0),readingRows=items=>rowsOf(items).map(row=>rtl?[...row].reverse():row);
 const short=Math.min(width,height),ratio=width/height,extremeWide=ratio>=3,extremeTall=ratio<=.4,mode=extremeWide?'extreme-landscape':extremeTall?'extreme-portrait':ratio>=1.25?'landscape':ratio<=.8?'portrait':'square',margin=short*.05,mx=width*.05,my=height*.05,gap=short*(extremeTall?.015:.025),W=width-2*mx;
 const placements=[],allowedOverlaps=[],relations=[];
 // A source id alone does not mean shared lettering: protect groups containing text.
 const decorative=units.filter(u=>u.role==='decoration'&&u.items.every(e=>!e.text&&!e.manualGroup&&!(e.sourceGroup&&fg.some(p=>p.text&&p.sourceGroup===e.sourceGroup))));
 const decorations=decorative.flatMap(u=>u.items.map(e=>({e,u,ribbon:e.kind==='shape'&&['rect','line','polygon','path'].includes(e.shapeType)&&(/ribbon|stripe|리본|띠|줄무늬/i.test(e.name)||e.w>e.h*5),floating:/star|sparkle|별|반짝/i.test(e.name)||e.shapeType==='triangle'})));
 const handledDecorations=new Set(decorations.filter(d=>d.ribbon||d.floating).map(d=>d.e.id));
 const target={title:Math.min(180,short*.17*(design?.titleScale||1)),body:Math.min(28,short*.034),details:Math.min(40,short*.047),logo:Math.min(24,short*.029),decoration:Math.min(70,short*.065)};
 const minimum={title:Math.max(16,Math.min(36,short*.06)),body:Math.max(9,Math.min(15,short*.026)),details:Math.max(10,Math.min(18,short*.032)),logo:Math.max(8,Math.min(13,short*.022)),decoration:Math.max(10,Math.min(22,short*.035))};
 if(design?.adaptiveTypography){if(design.titleSize)target.title=design.titleSize;if(design.bodySize){target.body=design.bodySize;target.details=design.bodySize;}for(const role of Object.keys(minimum))minimum[role]=Math.min(minimum[role],target[role]);}
 for(const role of Object.keys(target))target[role]=Math.max(target[role],minimum[role]);
 const zone=(e,u,b,size,align=extremeTall?'center':rtl?'right':'left')=>placements.push({id:e.id,role:u.role,groupRole:u.role,layoutGroup:u.id,x:b.x,y:b.y,w:b.w,h:b.h,scale:1,zone:b,readableBody:true,readableSize:size,minimumSize:minimum[u.role],align,textDirection:rtl?'rtl':'ltr',verticalAlign:'top'});
 const affine=(u,cell)=>{const s=Math.min(cell.w/u.b.w,cell.h/u.b.h,...(u.band==='cta'?u.items.filter(e=>e.text).map(e=>target.details/Math.max(1,e.fontSize)):[]),...u.items.filter(e=>e.kind==='image').map(e=>u.role==='subject'?Infinity:e.semanticMaxScale||1)),x=cell.x+(cell.w-u.b.w*s)/2,y=cell.y+(cell.h-u.b.h*s)/2;for(const e of u.items)placements.push({id:e.id,role:u.role,groupRole:u.role,layoutGroup:u.id,scale:s,x:x+(e.x-u.b.x)*s,y:y+(e.y-u.b.y)*s,w:e.w*s,h:e.h*s,zone:null,align:'center'});};
 // Existing overlaps are explicit, bounded relations; they are not forced in new ratios.
 for(const u of units)for(let i=0;i<u.items.length;i++)for(let j=i+1;j<u.items.length;j++){const a=u.items[i],b=u.items[j];if(overlap(a,b)>0&&(u.role==='subject'||u.role==='logo'||u.band==='cta'&&(separated||a.sourceGroup&&a.sourceGroup===b.sourceGroup||a.text&&inside(a,b)||b.text&&inside(b,a)))&&(a.kind!=='text'||b.kind!=='text'))allowedOverlaps.push([a.id,b.id]);}
 const observed=sourceOverlapRelations(elements,{acceptedPairs:design?.allowedOverlapPairs||[],groupIds:Object.fromEntries(units.flatMap(u=>u.items.map(e=>[e.id,u.id])))});relations.push(...observed);allowedOverlaps.push(...appliedOverlapPairs(observed));
 const textNeed=(u,w,size)=>readingRows(u.items).reduce((n,row)=>n+Math.max(...row.map(e=>Math.max(1,Math.ceil((e.textWidth||e.inkWidth||e.w)/Math.max(1,e.fontSize)*size/w))*size*Math.max(1.5,e.h/Math.max(1,e.fontSize)/Math.max(1,e.lineCount||1)))),0);
 const flow=(u,cell,size=target[u.role])=>{
  if(u.items.some(e=>e.kind!=='text')){const before=placements.length;affine(u,cell);for(const p of placements.slice(before)){const e=u.items.find(e=>e.id===p.id);if(e.text&&((e.fontSize||e.h*.7)*p.scale)<minimum[u.role]-.1)throw review('이미지형 글자 묶음을 읽을 크기로 배치할 공간이 부족합니다. 더 큰 규격이나 묶음을 확인하세요.');}return;}
  const rows=readingRows(u.items).flatMap(row=>u.role==='title'&&row.length>1&&row.reduce((n,e)=>n+(e.textWidth||e.inkWidth||e.w)/Math.max(1,e.fontSize)*size,0)+size*.18*(row.length-1)>cell.w?row.map(e=>[e]):[row]),needs=rows.map(row=>{const natural=row.map(e=>(e.textWidth||e.inkWidth||e.w)/Math.max(1,e.fontSize)*size),total=natural.reduce((a,b)=>a+b,0)+size*.18*(row.length-1);return {row,natural,total,lines:Math.max(1,Math.ceil(total/cell.w))};}),totalLines=needs.reduce((n,r)=>n+r.lines,0),lineH=Math.min(cell.h/totalLines,u.role==='title'?size*1.1:Infinity);let y=cell.y;
  for(const r of needs){const h=lineH*r.lines,g=Math.min(gap*.35,size*.18),available=cell.w-g*(r.row.length-1),sum=r.natural.reduce((a,b)=>a+b,0);let x=extremeTall?cell.x+(r.row.length===1?0:(cell.w-Math.min(cell.w,sum+size*.08*r.row.length+g*(r.row.length-1)))/2):rtl?cell.x+cell.w:cell.x;
   for(let i=0;i<r.row.length;i++){const w=r.row.length===1?cell.w:r.total<=cell.w?r.natural[i]+size*.08:available*r.natural[i]/sum;zone(r.row[i],u,{x:rtl?x-w:x,y,w:Math.max(1,w),h},size);x+=(rtl?-1:1)*(w+g);}y+=h;
  }
 };
 const schedule=(u,cell)=>{
  const times=u.items.filter(isTime).sort((a,b)=>a.x-b.x),suffixes=u.items.filter(isSuffix),seps=u.items.filter(isSeparator),labels=u.items.filter(e=>!times.includes(e)&&!suffixes.includes(e)&&!seps.includes(e));
  if(times.length<1||u.items.some(e=>e.kind!=='text')){flow(u,cell);return;}
  const labelH=labels.length?cell.h*.4:0,rowY=cell.y+labelH,rowH=cell.h-labelH,sepW=seps.length?Math.min(target.details*.6,cell.w*.04):0,g=gap*.35;
  if(labels.length)flow({...u,items:labels},{x:cell.x,y:cell.y,w:cell.w,h:labelH},Math.max(minimum.details,target.details*.72));
  const unused=new Set(suffixes),parts=[];const suffixSize=Math.max(minimum.details,target.details*.55);
  times.forEach((e,i)=>{const suffix=[...unused].sort((a,b)=>Math.abs(a.x-e.x)-Math.abs(b.x-e.x))[0];if(suffix)unused.delete(suffix);parts.push({e,size:target.details,w:(e.inkWidth||e.w)/Math.max(1,e.fontSize)*target.details+target.details*.12});if(suffix)parts.push({e:suffix,size:suffixSize,w:(suffix.inkWidth||suffix.w)/Math.max(1,suffix.fontSize)*suffixSize+suffixSize*.15,suffix:true});if(seps[i])parts.push({e:seps[i],size:target.details,w:sepW});});
  const sum=parts.reduce((n,p)=>n+p.w,0)+g*(parts.length-1),scale=Math.min(1,cell.w/sum);let x=cell.x;
  for(const p of parts){const w=p.w*scale;zone(p.e,u,{x,y:rowY+(p.suffix?rowH*.12:0),w,h:rowH*(p.suffix?.8:1)},p.size);x+=w+g*scale;}
  // Unmatched tokens stay in the block; no text is omitted to force a fit.
  if(unused.size||seps.length>Math.max(0,times.length-1))throw review('영업정보 연결을 확인해 주세요. 묶음 지정으로 함께 읽을 항목을 조정할 수 있습니다.');
 };
 const brand=(u,cell)=>{
  const frame=cell;cell={...cell,y:cell.y+gap*.3,h:cell.h-gap*.6};
  const pictures=u.items.filter(e=>e.kind!=='text'),thin=pictures.filter(e=>e.h/e.w<.08),logos=pictures.filter(e=>!thin.includes(e));
  if(logos.length!==1){affine(u,cell);return;}
  const logo=logos[0],b=rect([logo]),center=e=>e.x+e.w/2,embedded=u.items.filter(e=>e===logo||e.kind==='text'&&center(e)>=b.x&&center(e)<=b.x+b.w&&e.y+e.h/2>=b.y&&e.y+e.h/2<=b.y+b.h),rest=u.items.filter(e=>!embedded.includes(e)&&!thin.includes(e)),col=(cell.w-gap*2)/3;
  affine({...u,items:embedded,b:rect(embedded)},{x:cell.x+col+gap,y:cell.y,w:col,h:cell.h});
  for(const side of [0,1]){const items=rest.filter(e=>(center(e)<center(logo)?0:1)===side);if(items.length)flow({...u,items},{x:cell.x+(side?2*(col+gap):0),y:cell.y,w:col,h:cell.h},target.logo);}
  for(const e of thin)affine({...u,items:[e],b:rect([e])},{x:frame.x,y:u.band==='header'?frame.y+frame.h:frame.y,w:frame.w,h:Math.max(1,short*.004)});
 };
 const joint=design?.jointLayout||{},brands=units.filter(u=>u.role==='logo'),bandH=Math.max(short*.075,minimum.logo*4.2+gap*.6),brandColumns=width>=900?Math.min(2,brands.length)||1:1;
 const bandRows=Math.ceil(brands.length/brandColumns),brandHeight=bandRows*(bandH+gap*.5),brandW=(W-gap*(brandColumns-1))/brandColumns;
 const anchor=extremeWide?'left':extremeTall?'top':joint.anchor||'bottom';let top=my,bottom=height-my;
 if(!extremeWide&&!extremeTall){
 if(anchor==='split'&&brands.length>1){const head=brands.slice(0,Math.ceil(brands.length/2)),foot=brands.slice(head.length);for(const [list,start]of [[head,true],[foot,false]]){const h=list.length*(bandH+gap*.5);list.forEach((u,i)=>brand(u,{x:mx,y:(start?top:bottom-h)+i*(bandH+gap*.5),w:W,h:bandH}));if(start)top+=h+gap;else bottom-=h+gap;}}
 else if(brands.length){const start=anchor==='top'?top:bottom-brandHeight;brands.forEach((u,i)=>brand(u,{x:mx+(i%brandColumns)*(brandW+gap),y:start+Math.floor(i/brandColumns)*(bandH+gap*.5),w:brandW,h:bandH}));if(anchor==='top')top+=brandHeight+gap;else bottom-=brandHeight+gap;}
 }
 const copy=units.filter(u=>!brands.includes(u)&&u.role!=='subject').map(u=>({...u,items:u.items.filter(e=>!handledDecorations.has(e.id))})).filter(u=>u.items.length),art=subjects,main={x:mx,y:top,w:W,h:bottom-top};
 const order={title:0,body:1,details:2,decoration:3,logo:4};copy.sort((a,b)=>(order[a.role]??5)-(order[b.role]??5)||a.b.y-b.b.y);
 const stack=(list,cell)=>{
  if(!list.length)return;const weights=list.map(u=>u.role==='title'?Math.max(target.title*2.7,textNeed(u,cell.w,target.title)):u.role==='details'?target.details*2.7:u.role==='decoration'?target.decoration*1.2:u.role==='body'?Math.max(target.body*2.3,textNeed(u,cell.w,target.body)):target.logo*2.4),space=cell.h-gap*(list.length-1),sum=weights.reduce((a,b)=>a+b,0);
  const floors=list.map(u=>u.role==='details'?minimum.details*3.5:Math.max(minimum[u.role]*1.4,textNeed(u,cell.w,minimum[u.role]),u.role==='title'?u.items.length*minimum.title*1.4:0)),required=floors.reduce((a,b)=>a+b,0);if(required>space)throw review('원문과 필수 정보를 읽을 수 있는 공간이 부족합니다. 더 큰 규격 또는 묶음 배치를 선택하세요.');let y=cell.y;
  list.forEach((u,i)=>{const h=floors[i]+(space-required)*weights[i]/sum,b={x:cell.x,y,w:cell.w,h};if(u.band==='hours')schedule(u,b);else flow(u,b);y+=h+gap;});
 };
 const artIn=cell=>{const h=(cell.h-gap*(art.length-1))/art.length;art.forEach((u,i)=>affine(u,{x:cell.x,y:cell.y+i*(h+gap),w:cell.w,h}));};
 const variant=extremeWide?'inline':extremeTall?'center-stack':joint.variant||(mode==='landscape'?'columns':mode==='square'?'headline':'stack');
 if(extremeWide){
  const bw=brands.length?W*(joint.brandShare||.16):0,cw=(W-bw-gap*(brands.length?2:1))*(joint.copyShare||.62),ix=mx+bw+(brands.length?gap:0)+cw+gap;
  if(brands.length)brands.forEach((u,i)=>flow(u,{x:mx,y:my+i*main.h/brands.length,w:bw,h:main.h/brands.length-gap},target.logo));
  stack(copy,{x:mx+bw+(brands.length?gap:0),y:my,w:cw,h:main.h});artIn({x:ix,y:my,w:width-mx-ix,h:main.h});
 }else if(extremeTall){
  const heading=copy.filter(u=>u.role==='title'),other=copy.filter(u=>u.role!=='title'),bh=brands.length?main.h*.12:0,hh=main.h*(joint.headShare||.23),ih=main.h*(joint.imageShare||.40),by=my+bh+(brands.length?gap:0);
  brands.forEach((u,i)=>flow(u,{x:mx,y:my+i*bh/brands.length,w:W,h:bh/brands.length-gap},target.logo));
  stack(heading,{x:mx,y:by,w:W,h:hh});artIn({x:mx,y:by+hh+gap,w:W,h:ih});
  stack(other,{x:mx,y:by+hh+ih+2*gap,w:W,h:height-my-by-hh-ih-2*gap});
 }else if(variant==='columns'){
  const share=joint.copyShare||design?.copyShare||.54,cw=(main.w-gap)*share,iw=main.w-gap-cw,left=design?.imageSide?design.imageSide==='left':rtl;
  stack(copy,{x:left?main.x+iw+gap:main.x,y:main.y,w:cw,h:main.h});artIn({x:left?main.x:main.x+cw+gap,y:main.y,w:iw,h:main.h});
 }else if(variant==='headline'){
  const heading=copy.filter(u=>u.role==='title'),other=copy.filter(u=>!heading.includes(u)),headH=main.h*(joint.headShare||.31),lowerY=main.y+headH+gap,lowerH=main.h-headH-gap,iw=(main.w-gap)*(joint.imageShare||.51),artRight=rtl;
  stack(heading,{x:main.x,y:main.y,w:main.w,h:headH});artIn({x:artRight?main.x+main.w-iw:main.x,y:lowerY,w:iw,h:lowerH});if(other.length)stack(other,{x:artRight?main.x:main.x+iw+gap,y:lowerY,w:main.w-iw-gap,h:lowerH});
 }else{
  const heading=copy.filter(u=>u.role==='title'),other=copy.filter(u=>!heading.includes(u)),headH=main.h*(joint.headShare||.25),artH=main.h*(joint.imageShare||.40),artFirst=variant==='hero-first';
  stack(heading,{x:main.x,y:main.y+(artFirst?artH+gap:0),w:main.w,h:headH});artIn({x:main.x,y:main.y+(artFirst?0:headH+gap),w:main.w,h:artH});if(other.length)stack(other,{x:main.x,y:main.y+headH+artH+2*gap,w:main.w,h:main.h-headH-artH-2*gap});
 }
 // Keep plain ribbon graphics behind content. Never stretch unknown raster lettering.
 for(const {e,u,ribbon,floating} of decorations){
  if(!handledDecorations.has(e.id))continue;
  if(ribbon){
   const p=adaptDecorativeStrip(e,{width,height,sourceWidth,sourceHeight,placements,elements});if(!p)throw review('구분선·리본과 글자·상품을 띄울 공간이 없습니다.');placements.push({id:e.id,role:'decoration',groupRole:'decoration',layoutGroup:u.id,...p});continue;
  }
  const size=Math.max(6,Math.min(32,short*.06)),s=Math.min(size/e.w,size/e.h),w=e.w*s,h=e.h*s,occupied=placements.filter(p=>p.role!=='decoration');let best=null;
  for(let row=0;row<=16;row++)for(let col=0;col<=16;col++){const b={x:(width-w)*col/16,y:(height-h)*row/16,w,h};const clear=occupied.every(p=>{const dx=Math.max(0,p.x-b.x-b.w,b.x-p.x-p.w),dy=Math.max(0,p.y-b.y-b.h,b.y-p.y-p.h);return Math.hypot(dx,dy)>=(p.readableBody||p.role==='title'||p.role==='body'||p.role==='details'||p.role==='logo'?24:gap);})&&placements.filter(p=>p.decorationKind==='floating').every(p=>!overlap(b,p));if(clear){const score=Math.hypot(b.x+ w/2-width*(e.x+e.w/2)/sourceWidth,b.y+h/2-height*(e.y+e.h/2)/sourceHeight);if(!best||score<best.score)best={...b,score};}}
  best??={x:Math.max(0,Math.min(width-w,width*(e.x+e.w/2)/sourceWidth-w/2)),y:Math.max(0,Math.min(height-h,height*(e.y+e.h/2)/sourceHeight-h/2)),w,h};
  placements.push({id:e.id,role:'decoration',groupRole:'decoration',layoutGroup:u.id,...best,scale:s,decorationKind:'floating',deferredFloating:true,floatingPreference:{x:(e.x+e.w/2)/sourceWidth,y:(e.y+e.h/2)/sourceHeight}});
 }
 if(placements.length!==fg.length||new Set(placements.map(p=>p.id)).size!==fg.length)return null;
 const roles=Object.fromEntries(elements.map(e=>[e.id,e.role]));for(const u of units)for(const e of u.items)roles[e.id]=u.role;
 const rank=e=>e.role==='background'?0:handledDecorations.has(e.id)?1:roles[e.id]==='subject'?2:e.text||roles[e.id]==='logo'?3:2;
 const paintOrder=paintOrderForRelations(elements,relations,rank).order;
 return {engine:'relationships-v1',width,height,mode,orientationRule:extremeWide?'horizontal-inline':extremeTall?'vertical-center':'standard-balanced',safeZone:{x:mx,y:my,w:W,h:height-2*my},decorations:placements.filter(p=>p.decorationKind).map(p=>({id:p.id,kind:p.decorationKind})),paintOrder,validation:{status:'planned',geometry:'not_run',textProductCollision:'not_run',decorationDistance:'not_run',aesthetic:'not_run',criticalProductRegion:'not_run'},design,candidate:joint.id||null,layoutLabel:joint.label||'',brandAnchor:anchor,anchorAffinity:brands.length?brands.filter(u=>anchor==='split'||anchor==='top'&&u.band==='header'||anchor==='bottom'&&u.band==='footer').length/brands.length:0,overlapPolicy:'source-observed-or-explicit-with-review',readingDirection:rtl?'rtl':'ltr',solver:solverInfo,roles,placements,backgrounds:elements.filter(e=>!e.hidden&&e.role==='background').map(e=>e.id),margin,gap,layoutGroups:Object.fromEntries(units.flatMap(u=>u.items.map(e=>[e.id,u.id]))),semanticUnits:units.map(u=>({id:u.id,role:u.role,band:'relations:'+u.band,ids:u.items.map(e=>e.id),importance:{title:5,subject:5,details:4,logo:4,body:3,decoration:1}[u.role]})),allowedOverlaps,relations,quality:{outside:[],overlaps:[]},warnings:fg.some(e=>e.text&&e.kind!=='text')?['이미지형 글자는 원본 픽셀을 보존해 이동·균등 배율만 적용했습니다. 줄바꿈과 글꼴은 복원하지 않았습니다.']:[]};
}
function isCTA(e){return /^\s*(?:shop now|learn more|join now|sign up(?: now)?|buy now|download(?: now)?|get started|구매하기|신청하기|예약하기|자세히 보기|더 알아보기|문의하기|바로 구매)\s*[!！]?\s*$/i.test(e.text||'');}
function review(message){const e=Error('조정 필요: '+message);e.code='LAYOUT_NEEDS_REVIEW';return e;}

