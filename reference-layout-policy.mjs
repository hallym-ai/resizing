import {referenceBuckets} from './reference-layout-data.mjs';
// Observed reference coordinates are preferences, never permission to crop or omit.
export function referencePreference(width,height){const ar=width/height;return referenceBuckets.find(b=>ar>=b.ratio[0]&&(b.ratio[1]===null||ar<b.ratio[1]))||referenceBuckets[0];}
export function referenceTopologies(width,height){const b=referencePreference(width,height);return b.id==='ultra_wide'?[{type:'inline',share:.6}]:b.id==='wide'?[{type:'row',share:.5},{type:'row',share:.6}]:b.id==='square'?[{type:'corner',share:.52},{type:'column',heroFirst:false},{type:'row',share:.53}]:[{type:'column',heroFirst:false},{type:'column',heroFirst:true}];}
export function referenceLayoutScore(plan,objects){
 const pref=referencePreference(plan.width,plan.height),units=new Map();for(const p of plan.placements.filter(p=>p.groupRole==='subject')){const b=objects[p.id].getBoundingRect(),key=p.layoutGroup??p.id,old=units.get(key);units.set(key,old?{left:Math.min(old.left,b.left),top:Math.min(old.top,b.top),right:Math.max(old.right,b.left+b.width),bottom:Math.max(old.bottom,b.top+b.height)}:{left:b.left,top:b.top,right:b.left+b.width,bottom:b.top+b.height});}
 const heroArea=[...units.values()].reduce((sum,b)=>sum+(b.right-b.left)*(b.bottom-b.top),0)/(plan.width*plan.height),heroFit=units.size?Math.max(0,1-Math.abs(heroArea-pref.heroArea)/Math.max(.1,pref.heroArea)):1;
 return{bucket:pref.id,heroArea,targetHeroArea:pref.heroArea,bonus:.8*heroFit,evidence:'97 reference samples; approximate hand-labelled boxes; soft preference only'};
}
export function adaptMaterialBackground(o,node,width,height){
 if(String(o.type).toLowerCase()!=='image'||o.layoutManualRole||o.layoutManualGroup)return null;const b=o.getBoundingRect();
 if(node?.materialKind==='edge-texture'){const scale=height/b.height;return{x:node.source.x+node.source.w/2>node.basis.sourceWidth/2?width-b.width*scale:0,y:0,scale};}
 const scale=Math.max(width/b.width,height/b.height);return{x:(width-b.width*scale)/2,y:(height-b.height*scale)/2,scale};
}
export function supportLightMaterialText(o,node){
 if(node?.kind!=='text'||!['body','details'].includes(node.role)||node.manualRole||node.manualGroup||o.textBackgroundColor||typeof o.fill!=='string')return false;
 try{const c=document.createElement('canvas');c.width=c.height=1;const ctx=c.getContext('2d');ctx.fillStyle=o.fill;ctx.fillRect(0,0,1,1);const p=ctx.getImageData(0,0,1,1).data;c.width=c.height=0;if(Math.min(...p.slice(0,3))<220||p[3]<250)return false;o.set('textBackgroundColor','#242424');return true;}catch{return false;}
}
