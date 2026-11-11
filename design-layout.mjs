/* Penpot-style declarative flex rules; calculations are performed by Yoga.
 * Original integration code. Does not embed or copy the Penpot application. */
import {solveFlexTree,solverInfo} from './yoga-solver.mjs';
export {solverInfo};
const bounds=items=>{const x=Math.min(...items.map(e=>e.x)),y=Math.min(...items.map(e=>e.y));return{x,y,w:Math.max(...items.map(e=>e.x+e.w))-x,h:Math.max(...items.map(e=>e.y+e.h))-y};};

export function designRules(width,height,groups,design=null){
 const short=Math.min(width,height),margin=short*(design?.variant==='minimal'?.08:.06),gap=short*.028,W=width-margin*2,H=height-margin*2,r=width/height;
 const mode=r>=2.5?'wide':r>=1.25?'landscape':r<=.8?'portrait':'square';
 const weights={logo:.075,title:.23,subject:.40,decoration:.18,body:.17,details:.125,...({editorial:{title:.34,body:.23,subject:.28},visual:{title:.20,subject:.58,decoration:.24},minimal:{title:.27,subject:.32,body:.20}}[design?.variant]||{})},has=key=>groups.has(key);if(design?.titleScale>1)weights.title*=design.titleScale;
 for(const key of ['title','subject','details'])if(Number.isFinite(design?.weights?.[key]))weights[key]=Math.max(.04,Math.min(.7,design.weights[key]));
 const leaf=role=>{const lines=groups.get(role).filter(e=>e.text).reduce((n,e)=>n+Math.max(1,e.text.split(/\n/).length),0);return{key:role,basis:0,grow:weights[role]*Math.min(1.6,1+Math.max(0,lines-2)*.08),shrink:1,minWidth:0,minHeight:0};};
 const leaves=roles=>{const nodes=roles.map(leaf),total=nodes.reduce((sum,n)=>sum+n.grow,0);return nodes.map(n=>({...n,grow:n.grow/total}));};
 const column=(key,roles,grow)=>({key,direction:'column',gap:Math.min(gap,H/(roles.length*5)),basis:0,grow,minWidth:0,minHeight:0,children:leaves(roles)});
 const images=['subject','decoration'].filter(has),copy=['logo','title','body','details'].filter(has);
 const split=(mode==='landscape'||mode==='wide')&&images.length&&copy.length;
 let children;
 if(split){const copyShare=Number.isFinite(design?.copyShare)?Math.max(.35,Math.min(.65,design.copyShare)):design?.variant==='editorial'?.62:design?.variant==='visual'?.40:design?.variant==='minimal'?.60:mode==='wide'?.54:.53;children=[column('copy-column',copy,copyShare),column('art-column',images,1-copyShare)];if(design?.imageSide==='left'||!design?.imageSide&&design?.variant==='visual')children.reverse();}
 else children=leaves(['logo','title','subject','decoration','body','details'].filter(has));
 const rule={key:'canvas',width,height,direction:split?'row':'column',padding:margin,gap:split?gap:Math.min(gap,H/(Math.max(1,children.length)*5)),align:'stretch',children};
 return{schema:'coex-flex-v1',mode,margin,gap,rule};
}

export function designZones(width,height,groups,design=null){
 const rules=designRules(width,height,groups,design),result=solveFlexTree(rules.rule),zones={};
 for(const role of groups.keys()){const b=result.boxes[role];if(!b||b.w<=0||b.h<=0)throw Error('요소를 배치할 공간이 부족합니다. 크기나 내용을 확인하세요.');zones[role]=b;}
 return{mode:rules.mode,zones,margin:rules.margin,gap:rules.gap,rules,solver:result.engine};
}

export function designUnits(items,role){
 if(role==='logo')return[{items,b:bounds(items)}];
 const grouped=new Map();for(const e of items){const key=e.sourceGroup?`native:${e.sourceGroup}`:`single:${e.id}`;if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(e);}
 return [...grouped.values()].map(items=>({items,b:bounds(items)})).sort((a,b)=>a.b.y-b.b.y||a.b.x-b.b.x);
}

export function packDesignUnits(items,role,zone,gap,mode){
 const units=designUnits(items,role),n=units.length;
 if(n===1)return units.map(u=>({...u,cell:zone}));
 let best;
 for(let columns=1;columns<=Math.min(n,n>12?24:8);columns++){
  const rows=Math.ceil(n/columns),g=Math.min(gap,zone.w/(columns*8),zone.h/(rows*8)),cw=(zone.w-g*(columns-1))/columns,ch=(zone.h-g*(rows-1))/rows;
  let score=0,minText=Infinity;for(const u of units){const s=Math.min(cw/u.b.w,ch/u.b.h);score+=u.b.w*u.b.h*s*s;if(u.items.some(e=>e.text))minText=Math.min(minText,u.b.h*s);}
  score/=zone.w*zone.h;score+=Number.isFinite(minText)?Math.min(.3,minText/Math.max(zone.w,zone.h)):0;
  // Prefer a simple reading order for small sets. For dense slides, a fixed
  // penalty per column overwhelmed usable area and forced hundreds of rows.
  if(['title','body','details'].includes(role)&&columns>1)score-=.13*(columns-1)*Math.min(1,12/n);
  if(!best||score>best.score)best={columns,rows,g,cw,score};
 }
 const center=['portrait','square'].includes(mode)||role==='subject'||role==='decoration';
 const rule={key:'grid',width:zone.w,height:zone.h,direction:'column',gap:best.g,children:[]};
 for(let row=0;row<best.rows;row++){
  const cells=units.slice(row*best.columns,(row+1)*best.columns);
  rule.children.push({key:`row:${row}`,direction:'row',gap:best.g,basis:0,grow:1,minHeight:0,justify:center?'center':'start',children:cells.map((u,col)=>({key:`cell:${row*best.columns+col}`,width:best.cw,shrink:0,minWidth:0}))});
 }
 const result=solveFlexTree(rule);
 return units.map((u,i)=>{const b=result.boxes[`cell:${i}`];return{...u,cell:{x:zone.x+b.x,y:zone.y+b.y,w:b.w,h:b.h}};});
}

export function inspectLayout(elements,width,height,margin=0){
 const visible=elements.filter(e=>!e.hidden&&e.role!=='background'),outside=[],overlaps=[];
 for(const e of visible)if(e.x<margin-.6||e.y<margin-.6||e.x+e.w>width-margin+.6||e.y+e.h>height-margin+.6)outside.push(e.id);
 for(let i=0;i<visible.length;i++)for(let j=i+1;j<visible.length;j++){
  const a=visible[i],b=visible[j];if(a.sourceGroup&&a.sourceGroup===b.sourceGroup)continue;if(a.role==='logo'&&b.role==='logo')continue;
  const intersection=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
  if(intersection>Math.max(1,Math.min(a.w*a.h,b.w*b.h)*.002))overlaps.push([a.id,b.id]);
 }
 return{outside,overlaps};
}
