import {Solver,Variable,Expression,Constraint,Operator,Strength} from './vendor/layout/kiwi/kiwi.js';
import {munkres} from './vendor/layout/munkres.mjs';
export const constraintEngines={geometry:'@lume/kiwi@0.4.4',assignment:'munkres@2.1.1',semanticAnalysis:'local evidence rules',topology:'enumerated region trees'};
export function assignRegionSlots(groups,slots){
 if(groups.length!==slots.length||new Set(groups.map(g=>g.id)).size!==groups.length||new Set(slots.map(s=>s.id)).size!==slots.length||!groups.length)return null;
 if(groups.some(g=>![g.sourceOrder,g.normalized?.cx,g.normalized?.cy].every(Number.isFinite))||slots.some(s=>![s.order,s.preferred?.cx,s.preferred?.cy].every(Number.isFinite)))return null;
 const blocked=1e12,cost=groups.map(g=>slots.map(s=>g.role!==s.role||g.band!==s.band?blocked:4*((g.normalized.cx-s.preferred.cx)**2+(g.normalized.cy-s.preferred.cy)**2)+Math.abs(g.sourceOrder-s.order)*.005));
 const result=munkres(cost);if(result.length!==groups.length||new Set(result.map(([a])=>a)).size!==groups.length||new Set(result.map(([,b])=>b)).size!==slots.length||result.some(([a,b])=>cost[a][b]>=blocked))return null;
 return result.map(([a,b])=>({group:groups[a],slot:slots[b],cost:cost[a][b]}));
}
// Topology and actual text minima are supplied by the caller. Kiwi only solves
// the continuous dimensions; it does not infer roles, wrapping or disjunctions.
export function solveRegionStack(cell,items,gap,{horizontal=false,center=true}={}){
 const solver=new Solver(),vars=new Map(),axis=horizontal?'w':'h',pos=horizontal?'x':'y',cross=horizontal?'h':'w',crossPos=horizontal?'y':'x',count=items.length;
 if(!count)return{boxes:{},constraints:0};let constraints=0;
 const add=(terms,op,rhs,strength=Strength.required)=>{solver.addConstraint(new Constraint(new Expression(...terms),op,rhs,strength));constraints++;};
 try{
  if(!Object.values(cell).every(Number.isFinite)||cell.w<=0||cell.h<=0)throw Error('empty region');
  const total=items.reduce((n,u)=>n+u.weight,0)||1;
  for(const u of items){const v=Object.fromEntries(['x','y','w','h'].map(k=>[k,new Variable(u.id+'.'+k)]));vars.set(u.id,v);
   add([v.x],Operator.Ge,cell.x);add([v.y],Operator.Ge,cell.y);add([v.x,v.w],Operator.Le,cell.x+cell.w);add([v.y,v.h],Operator.Le,cell.y+cell.h);
   add([v.w],Operator.Ge,u.minW);add([v.h],Operator.Ge,u.minH);
   add([v[cross]],Operator.Eq,cell[cross]);add([v[crossPos]],Operator.Eq,cell[crossPos]);
   add([v[axis]],Operator.Eq,(cell[axis]-gap*(count-1))*u.weight/total,Strength.medium);
  }
  items.forEach((u,i)=>{const v=vars.get(u.id);if(!i)add([v[pos]],Operator.Eq,cell[pos]);else{const prev=vars.get(items[i-1].id);add([v[pos],[-1,prev[pos]],[-1,prev[axis]]],Operator.Eq,gap);}});
  const last=vars.get(items[count-1].id);add([last[pos],last[axis]],Operator.Eq,cell[pos]+cell[axis]);solver.updateVariables();
  const boxes=Object.fromEntries([...vars].map(([id,v])=>[id,Object.fromEntries(Object.entries(v).map(([k,x])=>[k,x.value()]))]));
  return{boxes,constraints};
 }catch(error){return{boxes:null,reason:error.message,constraints};}
}
