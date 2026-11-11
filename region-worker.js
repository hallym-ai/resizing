/* Conservative colour/connected-component proposals, not a semantic AI classifier. */
self.onmessage=({data:{width:w,height:h,pixels,textBoxes}})=>{
 try{
  const rgba=new Uint8ClampedArray(pixels),scale=Math.min(1,600/Math.max(w,h));
  const gw=Math.max(1,Math.round(w*scale)),gh=Math.max(1,Math.round(h*scale));
  const histogram=new Map(),samples=[];
  function rgbaAt(x,y){const i=(Math.min(h-1,Math.floor(y/scale))*w+Math.min(w-1,Math.floor(x/scale)))*4;return [rgba[i],rgba[i+1],rgba[i+2],rgba[i+3]];}
  for(let y=0;y<gh;y++)for(let x=0;x<gw;x++)if(x<3||y<3||x>=gw-3||y>=gh-3){const c=rgbaAt(x,y);if(c[3]<240)continue;const key=(c[0]>>4)*256+(c[1]>>4)*16+(c[2]>>4);histogram.set(key,(histogram.get(key)||0)+1);samples.push({key,c});}
  let dominant=0,count=-1;for(const [key,n]of histogram)if(n>count){dominant=key;count=n;}
  const selected=samples.filter(s=>s.key===dominant),bg=[255,255,255];
  if(selected.length)for(let k=0;k<3;k++)bg[k]=Math.round(selected.reduce((n,s)=>n+s.c[k],0)/selected.length);
  const mask=new Uint8Array(gw*gh),seen=new Uint8Array(gw*gh);
  for(let y=0;y<gh;y++)for(let x=0;x<gw;x++){const c=rgbaAt(x,y),d=Math.hypot(c[0]-bg[0],c[1]-bg[1],c[2]-bg[2]);if(c[3]>24&&d>46)mask[y*gw+x]=1;}
  for(const b of textBoxes){const x0=Math.max(0,Math.floor(b.x*scale)-3),y0=Math.max(0,Math.floor(b.y*scale)-3),x1=Math.min(gw,Math.ceil((b.x+b.w)*scale)+3),y1=Math.min(gh,Math.ceil((b.y+b.h)*scale)+3);for(let y=y0;y<y1;y++)mask.fill(0,y*gw+x0,y*gw+x1);}
  const queue=new Int32Array(gw*gh),found=[];
  for(let pos=0;pos<mask.length;pos++){
   if(!mask[pos]||seen[pos])continue;let head=0,tail=1;queue[0]=pos;seen[pos]=1;let x0=gw,y0=gh,x1=0,y1=0,area=0;
   while(head<tail){const p=queue[head++],x=p%gw,y=Math.floor(p/gw);area++;x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
    for(const q of [x>0?p-1:-1,x+1<gw?p+1:-1,y>0?p-gw:-1,y+1<gh?p+gw:-1])if(q>=0&&mask[q]&&!seen[q]){seen[q]=1;queue[tail++]=q;}
   }
   if(area<Math.max(24,gw*gh*.00025)||x1-x0<7||y1-y0<7)continue;
   const b={x:Math.max(0,Math.floor((x0-2)/scale)),y:Math.max(0,Math.floor((y0-2)/scale)),w:Math.ceil((x1-x0+5)/scale),h:Math.ceil((y1-y0+5)/scale),area};
   b.w=Math.min(w-b.x,b.w);b.h=Math.min(h-b.y,b.h);found.push(b);
  }
  found.sort((a,b)=>b.area-a.area);
  // Return a bounded set; leave uncertain background pixels intact in the base layer.
  self.postMessage({boxes:found.slice(0,32),background:bg,method:'border-colour-connected-components',truncated:found.length>32});
 }catch(e){self.postMessage({error:e.message});}
};
