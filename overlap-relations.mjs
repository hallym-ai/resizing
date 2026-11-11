// Original relationship helpers. Object-box intersection is evidence to review,
// not a blanket reason to separate layers or proof of visible pixel occlusion.
export const overlapArea=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
export function sourceOverlapRelations(elements,{acceptedPairs=[],groupIds=null}={}){
 const accepted=new Set(acceptedPairs.map(p=>[...p].sort((a,b)=>a-b).join(':'))),visible=elements.filter(e=>!e.hidden&&e.role!=='background'),relations=[];
 for(let i=0;i<visible.length;i++)for(let j=i+1;j<visible.length;j++){
  const a=visible[i],b=visible[j],ab=a.tightBox||a,bb=b.tightBox||b,area=overlapArea(ab,bb),pair=[a.id,b.id].sort((x,y)=>x-y),explicit=accepted.has(pair.join(':')),shared=groupIds&&groupIds[a.id]&&groupIds[a.id]===groupIds[b.id];if(area<=1&&!explicit)continue;
  relations.push({id:'source-overlap:'+pair.join(':'),ids:pair,kind:a.text&&b.text?'text-text':a.text||b.text?'text-image':'image-image',evidence:area<=1?'explicit-planned':a.tightBox||b.tightBox?'measured-native-boxes':'source-object-boxes',sourceCoverage:area/Math.min(ab.w*ab.h,bb.w*bb.h),paintOrder:[...pair],allowed:!!(explicit||shared),applied:!!shared&&area>1,policy:area<=1?'explicit-planned-overlap':shared?'preserve-group-affine-and-source-order':explicit?'explicit-source-overlap':'candidate-needs-review',anchor:{dx:(bb.x+bb.w/2-ab.x-ab.w/2)/Math.max(ab.w,bb.w),dy:(bb.y+bb.h/2-ab.y-ab.h/2)/Math.max(ab.h,bb.h)},visibleOcclusion:'not_run'});
 }
 return relations;
}
export function paintOrderForRelations(elements,relations,rank=e=>e.role==='background'?0:e.text?2:1){
 const byId=new Map(elements.map(e=>[e.id,e])),edges=new Map(elements.map(e=>[e.id,new Set()])),degree=new Map(elements.map(e=>[e.id,0]));
 for(const r of relations.filter(r=>r.allowed||r.applied)){const ids=r.paintOrder||r.ids;for(let i=1;i<ids.length;i++){const a=ids[i-1],b=ids[i];if(!byId.has(a)||!byId.has(b)||edges.get(a).has(b))continue;edges.get(a).add(b);degree.set(b,degree.get(b)+1);}}
 const ready=elements.filter(e=>!degree.get(e.id)),order=[];
 while(ready.length){ready.sort((a,b)=>rank(a)-rank(b)||a.id-b.id);const e=ready.shift();order.push(e.id);for(const next of edges.get(e.id)){degree.set(next,degree.get(next)-1);if(!degree.get(next))ready.push(byId.get(next));}}
 return order.length===elements.length?{order,cyclic:false}:{order:elements.map(e=>e.id),cyclic:true};
}
export function appliedOverlapPairs(relations){return relations.filter(r=>r.allowed||r.applied).map(r=>r.ids);}
