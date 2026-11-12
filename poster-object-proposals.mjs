/* Lightweight palette/component proposals for flattened posters.
 * No semantic labels, learned weights or source-specific colours/coordinates.
 * Proposals remain review-required; they are not a clean-background proof.
 */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function reducedPixels(pixels,width,height){
  const scale=Math.min(1,600/Math.max(width,height)),w=Math.max(1,Math.round(width*scale)),h=Math.max(1,Math.round(height*scale)),rgb=new Float32Array(w*h*3),alpha=new Uint8Array(w*h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const p=y*w+x;let n=0,a=0,r=0,g=0,b=0;
    const x0=Math.floor(x*width/w),x1=Math.max(x0+1,Math.floor((x+1)*width/w)),y0=Math.floor(y*height/h),y1=Math.max(y0+1,Math.floor((y+1)*height/h));
    for(let yy=y0;yy<y1;yy++)for(let xx=x0;xx<x1;xx++){const i=(yy*width+xx)*4;const v=pixels[i+3]/255;r+=pixels[i]*v;g+=pixels[i+1]*v;b+=pixels[i+2]*v;a+=v;n++;}
    const d=Math.max(a,.0001);rgb[p*3]=r/d;rgb[p*3+1]=g/d;rgb[p*3+2]=b/d;alpha[p]=Math.round(a/n*255);
  }
  return {rgb,alpha,w,h};
}
const metric=(r,g,b,c)=>(r-c[0])**2+(g-c[1])**2+(b-c[2])**2;
function palette(rgb,alpha,w,h){
  const hist=new Map();
  for(let p=0;p<w*h;p+=2){if(alpha[p]<24)continue;const r=rgb[p*3],g=rgb[p*3+1],b=rgb[p*3+2],key=(r>>4)*256+(g>>4)*16+(b>>4),v=hist.get(key)||[0,0,0,0];v[0]+=r;v[1]+=g;v[2]+=b;v[3]++;hist.set(key,v);}
  const bins=[...hist.values()].map(v=>[v[0]/v[3],v[1]/v[3],v[2]/v[3],v[3]]).sort((a,b)=>b[3]-a[3]);
  if(!bins.length)return null;
  const centers=[bins[0].slice(0,3)],k=Math.min(14,bins.length);
  while(centers.length<k){let best=null,bestScore=-1;for(const b of bins){const distance=Math.min(...centers.map(c=>metric(b[0],b[1],b[2],c))),score=distance*Math.sqrt(b[3]);if(score>bestScore){bestScore=score;best=b;}}if(bestScore<80)break;centers.push(best.slice(0,3));}
  for(let it=0;it<14;it++){
    const sums=centers.map(()=>[0,0,0,0]);
    for(const b of bins){let near=0,d=Infinity;for(let j=0;j<centers.length;j++){const q=metric(b[0],b[1],b[2],centers[j]);if(q<d){d=q;near=j;}}const s=sums[near];for(let c=0;c<3;c++)s[c]+=b[c]*b[3];s[3]+=b[3];}
    let moved=0;for(let j=0;j<centers.length;j++)if(sums[j][3]){const next=sums[j].slice(0,3).map(v=>v/sums[j][3]);moved+=metric(...next,centers[j]);centers[j]=next;}if(moved<.1)break;
  }
  const labels=new Uint8Array(w*h),counts=new Uint32Array(centers.length),variance=new Float64Array(centers.length);
  for(let p=0;p<w*h;p++){let near=0,d=Infinity;for(let j=0;j<centers.length;j++){const q=metric(rgb[p*3],rgb[p*3+1],rgb[p*3+2],centers[j]);if(q<d){d=q;near=j;}}labels[p]=near;if(alpha[p]>=24){counts[near]++;variance[near]+=d;}}
  return {centers,labels,counts,variance};
}
function components(mask,w,h){
  const seen=new Uint8Array(mask.length),queue=new Int32Array(mask.length),found=[];
  for(let start=0;start<mask.length;start++){
    if(!mask[start]||seen[start])continue;let head=0,tail=1;queue[0]=start;seen[start]=1;let l=w,t=h,r=-1,b=-1,border=0;
    while(head<tail){const p=queue[head++],x=p%w,y=Math.floor(p/w);l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);if(!x||!y||x===w-1||y===h-1)border++;
      if(x&&!seen[p-1]&&mask[p-1]){seen[p-1]=1;queue[tail++]=p-1;}if(x+1<w&&!seen[p+1]&&mask[p+1]){seen[p+1]=1;queue[tail++]=p+1;}if(y&&!seen[p-w]&&mask[p-w]){seen[p-w]=1;queue[tail++]=p-w;}if(y+1<h&&!seen[p+w]&&mask[p+w]){seen[p+w]=1;queue[tail++]=p+w;}
    }
    found.push({pixels:queue.slice(0,tail),area:tail,x:l,y:t,w:r-l+1,h:b-t+1,border});
  }
  return found;
}
function morphology(mask,w,h,r,dilate){
  const out=new Uint8Array(mask.length);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){let value=dilate?0:1;
    search:for(let yy=Math.max(0,y-r);yy<=Math.min(h-1,y+r);yy++)for(let xx=Math.max(0,x-r);xx<=Math.min(w-1,x+r);xx++){if(dilate&&mask[yy*w+xx]){value=1;break search;}if(!dilate&&!mask[yy*w+xx]){value=0;break search;}}
    out[y*w+x]=value;
  }
  return out;
}
function textMask(boxes,w,h,width,height){
  const out=new Uint8Array(w*h);
  for(const b of boxes||[]){if(b.include===false)continue;const l=clamp(Math.floor(b.x*w/width)-1,0,w),r=clamp(Math.ceil((b.x+b.w)*w/width)+1,0,w),t=clamp(Math.floor(b.y*h/height)-1,0,h),bottom=clamp(Math.ceil((b.y+b.h)*h/height)+1,0,h);for(let y=t;y<bottom;y++)out.fill(1,y*w+l,y*w+r);}
  return out;
}
function repairSmallHoles(mask,w,h,limit){
  const inverse=new Uint8Array(mask.length);for(let i=0;i<mask.length;i++)inverse[i]=mask[i]?0:1;
  // Tiny enclosed light highlights belong to a multicolour photographic object;
  // never fill open concavities or large holes such as a handle/ring interior.
  for(const hole of components(inverse,w,h))if(!hole.border&&hole.area<=limit)for(const p of hole.pixels)mask[p]=1;
}
function refineSourceBoundary(mask,W,H,x0,y0,pixels,sourceWidth,palette,surfaces,radius,photographic){
  const n=W*H,distance=new Uint8Array(n),queue=new Int32Array(n);let head=0,tail=0,removed=0;
  // Only classify a narrow inner band. Colours of the object's interior are
  // untouched, including highlights which resemble the surrounding paper.
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const p=y*W+x;if(!mask[p])continue;
    if(!x||!y||x===W-1||y===H-1||!mask[p-1]||!mask[p+1]||!mask[p-W]||!mask[p+W]){distance[p]=1;queue[tail++]=p;}
  }
  while(head<tail){
    const p=queue[head++],d=distance[p];if(d>=radius)continue;const x=p%W,y=(p/W)|0;
    for(const q of [x?p-1:-1,x+1<W?p+1:-1,y?p-W:-1,y+1<H?p+W:-1])if(q>=0&&mask[q]&&!distance[q]){distance[q]=d+1;queue[tail++]=q;}
  }
  for(let p=0;p<n;p++){
    if(!distance[p])continue;const x=p%W,y=(p/W)|0,i=((y0+y)*sourceWidth+x0+x)*4;
    let backgroundDistance=Infinity,foregroundDistance=Infinity;
    for(let k=0;k<palette.length;k++){const d=metric(pixels[i],pixels[i+1],pixels[i+2],palette[k]);if(surfaces[k])backgroundDistance=Math.min(backgroundDistance,d);else foregroundDistance=Math.min(foregroundDistance,d);}
    if(!pixels[i+3]||backgroundDistance<foregroundDistance*.8){mask[p]=0;removed++;}
  }
  const before=mask.reduce((a,b)=>a+(b?1:0),0),islandLimit=Math.max(4,Math.round(before*.0005));
  for(const part of components(mask,W,H))if(part.area<islandLimit)for(const p of part.pixels){mask[p]=0;removed++;}
  if(photographic)repairSmallHoles(mask,W,H,Math.max(4,Math.round(before*.005)));
  // Helpers use binary 0/1 internally; expose only 0/255 at the API boundary.
  for(let p=0;p<n;p++)mask[p]=mask[p]?255:0;
  return {boundaryRadius:radius,trimmedBoundaryPixels:removed};
}
function backgroundClusters(data,p){
  const {w,h,rgb}=data,{centers,labels,counts}=p,n=w*h,surfaces=new Uint8Array(centers.length),stats=[];
  // A broad, internally coherent colour region is a candidate backdrop, even
  // when it is inset from the image boundary (e.g. a coloured sign or panel).
  for(let k=0;k<centers.length;k++){
    if(counts[k]<n*.02)continue;
    const binary=new Uint8Array(n);for(let i=0;i<n;i++)binary[i]=data.alpha[i]>=24&&labels[i]===k?1:0;
    const closed=morphology(morphology(binary,w,h,1,true),w,h,1,false),parts=components(closed,w,h).sort((a,b)=>b.area-a.area),largest=parts[0];if(!largest)continue;
    let texture=0,samples=0;
    for(const i of largest.pixels){const x=i%w,y=Math.floor(i/w);if(x<2||y<2||x>=w-2||y>=h-2)continue;const neighbors=[i-1,i+1,i-w,i+w];for(const j of neighbors){if(labels[j]!==k)continue;texture+=Math.sqrt(metric(rgb[i*3],rgb[i*3+1],rgb[i*3+2],[rgb[j*3],rgb[j*3+1],rgb[j*3+2]]));samples++;}}
    const meanTexture=texture/Math.max(1,samples),fraction=largest.area/n,fill=largest.area/(largest.w*largest.h);
    const broad=fraction>.065&&Math.max(largest.w/w,largest.h/h)>.42;
    if(broad&&meanTexture<18&&fill>.27)surfaces[k]=1;
    stats.push({index:k,color:centers[k].map(Math.round),fraction:counts[k]/n,largestFraction:fraction,meanTexture,fill,surface:!!surfaces[k]});
  }
  // K-means often splits one textured panel into neighbouring shades. Treat
  // those shades as the same material; otherwise tiny gaps join it to photos.
  const anchors=[...surfaces].flatMap((v,k)=>v?[k]:[]);
  for(let k=0;k<centers.length;k++)if(anchors.some(a=>metric(...centers[k],centers[a])<65**2))surfaces[k]=1;
  for(const s of stats)s.surface=!!surfaces[s.index];
  return {surfaces,stats};
}
export function proposePosterObjects(pixels,width,height,textBoxes=[]){
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>8000000||pixels.length!==width*height*4)throw Error('Unsupported poster dimensions');
  const data=reducedPixels(pixels,width,height),{rgb,alpha,w,h}=data,p=palette(rgb,alpha,w,h);if(!p)return [];
  const {surfaces,stats}=backgroundClusters(data,p),text=textMask(textBoxes,w,h,width,height),foreground=new Uint8Array(w*h);
  for(let i=0;i<foreground.length;i++)foreground[i]=alpha[i]>=24&&!surfaces[p.labels[i]]&&!text[i]?1:0;
  // Close tiny palette gaps, then remove components attached to the frame.
  const joined=morphology(morphology(foreground,w,h,1,true),w,h,1,false);
  for(let i=0;i<joined.length;i++)if(text[i]||alpha[i]<24)joined[i]=0;
  const candidates=components(joined,w,h).filter(b=>b.area>=Math.max(40,w*h*.002)&&b.w>6&&b.h>6&&!b.border&&b.area<w*h*.52&&b.w<w*.94&&b.h<h*.94).sort((a,b)=>b.area-a.area),out=[];
  for(const b of candidates.slice(0,12)){
    const mask=new Uint8Array(b.w*b.h);for(const i of b.pixels){const x=i%w,y=Math.floor(i/w);mask[(y-b.y)*b.w+x-b.x]=1;}
    const localCounts=new Uint32Array(p.centers.length);for(const i of b.pixels)localCounts[p.labels[i]]++;
    const diversity=[...localCounts].filter(n=>n>b.area*.02).length;
    if(diversity>=4)repairSmallHoles(mask,b.w,b.h,Math.max(4,Math.round(b.area*.005)));
    const x=Math.max(0,Math.floor(b.x*width/w)),y=Math.max(0,Math.floor(b.y*height/h)),right=Math.min(width,Math.ceil((b.x+b.w)*width/w)),bottom=Math.min(height,Math.ceil((b.y+b.h)*height/h)),W=right-x,H=bottom-y,full=new Uint8Array(W*H);
    for(let yy=0;yy<H;yy++)for(let xx=0;xx<W;xx++){const sx=clamp(Math.floor((x+xx)*w/width)-b.x,0,b.w-1),sy=clamp(Math.floor((y+yy)*h/height)-b.y,0,b.h-1);full[yy*W+xx]=mask[sy*b.w+sx]?255:0;}
    const boundary=refineSourceBoundary(full,W,H,x,y,pixels,width,p.centers,surfaces,Math.max(2,Math.ceil(Math.max(width/w,height/h)*2)),diversity>=4);
    const fill=b.area/(b.w*b.h),fraction=b.area/(w*h),confidence=Math.min(.82,.40+Math.min(.2,fraction*2)+Math.min(.15,fill*.2));
    out.push({x,y,w:W,h:H,mask:full,confidence,method:'palette-components-review',review:true,kind:diversity>=4?'photographic-candidate':'graphic-candidate',diagnostics:{workingWidth:w,workingHeight:h,foregroundFraction:fraction,fill,paletteDiversity:diversity,palette:stats,...boundary}});
  }
  return out;
}
