import {panelAnchorPlacement} from './material-surfaces.mjs';
import {catalogCandidates} from './catalog-layout.mjs';
import {photoSceneCandidates} from './photo-scene-layout.mjs';
import {typography,typographyRole} from './type-scale.mjs';
import {referencePreference,referenceTopologies} from './reference-layout-policy.mjs';
import {analyzeLayoutGraph,graphBounds} from './source-graph.mjs';
import {assignRegionSlots,solveRegionStack,constraintEngines} from './constraint-layout.mjs';
const review=reason=>({reason,status:'review'});
const area=b=>b.w*b.h;
// A long thin vector is not automatically an intentional overlay ribbon.
// Use its source neighbours as a preference, then avoid all critical boxes.
export function adaptDecorativeStrip(e,{width,height,sourceHeight,sourceWidth,placements,elements}){
 const short=Math.min(width,height),kind=/ribbon|stripe|리본|띠/i.test(e.name||'')||Math.abs(e.angle||0)>.5?'ribbon':'separator',thickness=kind==='separator'?Math.max(1,Math.min(short*.012,e.h/Math.min(sourceWidth,sourceHeight)*short)):Math.max(1,Math.min(short*.035,height*.035));
 const text=elements.filter(n=>n.text&&n.id!==e.id),before=text.filter(n=>n.y+n.h<=e.y+.5).sort((a,b)=>b.y+b.h-a.y-a.h)[0],after=text.filter(n=>n.y>=e.y+e.h-.5).sort((a,b)=>a.y-b.y)[0],target=id=>placements.find(p=>p.id===id),a=before&&target(before.id),b=after&&target(after.id);
 const anchor=a&&b&&a.y+a.h<b.y?(a.y+a.h+b.y)/2:height*(e.y+e.h/2)/sourceHeight;
 const blockers=placements.filter(p=>p.role!=='decoration'||['ribbon','separator'].includes(p.decorationKind)).map(p=>[Math.max(0,p.y-.5),Math.min(height,p.y+p.h+.5)]).sort((a,b)=>a[0]-b[0]);
 const free=[];let end=0;for(const[start,stop]of blockers){if(start>end)free.push([end,start]);end=Math.max(end,stop);}if(end<height)free.push([end,height]);
 const sourceAngle=e.angle||0,angleLimit=Math.atan(height*(width/height<=.4?.035:.08)/width)*180/Math.PI,baseAngle=kind==='separator'?0:Math.sign(sourceAngle)*Math.min(Math.abs(sourceAngle),angleLimit);
 for(const fraction of [1,.5,0]){const angle=baseAngle*fraction,rad=Math.abs(angle)*Math.PI/180,length=(width-thickness*Math.sin(rad))/Math.cos(rad),h=length*Math.sin(rad)+thickness*Math.cos(rad),candidates=free.filter(([lo,hi])=>hi-lo>=h+.01).map(([lo,hi])=>Math.max(lo,Math.min(hi-h,anchor-h/2)));
  if(candidates.length){candidates.sort((a,b)=>Math.abs(a+h/2-anchor)-Math.abs(b+h/2-anchor));return{x:0,y:candidates[0],w:width,h,scale:1,stretchDecoration:true,decorationThickness:thickness,angle,decorationKind:kind,sourceNeighbours:{before:before?.id??null,after:after?.id??null},clearance:'planned critical boxes; measured again after text fit'};}
 }
 return null;
}
export function regionCandidates(elements,options){
 const {sourceWidth,sourceHeight,width,height,measureText}=options,graph=analyzeLayoutGraph(elements,{sourceWidth,sourceHeight}),failures=[];
 if(![width,height].every(n=>Number.isInteger(n)&&n>0&&n<=12000)||width*height>24000000)return{plans:[],failures:[review('invalid target size')],graph};
 if(graph.locked||graph.frameConflict)return{plans:[],failures:[],graph};
 if(graph.groups.some(g=>g.needsReview)||!graph.groups.length||graph.groups.every(g=>g.composite)&&!graph.manual)return{plans:[],failures:[],graph};
 if(graph.groups.length>128)return{plans:[],failures:[review('분석 묶음이 많아 영역·용도 확인이 필요합니다.')],graph};
 if(typeof measureText!=='function')return{plans:[],failures:[],graph};
 const ar=width/height,mode=ar>=3?'extreme-landscape':ar<=.4?'extreme-portrait':ar>=1.25?'landscape':ar<=.8?'portrait':'square';
 const shapes=ar>=3?[{type:'inline',share:.6}]:ar<=.4?[{type:'column',heroFirst:false}]:ar>=1.25?[{type:'row',share:.48},{type:'row',share:.62},{type:'row',share:.56,mirror:true},{type:'column',heroFirst:false}]:[{type:'column',heroFirst:false},{type:'column',heroFirst:true},{type:'row',share:.53},{type:'row',share:.62,mirror:true}];
 shapes.unshift(...referenceTopologies(width,height).map(t=>({...t,derived:'user-reference-rules'})));
 // Geometry contributes a split candidate, rather than selecting a file family.
 // Allocation remains recalculated for the target dimensions and text minima.
 const copy=graph.groups.filter(g=>!['subject','decoration','logo'].includes(g.role)),art=graph.groups.filter(g=>g.role==='subject');
 if(ar>=3&&copy.length>=2&&copy.length<=4)for(const share of [.55,.70])shapes.push({type:'inline',share,copyFlow:'row',derived:'multi-size-reference-copy-modules'});
 const sourceCopy=copy.length?graphBounds(copy.map(g=>g.source)):null,sourceArt=art.length?graphBounds(art.map(g=>g.source)):null;
 if(ar>.4&&ar<3&&sourceCopy&&sourceArt){const share=Math.max(.36,Math.min(.72,sourceCopy.w/(sourceCopy.w+sourceArt.w)));shapes.push({type:ar>=1?'row':'column',share,heroFirst:sourceArt.y<sourceCopy.y,derived:'source-region-extents'});}
 const catalog=graph.catalog?.mode==='photo-scene'?photoSceneCandidates(graph,elements,options):catalogCandidates(graph,elements,options),plans=[...catalog.plans];failures.push(...catalog.failures);if(graph.catalog)return{plans,failures,graph};for(const [i,topology]of shapes.entries()){
  try{plans.push(buildRegionPlan(graph,elements,{...options,mode,topology,index:i}));}catch(error){failures.push({id:'region-'+mode+'-'+i,status:'review',reason:error.message});}
 }
 return{plans,failures,graph};
}
function buildRegionPlan(graph,elements,{width,height,measureText,mode,topology,index}){
 const short=Math.min(width,height),mx=width*.05,my=height*.05,gap=short*(mode==='extreme-portrait'?.014:.025),safe={x:mx,y:my,w:width-2*mx,h:height-2*my},byId=new Map(graph.nodes.map(n=>[n.id,n])),sourceOrder=new Map(graph.nodes.map(n=>[n.id,n.basis.order??n.id]));
 const baseFont=Math.max(1,...graph.nodes.map(n=>n.originalFont)),floor=Object.fromEntries(['title','body','details','logo','decoration','price'].map(r=>[r,typography(r,short).minimum])),desired=Object.fromEntries(['title','body','details','logo','decoration','price'].map(r=>[r,typography(r,short).target]));floor.subject=desired.subject=0;
 const textRole=g=>g.role==='title'?'title':g.members.some(id=>byId.get(id).information.includes('price'))?'price':g.textRole||g.role,roleFont=Object.fromEntries(['title','body','details','logo','decoration','price'].map(role=>[role,Math.max(1,...graph.nodes.filter(n=>typographyRole(n)===role).map(n=>n.originalFont))])),target=g=>Math.max(floor[textRole(g)]||9,(desired[textRole(g)]||24)*Math.max(.45,Math.sqrt(g.displaySize/(roleFont[textRole(g)]||baseFont))));
 const decorations=graph.groups.filter(g=>g.role==='decoration'&&g.members.every(id=>!byId.get(id).text));
 const ribbon=g=>g.members.length===1&&byId.get(g.members[0]).kind==='shape'&&['rect','line','polygon','path'].includes(byId.get(g.members[0]).shapeType)&&(g.source.w>g.source.h*5||/ribbon|stripe|리본|띠/i.test(byId.get(g.members[0]).name));
 const floating=g=>g.members.length===1&&(['floating','panel-anchor'].includes(byId.get(g.members[0]).materialKind)||/star|sparkle|별|반짝/i.test(byId.get(g.members[0]).name));
 const handled=decorations.filter(g=>ribbon(g)||floating(g)),handledIds=new Set(handled.map(g=>g.id)),regular=graph.groups.filter(g=>!handledIds.has(g.id));
 const brands=regular.filter(g=>g.role==='logo'),header=mode==='extreme-portrait'?brands:brands.filter(g=>g.band==='header'),footer=mode==='extreme-portrait'?[]:brands.filter(g=>g.band==='footer'),visual=regular.filter(g=>g.role==='subject'||g.role==='decoration'),copy=regular.filter(g=>!brands.includes(g)&&!visual.includes(g));
 const title=copy.filter(g=>g.role==='title'),sub=copy.filter(g=>g.role!=='title');
 const boxes=new Map(),slots=[],requests=new Map();let constraints=0;
 const request=(g,crossWidth)=>{
  if(requests.has(g.id+':'+crossWidth))return requests.get(g.id+':'+crossWidth);
  const nodes=g.members.map(id=>byId.get(id)),text=nodes.filter(n=>n.kind==='text');let minW=1,minH=1,wanted=1;
  if(g.affine){const ratio=g.source.w/g.source.h,minScale=Math.max(0,...text.map(n=>(typography(typographyRole(n),short).minimum)/Math.max(1,n.originalFont))),wantScale=text.length?Math.min(crossWidth/g.source.w,target(g)/Math.max(1,g.displaySize)):crossWidth/g.source.w;
   minW=Math.max(1,g.source.w*minScale);minH=Math.max(1,g.source.h*minScale);wanted=g.source.h*wantScale;
   if(!text.length){minW=Math.min(crossWidth,short*.16);minH=minW/ratio;wanted=Math.min(height*.7,crossWidth/ratio);}
  }else{const node=nodes[0],low=measureText(node.id,crossWidth,floor[g.role]||9),high=measureText(node.id,crossWidth,target(g));minW=Math.max(1,Math.min(crossWidth,low.w));minH=low.h;wanted=high.h;if(low.w>crossWidth+.2)throw Error('원문 단어가 최소 크기로 영역에 들어가지 않습니다.');}
  const u={...g,sourceOrder:Math.min(...g.members.map(id=>sourceOrder.get(id))),minW,minH,weight:Math.max(minH,wanted)*Math.sqrt(g.importance)};requests.set(g.id+':'+crossWidth,u);return u;
 };
 const allocate=(groups,cell,horizontal=false)=>{
  if(!groups.length)return;
  const ordered=[...groups].sort((a,b)=>horizontal?a.normalized.cx-b.normalized.cx:a.role==='title'&&b.role!=='title'?-1:b.role==='title'&&a.role!=='title'?1:a.source.y-b.source.y||a.source.x-b.source.x);
  const breadth=horizontal?(cell.w-gap*(groups.length-1))/groups.length:cell.w;
  const items=ordered.map(g=>request(g,breadth));
  const solved=solveRegionStack(cell,items,gap,{horizontal});constraints+=solved.constraints;if(!solved.boxes)throw Error('원문과 최소 크기를 유지할 영역이 부족합니다: '+solved.reason);
  for(const [j,g]of ordered.entries()){const b=solved.boxes[g.id];slots.push({id:'slot:'+slots.length,role:g.role,band:g.band,box:b,preferred:{cx:(b.x+b.w/2)/width,cy:(b.y+b.h/2)/height},order:Math.min(...g.members.map(id=>sourceOrder.get(id)))});}
 };
 let core={...safe};
 if(topology.type!=='inline'){
  const brandHeight=gs=>gs.length?Math.max(short*.055,...gs.map(g=>request(g,(safe.w-gap*(gs.length-1))/gs.length).minH))+gap:0,hh=brandHeight(header),fh=brandHeight(footer);
  if(hh)allocate(header,{x:mx,y:my,w:topology.type==='row'?safe.w*topology.share:safe.w,h:hh-gap},true);if(fh)allocate(footer,{x:mx,y:height-my-fh+gap,w:safe.w,h:fh-gap},true);
  core={x:mx,y:my+hh,w:safe.w,h:safe.h-hh-fh};
 }
 if(!visual.length){if(topology.type==='inline'&&brands.length){const bw=core.w*.16;allocate(brands,{x:core.x,y:core.y,w:bw,h:core.h});allocate(copy,{x:core.x+bw+gap,y:core.y,w:core.w-bw-gap,h:core.h});}else allocate(copy,core);}
 else if(topology.type==='inline'){
  const bw=brands.length?core.w*.16:0,left=core.x+bw+(brands.length?gap:0),cw=(core.w-bw-gap*(brands.length?2:1))*topology.share;
  if(brands.length)allocate(brands,{x:core.x,y:core.y,w:bw,h:core.h});allocate(copy,{x:left,y:core.y,w:cw,h:core.h},topology.copyFlow==='row');allocate(visual,{x:left+cw+gap,y:core.y,w:core.x+core.w-left-cw-gap,h:core.h});
 }else if(topology.type==='corner'){
  const th=title.reduce((sum,g)=>sum+request(g,core.w).minH,0)+gap*Math.max(0,title.length-1)+core.h*.12;
  if(th>=core.h-gap)throw Error('상단 제목과 하단 정보 영역이 부족합니다.');
  allocate(title,{x:core.x,y:core.y,w:core.w,h:th});const lower={x:core.x,y:core.y+th+gap,w:core.w,h:core.h-th-gap},cw=(lower.w-gap)*topology.share;
  allocate(sub,{x:lower.x,y:lower.y,w:cw,h:lower.h});allocate(visual,{x:lower.x+cw+gap,y:lower.y,w:lower.w-cw-gap,h:lower.h});
 }else if(topology.type==='row'){
  const cw=(core.w-gap)*topology.share,vw=core.w-gap-cw,cx=topology.mirror?core.x+vw+gap:core.x,vx=topology.mirror?core.x:core.x+cw+gap;
  allocate(copy,{x:cx,y:core.y,w:cw,h:core.h});allocate(visual,{x:vx,y:core.y,w:vw,h:core.h});
 }else{
  const headlineNeed=title.reduce((n,g)=>n+request(g,core.w).minH,0)+gap*Math.max(0,title.length-1),subNeed=sub.reduce((n,g)=>n+request(g,core.w).minH,0)+gap*Math.max(0,sub.length-1);
  const minVisual=Math.max(short*.19,...visual.map(g=>request(g,core.w).minH)),remaining=core.h-headlineNeed-subNeed-minVisual-gap*(Number(!!title.length)+Number(!!sub.length));if(remaining<0)throw Error('세로 흐름에서 원문을 읽을 크기로 넣을 수 없습니다.');
  const th=title.length?headlineNeed+remaining*.28:0,bh=sub.length?subNeed+remaining*.18:0,vh=core.h-th-bh-gap*(Number(!!title.length)+Number(!!sub.length));let y=core.y;
  for(const [list,h]of(topology.heroFirst?[[visual,vh],[title,th],[sub,bh]]:[[title,th],[visual,vh],[sub,bh]])){if(list.length){allocate(list,{x:core.x,y,w:core.w,h});y+=h+gap;}}
 }
 const assign=assignRegionSlots(regular.map(g=>({...g,sourceOrder:Math.min(...g.members.map(id=>sourceOrder.get(id)))})),slots);if(!assign)throw Error('역할과 원본 묶음을 빠짐없이 배치할 수 없습니다.');
 for(const {group,slot}of assign)boxes.set(group.id,slot.box);
 const placements=[],roles=Object.fromEntries(graph.nodes.map(n=>[n.id,n.role])),layoutGroups={},allowedOverlaps=[],fontFloorById={};
 for(const g of regular){const cell=boxes.get(g.id),nodes=g.members.map(id=>byId.get(id));
  if(g.affine){const s=Math.min(cell.w/g.source.w,cell.h/g.source.h,...(g.role==='subject'?[]:nodes.filter(n=>n.text).map(n=>target(g)/n.originalFont))),x=cell.x+(cell.w-g.source.w*s)/2,y=cell.y+(cell.h-g.source.h*s)/2;
   for(const n of nodes){const sb=n.source,scale=s*sb.w/n.w,scaledH=n.h*scale;if(Math.abs(scaledH-sb.h*s)>Math.max(.1,sb.h*s*.001))throw Error('원본 묶음의 비율이 바뀌어 관계 확인이 필요합니다.');placements.push({id:n.id,role:n.role,groupRole:n.role,layoutGroup:g.id,x:x+(sb.x-g.source.x)*s,y:y+(sb.y-g.source.y)*s,w:n.w*scale,h:scaledH,scale,zone:null,nativeTightWidth:n.nativeTightWidth});if(n.text)fontFloorById[n.id]=typography(typographyRole(n),short).minimum;}
  }else{const n=nodes[0];placements.push({id:n.id,role:g.role,groupRole:g.role,layoutGroup:g.id,x:cell.x,y:cell.y,w:cell.w,h:cell.h,scale:1,zone:cell,readableBody:true,readableSize:target(g),minimumSize:floor[g.role]||9,align:graph.materialMode||mode==='extreme-portrait'||mode==='portrait'||mode==='square'?'center':'left',verticalAlign:'center',keepRowAnchors:true});fontFloorById[n.id]=floor[g.role]||9;}
  for(const n of nodes)layoutGroups[n.id]=g.id;
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++)if(graph.edges.some(e=>e.accepted&&e.ids.includes(nodes[i].id)&&e.ids.includes(nodes[j].id)))allowedOverlaps.push([nodes[i].id,nodes[j].id]);
 }
 for(const g of handled){const n=byId.get(g.members[0]);layoutGroups[n.id]=g.id;if(n.materialKind==='panel-anchor'){const panel=byId.get(n.panelId);placements.push({id:n.id,role:'decoration',groupRole:'decoration',layoutGroup:g.id,...panelAnchorPlacement(n,panel,{width,height,margin:short*.05}),decorationKind:'panel-anchor'});continue;}
  if(ribbon(g)){const p=adaptDecorativeStrip({...n,...n.source},{width,height,sourceWidth:graph.sourceWidth,sourceHeight:graph.sourceHeight,placements,elements:graph.nodes.map(n=>({...n,...n.source}))});if(!p)throw Error('구분선·리본을 글자와 상품에서 띄울 공간이 없습니다.');placements.push({id:n.id,role:'decoration',groupRole:'decoration',layoutGroup:g.id,...p});}
  else{const s=Math.min(32,short*.06)/Math.max(n.w,n.h),w=n.w*s,h=n.h*s;let best=null;for(let row=0;row<=20;row++)for(let col=0;col<=20;col++){const b={x:(width-w)*col/20,y:(height-h)*row/20,w,h};if(placements.filter(p=>p.role!=='decoration').some(p=>Math.hypot(Math.max(0,p.x-b.x-w,b.x-p.x-p.w),Math.max(0,p.y-b.y-h,b.y-p.y-p.h))<(g.members.some(id=>byId.get(id).text)?24:24)))continue;const distance=Math.hypot((b.x+w/2)/width-g.normalized.cx,(b.y+h/2)/height-g.normalized.cy);if(!best||distance<best.distance)best={...b,distance};}best??={x:Math.max(0,Math.min(width-w,width*g.normalized.cx-w/2)),y:Math.max(0,Math.min(height-h,height*g.normalized.cy-h/2)),w,h};placements.push({id:n.id,role:'decoration',groupRole:'decoration',layoutGroup:g.id,...best,scale:s,decorationKind:'floating',deferredFloating:true,floatingPreference:{x:g.normalized.cx,y:g.normalized.cy}});}
 }
 const ids=placements.map(p=>p.id);if(new Set(ids).size!==ids.length||ids.length!==graph.groups.flatMap(g=>g.members).length)throw Error('원본 요소의 누락 또는 중복을 발견했습니다.');
 const groupOf=id=>graph.groups.find(g=>g.members.includes(id)),rank=n=>roles[n.id]==='background'||n.hidden?0:handledIds.has(groupOf(n.id)?.id)?1:groupOf(n.id)?.role==='subject'?2:3,groupOrder=id=>{const g=groupOf(id);return g?Math.min(...g.members.map(i=>sourceOrder.get(i))):sourceOrder.get(id)??id;};
 const paintOrder=[...elements].sort((a,b)=>rank(a)-rank(b)||groupOrder(a.id)-groupOrder(b.id)||(sourceOrder.get(a.id)??a.id)-(sourceOrder.get(b.id)??b.id)).map(e=>e.id);
 return{materialMode:graph.materialMode,referenceBucket:referencePreference(width,height).id,engine:'relationships-v1',planner:'region-constraints-v1',width,height,mode,orientationRule:mode==='extreme-landscape'?'horizontal-inline':mode==='extreme-portrait'?'vertical-center':'standard-balanced',candidate:'region-'+mode+'-'+index,layoutLabel:'공통 영역 · '+topology.type+(topology.mirror?' 반전':''),topology,solver:{...constraintEngines,constraints,assignmentExecuted:true,mapping:assign.map(a=>({group:a.group.id,slot:a.slot.id,cost:a.cost}))},roles,placements,backgrounds:graph.backgrounds,layoutGroups,semanticUnits:graph.groups.map(g=>({id:g.id,role:g.role,band:'graph:'+g.band,ids:g.members,importance:g.importance})),safeZone:safe,margin:short*.05,gap,allowedOverlaps,fontFloorById,paintOrder,sourceGraph:{schema:graph.schema,confidence:graph.confidence,groups:graph.groups.map(({members,role,roleEvidence,...g})=>({...g,members,role})),nodes:graph.nodes.map(n=>({id:n.id,materialKind:n.materialKind,materialAttachTo:n.materialAttachTo,roleEvidence:n.roleEvidence,text:n.text,representation:n.representation,provenance:n.provenance,role:n.role,roleCandidates:n.roleCandidates,roleConfidence:n.roleConfidence,textReflow:n.textReflow,fontEvidence:n.fontEvidence,cropPermission:n.cropPermission})),edges:graph.edges},graphBasis:Object.fromEntries(graph.nodes.map(n=>[n.id,n.basis])),decorations:placements.filter(p=>p.decorationKind).map(p=>({id:p.id,kind:p.decorationKind})),warnings:[...graph.warnings,...(graph.materialMode?['분리된 배경 레이어는 비율을 유지해 화면을 채웠습니다. 질감의 타일 연결·사진 복원은 검증되지 않아 배경 확장 검토가 필요합니다.']:[]),'역할·묶음은 원본 객체와 기하에서 추정했습니다. 상품 중요 부위와 시각적 완성도는 확인하세요.'],quality:{outside:[],overlaps:[]},validation:{status:'planned',geometry:'not_run',aesthetic:'not_run',semanticOcclusion:'not_run'},analysisStatus:graph.needsReview?'review':'geometry-inferred'};
}
