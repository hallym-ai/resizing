/* Conservative flat-background matting, not semantic object segmentation. */
const distance=(a,b)=>Math.max(Math.abs(a[0]-b[0]),Math.abs(a[1]-b[1]),Math.abs(a[2]-b[2]));
const median=a=>{a.sort((x,y)=>x-y);return a[Math.floor(a.length/2)];};
function backgroundFor(pixels,W,H,b){
 const samples=[];let transparent=0,total=0;
 const at=(x,y)=>{if(x<0||y<0||x>=W||y>=H)return;const i=(y*W+x)*4;++total;if(pixels[i+3]<16){transparent++;return;}if(pixels[i+3]<245)return;samples.push([pixels[i],pixels[i+1],pixels[i+2]]);};
 const step=Math.max(1,Math.floor((b.w+b.h)/400));
 for(let x=b.x;x<b.x+b.w;x+=step){at(x,b.y-2);at(x,b.y+b.h+1);at(x,b.y);at(x,b.y+b.h-1);}
 for(let y=b.y;y<b.y+b.h;y+=step){at(b.x-2,y);at(b.x+b.w+1,y);at(b.x,y);at(b.x+b.w-1,y);}
 if(total&&transparent/total>.35)return {method:'original-alpha',reliable:true,color:null,tolerance:0};
 if(samples.length<8)return {method:'unresolved',reliable:false,color:null,tolerance:0};
 const histogram=new Map();for(const c of samples){const key=(c[0]>>4)*256+(c[1]>>4)*16+(c[2]>>4);const group=histogram.get(key)||[];group.push(c);histogram.set(key,group);}
 const cluster=[...histogram.values()].sort((a,b)=>b.length-a.length)[0];
 const color=[0,1,2].map(k=>median(cluster.map(c=>c[k]))),near=samples.filter(c=>distance(c,color)<=14);
 if(near.length/samples.length<.72)return {method:'unresolved',reliable:false,color:null,tolerance:0};
 const deviations=near.map(c=>distance(c,color)),tolerance=Math.max(3,Math.min(10,median(deviations)*2+3));
 return {method:'flat-background',reliable:true,color,tolerance};
}
function paletteFor(rgba,bg,tolerance){
 const groups=new Map();let count=0;
 const step=Math.max(1,Math.floor(rgba.length/4/5000));
 for(let p=0;p<rgba.length/4;p+=step){const i=p*4;if(rgba[i+3]<245)continue;const c=[rgba[i],rgba[i+1],rgba[i+2]];if(distance(c,bg)<=Math.max(tolerance,20))continue;
  const key=(c[0]>>4)*256+(c[1]>>4)*16+(c[2]>>4),g=groups.get(key)||{n:0,sum:[0,0,0]};g.n++;for(let k=0;k<3;k++)g.sum[k]+=c[k];groups.set(key,g);count++;
 }
 const sorted=[...groups.values()].sort((a,b)=>b.n-a.n),major=sorted.slice(0,8),coverage=major.reduce((n,g)=>n+g.n,0)/Math.max(1,count);
 return {flat:count>0&&coverage>=.96,dominance:(major[0]?.n||0)/Math.max(1,count),colors:major.map(g=>g.sum.map(v=>Math.round(v/g.n)))};
}
function trim(rgba,w,h){let x0=w,y0=h,x1=-1,y1=-1;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(rgba[(y*w+x)*4+3]>0){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
 if(x1<0)return null;const width=x1-x0+1,height=y1-y0+1,data=new Uint8ClampedArray(width*height*4);for(let y=0;y<height;y++)data.set(rgba.subarray(((y+y0)*w+x0)*4,((y+y0)*w+x0+width)*4),y*width*4);return{x:x0,y:y0,width,height,data};}
function matteRegion(pixels,W,H,b){
 const info=backgroundFor(pixels,W,H,b),rgba=new Uint8ClampedArray(b.w*b.h*4);
 for(let y=0;y<b.h;y++)rgba.set(pixels.subarray(((b.y+y)*W+b.x)*4,((b.y+y)*W+b.x+b.w)*4),y*b.w*4);
 if(!info.color)return {rgba,info};
 const palette=paletteFor(rgba,info.color,info.tolerance),n=b.w*b.h,background=new Uint8Array(n);
 // Text counters (O, P, 엑, etc.) are background even when enclosed by strokes.
 if(b.type==='text')palette.flat=true;
 for(let p=0;p<n;p++){const i=p*4;background[p]=rgba[i+3]===0||distance([rgba[i],rgba[i+1],rgba[i+2]],info.color)<=info.tolerance?1:0;}
 let remove=background;
 if(!palette.flat){
  info.method='boundary-background';remove=new Uint8Array(n);const queue=new Int32Array(n);let head=0,tail=0;
  const push=p=>{if(p>=0&&p<n&&background[p]&&!remove[p]){remove[p]=1;queue[tail++]=p;}};
  for(let x=0;x<b.w;x++){push(x);push((b.h-1)*b.w+x);}for(let y=0;y<b.h;y++){push(y*b.w);push(y*b.w+b.w-1);}
  while(head<tail){const p=queue[head++],x=p%b.w;if(x)push(p-1);if(x+1<b.w)push(p+1);push(p-b.w);push(p+b.w);}
 }
 for(let p=0;p<n;p++){
  const i=p*4;if(remove[p]){rgba.fill(0,i,i+4);continue;}
  const px=p%b.w,edge=(px>0&&remove[p-1])||(px+1<b.w&&remove[p+1])||(p>=b.w&&remove[p-b.w])||(p+b.w<n&&remove[p+b.w]);
  if((!palette.flat&&!(palette.dominance>.60&&edge))||rgba[i+3]!==255)continue;
  const c=[rgba[i],rgba[i+1],rgba[i+2]];let best=null;
  for(const foreground of palette.colors){const vector=foreground.map((v,k)=>v-info.color[k]),den=vector.reduce((sum,v)=>sum+v*v,0);if(den<400)continue;const alpha=c.reduce((sum,v,k)=>sum+(v-info.color[k])*vector[k],0)/den;if(alpha<=0||alpha>=.995)continue;
   const error=Math.sqrt(c.reduce((sum,v,k)=>sum+(v-info.color[k]-vector[k]*alpha)**2,0)/3);
   if(error<=2.5&&(!best||error<best.error))best={foreground,alpha,error};
  }
  if(best){rgba.set(best.foreground,i);rgba[i+3]=Math.round(best.alpha*255);if(rgba[i+3]<=2)rgba.fill(0,i,i+4);}
 }
 return {rgba,info};
}
export function buildForegroundLayers(pixels,width,height,regions,fallbackBackground=[255,255,255]){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>8000000||pixels.length!==width*height*4||!Array.isArray(regions)||regions.length>140)throw Error('배경 분리 입력이 지원 범위를 넘습니다.');
 const boxes=regions.filter(b=>b.include).sort((a,b)=>(a.type==='text'?0:1)-(b.type==='text'?0:1)),owner=new Uint16Array(width*height),background=new Uint8ClampedArray(pixels),layers=[];let budget=2*width*height,unresolved=0;
 for(const b of boxes){if(![b.x,b.y,b.w,b.h].every(Number.isInteger)||b.x<0||b.y<0||b.w<1||b.h<1||b.x+b.w>width||b.y+b.h>height)throw Error('잘못된 요소 영역입니다.');budget+=b.w*b.h;if(budget>48000000)throw Error('분리할 요소 이미지 합계가 너무 큽니다.');}
 for(let index=0;index<boxes.length;index++){
  const b=boxes[index],{rgba,info}=matteRegion(pixels,width,height,b);if(info.method==='unresolved')unresolved++;
  for(let y=0;y<b.h;y++)for(let x=0;x<b.w;x++){
   const p=(b.y+y)*width+b.x+x,at=(y*b.w+x)*4,src=p*4;if(!rgba[at+3])continue;if(owner[p]){rgba.fill(0,at,at+4);continue;}owner[p]=index+1;
   if(info.method==='original-alpha'||pixels[src+3]<255)background.fill(0,src,src+4);
   else{background.set(info.color||fallbackBackground,src);background[src+3]=255;}
  }
  const result=trim(rgba,b.w,b.h);if(result)layers.push({...b,x:b.x+result.x,y:b.y+result.y,w:result.width,h:result.height,rgba:result.data,cutoutMethod:info.method,cutoutBackground:info.color});
 }
 return {width,height,background,layers,unresolved,method:'local-flat-or-boundary-matte'};
}
