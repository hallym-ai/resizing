// Certifies only a flat cleaned plate and source-pixel reconstruction, not OCR accuracy.
export function verifyRasterSeparation(source,width,height,result){
 if(result.unresolved||source.length!==width*height*4)return{passed:false,reason:'unresolved matte'};
 const histogram=new Map();let opaque=0;for(let i=0;i<result.background.length;i+=4){const a=result.background[i+3];if(a!==255)return{passed:false,reason:'nonopaque or unresolved clean plate'};opaque++;const k=(result.background[i]>>4)*256+(result.background[i+1]>>4)*16+(result.background[i+2]>>4);histogram.set(k,(histogram.get(k)||0)+1);}
 const flatFraction=[...histogram.values()].sort((a,b)=>b-a).slice(0,4).reduce((a,b)=>a+b,0)/opaque;if(flatFraction<.999)return{passed:false,reason:'clean background still contains photographic detail',flatFraction};
 // A small white word left on a red plate uses only two colours, yet is a ghost.
 // Require each background row to be one quantized colour; horizontal brand bands remain valid.
 for(let y=0;y<height;y++){let rowColor=null;for(let x=0;x<width;x++){const i=(y*width+x)*4,k=(result.background[i]>>4)*256+(result.background[i+1]>>4)*16+(result.background[i+2]>>4);if(rowColor===null)rowColor=k;else if(rowColor!==k)return{passed:false,reason:'clean plate contains residual lettering, decorations or a nonflat scene'};}}
 const composed=new Uint8ClampedArray(result.background);for(const layer of result.layers){for(let y=0;y<layer.h;y++)for(let x=0;x<layer.w;x++){const s=(y*layer.w+x)*4,d=((layer.y+y)*width+layer.x+x)*4,a=layer.rgba[s+3]/255;if(!a)continue;for(let k=0;k<3;k++)composed[d+k]=Math.round(layer.rgba[s+k]*a+composed[d+k]*(1-a));}}
 let maxDifference=0,changedChannels=0;for(let i=0;i<composed.length;i++){const d=Math.abs(composed[i]-source[i]);maxDifference=Math.max(maxDifference,d);if(d)changedChannels++;if(d>2)return{passed:false,reason:'source-pixel reconstruction failed',maxDifference};}
 return{passed:true,flatFraction,maxDifference,changedChannels,scope:'all source pixels reconstructed within 2/255; clean plate flat; source lettering remains raster assets, OCR is unconfirmed metadata'};
}
