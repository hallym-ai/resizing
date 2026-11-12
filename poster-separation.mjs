import {proposePosterText} from './poster-text-masks.mjs';
import {proposePosterObjects} from './poster-object-proposals.mjs';

function withInkFringe(b,W,H){
 const radius=3,x=Math.max(0,b.x-radius),y=Math.max(0,b.y-radius),w=Math.min(W,b.x+b.w+radius)-x,h=Math.min(H,b.y+b.h+radius)-y,mask=new Uint8Array(w*h);
 // Include the source antialias fringe so it cannot remain as a second word
 // in the clean plate. This is still a contour mask, never a rectangular crop.
 for(let yy=0;yy<b.h;yy++)for(let xx=0;xx<b.w;xx++)if(b.mask[yy*b.w+xx])for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){const px=b.x+xx+dx-x,py=b.y+yy+dy-y;if(px>=0&&py>=0&&px<w&&py<h)mask[py*w+px]=255;}
 return {...b,x,y,w,h,mask};
}

// The plate is estimated from visible neighbours. It is never certified as the
// original hidden background. Reconstruction at source positions is separate.
function fillPlate(pixels,W,H,removed){
 const output=new Uint8ClampedArray(pixels),known=new Uint8Array(W*H),queue=new Int32Array(W*H);let head=0,tail=0;
 let anchors=0;for(let p=0;p<W*H;p++)if(!removed[p]){known[p]=1;anchors++;}
 if(!anchors){output.fill(0);return output;}
 const neighbors=p=>{const x=p%W;return [x?p-1:-1,x+1<W?p+1:-1,p>=W?p-W:-1,p+W<W*H?p+W:-1]};
 for(let p=0;p<W*H;p++)if(removed[p]&&neighbors(p).some(q=>q>=0&&known[q])){known[p]=2;queue[tail++]=p;}
 while(head<tail){const p=queue[head++],ns=neighbors(p).filter(q=>q>=0&&known[q]===1);if(ns.length){for(let k=0;k<4;k++)output[p*4+k]=Math.round(ns.reduce((s,q)=>s+output[q*4+k],0)/ns.length);}else output.fill(0,p*4,p*4+4);known[p]=1;for(const q of neighbors(p))if(q>=0&&!known[q]){known[q]=2;queue[tail++]=q;}}
 // Partial source alpha must stay compositable over transparent plate pixels.
 for(let p=0;p<W*H;p++)if(removed[p]&&pixels[p*4+3]!==255)output.fill(0,p*4,p*4+4);
 return output;
}
export function buildPosterLayers(pixels,width,height,ocr=[]){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>8000000||pixels.length!==width*height*4)throw Error('포스터 분리 크기가 지원 범위를 넘습니다.');
 const text=proposePosterText(pixels,width,height,ocr).map(b=>withInkFringe(b,width,height)),objects=proposePosterObjects(pixels,width,height,text),owner=new Uint8Array(width*height),layers=[];
 for(const region of [...text,...objects.map(o=>({...o,type:'image'}))]){
  const {x,y,w,h,mask}=region;if(![x,y,w,h].every(Number.isInteger)||w<1||h<1||x<0||y<0||x+w>width||y+h>height||mask.length!==w*h)throw Error('잘못된 포스터 마스크입니다.');
  const rgba=new Uint8ClampedArray(w*h*4);let area=0;
  for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++){const p=(y+yy)*width+x+xx,i=p*4,j=(yy*w+xx)*4;if(!mask[yy*w+xx]||owner[p]||!pixels[i+3])continue;rgba.set(pixels.subarray(i,i+4),j);owner[p]=1;area++;}
  if(area<12){for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++)if(rgba[(yy*w+xx)*4+3])owner[(y+yy)*width+x+xx]=0;continue;}
  layers.push({x,y,w,h,rgba,type:region.type,text:region.text||'',confidence:region.confidence,cutoutMethod:region.type==='text'?'poster-ink-review':'poster-object-review',cutoutBackground:null,review:true,area});
 }
 if(!layers.length)throw Error('분리 가능한 글자·그림을 찾지 못했습니다. 원본을 유지합니다.');
 const background=fillPlate(pixels,width,height,owner);
 let maxDifference=0,removedPixels=0;const composed=new Uint8ClampedArray(background);
 for(const l of layers)for(let y=0;y<l.h;y++)for(let x=0;x<l.w;x++){const s=(y*l.w+x)*4,d=((l.y+y)*width+l.x+x)*4,a=l.rgba[s+3]/255;if(!a)continue;const ba=composed[d+3]/255,oa=a+ba*(1-a);for(let k=0;k<3;k++)composed[d+k]=oa?Math.round((l.rgba[s+k]*a+composed[d+k]*ba*(1-a))/oa):0;composed[d+3]=Math.round(oa*255);}
 for(let p=0;p<owner.length;p++){if(owner[p])removedPixels++;for(let k=0;k<4;k++){if(k<3&&!pixels[p*4+3])continue;maxDifference=Math.max(maxDifference,Math.abs(composed[p*4+k]-pixels[p*4+k]));}}
 if(maxDifference>1)throw Error('포스터 요소 재합성이 원본과 일치하지 않아 적용하지 않았습니다.');
 return {width,height,layers,background,unresolved:layers.length,method:'poster-palette-ink-review',proof:{passed:true,sourceReconstruction:true,maxDifference,removedPixels,backgroundRestored:false,review:true,scope:'원래 위치의 재합성만 검증. 글씨 모양은 래스터이며 OCR·객체 의미·가려진 배경 복원은 미확인.'}};
}
