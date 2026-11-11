import {sourceOverlapRelations,paintOrderForRelations,appliedOverlapPairs} from './overlap-relations.mjs';
// Original family rules inferred from native geometry, typography and overlaps.
// No file-name, wording, asset id or generated image is used to choose a family.
const bounds=a=>{const x=Math.min(...a.map(e=>e.x)),y=Math.min(...a.map(e=>e.y));return{x,y,w:Math.max(...a.map(e=>e.x+e.w))-x,h:Math.max(...a.map(e=>e.y+e.h))-y};};
const intersection=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
const time=e=>/^\s*\d{1,2}\s*[:：]\s*\d{2}\s*$/.test(e.text),suffix=e=>/^\s*[ap]\.?\s*m\.?\s*$/i.test(e.text),separator=e=>/^\s*[/~–—-]\s*$/.test(e.text),day=e=>/monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekday|weekend|월요일|화요일|수요일|목요일|금요일|토요일|일요일|평일|주말|영업|운영/i.test(e.text);
const review=message=>{const e=Error('조정 필요: '+message);e.code='LAYOUT_NEEDS_REVIEW';return e;};
export function tightNativeBox(o,b){
 if(!o.text||o.textLines?.length!==1||Math.abs(o.skewX||0)>.02||Math.abs(o.skewY||0)>.02)return null;
 const width=Math.min(o.width,o.calcTextWidth()+1),old=o.width;if(width>=old*.99)return null;
 const sx=Math.abs(o.scaleX||1),sy=Math.abs(o.scaleY||1),r=(o.angle||0)*Math.PI/180,c=o.getCenterPoint(),dx=(o.textAlign==='center'?0:o.textAlign==='right'?(old-width)/2:(width-old)/2)*sx,cx=c.x+dx*Math.cos(r),cy=c.y+dx*Math.sin(r),w=(width+(o.strokeWidth||0))*sx*Math.abs(Math.cos(r))+(o.height+(o.strokeWidth||0))*sy*Math.abs(Math.sin(r)),h=(width+(o.strokeWidth||0))*sx*Math.abs(Math.sin(r))+(o.height+(o.strokeWidth||0))*sy*Math.abs(Math.cos(r));
 return{x:cx-w/2,y:cy-h/2,w,h,nativeTightWidth:width};
}
export function familyMasterPlan(elements,{sourceWidth,sourceHeight,width,height,design=null}){
 // Preserve existing explicit typography/side controls through the legacy
 // planner until their interaction with this family has been measured.
 if(design?.titleSize||design?.bodySize||design?.imageSide)return null;
 const ar=width/height;if(ar>=3||ar<=.4||Math.min(width,height)<400)return null;
 const fg=elements.filter(e=>!e.hidden&&e.role!=='background'),texts=fg.filter(e=>e.kind==='text'&&e.text?.trim()),images=fg.filter(e=>e.kind==='image'&&!e.text&&e.h/e.w>.12).sort((a,b)=>b.w*b.h-a.w*a.h);
 if(texts.length<8||fg.some(e=>e.locked||e.manualGroup||e.manualRole)||!images.length||images[0].w*images[0].h<sourceWidth*sourceHeight*.07||images[1]&&images[0].w*images[0].h<images[1].w*images[1].h*3)return null;
 const hero=images[0],maxFont=Math.max(...texts.map(e=>e.fontSize||0)),large=texts.filter(e=>(e.fontSize||0)>=maxFont*.45),families=new Map();
 for(const e of large){const key=e.fontFamily||'';if(!families.has(key))families.set(key,[]);families.get(key).push(e);}
 const remembered=texts.filter(e=>e.semanticUnit==='family:title'||e.semanticBand==='family:title'),title=remembered.length>=2?remembered:[...families.values()].sort((a,b)=>b.reduce((n,e)=>n+e.fontSize*e.text.length,0)-a.reduce((n,e)=>n+e.fontSize*e.text.length,0))[0];
 if(!title||title.length<2||title.length>8)return null;
 const savedAccent=texts.filter(e=>e.semanticBand==='family:visual'&&!title.includes(e)),accent=savedAccent.length===1?savedAccent:large.filter(e=>!title.includes(e)&&e.fontFamily!==title[0].fontFamily&&intersection(e,hero)>Math.min(e.w*e.h,hero.w*hero.h)*.08);
 if(accent.length!==1||Math.abs(accent[0].angle||0)>25)return null;
 const used=new Set([...title,...accent,hero].map(e=>e.id));
 const band=(bottom)=>fg.filter(e=>!used.has(e.id)&&(bottom?e.y>sourceHeight*.8:e.y+e.h/2<sourceHeight*.2)&&(!e.text||e.text.length<64&&(e.fontSize||0)<maxFont*.3));
 const header=band(false),footer=band(true);if(header.filter(e=>e.text).length<2||footer.filter(e=>e.text).length<2)return null;
 [...header,...footer].forEach(e=>used.add(e.id));
 const underlay=fg.filter(e=>!used.has(e.id)&&!e.text&&e.x>=hero.x-1&&e.y>=hero.y-1&&e.x+e.w<=hero.x+hero.w+1&&e.y+e.h<=hero.y+hero.h+1);underlay.forEach(e=>used.add(e.id));
 const hours=fg.filter(e=>!used.has(e.id)&&e.text&&(time(e)||suffix(e)||separator(e)||day(e)));hours.forEach(e=>used.add(e.id));
 const body=fg.filter(e=>!used.has(e.id)&&e.kind==='text'&&e.text);body.forEach(e=>used.add(e.id));if(used.size!==fg.length||!body.length||!hours.some(time))return null;
 const short=Math.min(width,height),mode=ar>=1.25?'landscape':ar<=.8?'portrait':'square',flavor=design?.jointLayout?.familyVariant??(design?.variant==='visual'?1:design?.variant==='minimal'?2:0),mx=width*.05,my=height*.05,W=width-2*mx,gap=short*(mode==='square'?.01:.018);
 const placements=[],units=[],allowedOverlaps=[],roles=Object.fromEntries(elements.map(e=>[e.id,e.role])),layoutGroups={},protectedRegions=[];
 const unit=(id,role,band,items)=>{const u={id:'family:'+id,role,band:'family:'+band,items};units.push(u);for(const e of items){roles[e.id]=role;layoutGroups[e.id]=u.id;}return u;};
 const headerU=unit('header','logo','header',header),footerU=unit('footer','logo','footer',footer),titleU=unit('title','title','title',title),artU=unit('visual','subject','visual',[hero,...underlay,...accent]),hoursU=unit('hours','details','hours',hours),bodyU=unit('body','body','body',body);
 const effective=e=>e.tightBox?{...e,...e.tightBox}:e;
 const affine=(u,items,cell)=>{const input=items.map(effective),b=bounds(input),s=Math.min(cell.w/b.w,cell.h/b.h),x=cell.x+(cell.alignX==='left'?0:cell.alignX==='right'?cell.w-b.w*s:(cell.w-b.w*s)/2),y=cell.y+(cell.h-b.h*s)/2;for(const e of input)placements.push({id:e.id,role:accent.some(a=>a.id===e.id)?'decoration':u.role,groupRole:accent.some(a=>a.id===e.id)?'decoration':u.role,layoutGroup:u.id,x:x+(e.x-b.x)*s,y:y+(e.y-b.y)*s,w:e.w*s,h:e.h*s,scale:s,zone:null,nativeTightWidth:e.nativeTightWidth});return{...b,s,x,y,w:b.w*s,h:b.h*s};};
 const zone=(e,u,b,size,align='left',minimum=12)=>placements.push({id:e.id,role:u.role,groupRole:u.role,layoutGroup:u.id,x:b.x,y:b.y,w:b.w,h:b.h,scale:1,zone:b,readableBody:true,readableSize:size,minimumSize:minimum,align,verticalAlign:'top'});
 const rowList=[];for(const e of [...title].sort((a,b)=>a.y-b.y||a.x-b.x)){let r=rowList.find(r=>Math.abs(r[0].y-e.y)<Math.min(r[0].fontSize,e.fontSize)*.35);if(!r){r=[];rowList.push(r);}r.push(e);}rowList.forEach(r=>r.sort((a,b)=>a.x-b.x));
 if(rowList.length>3)return null;
 // User preference: keep headline rows together below the product in every standard ratio.
 const ratioWidth=e=>(e.inkWidth||e.textWidth||e.w)/Math.max(1,e.fontSize),titleRows=(cell,font,sideInfo=false)=>{
  const widest=Math.max(...rowList.map(r=>r.reduce((n,e)=>n+ratioWidth(e),0)+.24*(r.length-1))),fontSize=Math.min(font,(cell.w-2)/widest);if(fontSize<Math.max(24,short*.025))throw review('제목의 원래 단어 행을 유지할 공간이 부족합니다.');
  const leading=fontSize*.88;rowList.forEach((row,ri)=>{const rowW=row.reduce((n,e)=>n+ratioWidth(e)*fontSize+2,0)+fontSize*.24*(row.length-1),center=mode!=='landscape'&&!(sideInfo&&ri===rowList.length-1);let x=center?cell.x+(cell.w-rowW)/2:cell.x;for(const e of row){const w=ratioWidth(e)*fontSize+2;zone(e,titleU,{x,y:cell.y+ri*leading,w,h:fontSize*1.18},fontSize,'left',Math.max(24,short*.025));x+=w+fontSize*.24;}});return{fontSize,bottom:cell.y+(rowList.length-1)*leading+fontSize*1.18,firstY:cell.y};
 };
 const bodyFlow=(cell,size)=>{const h=(cell.h-gap*(body.length-1))/body.length;body.forEach((e,i)=>zone(e,bodyU,{x:cell.x,y:cell.y+i*(h+gap),w:cell.w,h},size,'left',Math.max(12,short*.012)));};
 const schedule=cell=>{const times=hours.filter(time).sort((a,b)=>a.x-b.x),suffixes=hours.filter(suffix),seps=hours.filter(separator),labels=hours.filter(e=>!times.includes(e)&&!suffixes.includes(e)&&!seps.includes(e));if(times.length>3||labels.length>2)return false;const size=Math.min(short*(mode==='square'?.033:.041),cell.w/Math.max(1,times.length*3.7)),labelSize=size*.65,labelH=labels.length?labelSize*1.35:0;labels.forEach((e,i)=>zone(e,hoursU,{x:cell.x,y:cell.y+i*labelH,w:cell.w,h:labelH},labelSize,'left',12));const unused=new Set(suffixes),parts=[];times.forEach((e,i)=>{parts.push({e,size,w:ratioWidth(e)*size+2});const s=[...unused].sort((a,b)=>Math.abs(a.x-e.x)-Math.abs(b.x-e.x))[0];if(s){unused.delete(s);parts.push({e:s,size:size*.47,w:ratioWidth(s)*size*.47+2});}if(seps[i])parts.push({e:seps[i],size,w:Math.max(8,ratioWidth(seps[i])*size)});});if(unused.size||seps.length>times.length-1)return false;const g=size*.13,total=parts.reduce((n,p)=>n+p.w,0)+g*(parts.length-1),scale=Math.min(1,cell.w/total);let x=cell.x;for(const p of parts){const w=p.w*scale;zone(p.e,hoursU,{x,y:cell.y+labelH+(p.size<size?size*.23:0),w,h:cell.h-labelH-(p.size<size?size*.23:0)},p.size*scale,'left',p.size<size?10:14);x+=w+g*scale;}return true;};
 const brandH=short*(mode==='portrait'?.09:mode==='square'?.049:.085),headerBox={x:mx,y:my,w:W,h:brandH},footerBox={x:mx,y:height-my-brandH,w:W,h:brandH};
 const brandBand=(u,items,cell)=>{const lines=items.filter(e=>!e.text&&e.w/e.h>20),pictures=items.filter(e=>!e.text&&!lines.includes(e));if(pictures.length!==1){affine(u,items,cell);return;}const logo=pictures[0],cx=logo.x+logo.w/2,embedded=items.filter(e=>e===logo||e.text&&e.x+e.w/2>=logo.x&&e.x+e.w/2<=logo.x+logo.w&&e.y+e.h/2>=logo.y&&e.y+e.h/2<=logo.y+logo.h),others=items.filter(e=>!embedded.includes(e)&&!lines.includes(e)),bodyY=cell.y+(u===footerU?gap*.70:0),bodyH=cell.h*.72,col=cell.w*.30;affine(u,embedded,{x:cell.x+(cell.w-col)/2,y:bodyY,w:col,h:bodyH});for(const side of ['left','right']){const a=others.filter(e=>(e.x+e.w/2<cx?'left':'right')===side);if(a.length)affine(u,a,{x:side==='left'?cell.x:cell.x+cell.w-col,y:bodyY,w:col,h:bodyH,alignX:side});}for(const e of lines){const h=cell.w/e.w*e.h;affine(u,[e],{x:cell.x,y:u===headerU?cell.y+cell.h-h:cell.y,w:cell.w,h});}};
 brandBand(headerU,header,headerBox);brandBand(footerU,footer,footerBox);
 const top=my+brandH+gap,bottom=footerBox.y-gap,H=bottom-top;let artBox,titleBox,infoBox,bodyBox,titleFont;
 if(mode==='landscape'){
  const split=.51+(flavor===1?-.04:flavor===2?.04:0),cw=(W-gap)*split,iw=W-gap-cw;
  artBox={x:mx+cw+gap,y:top,w:iw,h:H};titleFont=Math.min(short*.19,H*.27);titleBox={x:mx,y:top+H*.06,w:cw,h:H*.53};
  infoBox={x:mx,y:top+H*.61,w:cw,h:H*.13};bodyBox={x:mx,y:top+H*.80,w:cw,h:H*.19};
 }else if(mode==='square'){
  const reserve=short*.066,preferredFont=short*.086*(flavor===1?.96:flavor===2?1.04:1),titleFactor=(rowList.length-1)*.88+1.18-.27,artH=Math.min(height*(.56+(flavor===1?.015:flavor===2?-.02:0)),H-reserve-gap*.6-preferredFont*titleFactor);
  artBox={x:mx,y:top,w:W,h:artH};titleFont=preferredFont;titleBox={x:mx,y:top+artH-titleFont*.27,w:W,h:height*.25};const titleBottom=titleBox.y+(rowList.length-1)*titleFont*.88+titleFont*1.18;
  infoBox={x:mx+W*.74,y:titleBox.y+titleFont*.65,w:W*.26,h:titleFont*.9};bodyBox={x:mx,y:titleBottom+gap*.6,w:W,h:bottom-titleBottom-gap*.6};
 }else{
  const artShare=(mode==='portrait'?.53:.44)+(flavor===1?.025:flavor===2?-.02:0);artBox={x:mx,y:top,w:W,h:height*artShare};
  titleFont=Math.min(short*(mode==='portrait'?.17:.11),(bottom-top-artBox.h-short*.065-gap*.6)/((rowList.length-1)*.88+1.18-.27));titleBox={x:mx,y:top+artBox.h-titleFont*.27,w:W,h:height*.25};
  const titleBottom=titleBox.y+(rowList.length-1)*titleFont*.88+titleFont*1.18;
  infoBox={x:mx+W*.62,y:titleBox.y+(rowList.length-1)*titleFont*.88+titleFont*.26,w:W*.38,h:titleFont*.75};
  bodyBox={x:mx,y:titleBottom+gap*.6,w:W,h:bottom-titleBottom-gap*.6};
 }
 const art=affine(artU,[hero,...underlay,...accent],artBox),headline=titleRows(titleBox,titleFont,mode==='portrait');
 if(!schedule(infoBox))return null;
 if(bodyBox.h<short*.045)throw review('본문·영업정보와 상하 브랜드를 함께 둘 공간이 부족합니다.');bodyFlow(bodyBox,short*(mode==='portrait'?.024:.023));
 // Preserve only observed original overlaps, and confine headline/product
 // overlap to the original lower-product region. Script/product is intentional.
 for(const u of units)for(let i=0;i<u.items.length;i++)for(let j=i+1;j<u.items.length;j++)if(intersection(u.items[i],u.items[j])>0||u===titleU)allowedOverlaps.push([u.items[i].id,u.items[j].id]);
 const hp=placements.find(p=>p.id===hero.id),titleProduct=title.filter(e=>intersection(e,hero)>0),protectedFraction=titleProduct.length?Math.max(.62,Math.min(.9,Math.min(...titleProduct.map(t=>(Math.max(t.y,hero.y)-hero.y)/hero.h))-.03)):.9;
 for(const e of titleProduct){const p=placements.find(p=>p.id===e.id);if(p.y>=hp.y+hp.h*protectedFraction)allowedOverlaps.push([hero.id,e.id]);}
 protectedRegions.push({id:hero.id,x:hp.x,y:hp.y,w:hp.w,h:hp.h*protectedFraction,except:accent.map(e=>e.id),method:'source-observed-title-overlap-boundary'});
 if(placements.length!==fg.length)return null;
 const rank=e=>e.role==='background'?0:roles[e.id]==='subject'&&e.kind!=='text'?1:2,observed=sourceOverlapRelations(elements,{acceptedPairs:allowedOverlaps,groupIds:layoutGroups});allowedOverlaps.push(...appliedOverlapPairs(observed));
 return{engine:'relationships-v1',family:'native-hero-editorial-v1',familyVariant:flavor,width,height,mode,orientationRule:'standard-balanced',safeZone:{x:mx,y:my,w:W,h:height-2*my},margin:short*.05,gap,design,candidate:'family-'+mode+'-'+flavor,layoutLabel:'원본 관계 · '+({landscape:'좌우 편집',portrait:'중앙 세로',square:'중앙 정사각'}[mode]),brandAnchor:'split',anchorAffinity:1,roles,placements,layoutGroups,semanticUnits:units.map(u=>({id:u.id,role:u.role,band:u.band,ids:u.items.map(e=>e.id),importance:u.role==='subject'||u.role==='title'?5:4})),backgrounds:elements.filter(e=>!e.hidden&&e.role==='background').map(e=>e.id),paintOrder:paintOrderForRelations(elements,observed,rank).order,allowedOverlaps,protectedRegions,overlapPolicy:'preserve-observed-and-explicit-intent',relations:[...observed,{type:'observed-script-product',ids:[hero.id,...accent.map(e=>e.id)]},{type:'source-title-rows',rows:rowList.map(r=>r.map(e=>e.id))},{type:'header-footer-preserved'}],decorations:[],quality:{outside:[],overlaps:[]},validation:{status:'planned',geometry:'not_run',readability:'not_run',aesthetic:'not_run',criticalProductRegion:'not_run'},warnings:['원본의 제목 행·상품 위 장식·상하 브랜드 관계를 규격별 마스터로 배치했습니다. 실제 가림과 미관을 확인하세요.']};
}


