// Scratch-only geometric trial. A caller must validate OOXML provenance,
// media safety, crop/group/effects and verify the resulting pixels before use.
const finite=(...xs)=>xs.every(Number.isFinite);
export function outsidePictureSvg({slideWidth,slideHeight,padding,object,mediaDataUrl,maxPixels=2000000,insetX=0,insetY=0}){
 const {left=0,top=0,right=0,bottom=0}=padding||{};
 const {x,y,width,height,rotation=0,flipH=false,flipV=false,opacity=1,crop=null,group=false,effects=[]}=object||{};
 if(!finite(slideWidth,slideHeight,left,top,right,bottom,x,y,width,height,rotation,opacity,maxPixels,insetX,insetY)||slideWidth<=0||slideHeight<=0||width<=0||height<=0||opacity<0||opacity>1||insetX<0||insetY<0||insetX*2>=slideWidth||insetY*2>=slideHeight||[left,top,right,bottom].some(n=>n<0))return {ok:false,reason:'invalid-geometry'};
 if(crop||group||effects.length)return {ok:false,reason:'unsupported-source-effects'};
 if(typeof mediaDataUrl!=='string'||!/^data:image\/(png|jpeg|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(mediaDataUrl)||mediaDataUrl.length>4*1024*1024)return {ok:false,reason:'unsupported-media'};
 const outW=slideWidth+left+right,outH=slideHeight+top+bottom;
 if(outW*outH>maxPixels)return {ok:false,reason:'capture-budget'};
 const cx=x+width/2,cy=y+height/2,fx=flipH?-1:1,fy=flipV?-1:1;
 // A fill-rule viewport subtraction clips away the existing slide entirely.
 // The original visible layer is never modified, so no alpha is double-applied.
 const path=`M ${-left} ${-top} H ${slideWidth+right} V ${slideHeight+bottom} H ${-left} Z M ${insetX} ${insetY} H ${slideWidth-insetX} V ${slideHeight-insetY} H ${insetX} Z`;
 const transform=`translate(${cx} ${cy}) rotate(${rotation}) scale(${fx} ${fy}) translate(${-cx} ${-cy})`;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${outW}" height="${outH}" viewBox="${-left} ${-top} ${outW} ${outH}"><defs><clipPath id="outside"><path fill-rule="evenodd" clip-rule="evenodd" d="${path}"/></clipPath></defs><g clip-path="url(#outside)"><g opacity="${opacity}" transform="${transform}"><image x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="none" href="${mediaDataUrl}"/></g></g></svg>`;
 return {ok:true,svg,viewBox:{x:left?-left:0,y:top?-top:0,width:outW,height:outH},status:'unverified-render'};
}
