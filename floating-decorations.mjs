const distance=(a,b)=>Math.hypot(Math.max(0,b.x-a.x-a.w,a.x-b.x-b.w),Math.max(0,b.y-a.y-a.h,a.y-b.y-b.h));
export function findFloatingSpace({width,height,w,h,preferred,blockers,placed=[],gap=3}){
 if(![width,height,w,h].every(n=>Number.isFinite(n)&&n>0)||w>width||h>height||!Number.isFinite(preferred?.x)||!Number.isFinite(preferred?.y))return null;
 const xs=new Set([0,width-w,Math.max(0,Math.min(width-w,width*preferred.x-w/2))]),ys=new Set([0,height-h,Math.max(0,Math.min(height-h,height*preferred.y-h/2))]);
 const all=[...blockers,...placed.map(b=>({...b,clearance:gap}))];
 if(all.some(b=>![b.x,b.y,b.w,b.h,b.clearance??gap].every(Number.isFinite)||b.w<0||b.h<0||(b.clearance??gap)<0))return null;
 for(const b of all){const c=b.clearance??gap;xs.add(b.x-w-c-.1);xs.add(b.x+b.w+c+.1);ys.add(b.y-h-c-.1);ys.add(b.y+b.h+c+.1);}
 for(let i=0;i<=20;i++){xs.add((width-w)*i/20);ys.add((height-h)*i/20);}
 let best=null;for(const y of ys)for(const x of xs){if(x<0||y<0||x+w>width||y+h>height)continue;const p={x,y,w,h};if(all.some(b=>distance(p,b)<(b.clearance??gap)-.001))continue;const score=Math.hypot((x+w/2)/width-preferred.x,(y+h/2)/height-preferred.y);if(!best||score<best.score-1e-9||Math.abs(score-best.score)<1e-9&&(y<best.y||y===best.y&&x<best.x))best={...p,score};}
 return best;
}
export function settleFloatingDecorations(plan,state){
 const floating=(plan.placements||[]).filter(p=>p.decorationKind==='floating'&&p.deferredFloating);if(!floating.length)return;
 const floatingIds=new Set(floating.map(p=>p.id)),placed=[],resolved=[];
 for(const p of floating){const object=state.objects[p.id];if(object.visible===false)continue;const b=object.getBoundingRect();
  const blockers=state.objects.flatMap((o,id)=>{const role=plan.roles[id]||o.layerRole;if(o.visible===false||floatingIds.has(id)||role==='background'||role==='decoration')return[];const r=o.getBoundingRect(),text=['text','textbox','itext'].includes(String(o.type).toLowerCase())||!!o.sourceText||['title','body','details'].includes(role);return[{x:r.left,y:r.top,w:r.width,h:r.height,clearance:text||role==='logo'?24:Math.max(1,plan.gap||3)}];});
  const target=findFloatingSpace({width:plan.width,height:plan.height,w:b.width,h:b.height,preferred:p.floatingPreference||{x:(p.x+p.w/2)/plan.width,y:(p.y+p.h/2)/plan.height},blockers,placed,gap:Math.max(1,plan.gap||3)});
  if(!target){const error=Error('조정 필요: 실제 글자 배치 후에도 장식과 글자의 24px 간격을 확보하지 못했습니다.');error.code='LAYOUT_NEEDS_REVIEW';throw error;}
  const center=object.getCenterPoint();object.setPositionByOrigin(new state.F.Point(center.x+target.x-b.left,center.y+target.y-b.top),'center','center');object.setCoords();
  Object.assign(p,{x:target.x,y:target.y,w:b.width,h:b.height,floatingResolved:'measured-object-bounds'});placed.push(target);resolved.push({id:p.id,x:target.x,y:target.y,w:b.width,h:b.height});
 }
 plan.floatingResolution={method:'after typography fit; measured current object bounds',textClearance:24,placements:resolved};
}
