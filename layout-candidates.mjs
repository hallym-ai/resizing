import {referenceLayoutScore} from './reference-layout-policy.mjs';
import {regionCandidates} from './region-layout.mjs';
import {relationshipPlan} from './relationship-layout.mjs';

// These are alternative compositions over the same original units, not new
// assets. Real Fabric measurement and collision checks choose the final plan.
export function relationshipCandidates(elements,options){
 const ratio=options.width/options.height;
 const profiles=ratio>=1.25?[
  {variant:'columns',copyShare:.48,label:'좌우 균형'},
  {variant:'columns',copyShare:.60,label:'문구 중심 좌우'},
  {variant:'columns',copyShare:.68,label:'긴 문구 좌우'},
  {variant:'headline',headShare:.34,imageShare:.40,label:'상단 제목·하단 병렬'}
 ]:ratio<=.8?[
  {variant:'stack',headShare:.24,imageShare:.40,label:'제목·상품·정보'},
  {variant:'stack',headShare:.31,imageShare:.32,label:'긴 제목·상품·정보'},
  {variant:'hero-first',headShare:.24,imageShare:.40,label:'상품·제목·정보'}
 ]:[
  {variant:'headline',headShare:.31,imageShare:.51,label:'상단 제목·하단 병렬'},
  {variant:'columns',copyShare:.57,label:'좌우 문구·상품'},
  {variant:'stack',headShare:.25,imageShare:.38,label:'제목·상품·정보'}
 ];
 if(ratio>.4&&ratio<3)profiles.unshift(...[0,1,2].map(familyVariant=>({variant:'family',familyVariant,label:'원본 관계 마스터 '+(familyVariant+1)})));
 const generic=regionCandidates(elements,options);const plans=[...generic.plans],failures=[...generic.failures];
 for(let i=0;i<profiles.length;i++)for(const anchor of ['bottom','top','split']){
  const jointLayout={...profiles[i],anchor,id:`${ratio>=1.25?'wide':ratio<=.8?'tall':'square'}-${i}-${anchor}`,label:profiles[i].label+' · '+({bottom:'하단 브랜드',top:'상단 브랜드',split:'상하 브랜드'}[anchor])};
  try{const plan=relationshipPlan(elements,{...options,design:{jointLayout}});if(plan)plans.push(plan);}catch(error){if(error.code!=='LAYOUT_NEEDS_REVIEW')throw error;failures.push({id:jointLayout.id,reason:error.message});}
 }
 return {plans,failures};
}

export function scoreMeasuredLayout(plan,objects){
 const short=Math.min(plan.width,plan.height),canvasArea=plan.width*plan.height;
 const elements=plan.placements.map(p=>{const o=objects[p.id],b=o.getBoundingRect();return{p,o,b,size:(o.fontSize||0)*Math.abs(o.scaleY||1)}});
 const native=role=>elements.filter(e=>e.p.groupRole===role&&['text','textbox','itext'].includes(String(e.o.type).toLowerCase()));
 const minimum=role=>{const a=native(role);return a.length?Math.min(...a.map(e=>e.size)):null;};
 const title=minimum('title'),body=minimum('body'),details=minimum('details');
 const heroArea=elements.filter(e=>e.p.groupRole==='subject').reduce((n,e)=>n+e.b.width*e.b.height,0)/canvasArea;
 const quality=(value,target)=>value===null?1:Math.min(1,value/target);
 // Compare roles separately: a giant photo may not compensate for unreadable
 // text. All candidates already pass the explicit font floors and overlaps.
 const score=4*quality(title,short*.15)+2*quality(body,short*.033)+1.5*quality(details,short*.04)+2.5*Math.min(1,heroArea/.23)+.03*(plan.anchorAffinity||0);
 const reference=referenceLayoutScore(plan,objects);
 return {score:score+reference.bonus,reference,titleSize:title,bodySize:body,detailsSize:details,heroArea,variant:plan.candidate,anchor:plan.brandAnchor,label:plan.layoutLabel};
}


export function measuredLayoutSignature(objects){return JSON.stringify(objects.map(o=>[o.left,o.top,o.width,o.height,o.scaleX,o.scaleY,o.angle,o.textAlign,o.visible].map(v=>typeof v==='number'?Math.round(v*1000):v)));}
