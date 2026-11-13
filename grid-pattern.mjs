// Scratch-only. A periodic grid is heuristic evidence, never proof that a
// bitmap contains no embedded logo or text. Caller must disclose review.
const mirrors=new WeakMap();
function axisScore(data,w,h,axis){
 const start=Math.floor(h*.35),hi=Math.min(128,Math.floor((axis==='x'?w:h)*.3)),step=Math.max(3,Math.ceil(Math.sqrt(w*h/120000)));let best=null;
 for(let k=8;k<=hi;k++){let sum=0,bad=0,n=0,low=255,high=0;
  for(let y=start;y<h-(axis==='y'?k:0);y+=step)for(let x=0;x<w-(axis==='x'?k:0);x+=step){const a=(y*w+x)*4,b=((y+(axis==='y'?k:0))*w+x+(axis==='x'?k:0))*4;if(data[a+3]<250||data[b+3]<250)continue;let d=0;for(let q=0;q<3;q++)d=Math.max(d,Math.abs(data[a+q]-data[b+q]));sum+=d;if(d>5)bad++;n++;const v=(data[a]+data[a+1]+data[a+2])/3;low=Math.min(low,v);high=Math.max(high,v)}
  if(n>=500){const t={period:k,mean:sum/n,bad:bad/n,contrast:high-low,samples:n};if(!best||t.mean<best.mean)best=t;}
 }
 return best;
}
export function inspectGridPixels({data,width,height}){
 if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<64||height<64||width*height>8000000||data?.length!==width*height*4)return null;
 const x=axisScore(data,width,height,'x'),y=axisScore(data,width,height,'y');
 if(!x||!y||x.mean>.2||y.mean>.2||x.bad>.005||y.bad>.005||x.contrast<6||y.contrast<6)return null;
 return {x,y,semanticGuarantee:false,warning:'반복 패턴 추정입니다. 이미지에 포함된 글씨·로고와 좌우 경계를 확인하세요.'};
}
const rect=o=>{const r=o.getBoundingRect();return {left:r.left,top:r.top,right:r.left+r.width,bottom:r.top+r.height}};
const intersects=(a,b)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>.01&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>.01;
function lowerSignature(o){try{if(typeof o.toObject!=='function')return null;return JSON.stringify(o.toObject(),(k,v)=>k==='src'&&typeof v==='string'?'[source]':v);}catch{return null;}}
export function inspectGridCandidate({state,object,sourceFrame,targetFrame,pixels,permittedUnderlays=[],allowNoExtension=false,reviewedJson=false}){
 if(state?.inputKind!=='layered'||!(state?.sourceFormat==='pptx'||state?.sourceFormat==='json'&&reviewedJson)||!object||!Array.isArray(state.objects)||!sourceFrame||!targetFrame)return null;
 const o=object,id=state.objects.indexOf(o);if(id<0||o.visible===false||o.gridSourceUserEdited||o.layerRole!=='subject'||o.layerRoleInferred!==true||o.layerLocked||o.layoutManualRole||o.layoutManualGroup||o.sourceText||o.text||o.sourceImageFill||o.sourceElementType!=='picture'||o.cutoutMethod!=='pptx-original-object'||!o.sourceElementId||String(o.type).toLowerCase()!=='image'||o.group||o.clipPath||o.shadow||o.filters?.length||o.angle||o.skewX||o.skewY||o.flipX||o.flipY||o.cropX||o.cropY||o.trialOutsideRestore||o.__outsideTrialVisible||(o.opacity??1)!==1||o.globalCompositeOperation&&o.globalCompositeOperation!=='source-over'||o.originX!=='left'||o.originY!=='top'||!(o.scaleX>0&&o.scaleY>0))return null;
 const b=rect(o),f=sourceFrame,tol=2;if(![b.left,b.top,b.right,b.bottom,f.left,f.top,f.right,f.bottom,targetFrame.left,targetFrame.top,targetFrame.right,targetFrame.bottom].every(Number.isFinite)||Math.abs(b.left-f.left)>tol||Math.abs(b.right-f.right)>tol||Math.abs(b.bottom-f.bottom)>tol||b.top<f.top-tol||(b.bottom-b.top)/(f.bottom-f.top)<.2||(b.bottom-b.top)/(f.bottom-f.top)>.65)return null;
 if(targetFrame.right<=targetFrame.left||targetFrame.bottom<=targetFrame.top||!allowNoExtension&&f.left<=targetFrame.left+.01&&f.right>=targetFrame.right-.01||pixels?.width!==o.width||pixels?.height!==o.height)return null;
 // Never paint over earlier visible, potentially meaningful content. The caller
 // must separately prove each permitted underlay's identity and opacity.
 const regions=[{left:targetFrame.left,top:b.top,right:f.left,bottom:b.bottom},{left:f.right,top:b.top,right:targetFrame.right,bottom:b.bottom}];
 for(const lower of state.objects.slice(0,id)){if(lower.visible===false||permittedUnderlays.includes(lower))continue;if(lower.group||lower.shadow||lower.clipPath||lower.filters?.length)return null;const q=rect(lower);if(regions.some(z=>intersects(q,z)))return null;}
 const grid=inspectGridPixels(pixels);if(!grid)return null;
 const el=o.getElement?.(),src=o.getSrc?.();if(!el||!src||typeof o._render!=='function')return null;
 const keys=['left','top','scaleX','scaleY','angle','skewX','skewY','flipX','flipY','cropX','cropY','opacity','visible','layerLocked','layerRole','layerRoleInferred','layoutManualRole','layoutManualGroup','sourceText','sourceImageFill','globalCompositeOperation'];
 const lower=state.objects.slice(0,id).map(x=>({object:x,visible:x.visible,box:x.getBoundingRect?.(),element:x.getElement?.(),src:x.getSrc?.(),signature:lowerSignature(x)}));if(lower.some(x=>!x.signature))return null;
 return {object:o,element:el,src,width:o.width,height:o.height,index:id,objects:state.objects.slice(),epoch:state.epoch,properties:Object.fromEntries(keys.map(k=>[k,o[k]])),lower,grid,quality:'review',warning:grid.warning};
}
export function installGridMirror(plan,{targetWidth}){
 const o=plan?.object;if(!o||!Number.isFinite(targetWidth)||targetWidth<=0||o.getElement?.()!==plan.element||o.getSrc?.()!==plan.src||o.width!==plan.width||o.height!==plan.height||!(o.scaleX>0)||o.width*o.scaleX<=0)return false;
 const current=p=>{const all=o.canvas?.getObjects?.();if(!all||all.length!==p.objects.length||all.some((x,i)=>x!==p.objects[i]))return false;if(Object.entries(p.properties).some(([k,v])=>!Object.is(o[k],v)))return false;return p.lower.every(({object,visible,box,element,src,signature})=>{if(object.visible!==visible||object.getElement?.()!==element||object.getSrc?.()!==src||lowerSignature(object)!==signature)return false;if(!box)return !object.getBoundingRect;const q=object.getBoundingRect();return ['left','top','width','height'].every(k=>Math.abs(q[k]-box[k])<.01);});};
 if(!current(plan))return false;
 const count=Math.ceil(targetWidth/(o.width*o.scaleX))+1;if(count>32)return false;
 const existing=mirrors.get(o);if(existing){if(o._render!==existing.wrapper||existing.plans.length>=8)return false;existing.plans.push({plan,count,committed:false});o.objectCaching=false;o.dirty=true;return true;}
 const original=o._render,oldCache=o.objectCaching,entry={original,oldCache,plans:[{plan,count,committed:false}],wrapper:null};
 o._render=function(ctx){
  const hit=entry.plans.findLast(({plan:p})=>current(p)&&this.getElement?.()===p.element&&this.getSrc?.()===p.src&&this.width===p.width&&this.height===p.height);
  const safe=hit&&!this.group&&!this.clipPath&&!this.shadow&&!this.filters?.length&&!this.angle&&!this.skewX&&!this.skewY&&!this.flipX&&!this.flipY&&!this.cropX&&!this.cropY&&(this.opacity??1)===1&&(!this.globalCompositeOperation||this.globalCompositeOperation==='source-over');
  if(safe){const {count}=hit;ctx.save();try{ctx.beginPath();ctx.rect((-count-.5)*this.width,-this.height/2,count*this.width,this.height);ctx.rect(this.width/2,-this.height/2,count*this.width,this.height);ctx.clip();for(let n=-count;n<=count;n++){if(!n)continue;ctx.save();try{ctx.translate(n*this.width,0);if(Math.abs(n)%2)ctx.scale(-1,1);original.call(this,ctx)}finally{ctx.restore()}}}finally{ctx.restore()}}
  original.call(this,ctx);
 };
 entry.wrapper=o._render;mirrors.set(o,entry);o.objectCaching=false;o.dirty=true;return true;
}
export function uninstallGridMirror(o){const x=mirrors.get(o);if(!x)return false;mirrors.delete(o);if(o._render!==x.wrapper)return false;o._render=x.original;if(o.objectCaching===false)o.objectCaching=x.oldCache;o.dirty=true;return true;}
// Drop only the plan staged by a failed/cancelled resize, preserving any
// earlier committed plans used by the current canvas or a size undo.
export function removeGridMirrorPlan(plan){const o=plan?.object,x=o&&mirrors.get(o);if(!x)return false;const i=x.plans.findIndex(p=>p.plan===plan);if(i<0)return false;x.plans.splice(i,1);if(!x.plans.length)uninstallGridMirror(o);else o.dirty=true;return true;}

// Preserve in-flight plans; prune only old committed plans after success.
export function commitGridMirrorPlan(plan){const x=plan?.object&&mirrors.get(plan.object),p=x?.plans.find(item=>item.plan===plan);if(!p)return false;p.committed=true;while(x.plans.filter(item=>item.committed).length>4){const i=x.plans.findIndex(item=>item.committed&&item.plan!==plan);if(i<0)break;x.plans.splice(i,1);}return true;}
