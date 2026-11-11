// Adapt a proven separate paper surface; foreground assets never enter this path.
const originals=new WeakMap(),surfaces=new WeakMap();
export function materialPanelFrame(plan){const m=plan.margin||Math.min(plan.width,plan.height)*.05;return{x:m,y:m,w:plan.width-m*2,h:plan.height-m*2};}
export function prepareMaterialPanel(o,node,plan){
 if(node?.materialKind!=='panel'||o.layoutManualRole||o.layoutManualGroup||o.clipPath||o.cropX||o.cropY||o.filters?.length||o.angle)return null;
 let el=originals.get(o);if(!el){el=o.getElement?.();if(!el)return null;originals.set(o,el);}
 const frame=materialPanelFrame(plan),w=Math.round(frame.w),h=Math.round(frame.h),sw=el.naturalWidth||el.width,sh=el.naturalHeight||el.height;if(Math.min(sw,sh,w,h)<8)return null;
 const key=w+'x'+h;let cache=surfaces.get(el);if(!cache){cache=new Map();surfaces.set(el,cache);}let surface=cache.get(key);
 if(!surface){try{
  const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d'),border=Math.max(2,Math.floor(Math.min(sw,sh)*.1)),pixelScale=node.source.w/sw*Math.min(plan.width,plan.height)/Math.min(node.basis.sourceWidth,node.basis.sourceHeight),d=Math.max(1,Math.min(Math.floor(Math.min(w,h)*.22),Math.round(border*pixelScale)));
  const patch=(sx,sy,pw,ph,dx,dy,dw,dh)=>{const p=document.createElement('canvas');p.width=Math.max(1,Math.round(pw*d/border));p.height=Math.max(1,Math.round(ph*d/border));p.getContext('2d').drawImage(el,sx,sy,pw,ph,0,0,p.width,p.height);x.save();x.beginPath();x.rect(dx,dy,dw,dh);x.clip();x.translate(dx,dy);x.fillStyle=x.createPattern(p,'repeat');x.fillRect(0,0,dw,dh);x.restore();};
  const tile=Math.min(128,sw-border*2,sh-border*2);patch(Math.floor((sw-tile)/2),Math.floor((sh-tile)/2),tile,tile,d,d,w-d*2,h-d*2);
  patch(border,0,sw-border*2,border,d,0,w-d*2,d);patch(border,sh-border,sw-border*2,border,d,h-d,w-d*2,d);patch(0,border,border,sh-border*2,0,d,d,h-d*2);patch(sw-border,border,border,sh-border*2,w-d,d,d,h-d*2);
  for(const [sx,sy,dx,dy]of[[0,0,0,0],[sw-border,0,w-d,0],[0,sh-border,0,h-d],[sw-border,sh-border,w-d,h-d]])x.drawImage(el,sx,sy,border,border,dx,dy,d,d);
  surface=c;cache.set(key,c);if(cache.size>4)cache.delete(cache.keys().next().value);
 }catch{return null;}}
 o.setElement(surface);o.set({width:w,height:h,scaleX:1,scaleY:1});o.setCoords();return{...frame,w,h,scale:1,strategy:'separate-paper-nine-slice-and-texture-repeat',seams:'requires-review'};
}
export function panelAnchorPlacement(node,panel,plan){const frame=materialPanelFrame(plan),a=node.source,p=panel.source,scale=Math.min(frame.w/p.w,frame.h/p.h),left=a.x+a.w/2<p.x+p.w/2,top=a.y+a.h/2<p.y+p.h/2,cx=frame.x+(left?0:frame.w)+(a.x+a.w/2-p.x-(left?0:p.w))*scale,cy=frame.y+(top?0:frame.h)+(a.y+a.h/2-p.y-(top?0:p.h))*scale,w=a.w*scale,h=a.h*scale;return{x:Math.max(0,Math.min(plan.width-w,cx-w/2)),y:Math.max(0,Math.min(plan.height-h,cy-h/2)),w,h,scale:scale*a.w/node.w};}
