// Diagnostic only: the caller must also independently compare render output.
// Never infer the semantic role (logo/decoration/product) from this evidence.
export function decomposeRigidMatrix(m){
 if(!m?.is2D||![m.a,m.b,m.c,m.d,m.e,m.f].every(Number.isFinite)||Math.abs(m.e)>1e-8||Math.abs(m.f)>1e-8)return null;
 const l=Math.hypot(m.a,m.b),r=Math.hypot(m.c,m.d),dot=m.a*m.c+m.b*m.d,det=m.a*m.d-m.b*m.c;
 if(Math.abs(l-1)>1e-5||Math.abs(r-1)>1e-5||Math.abs(dot)>1e-5||Math.abs(Math.abs(det)-1)>1e-5)return null;
 return {rotation:Math.atan2(m.b,m.a)*180/Math.PI,flipH:false,flipV:det<0};
}
export function simpleSvgOnly(xml,parse=(v)=>new DOMParser().parseFromString(v,'image/svg+xml')){
 if(typeof xml!=='string'||xml.length>500000||/<!DOCTYPE|<!ENTITY|<\?xml-stylesheet/i.test(xml))return false;
 let doc;try{doc=parse(xml)}catch{return false}
 if(doc.documentElement?.localName!=='svg'||doc.querySelector('parsererror'))return false;
 const tags=new Set(['svg','g','path','rect','circle','ellipse','line','polyline','polygon','defs']);
 const attrs=new Set(['xmlns','xmlns:xlink','viewbox','width','height','x','y','cx','cy','r','rx','ry','d','points','x1','y1','x2','y2','fill','fill-rule','stroke','stroke-width','stroke-linecap','stroke-linejoin','stroke-miterlimit','stroke-dasharray','stroke-dashoffset','opacity','fill-opacity','stroke-opacity','transform','id','preserveaspectratio','style']);
 let count=0;
 for(const el of [doc.documentElement,...doc.documentElement.querySelectorAll('*')]){
  if(++count>2000||!tags.has(el.localName)||el.namespaceURI!=='http://www.w3.org/2000/svg')return false;
  for(const a of el.attributes){const name=a.name.toLowerCase(),value=a.value;
   if(!attrs.has(name)||name.startsWith('on')||name==='href'||name.endsWith(':href')||name==='src'||/\\|\/\*|\*\/|url\s*\(|@import|expression\s*\(|javascript:|data:/i.test(value))return false;
   if(name==='style'&&!/^(?:(?:\s*(?:overflow|position)\s*:\s*(?:visible|hidden|absolute|relative|static)\s*;?\s*)*)$/i.test(value))return false;
  }
 }
 return true;
}
export async function readSimplePicture(el,root,{signal,width,height}){
 if(!el||!root||!root.contains(el)||signal?.aborted||el.coexPptxInfo?.type!=='picture')return {ok:false,reason:'not-picture'};
 for(let p=el.parentElement;p&&p!==root;p=p.parentElement){const s=getComputedStyle(p);if(p.dataset?.coexPptxType==='group'||s.transform!=='none'||s.opacity!=='1'||s.clipPath!=='none'||['hidden','clip','scroll','auto'].includes(s.overflowX)||['hidden','clip','scroll','auto'].includes(s.overflowY))return {ok:false,reason:'unsupported-ancestor'};}
 const s=getComputedStyle(el),imgs=el.querySelectorAll('img');
 if(imgs.length!==1||el.querySelector('svg,canvas,video')||s.clipPath!=='none'||s.filter!=='none'||s.mixBlendMode!=='normal'||s.boxShadow!=='none')return {ok:false,reason:'unsupported-picture'};
 const img=imgs[0];
 for(let p=img.parentElement;p&&p!==el;p=p.parentElement){const x=getComputedStyle(p);if(x.transform!=='none'||x.opacity!=='1'||x.clipPath!=='none'||x.clip!=='auto'||x.maskImage!=='none'||x.filter!=='none'||['hidden','clip','scroll','auto'].includes(x.overflowX)||['hidden','clip','scroll','auto'].includes(x.overflowY))return {ok:false,reason:'unsupported-image-wrapper'};}
 const is=getComputedStyle(img),w=parseFloat(s.width),h=parseFloat(s.height),opacity=Number(s.opacity),rotation=s.transform==='none'?{rotation:0,flipH:false,flipV:false}:decomposeRigidMatrix(new DOMMatrixReadOnly(s.transform));
 const margins=['marginLeft','marginTop','marginRight','marginBottom'].map(k=>parseFloat(is[k])||0),origin=s.transformOrigin.split(/\s+/).map(parseFloat);
 if(!rotation||!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0||!Number.isFinite(opacity)||opacity<0||opacity>1||!img.complete||!img.naturalWidth||!img.naturalHeight||is.filter!=='none'||is.transform!=='none'||is.clipPath!=='none'||is.clip!=='auto'||is.objectFit!=='fill'||is.opacity!=='1'||margins.some(n=>Math.abs(n)>.01)||origin.length<2||Math.abs(origin[0]-w/2)>.2||Math.abs(origin[1]-h/2)>.2||s.maskImage!=='none'||is.maskImage!=='none'||Math.abs(parseFloat(is.width)-w)>.2||Math.abs(parseFloat(is.height)-h)>.2||Math.abs(parseFloat(is.left)||0)>.2||Math.abs(parseFloat(is.top)||0)>.2)return {ok:false,reason:'unsupported-geometry'};
 const rr=root.getBoundingClientRect(),er=el.getBoundingClientRect();
 if(Math.abs(rr.width-width)>1||Math.abs(rr.height-height)>1)return {ok:false,reason:'unsupported-root'};
 const x=er.left-rr.left+(er.width-w)/2,y=er.top-rr.top+(er.height-h)/2;
 if(![x,y].every(Number.isFinite))return {ok:false,reason:'invalid-position'};
 const src=img.currentSrc||img.src;if(!src.startsWith('blob:')&&!src.startsWith('data:image/'))return {ok:false,reason:'unsupported-source'};
 const response=await fetch(src,{signal});if(!response.ok)return {ok:false,reason:'media-read-failed'};
 const blob=await response.blob();if(blob.size>3000000||!['image/png','image/jpeg','image/svg+xml'].includes(blob.type))return {ok:false,reason:'unsupported-media'};
 if(blob.type==='image/svg+xml'&&!simpleSvgOnly(await blob.text()))return {ok:false,reason:'unsafe-svg'};
 const data=await new Promise((resolve,reject)=>{const fr=new FileReader();fr.onerror=()=>reject(Error('media-read-failed'));fr.onload=()=>resolve(fr.result);fr.readAsDataURL(blob)});
 return {ok:true,object:{x,y,width:w,height:h,...rotation,opacity,crop:null,group:false,effects:[]},mediaDataUrl:data};
}
