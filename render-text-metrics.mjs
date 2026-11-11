// Measurements over the existing native renderer. No OCR, image generation,
// text rewriting, or permission to alter source assets is inferred here.
const luminance=p=>[.2126,.7152,.0722].reduce((sum,k,i)=>{const n=p[i]/255;return sum+k*(n<=.04045?n/12.92:((n+.055)/1.055)**2.4);},0);
const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
const copyStyles=(styles,change)=>Object.fromEntries(Object.entries(styles||{}).map(([line,chars])=>[line,Object.fromEntries(Object.entries(chars).map(([at,style])=>[at,change({...style})]))]));
export function measureRenderedText(object,objects,{width,height,role='body',minimumSize=0,backgroundColor=null,maxPatchPixels=4000000}={}){
 const limits=['Contrast samples opaque glyph interiors in actual composed paint.','An original intentional occlusion is not granted or rejected by these metrics.','No semantic product masks, texture seam detection, or universal design quality is inferred.'];
 const unknown=reason=>({status:'not_verified',reason,limits});
 if(!object||typeof object.text!=='string'||!object.visible)return unknown('not a visible native text object');
 if(object.group||object.clipPath)return unknown('group or clip needs a dedicated transform/visibility comparison');
 if(object.globalCompositeOperation&&object.globalCompositeOperation!=='source-over')return unknown('nonstandard text blend needs dedicated compositing validation');
 if(![width,height].every(n=>Number.isInteger(n)&&n>0)||!objects.includes(object))return unknown('missing scene dimensions or source membership');
 const fonts=[object.fontSize||0,...Object.values(object.styles||{}).flatMap(line=>Object.values(line).map(style=>style.fontSize).filter(n=>Number.isFinite(n)&&n>0))];
 const effectiveSize=Math.min(...fonts)*Math.abs(object.scaleY||1),box=object.getBoundingRect(),pad=Math.ceil(Math.max(16,effectiveSize*1.5,(object.strokeWidth||0)*4));
 const x=Math.floor(box.left-pad),y=Math.floor(box.top-pad),w=Math.ceil(box.width+2*pad+2),h=Math.ceil(box.height+2*pad+2);
 if(![x,y,w,h].every(Number.isFinite)||w<1||h<1||w*h>maxPatchPixels)return unknown('local render patch exceeds the measurement budget');
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)return unknown('2D readback unavailable');
 const saved=Object.fromEntries(['fill','stroke','styles','shadow','backgroundColor','textBackgroundColor','objectCaching','dirty'].map(k=>[k,object[k]]));
 const sceneCanvases=[...new Set(objects.map(o=>o.canvas).filter(Boolean))],canvasStates=sceneCanvases.map(c=>({skipOffscreen:c.skipOffscreen,viewportTransform:c.viewportTransform,enableRetinaScaling:c.enableRetinaScaling}));
 if(sceneCanvases.some(c=>c.clipPath)){canvas.width=canvas.height=0;return unknown('scene clip needs a dedicated visibility comparison');}
 const sceneCanvas=object.canvas,opaqueBackground=typeof backgroundColor==='string'&&CSS.supports('color',backgroundColor)?backgroundColor:typeof sceneCanvas?.backgroundColor==='string'&&CSS.supports('color',sceneCanvas.backgroundColor)?sceneCanvas.backgroundColor:null;
 const reset=()=>{ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,w,h);if(opaqueBackground){ctx.fillStyle=opaqueBackground;ctx.fillRect(0,0,w,h);}ctx.translate(-x,-y);};
 const read=()=>ctx.getImageData(0,0,w,h).data;
 const restore=()=>{object.set({fill:saved.fill,stroke:saved.stroke,styles:saved.styles,shadow:saved.shadow,backgroundColor:saved.backgroundColor,textBackgroundColor:saved.textBackgroundColor});object.objectCaching=saved.objectCaching;object.dirty=saved.dirty;};
 const paintScene=()=>{reset();sceneCanvas?.backgroundImage?.render(ctx);for(const o of objects)o.render(ctx);sceneCanvas?.overlayImage?.render(ctx);return read();};
 try{
  // Match a native 1x export, rather than sampling an image cache built at the
  // editor's zoom or the device pixel ratio. Restore the live view on exit.
  sceneCanvases.forEach(c=>{c.skipOffscreen=false;c.viewportTransform=[1,0,0,1,0,0];c.enableRetinaScaling=false;});object.objectCaching=false;
  // Render the text alone without its own supporting panel or shadow. These
  // pixels locate actual glyph ink, not a Fabric textbox rectangle.
  ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,w,h);ctx.translate(-x,-y);
  object.set({shadow:null,backgroundColor:'',textBackgroundColor:'',styles:copyStyles(saved.styles,s=>{delete s.textBackgroundColor;delete s.backgroundColor;return s;})});
  object.render(ctx);const ink=read();restore();object.objectCaching=false;
  let maxAlpha=0,left=w,top=h,right=-1,bottom=-1,outsidePixels=0,paintedPixels=0,touchesPatchEdge=false;
  for(let row=0;row<h;row++)for(let col=0;col<w;col++){const a=ink[(row*w+col)*4+3];if(!a)continue;maxAlpha=Math.max(maxAlpha,a);paintedPixels++;left=Math.min(left,col);right=Math.max(right,col);top=Math.min(top,row);bottom=Math.max(bottom,row);if(x+col<0||y+row<0||x+col>=width||y+row>=height)outsidePixels++;if(!row||!col||row===h-1||col===w-1)touchesPatchEdge=true;}
  if(touchesPatchEdge)return unknown('glyph paint touches the capture edge; bounds are incomplete');
  if(!paintedPixels)return{status:'failed',reason:'native text has no painted glyphs',effectiveSize,minimumSize,limits};
  const full=paintScene();
  // Suppress glyph fill/stroke only. Preserve this text object's supporting
  // background and all other objects in their actual paint order.
  object.set({fill:'rgba(0,0,0,0)',stroke:null,shadow:null,styles:copyStyles(saved.styles,s=>({...s,fill:'rgba(0,0,0,0)',stroke:null}))});
  const behind=paintScene();restore();object.objectCaching=false;
  const samples=[],threshold=role==='title'?3:4.5;let missingBackground=0,unchangedPixels=0;
  for(let p=0;p<w*h;p++){if(ink[p*4+3]<Math.max(1,Math.ceil(maxAlpha*.98)))continue;const at=p*4;
   if(behind[at+3]<254||full[at+3]<254){missingBackground++;continue;}
   const a=full.subarray(at,at+3),b=behind.subarray(at,at+3);samples.push(contrast(a,b));if(a.every((v,i)=>Math.abs(v-b[i])<=1))unchangedPixels++;
  }
  samples.sort((a,b)=>a-b);
  const result={status:'measured',role,effectiveSize,minimumSize,fontMinimumPassed:effectiveSize>=minimumSize-.01,inkBox:{x:x+left,y:y+top,w:right-left+1,h:bottom-top+1},paintedPixels,outsidePixels,canvasInkPassed:outsidePixels===0,sampleCount:samples.length,missingOpaqueBackgroundSamples:missingBackground,unchangedSamples:unchangedPixels,contrastThreshold:threshold,contrast:samples.length?{minimum:samples[0],p05:samples[Math.floor((samples.length-1)*.05)],median:samples[Math.floor(samples.length/2)],passFraction:samples.filter(n=>n>=threshold).length/samples.length}:null,contrastPassed:missingBackground===0&&samples.length>0&&samples[0]>=threshold,limits};
  if(missingBackground||!samples.length){result.status='not_verified';result.reason='reference background is not fully opaque or no opaque glyph interior was sampled';}
  return result;
 }catch(error){return unknown('pixel measurement unavailable: '+error.message);}
 finally{restore();sceneCanvases.forEach((c,i)=>{c.skipOffscreen=canvasStates[i].skipOffscreen;c.viewportTransform=canvasStates[i].viewportTransform;c.enableRetinaScaling=canvasStates[i].enableRetinaScaling;});canvas.width=canvas.height=0;}
}
