// Explicit opaque slide-only sRGB fills are safe as an underlay. Theme,
// gradients, transparency, effects, master fallback and malformed XML stay
// on the existing capture path. This is not a general background detector.
const P='http://schemas.openxmlformats.org/presentationml/2006/main';
const A='http://schemas.openxmlformats.org/drawingml/2006/main';
const direct=(node,ns,name)=>[...node.children].filter(x=>x.namespaceURI===ns&&x.localName===name);
export function explicitSlideSolid(xml){
 if(typeof xml!=='string'||xml.length>4_000_000||/<!DOCTYPE|<!ENTITY/i.test(xml))return null;
 try{
  const doc=new DOMParser().parseFromString(xml,'application/xml'),root=doc.documentElement;
  if(doc.doctype||doc.querySelector('parsererror')||root?.namespaceURI!==P||root.localName!=='sld')return null;
  const c=direct(root,P,'cSld');if(c.length!==1)return null;
  const bg=direct(c[0],P,'bg');if(bg.length!==1)return null;
  const props=direct(bg[0],P,'bgPr');if(props.length!==1||bg[0].children.length!==1)return null;
  const fills=direct(props[0],A,'solidFill');if(fills.length!==1)return null;
  for(const child of props[0].children){if(child===fills[0])continue;if(child.namespaceURI!==A||child.localName!=='effectLst'||child.children.length)return null;}
  const colors=direct(fills[0],A,'srgbClr');if(colors.length!==1||fills[0].children.length!==1||colors[0].children.length)return null;
  const value=colors[0].getAttribute('val');return /^[0-9a-f]{6}$/i.test(value||'')?'#'+value.toLowerCase():null;
 }catch{return null;}
}

// Never replace a captured image based on XML alone. A slide can contain
// master artwork or other painted material not described by p:bgPr. Require
// every source pixel to match the explicit opaque colour exactly.
export function captureMatchesSlideSolid(canvas,color){
 if(!canvas||!/^#[0-9a-f]{6}$/i.test(color||''))return false;
 const w=canvas.width,h=canvas.height;
 if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w*h>24_000_000)return false;
 const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
 try{
  const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)return false;
  // Read bounded strips to avoid allocating a second full-slide RGBA buffer.
  for(let y=0;y<h;y+=128){
   const data=ctx.getImageData(0,y,w,Math.min(128,h-y)).data;
   for(let i=0;i<data.length;i+=4)if(data[i]!==rgb[0]||data[i+1]!==rgb[1]||data[i+2]!==rgb[2]||data[i+3]!==255)return false;
  }
  return true;
 }catch{return false;}
}

