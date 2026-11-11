import {catalogEvidence} from './catalog-evidence.mjs';
import {inferPosterMaterials,provenSeparatePaint} from './poster-material-evidence.mjs';
// Evidence over existing objects, not a semantic model or a raster segmenter.
const roles=new Set(['logo','title','subject','body','details','decoration','background']);
export const graphBounds=a=>{const x=Math.min(...a.map(e=>e.x)),y=Math.min(...a.map(e=>e.y));return{x,y,w:Math.max(...a.map(e=>e.x+e.w))-x,h:Math.max(...a.map(e=>e.y+e.h))-y};};
const intersect=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
const information=t=>[['price',/(?:[$₩€¥]\s*\d|\d[\d,.]*\s*(?:원|KRW|USD|WON))/i],['contact',/(?:\+?\d[\d -]{7,}\d|[\w.+-]+@[\w.-]+\.[a-z]{2,})/i],['time',/(?:\d{1,2}\s*[:：]\s*\d{2}|\b[AP]\.?M\b|영업|운영)/i],['date',/(?:\d{4}[-./년]\s*\d|\d{1,2}월\s*\d{1,2}일)/]].filter(([,r])=>r.test(t)).map(([k])=>k);
const hours=t=>/^\s*(?:\d{1,2}\s*[:：]\s*\d{2}|[ap]\.?\s*m\.?|[/~–—-]|(?:mon|tues|wednes|thurs|fri|satur|sun)day(?:\s+to\s+\w+)?|평일|주말|영업시간)\s*$/i.test(t);
const cta=t=>/^\s*(?:shop now|buy now|learn more|sign up|join now|register|구매하기|신청하기|예약하기|자세히 보기|문의하기)\s*[!！]?\s*$/i.test(t);
export function analyzeLayoutGraph(elements,{sourceWidth,sourceHeight}={}){
 if(![sourceWidth,sourceHeight].every(v=>Number.isFinite(v)&&v>0))throw Error('invalid graph source dimensions');
 if(new Set(elements.map(e=>e.id)).size!==elements.length)throw Error('duplicate source ids');
 const prior=elements.map(e=>e.graphBasis).filter(b=>b?.version===1&&b.sourceWidth>0&&b.sourceHeight>0),frame=prior[0]||{sourceWidth,sourceHeight},frameConflict=prior.some(b=>b.sourceWidth!==frame.sourceWidth||b.sourceHeight!==frame.sourceHeight),nextOrder=Math.max(-1,...prior.map(b=>b.order??-1))+1;
 const originals=elements.map((input,sourceIndex)=>{const e=input.tightBox?{...input,...input.tightBox}:input;if(![e.x,e.y,e.w,e.h].every(Number.isFinite)||e.w<=0||e.h<=0)throw Error('invalid source geometry');
  const saved=e.graphBasis,valid=saved?.version===1&&[saved.x,saved.y,saved.w,saved.h,saved.sourceWidth,saved.sourceHeight].every(Number.isFinite)&&saved.w>0&&saved.h>0&&saved.sourceWidth>0&&saved.sourceHeight>0;
  const scale=prior.length?Math.min(frame.sourceWidth/sourceWidth,frame.sourceHeight/sourceHeight):1,fw=frame.sourceWidth,fh=frame.sourceHeight;
  const b=valid?{...saved,order:Number.isFinite(saved.order)?saved.order:Number.isFinite(e.sourceIndex)?e.sourceIndex:sourceIndex}:{version:1,x:((e.x-sourceWidth/2)*scale+fw/2)/fw,y:((e.y-sourceHeight/2)*scale+fh/2)/fh,w:e.w*scale/fw,h:e.h*scale/fh,font:(e.fontSize||0)*scale,sourceWidth:fw,sourceHeight:fh,order:Number.isFinite(e.sourceIndex)?e.sourceIndex:prior.length?nextOrder+sourceIndex:sourceIndex};
  return{...e,container:{x:input.x,y:input.y,w:input.w,h:input.h},basis:b,original:{x:b.x*b.sourceWidth,y:b.y*b.sourceHeight,w:b.w*b.sourceWidth,h:b.h*b.sourceHeight},originalFont:b.font||e.fontSize||0};});
 const visible=originals.filter(e=>!e.hidden),sw=visible.find(e=>e.graphBasis)?.basis.sourceWidth||sourceWidth,sh=visible.find(e=>e.graphBasis)?.basis.sourceHeight||sourceHeight,area=sw*sh;
 const measuredText=e=>e.text&&(e.kind==='text'||e.cutoutMethod==='verified-flat-background');
 const maxFont=Math.max(1,...visible.filter(measuredText).map(e=>e.originalFont));
 const prominence=e=>e.originalFont*((Number(e.fontWeight)>=600||/bold/i.test(String(e.fontWeight)))?1.08:1)/Math.max(1,Math.log2(2+[...String(e.text||'').trim()].length)/4),maxProminence=Math.max(1,...visible.filter(measuredText).map(prominence));
 const majorTop=Math.min(Infinity,...visible.filter(e=>e.text&&prominence(e)>=maxProminence*.6).map(e=>e.original.y));
 const nodes=visible.map(e=>{
  const b=e.original,declared=e.manualRole||e.role,manual=!!e.manualRole,evidence=[],text=String(e.text||''),info=information(text);
  let role=roles.has(declared)&&(manual||!e.roleInferred||declared==='background')?declared:null;
  if(role)evidence.push(manual?'manual-role':'declared-object-role');else if(e.roleInferred)evidence.push('importer-type-role-is-only-a-hint');
  if(!role&&!text&&e.kind==='shape'&&e.shapeType==='rect'&&b.x<=sw*.025&&b.y<=sh*.025&&b.w>=sw*.95&&b.h>=sh*.95){role='background';evidence.push('full-canvas-vector');}
  if(!role&&/logo|로고/i.test(e.name||'')){role='logo';evidence.push('layer-name');}
  if(!role&&text){const header=e.originalFont<maxFont*.2&&b.y+b.h/2<majorTop;role=header?'logo':info.length||hours(text)||cta(text)?'details':prominence(e)>=maxProminence*.6?'title':'body';evidence.push(header?'small-text-above-display-content':info.length?'information-pattern':cta(text)?'action-label':'native-size-weight-and-length-prominence');}
  if(!role&&!text){const ornamental=/star|sparkle|ribbon|stripe|별|반짝|리본|구분선/i.test(e.name||''),substantial=b.w*b.h>area*.06&&Math.min(b.w,b.h)/Math.max(b.w,b.h)>.15,thin=Math.min(b.w,b.h)/Math.max(b.w,b.h)<.12;role=ornamental||thin||e.kind==='shape'&&!substantial?'decoration':'subject';evidence.push(e.kind==='image'?'independent-image':substantial?'substantial-vector-region':'vector-geometry');}
  const rasterText=!!text&&e.kind!=='text',separated=['flat-background','original-alpha','verified-flat-background'].includes(e.cutoutMethod),representation=e.kind==='text'?'native-text':rasterText?'raster-text':role==='logo'?'logo':e.kind==='image'?(e.cutoutMethod==='original-alpha'?'product-cutout':e.sourceGroup?'object-raster':separated?'separated-raster':'unknown'):e.kind==='shape'?'native-vector':'unknown';
  return{...e,source:b,role,prominence:prominence(e),roleCandidates:[{role,evidence:[...evidence]},{role:role==='title'?'body':role==='subject'?'decoration':role,evidence:['alternative-requires-review']}].filter((r,i,a)=>a.findIndex(p=>p.role===r.role)===i),roleEvidence:evidence,roleConfidence:manual?'manual':roles.has(declared)&&!e.roleInferred?'declared':'geometry-inferred',representation,provenance:e.kind==='text'?'native-object':e.sourceGroup?'imported-object':e.cutoutMethod||'unknown',textReflow:e.kind==='text',fontEvidence:e.kind==='text'?'native-font-reference':'unrecovered',cropPermission:'none',information:info,composite:representation==='unknown'&&e.kind==='image'&&!roles.has(declared),needsReview:rasterText&&!separated,cta:cta(text),basis:e.basis};
 });
 const panelMode=inferPosterMaterials(nodes,sw,sh),catalog=catalogEvidence(nodes,sw,sh),materialMode=panelMode||!!catalog;
 const parent=new Map(nodes.map(e=>[e.id,e.id])),find=id=>parent.get(id)===id?id:(parent.set(id,find(parent.get(id))),parent.get(id)),join=(a,b)=>parent.set(find(a.id),find(b.id));
 const fg=nodes.filter(e=>e.role!=='background');
 for(let i=0;i<fg.length;i++)for(let j=i+1;j<fg.length;j++){
  const a=fg[i],b=fg[j],x=a.source,y=b.source;
  if(a.manualGroup||b.manualGroup){if(a.manualGroup&&a.manualGroup===b.manualGroup)join(a,b);continue;}
  if(a.sourceGroup&&a.sourceGroup===b.sourceGroup){join(a,b);continue;}
  if(a.materialAttachTo===b.id||b.materialAttachTo===a.id){join(a,b);continue;}
  if(a.productPhotoKey&&a.productPhotoKey===b.productPhotoKey){join(a,b);continue;}
  const sameText=a.text&&b.text&&a.kind===b.kind&&a.fontFamily===b.fontFamily&&Math.abs(a.originalFont-b.originalFont)<Math.max(a.originalFont,b.originalFont)*.2;
  const dy=Math.max(0,Math.max(x.y,y.y)-Math.min(x.y+x.h,y.y+y.h)),dx=Math.max(0,Math.max(x.x,y.x)-Math.min(x.x+x.w,y.x+y.w));
  if(sameText&&a.role===b.role&&dy<Math.min(x.h,y.h)*.45&&dx<Math.max(a.originalFont,b.originalFont)*1.8)join(a,b);
  // Large native typography intersecting in the source is a composition island,
  // regardless of font family. This preserves mixed-font emphasis and z-order.
  if(a.kind==='text'&&b.kind==='text'&&a.originalFont>=maxFont*.48&&b.originalFont>=maxFont*.48&&intersect(x,y)>Math.min(x.w*x.h,y.w*y.h)*.03){join(a,b);a.conservativeContact=b.conservativeContact=true;}
  // An uncertain native-text/image contact is kept as a conservative island.
  // It is not proof of semantic intent and grants no right to crop or occlude.
  const nativeImageContact=a.kind==='text'&&b.kind==='image'||b.kind==='text'&&a.kind==='image';
  if(nativeImageContact&&a.materialKind!=='brand-band'&&b.materialKind!=='brand-band'&&intersect(x,y)>1&&!a.composite&&!b.composite&&!(materialMode&&provenSeparatePaint(a,b))){join(a,b);a.conservativeContact=b.conservativeContact=true;}
  if(!materialMode&&a.semanticUnit&&a.semanticUnit===b.semanticUnit&&a.semanticBand?.includes('visual')&&b.semanticBand?.includes('visual'))join(a,b);
  if(hours(a.text||'')&&hours(b.text||'')&&dy<Math.max(x.h,y.h)*1.5&&dx<sw*.2)join(a,b);
  const label=a.text?a:b.text?b:null,shape=label===a?b:a;
  if(label&&shape.kind==='shape'&&shape.role==='decoration'&&shape.source.w*shape.source.h<area*.18&&intersect(label.source,shape.source)>(label.source.w*label.source.h)*.92)join(label,shape);
 }
 const grouped=new Map();for(const n of fg){const k=find(n.id);if(!grouped.has(k))grouped.set(k,[]);grouped.get(k).push(n);}
 const groups=[...grouped.values()].map(members=>{const b=graphBounds(members.map(e=>e.source)),dominant=members.filter(e=>e.text).sort((a,b)=>b.originalFont-a.originalFont)[0]||members.find(e=>e.role==='subject')||members[0],role=members.some(n=>n.role==='subject')?'subject':dominant.role,band=role==='logo'?(b.y+b.h/2<sh/2?'header':'footer'):role,important=members.some(e=>e.information.length||e.cta),affine=members.length>1||members[0].kind!=='text'||!!members[0].angle;
  return{id:'graph:'+JSON.stringify(members.map(e=>e.id).sort((a,b)=>String(a).localeCompare(String(b)))),sourceOrder:Math.min(...members.map(e=>e.basis.order)),role,textRole:dominant.text?dominant.role:null,conservativeContact:members.some(e=>e.conservativeContact),band,members:members.map(e=>e.id),source:b,normalized:{cx:(b.x+b.w/2)/sw,cy:(b.y+b.h/2)/sh,w:b.w/sw,h:b.h/sh},importance:role==='subject'||role==='title'?5:important||role==='logo'?4:role==='body'?3:1,affine,locked:members.some(e=>e.locked),needsReview:members.some(e=>e.needsReview),composite:members.some(e=>e.composite),displaySize:Math.max(0,...members.map(e=>e.originalFont)),badge:members.some(e=>e.cta)&&members.some(e=>e.kind==='shape')};});
 groups.sort((a,b)=>a.source.y-b.source.y||a.source.x-b.source.x);
 const styles=new Map();for(const n of fg.filter(n=>n.kind==='text'&&!n.manualRole&&typeof n.textFill==='string')){const key=JSON.stringify([n.fontFamily,Number(n.fontWeight)||(/bold/i.test(String(n.fontWeight))?700:400),n.fontStyle||'normal',n.textFill,n.textRunStyle||'{}']);if(!styles.has(key))styles.set(key,[]);styles.get(key).push(n);}
 const typographyCohorts=[];for(const [style,members]of styles){const ordered=[...members].sort((a,b)=>a.originalFont-b.originalFont);let cohort=[];const emit=()=>{if(cohort.length>1)typographyCohorts.push({ids:cohort.map(n=>n.id),sourceSize:cohort[0].originalFont,style,evidence:'same native family/weight/style/fill/run styles and source size',policy:'common fitted size where independent; review material imbalance otherwise'});};for(const n of ordered){if(cohort.length&&n.originalFont-cohort[0].originalFont>Math.min(.15,cohort[0].originalFont*.005)){emit();cohort=[];}cohort.push(n);}emit();}
 const edges=[];for(let i=0;i<fg.length;i++)for(let j=i+1;j<fg.length;j++){const a=fg[i],b=fg[j],amount=intersect(a.source,b.source);if(amount>1)edges.push({type:'source-overlap-evidence',ids:[a.id,b.id],sourceCoverage:amount/Math.min(a.source.w*a.source.h,b.source.w*b.source.h),visibleOcclusion:'not_run',intent:a.conservativeContact||b.conservativeContact?'uncertain-kept-as-composite':'group-evidence',accepted:find(a.id)===find(b.id),paintOrder:[a,b].sort((a,b)=>a.basis.order-b.basis.order).map(e=>e.id)});}
 return{schema:'coex-layout-graph-v1',catalog,materialMode,sourceWidth:sw,sourceHeight:sh,nodes,groups,edges,typographyCohorts,backgrounds:nodes.filter(e=>e.role==='background').map(e=>e.id),nativeText:nodes.filter(e=>e.kind==='text').length,manual:fg.some(e=>e.manualGroup||e.manualRole),locked:groups.some(g=>g.locked),frameConflict,needsReview:frameConflict||groups.some(g=>g.needsReview||g.composite),warnings:groups.some(g=>g.composite)?['일부 이미지의 분리가 불확실해 해당 묶음은 원본 이미지로 유지합니다.']:[],confidence:{representation:'per-node',role:'per-node-evidence; not probability',semanticOcclusion:'not_run'}};
}
// Apply the same source-contact contract to every candidate, including legacy
// families. Passing this is measured box/typography preservation, not glyph or
// semantic occlusion verification. Products may grow while retaining contact.
export function validateSourceRelations(graph,actual,paintOrder,plan=null){
 const byId=new Map(graph.nodes.map(n=>[n.id,n])),now=new Map(actual.map(n=>[n.id,n.tightBox?{...n,...n.tightBox}:n])),failures=[],order=new Map((paintOrder||actual.map(n=>n.id)).map((id,i)=>[id,i]));
 for(const edge of graph.edges.filter(e=>e.accepted&&e.intent==='uncertain-kept-as-composite')){
  const[a,b]=edge.ids.map(id=>byId.get(id)),[x,y]=edge.ids.map(id=>now.get(id));if(!x||!y){failures.push({ids:edge.ids,reason:'source relation member missing'});continue;}
  const titleRows=plan?.relations?.find(r=>r.type==='source-title-rows')?.rows?.flat()||[],text=a.text?a:b,image=a.text?b:a;
  // An explicit plan may relocate a title away from a protected product region.
  // Source contact is then resolved by measured safe-region validation below,
  // rather than being forced into every new aspect ratio.
  if(text.kind==='text'&&image.kind==='image'&&titleRows.includes(text.id)&&plan?.protectedRegions?.some(r=>r.id===image.id&&!r.except.includes(text.id)))continue;
  if(intersect(x,y)<.05){failures.push({ids:edge.ids,reason:'original contact separated'});continue;}
  if(order.get(edge.paintOrder[0])>order.get(edge.paintOrder[1]))failures.push({ids:edge.ids,reason:'source paint order inverted'});
  if(a.kind==='text'&&b.kind==='text'){
   const sourceRatio=a.originalFont/b.originalFont,actualRatio=x.fontSize/y.fontSize;if(!Number.isFinite(actualRatio)||Math.abs(actualRatio/sourceRatio-1)>.02)failures.push({ids:edge.ids,reason:'mixed typography hierarchy changed'});
  }
 }
 const native=graph.nodes.filter(n=>n.kind==='text'&&!n.manualRole);
 for(const cohort of graph.typographyCohorts||[]){const fonts=cohort.ids.map(id=>now.get(id)?.fontSize).filter(v=>Number.isFinite(v)&&v>0);if(fonts.length!==cohort.ids.length)failures.push({ids:cohort.ids,reason:'source typography member missing'});else if(Math.max(...fonts)/Math.min(...fonts)>1.25)failures.push({ids:cohort.ids,reason:'equivalent source typography materially diverged',actualSizes:fonts});}
 for(const a of native.filter(n=>n.role==='title'))for(const b of native.filter(n=>['body','title'].includes(n.role))){
  if(a.id===b.id||a.originalFont<b.originalFont*1.5)continue;
  const x=now.get(a.id),y=now.get(b.id);if(x&&y&&x.fontSize+ .1<y.fontSize)failures.push({ids:[a.id,b.id],reason:'clear source headline prominence inverted against body',sourceFontRatio:a.originalFont/b.originalFont,actualFontRatio:x.fontSize/y.fontSize});
 }
 return{passed:!failures.length,failures,policy:'conservative source boxes; semantic intent and glyph occlusion not verified'};
}

