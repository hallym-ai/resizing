import {typography} from './type-scale.mjs';
const bounds=items=>{const x=Math.min(...items.map(n=>n.source.x)),y=Math.min(...items.map(n=>n.source.y));return{x,y,w:Math.max(...items.map(n=>n.source.x+n.source.w))-x,h:Math.max(...items.map(n=>n.source.y+n.source.h))-y};};
export function catalogCandidates(graph,elements,options){
 if(!graph.catalog||graph.manual||graph.locked)return{plans:[],failures:[]};
 if(graph.catalog.mode!=='catalog')return{plans:[],failures:[]};
 const plans=[],failures=[];for(let i=0;i<3;i++)try{plans.push(build(graph,elements,options,i));}catch(e){failures.push({id:'catalog-'+i,reason:e.message,status:'review'});}return{plans,failures};
}
function build(graph,elements,{width,height,measureText},variant){
 const S=Math.min(width,height),u=S/1080,gap=S*.011,margin=S*.05,wide=width/height>=1.4,tall=width/height<.7,byId=new Map(graph.nodes.map(n=>[n.id,n])),used=new Set(),placements=[],fontFloorById={},layoutGroups={},roles=Object.fromEntries(graph.nodes.map(n=>[n.id,n.role])),minimums={},cardCells=[],factor=[1,.94,.88][variant];
 const usable={x:margin,y:margin,w:width-margin*2,h:height-margin*2},units=graph.groups;
 const unitRole=g=>g.members.map(id=>byId.get(id)).find(n=>n.catalogRole)?.catalogRole||g.textRole||g.role;
 const fit=(g,cell,{image=false,align='left',role=null}={})=>{
  const ns=g.members.map(id=>byId.get(id)),text=ns.filter(n=>n.text),r=role||unitRole(g),type=typography(r,S),font=r==='title'?Math.max(type.target*factor,Math.max(...text.map(n=>n.originalFont))/Math.max(1,Math.min(...text.map(n=>n.originalFont)))*type.minimum):type.target*factor,min=type.minimum;
  if(g.affine||image){const source=bounds(ns),scale=Math.min(cell.w/source.w,cell.h/source.h,...(text.length?[font/Math.max(...text.map(n=>n.originalFont))]:[]));if(text.some(n=>n.originalFont*scale<typography(r==='title'?'title':n.catalogRole||n.role,S).minimum-.1))throw Error('묶음의 최소 글자 크기를 확보할 수 없습니다.');
   const x=cell.x+(text.length&&align==='left'?0:(cell.w-source.w*scale)/2),y=cell.y+(cell.h-source.h*scale)/2;for(const n of ns){const s=scale*n.source.w/n.w;placements.push({id:n.id,role:n.role,groupRole:n.role,layoutGroup:g.id,x:x+(n.source.x-source.x)*scale,y:y+(n.source.y-source.y)*scale,w:n.w*s,h:n.h*s,scale:s,nativeTightWidth:n.nativeTightWidth});}
  }else{const n=ns[0];placements.push({id:n.id,role:n.role,groupRole:n.role,layoutGroup:g.id,x:cell.x,y:cell.y,w:cell.w,h:cell.h,scale:1,zone:cell,readableBody:true,readableSize:font,minimumSize:min,align,verticalAlign:'center',keepRowAnchors:true});}
  for(const n of ns){used.add(n.id);layoutGroups[n.id]=g.id;if(n.kind==='text'){const t=typography(r==='title'?'title':n.catalogRole||n.role,S);fontFloorById[n.id]=t.minimum;minimums[n.id]={...t,sourceRole:n.catalogRole||n.role};}}
 };
 const flow=(groups,cell,align='left')=>{const ordered=[...groups].sort((a,b)=>{const order={name:0,price:1,description:2};return(order[unitRole(a)]??3)-(order[unitRole(b)]??3)||a.source.y-b.source.y;});
  const heights=ordered.map(g=>{const ns=g.members.map(id=>byId.get(id)),text=ns.filter(n=>n.text),font=typography(unitRole(g),S).target*factor;if(g.affine)return g.source.h*Math.min(cell.w/g.source.w,font/Math.max(1,...text.map(n=>n.originalFont)));return measureText(ns[0].id,cell.w,font).h;});
  const need=heights.reduce((a,b)=>a+b,0)+gap*(groups.length-1);if(need>cell.h+.1)throw Error('상품 설명을 최소 가독 크기로 배치할 공간이 부족합니다.');let y=cell.y+(cell.h-need)/2;
  ordered.forEach((g,i)=>{fit(g,{x:cell.x,y,w:cell.w,h:heights[i]}, {align});y+=heights[i]+gap;});
 };
 const bands=graph.nodes.filter(n=>n.materialKind==='brand-band'),brands=units.filter(g=>g.members.some(id=>byId.get(id).catalogRole==='brand')),brandHeight=brands.length?Math.max(height*.085,margin*2+typography('brand',S).target*1.2):0;
 const brandCell={x:0,y:height-brandHeight,w:width,h:brandHeight};
 for(const n of bands){placements.push({id:n.id,role:'decoration',groupRole:'decoration',layoutGroup:'brand-band',...brandCell,scale:1,stretchDecoration:true,decorationThickness:brandCell.h,angle:0});used.add(n.id);layoutGroups[n.id]='brand-band';}
 for(const g of brands)fit(g,{x:brandCell.x+gap,y:brandCell.y+gap/2,w:brandCell.w-gap*2,h:brandCell.h-gap},{role:'brand',align:'center'});
 const titles=units.filter(g=>g.role==='title'),titleNeed=Math.max(0,...titles.map(g=>g.source.h*Math.max(...g.members.map(id=>byId.get(id)).filter(n=>n.text).map(n=>typography('title',S).minimum/Math.max(1,n.originalFont))))),header=wide?{x:margin,y:margin,w:width*.30,h:height-margin*2-brandHeight-gap}:{x:margin,y:margin,w:usable.w,h:Math.max(titleNeed,height*(tall?.18:.19))};
 for(const g of titles)fit(g,header,{role:'title',align:'center'});
 const region=wide?{x:width*.35,y:margin,w:width*.65-margin,h:height-brandHeight-margin-gap}:{x:margin,y:header.y+header.h+gap,w:usable.w,h:height-brandHeight-header.y-header.h-gap*2};
 const cards=graph.catalog.cards,columns=wide,count=cards.length;
 cards.forEach((card,index)=>{const cell=columns?{x:region.x+index*(region.w+gap)/count,y:region.y,w:(region.w-gap*(count-1))/count,h:region.h}:{x:region.x,y:region.y+index*(region.h+gap)/count,w:region.w,h:(region.h-gap*(count-1))/count};
  const ids=new Set(card.photos),copy=units.filter(g=>g.members.some(id=>card.texts.includes(id))),photoNodes=card.photos.map(id=>byId.get(id)),photo={id:'product:'+card.key,members:card.photos,source:bounds(photoNodes),affine:true,role:'subject'},vertical=columns||(tall&&variant===1),share=vertical?.46:[.48,.44,.40][variant];
  const image=vertical?{x:cell.x,y:cell.y,w:cell.w,h:cell.h*share-gap/2}:{x:cell.x,y:cell.y,w:cell.w*share-gap/2,h:cell.h},copyCell=vertical?{x:cell.x,y:cell.y+cell.h*share+gap/2,w:cell.w,h:cell.h*(1-share)-gap/2}:{x:cell.x+cell.w*share+gap/2,y:cell.y,w:cell.w*(1-share)-gap/2,h:cell.h};
  fit(photo,image,{image:true});flow(copy,copyCell);cardCells.push({key:card.key,cell,image,copy:copyCell,ids:[...ids,...card.texts],relation:vertical?'image-above-copy':'image-next-to-copy'});
 });
 const decorationNodes=graph.nodes.filter(n=>!used.has(n.id)&&n.role==='decoration');
 for(const n of decorationNodes){const scale=Math.min(S*.025,22)/Math.max(n.w,n.h);placements.push({id:n.id,role:'decoration',groupRole:'decoration',layoutGroup:'decoration:'+n.id,x:0,y:0,w:n.w*scale,h:n.h*scale,scale,decorationKind:'floating',deferredFloating:true,floatingPreference:{x:(n.source.x+n.source.w/2)/graph.sourceWidth,y:(n.source.y+n.source.h/2)/graph.sourceHeight}});used.add(n.id);layoutGroups[n.id]='decoration:'+n.id;}
 const missing=graph.nodes.filter(n=>n.role!=='background'&&!used.has(n.id));if(missing.length)throw Error('상품에 연결되지 않은 요소를 확인해야 합니다: '+missing.map(n=>n.id).join(','));
 const allowedOverlaps=graph.edges.filter(e=>e.accepted).map(e=>e.ids);for(const n of graph.nodes.filter(n=>n.brandBand!==undefined))allowedOverlaps.push([n.id,n.brandBand]);
 return{engine:'relationships-v1',planner:'product-cards-v1',candidate:'catalog-'+variant,layoutLabel:'상품별 정보 블록 · '+(columns?'나란히':'위아래')+(variant===1?' · 세로형 카드':''),mode:wide?'landscape':tall?'portrait':'square',width,height,roles,placements,backgrounds:graph.backgrounds,layoutGroups,semanticUnits:units.map(g=>({id:g.id,role:g.role,band:'graph:'+g.band,ids:g.members})),cardCells,typographyMinimums:minimums,fontFloorById,graphBasis:Object.fromEntries(graph.nodes.map(n=>[n.id,n.basis])),allowedOverlaps,decorations:[...placements.filter(p=>p.decorationKind).map(p=>({id:p.id,kind:p.decorationKind})),...bands.map(n=>({id:n.id,kind:'brand-band'}))],paintOrder:[...elements].sort((a,b)=>(roles[a.id]==='background'?0:1)-(roles[b.id]==='background'?0:1)||a.sourceIndex-b.sourceIndex).map(n=>n.id),safeZone:{x:margin,y:margin,w:usable.w,h:usable.h},margin,gap,quality:{outside:[],overlaps:[]},warnings:['상품 연결은 원본 객체 위치에서 추정했습니다. 상품명·가격 연결을 확인하세요.'],sourceGraph:graph,analysisStatus:'object-inferred',materialMode:graph.materialMode};
}
