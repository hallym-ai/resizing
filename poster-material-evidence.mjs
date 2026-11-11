// Read-only evidence from existing assets. No OCR, asset generation or deletion.
const objects=new Map(),tokens=new WeakMap(),profiles=new WeakMap(),masks=new WeakMap();let sequence=0;
export function posterVisualEvidence(o){
 let token=tokens.get(o);if(!token){token='visual-'+(++sequence);tokens.set(o,token);objects.set(token,new WeakRef(o));}
 if(String(o.type).toLowerCase()!=='image')return{visualToken:token};
 const el=o.getElement?.();if(!el||o.clipPath||o.group||o.cropX||o.cropY||o.filters?.length)return{visualToken:token};
 const key=[el,o.width,o.height],old=profiles.get(o);if(old&&old.key.every((v,i)=>v===key[i]))return{visualToken:token,visualProfile:old.value};
 try{
  const c=document.createElement('canvas'),s=192/Math.max(o.width,o.height);c.width=Math.max(1,Math.ceil(o.width*s));c.height=Math.max(1,Math.ceil(o.height*s));const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(el,0,0,c.width,c.height);const a=ctx.getImageData(0,0,c.width,c.height).data;
  let max=0;for(let i=3;i<a.length;i+=4)max=Math.max(max,a[i]);let count=0,sum=[0,0,0],sq=[0,0,0],left=c.width,top=c.height,right=0,bottom=0;const core=new Uint8Array(c.width*c.height),palette=new Map();
  for(let p=0;p<core.length;p++){const i=p*4;if(a[i+3]<Math.max(1,max*.5))continue;core[p]=1;count++;const x=p%c.width,y=Math.floor(p/c.width);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);for(let k=0;k<3;k++){sum[k]+=a[i+k];sq[k]+=a[i+k]**2;}const color=(a[i]>>5)*64+(a[i+1]>>5)*8+(a[i+2]>>5);palette.set(color,(palette.get(color)||0)+1);}
  let components=0,largest=0;const queue=new Int32Array(core.length);for(let p=0;p<core.length;p++){if(!core[p])continue;components++;let head=0,tail=1;queue[0]=p;core[p]=0;while(head<tail){const at=queue[head++],x=at%c.width;for(const next of[at-c.width,at+c.width,x?at-1:-1,x<c.width-1?at+1:-1])if(next>=0&&next<core.length&&core[next]){core[next]=0;queue[tail++]=next;}}largest=Math.max(largest,tail);}
  const value={mean:sum.map(v=>count?v/count:0),maxAlpha:max,coverage:count/core.length,variance:count?sum.reduce((v,n,k)=>v+Math.max(0,sq[k]/count-(n/count)**2),0)/3:Infinity,components,largestFraction:count?largest/count:1,paletteFraction:count?[...palette.values()].sort((a,b)=>b-a).slice(0,4).reduce((a,b)=>a+b,0)/count:0,inkAspect:count?(right-left+1)/(bottom-top+1):1};c.width=c.height=0;profiles.set(o,{key,value});return{visualToken:token,visualProfile:value};
 }catch{return{visualToken:token};}
}
const overlap=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
const centerDistance=(a,b)=>Math.hypot(a.x+a.w/2-b.x-b.w/2,a.y+a.h/2-b.y-b.h/2);
export function inferPosterMaterials(nodes,sw,sh){
 const texts=nodes.filter(n=>n.kind==='text'),eligible=n=>!n.manualRole&&!n.manualGroup&&!n.locked&&n.roleConfidence!=='declared',images=nodes.filter(n=>n.kind==='image'&&n.role!=='background'),area=sw*sh;
 const heroes=images.filter(n=>eligible(n)&&n.visualProfile?.variance>400&&n.source.w*n.source.h>area*.06&&Math.min(n.source.w,n.source.h)/Math.max(n.source.w,n.source.h)>.25);
 const panels=images.filter(n=>eligible(n)&&n.visualProfile?.variance<200&&n.visualProfile.maxAlpha>=240&&n.visualProfile.coverage>.75&&n.source.w>sw*.55&&n.source.h>sh*.55&&n.source.w*n.source.h>area*.35&&texts.filter(t=>overlap(n.source,t.source)>t.source.w*t.source.h*.8).length>=2);
 if(texts.length<2||!heroes.length||!panels.length)return false;
 const mark=(n,role,kind,target)=>{n.role=role;n.materialKind=kind;n.materialAttachTo=target?.id;n.roleEvidence.push('poster-material:'+kind);n.roleConfidence='material-geometry-inferred';n.roleCandidates[0]={role,evidence:[...n.roleEvidence]};};
 for(const n of panels)mark(n,'background','panel');
 const titles=texts.filter(t=>t.role==='title'),titleTop=Math.min(...titles.map(t=>t.source.y)),titleFont=Math.max(1,...titles.map(t=>t.originalFont));
 for(const t of texts)if(eligible(t)&&t.role==='body'&&t.originalFont<titleFont*.4&&t.source.y+t.source.h<titleTop)mark(t,'logo','header-brand');
 for(const n of images.filter(n=>!panels.includes(n)&&eligible(n)&&!heroes.includes(n))){const p=n.visualProfile,b=n.source;if(!p)continue;const size=b.w*b.h/area;
  const native=texts.filter(t=>!t.manualGroup&&!t.manualRole).sort((a,c)=>centerDistance(b,a.source)-centerDistance(b,c.source));
  const backing=native.find(t=>p.variance<200&&size<.3&&size>.01&&n.basis.order<t.basis.order&&overlap(b,t.source)>t.source.w*t.source.h*.85);
  if(backing){mark(n,backing.role,'text-backing',backing);continue;}
  const lettering=p.variance<36&&p.components>=6&&p.largestFraction<.65&&b.w/b.h>=3&&b.w>sw*.2&&size<.08;
  if(lettering){const t=native.filter(t=>t.role==='title').sort((a,c)=>centerDistance(b,a.source)-centerDistance(b,c.source))[0];if(t&&centerDistance(b,t.source)<sh*.3){mark(n,t.role,'raster-lettering',t);continue;}}
  const shadow=heroes.filter(h=>n.basis.order<h.basis.order&&overlap(b,h.source)>b.w*b.h*.15).sort((a,c)=>centerDistance(b,a.source)-centerDistance(b,c.source))[0];
  if(p.maxAlpha<200&&p.variance<36&&shadow){mark(n,'subject','product-shadow',shadow);continue;}
  if(b.h>sh*.8&&p.inkAspect<.12&&(b.x+b.w/2>sw*.75||b.x+b.w/2<sw*.25)){mark(n,'background','edge-texture');continue;}
  const small=native.find(t=>size<.003&&b.h<t.source.h*1.3&&centerDistance(b,t.source)<Math.max(t.source.w*.8,t.source.h*2));
  if(small&&p.variance<200){mark(n,small.role,'text-mark',small);continue;}
  if(size<.05&&(p.variance<200||p.paletteFraction>.75)){mark(n,'decoration','floating');}
 }
 for(const n of images.filter(n=>n.materialKind==='floating'&&n.visualProfile.variance<200&&n.source.w*n.source.h>area*.015)){const panel=panels.find(p=>Math.min(Math.abs(n.source.x+n.source.w/2-p.source.x),Math.abs(n.source.x+n.source.w/2-p.source.x-p.source.w))<p.source.w*.22&&Math.min(Math.abs(n.source.y+n.source.h/2-p.source.y),Math.abs(n.source.y+n.source.h/2-p.source.y-p.source.h))<p.source.h*.22);if(panel){mark(n,'decoration','panel-anchor');n.panelId=panel.id;}}
 return true;
}
function sourceMask(node){
 const o=objects.get(node.visualToken)?.deref();if(!o||o.group||o.clipPath||o.shadow||o.globalCompositeOperation&&o.globalCompositeOperation!=='source-over')return null;
 const b=o.getBoundingRect(),source=node.source,current=node.tightBox||{x:b.left,y:b.top,w:b.width,h:b.height};if(['x','y','w','h'].some(k=>Math.abs(current[k]-source[k])>1))return null;
 const key=JSON.stringify([o.left,o.top,o.width,o.height,o.scaleX,o.scaleY,o.angle,o.skewX,o.skewY,o.flipX,o.flipY,o.opacity,o.cropX,o.cropY,o.text,o.fontFamily,o.fontSize,o.styles,o.fill,o.stroke,o.strokeWidth,o.charSpacing,o.lineHeight,o.getSrc?.()]);const cached=masks.get(o);if(cached?.key===key)return cached.value;
 for(const pad of[4,Math.ceil((node.fontSize||0)*1.2)+8]){
  const x=Math.floor(b.left-pad),y=Math.floor(b.top-pad),w=Math.ceil(b.width+2*pad)+2,h=Math.ceil(b.height+2*pad)+2;if(w*h>8000000)return null;
  const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d',{willReadFrequently:true}),cache=o.objectCaching,off=o.canvas?.skipOffscreen;
  try{ctx.translate(-x,-y);o.objectCaching=false;if(o.canvas)o.canvas.skipOffscreen=false;o.render(ctx);const rgba=ctx.getImageData(0,0,w,h).data,alpha=new Uint8Array(w*h);let painted=0,border=false;for(let i=0;i<alpha.length;i++){alpha[i]=rgba[i*4+3];if(alpha[i]){painted++;if(i<w||i>=w*(h-1)||i%w===0||i%w===w-1)border=true;}}if(!painted)return null;if(border)continue;const value={x,y,w,h,alpha};masks.set(o,{key,value});return value;
  }catch{return null;}finally{o.objectCaching=cache;if(o.canvas)o.canvas.skipOffscreen=off;c.width=c.height=0;}
 }return null;
}
// Only exact zero paint contact with a 2px fringe guard relaxes a box contact.
export function provenSeparatePaint(a,b){
 const x=sourceMask(a),y=sourceMask(b);if(!x||!y)return false;
 const left=Math.max(x.x-2,y.x),top=Math.max(x.y-2,y.y),right=Math.min(x.x+x.w+2,y.x+y.w),bottom=Math.min(x.y+x.h+2,y.y+y.h);
 for(let row=top;row<bottom;row++)for(let col=left;col<right;col++){if(!y.alpha[(row-y.y)*y.w+col-y.x])continue;for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const xx=col+dx-x.x,yy=row+dy-x.y;if(xx>=0&&xx<x.w&&yy>=0&&yy<x.h&&x.alpha[yy*x.w+xx])return false;}}
 return true;
}
