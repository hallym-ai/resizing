// Visible ink decomposition. OCR strings are annotations, not recovered fonts.
const dist=(r,g,b,c)=>Math.max(Math.abs(r-c[0]),Math.abs(g-c[1]),Math.abs(b-c[2]));
const intersect=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
export function proposePosterText(pixels,W,H,ocr=[]){
 const scale=Math.min(1,1100/Math.max(W,H)),w=Math.round(W*scale),h=Math.round(H*scale),n=w*h,rgb=new Uint8ClampedArray(n*4),hist=new Map();
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const p=y*w+x,i=(Math.min(H-1,Math.floor(y/scale))*W+Math.min(W-1,Math.floor(x/scale)))*4;rgb.set(pixels.subarray(i,i+4),p*4);if(p%3||pixels[i+3]<220)continue;const c=[pixels[i],pixels[i+1],pixels[i+2]],key=(c[0]>>4)*256+(c[1]>>4)*16+(c[2]>>4),v=hist.get(key)||{n:0,s:[0,0,0]};v.n++;c.forEach((k,j)=>v.s[j]+=k);hist.set(key,v);}
 const palette=[[255,255,255],[0,0,0],...[...hist.values()].sort((a,b)=>b.n-a.n).slice(0,12).map(v=>v.s.map(k=>Math.round(k/v.n)))],lines=[];
 for(const color of palette){
  const mask=new Uint8Array(n),seen=new Uint8Array(n),q=new Int32Array(n),components=[];
  const tolerance=color.every(k=>k===255)?14:color.every(k=>k===0)?58:18;
  for(let p=0;p<n;p++){const i=p*4;if(rgb[i+3]>200&&dist(rgb[i],rgb[i+1],rgb[i+2],color)<=tolerance)mask[p]=1;}
  for(let p=0;p<n;p++){if(!mask[p]||seen[p])continue;let head=0,tail=1,x0=w,y0=h,x1=0,y1=0;q[0]=p;seen[p]=1;
   while(head<tail){const a=q[head++],x=a%w,y=(a/w)|0;x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);for(const b of [x?a-1:-1,x+1<w?a+1:-1,y?a-w:-1,y+1<h?a+w:-1])if(b>=0&&mask[b]&&!seen[b]){seen[b]=1;q[tail++]=b;}}
   const cw=x1-x0+1,ch=y1-y0+1,fill=tail/(cw*ch);
   if(x0<=1||y0<=1||x1>=w-2||y1>=h-2||tail<12||ch<7||ch>h*.22||cw<2||cw>w*.3||cw/ch>3.5||fill<.12||fill>.95)continue;
   components.push({x:x0,y:y0,w:cw,h:ch,area:tail,points:q.slice(0,tail)});
  }
  components.sort((a,b)=>b.h-a.h);const used=new Set();
  for(const seed of components){if(used.has(seed))continue;const group=[seed];used.add(seed);let expanded=true;
   while(expanded){expanded=false;for(const c of components){if(used.has(c)||c.h<seed.h*.30||c.h>seed.h*1.9)continue;if(group.some(g=>{const vy=Math.max(0,Math.min(c.y+c.h,g.y+g.h)-Math.max(c.y,g.y)),gap=Math.max(c.x-g.x-g.w,g.x-c.x-c.w,0);return vy/Math.min(c.h,g.h)>.45&&gap<Math.min(w*.08,Math.max(c.h,g.h)*1.15)})){group.push(c);used.add(c);expanded=true;}}}
   if(group.length<2)continue;const x=Math.min(...group.map(c=>c.x)),y=Math.min(...group.map(c=>c.y)),right=Math.max(...group.map(c=>c.x+c.w)),bottom=Math.max(...group.map(c=>c.y+c.h)),bw=right-x,bh=bottom-y,area=group.reduce((s,c)=>s+c.area,0);
   if(bw<w*.065||bw/bh<1.35||bw>w*.92||area/(bw*bh)<.10||area/(bw*bh)>.85)continue;
   // Ink should contrast with its nearby surround, not be a textured surface.
   let contrast=0,count=0;for(let xx=x;xx<right;xx+=Math.max(1,(bw/50)|0))for(const yy of [Math.max(0,y-3),Math.min(h-1,bottom+3)]){const i=(yy*w+xx)*4;contrast+=dist(rgb[i],rgb[i+1],rgb[i+2],color);count++;}
   if(contrast/Math.max(1,count)<200)continue;
   const local=new Uint8Array(bw*bh);for(const c of group)for(const p of c.points){const px=p%w,py=(p/w)|0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=px+dx,yy=py+dy;if(xx>=x&&xx<right&&yy>=y&&yy<bottom){const i=(yy*w+xx)*4;if(dist(rgb[i],rgb[i+1],rgb[i+2],color)<=Math.min(85,tolerance+35))local[(yy-y)*bw+xx-x]=255;}}}
   const box={x:Math.floor(x/scale),y:Math.floor(y/scale),w:Math.ceil(bw/scale),h:Math.ceil(bh/scale)};box.w=Math.min(W-box.x,box.w);box.h=Math.min(H-box.y,box.h);const full=new Uint8Array(box.w*box.h);
   for(let yy=0;yy<box.h;yy++)for(let xx=0;xx<box.w;xx++){const sx=Math.min(bw-1,Math.floor((box.x+xx)*scale)-x),sy=Math.min(bh-1,Math.floor((box.y+yy)*scale)-y);if(sx>=0&&sy>=0){const i=((box.y+yy)*W+box.x+xx)*4;if(dist(pixels[i],pixels[i+1],pixels[i+2],color)<=Math.min(85,tolerance+35))full[yy*box.w+xx]=255;}}
   const reads=ocr.filter(t=>intersect(t,box)>Math.min(t.w*t.h,box.w*box.h)*.4).sort((a,b)=>a.x-b.x),text=reads.map(t=>t.text).join(' ').trim();
   lines.push({...box,type:'text',mask:full,text,confidence:reads.length?Math.max(...reads.map(t=>t.confidence||0)):null,method:'visible-ink-components',review:true,inkColor:color,score:contrast/count+group.length*2});
  }
 }
 lines.sort((a,b)=>b.score-a.score);const selected=[];for(const l of lines){if(selected.some(t=>intersect(l,t)>Math.min(l.w*l.h,t.w*t.h)*.35))continue;selected.push(l);if(selected.length>=40)break;}return selected.sort((a,b)=>a.y-b.y||a.x-b.x);
}




