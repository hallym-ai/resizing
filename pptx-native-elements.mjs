import {fontDataUrl} from './project-fonts.mjs';
let fabric;
const F=async()=>{fabric||=await import('./vendor/layers/fabric.mjs');fabric.config.NUM_FRACTION_DIGITS=5;return fabric;};
const clean=v=>Array.isArray(v)?v.map(clean):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([k])=>!['layoutManager','clipPath'].includes(k)).map(([k,x])=>[k,clean(x)])):v;
const n=(x,f=0)=>Number.isFinite(parseFloat(x))?parseFloat(x):f;
// clientWidth is integer-rounded, which can turn an otherwise fitting final
// glyph into a new line. Preserve the browser's fractional content box.
export function textContentBoxWidth(style,clientWidth){
 const pad=n(style.paddingLeft)+n(style.paddingRight),border=n(style.borderLeftWidth)+n(style.borderRightWidth),css=String(style.width||'');
 const width=/^\s*(?:\d+(?:\.\d*)?|\.\d+)px\s*$/i.test(css)?parseFloat(css):NaN;
 return Math.max(1,Number.isFinite(width)?width-(style.boxSizing==='border-box'?pad+border:0):n(clientWidth)-pad);
}
function layoutPosition(el){let x=0,y=0;for(let node=el;node instanceof HTMLElement;node=node.offsetParent){x+=node.offsetLeft;y+=node.offsetTop;}return{x,y};}
// Compose layout offsets and every group/shape CSS transform around its origin.
function matrixToRoot(el,root){
 if(el===root)return new DOMMatrix();const parent=el.parentElement,m=matrixToRoot(parent,root),a=layoutPosition(el),b=layoutPosition(parent),s=getComputedStyle(el),origin=s.transformOrigin.split(' ').map(x=>n(x));
 return m.translate(a.x-b.x,a.y-b.y).translate(origin[0],origin[1]).multiply(s.transform==='none'?new DOMMatrix():new DOMMatrix(s.transform)).translate(-origin[0],-origin[1]);
}
function transform(o,m,f){f.util.applyTransformToObject(o,f.util.multiplyTransformMatrices([m.a,m.b,m.c,m.d,m.e,m.f],o.calcTransformMatrix()));o.setCoords();return o;}
function family(s){return (s.fontFamily||'sans-serif')+',"Malgun Gothic","Apple SD Gothic Neo",sans-serif';}
function textStyle(s){return{fontFamily:family(s),fontSize:n(s.fontSize,20),fontWeight:s.fontWeight,fontStyle:s.fontStyle,fill:s.color,underline:s.textDecorationLine.includes('underline'),linethrough:s.textDecorationLine.includes('line-through')};}
export async function nativeText(el,root,info,ratio){
 if(!el||el instanceof SVGElement)return null;
 const style=getComputedStyle(el);if(style.writingMode!=='horizontal-tb'||el.querySelector('svg,canvas'))return null;
 const f=await F(),spans=[...el.querySelectorAll('span')].filter(s=>s.textContent),first=spans[0]||el,base=getComputedStyle(first),paragraphs=[...el.children].filter(c=>c.textContent),p=paragraphs[0]||el,ps=getComputedStyle(p);
 const fontSize=n(base.fontSize,20),boxWidth=textContentBoxWidth(style,el.clientWidth);
 const lineHeight=n(ps.lineHeight,fontSize*1.16)/fontSize;
 const text=String(info.text||'').replace(/\r/g,'');if(!text.trim())return{empty:true};
 const styles={},defaults=textStyle(base);let line=0,column=0;
 // Preserve per-run font, weight and colour when the renderer text equals OOXML.
 const rendered=paragraphs.map(q=>q.textContent).join('\n');
 if(rendered===text){for(const [i,q]of paragraphs.entries()){
  line=i;column=0;const walker=document.createTreeWalker(q,NodeFilter.SHOW_TEXT);let node;
  while(node=walker.nextNode()){const st=textStyle(getComputedStyle(node.parentElement));for(const k of Object.keys(st))if(st[k]===defaults[k])delete st[k];for(const char of Array.from(node.textContent)){if(char==='\n'){line++;column=0;continue;}if(Object.keys(st).length)(styles[line]||={})[column]={...st};column++;}}
 }}
 const nowrap=style.whiteSpace==='nowrap';let width=boxWidth;
 if(nowrap){const measure=new f.Text(text,{...textStyle(base),styles});width=Math.max(boxWidth,measure.width+2);measure.dispose();}
 const o=new f.Textbox(text,{...textStyle(base),styles,width,splitByGrapheme:true,lineHeight:Math.max(.5,Math.min(3,lineHeight)),textAlign:['left','center','right','justify'].includes(ps.textAlign)?ps.textAlign:'left',charSpacing:n(base.letterSpacing)/fontSize*1000,originX:'left',originY:'top',left:n(style.paddingLeft),top:(p.offsetTop||n(style.paddingTop))+(n(ps.lineHeight,fontSize*1.16)-fontSize*1.13)/2,padding:0,objectCaching:false});
 const m=new DOMMatrix().scale(ratio.x,ratio.y).multiply(matrixToRoot(el,root));transform(o,m,f);
 o.sourceFontFamily=base.fontFamily;o.nativeKind='text';
 return{object:clean(o.toObject(['sourceFontFamily','nativeKind'])),bounds:o.getBoundingRect()};
}
export async function nativeShape(el,root,ratio){
 const svgs=[...el.children].filter(x=>x instanceof SVGElement&&!x.dataset.coexPptxText);if(!svgs.length)return null;
 if(svgs.length!==1)return null;const svg=svgs[0];
 if(svg.querySelector('foreignObject,text,textPath,image,mask,clipPath,pattern'))return null;
 const paths=[...svg.querySelectorAll('path,rect,circle,ellipse,line,polygon,polyline')];
 if(!paths.some(p=>{const s=getComputedStyle(p);return(s.fill!=='none'&&s.fill!=='rgba(0, 0, 0, 0)')||(s.stroke!=='none'&&n(s.strokeWidth)>0);} ))return{empty:true};
 const clone=svg.cloneNode(true),filters=[...clone.querySelectorAll('filter')];let shadow;
 if(filters.length){if(filters.length!==1||filters[0].children.length!==1||filters[0].firstElementChild.localName!=='feDropShadow')return null;
  const drop=filters[0].firstElementChild;shadow={color:drop.getAttribute('flood-color')||'#000',opacity:n(drop.getAttribute('flood-opacity'),1),blur:2*n(drop.getAttribute('stdDeviation')),offsetX:n(drop.getAttribute('dx')),offsetY:n(drop.getAttribute('dy'))};
  clone.querySelectorAll('[filter]').forEach(x=>x.removeAttribute('filter'));filters[0].remove();
 }
 const f=await F(),data=await f.loadSVGFromString(new XMLSerializer().serializeToString(clone)),objects=data.objects.filter(Boolean);if(!objects.length)return null;
 const o=f.util.groupSVGElements(objects,data.options),r=root.getBoundingClientRect(),ctm=svg.getScreenCTM();if(!ctm){o.dispose();return null;}
 const vb=svg.viewBox.baseVal,vw=svg.width.baseVal.value,vh=svg.height.baseVal.value;
 // Fabric already applies viewBox-to-viewport conversion during SVG parsing.
 const view=vb.width&&vb.height?new DOMMatrix().scale(vw/vb.width,vh/vb.height).translate(-vb.x,-vb.y):new DOMMatrix();
 const m=new DOMMatrix().scale(ratio.x,ratio.y).translate(-r.left,-r.top).multiply(ctm).multiply(view.inverse());
 if(shadow){const color=new f.Color(shadow.color);color.setAlpha(shadow.opacity);o.set('shadow',new f.Shadow({...shadow,color:color.toRgba()}));}
 transform(o,m,f);o.nativeKind='vector';return{object:clean(o.toObject(['nativeKind'])),bounds:o.getBoundingRect()};
}
export async function embeddedProjectFonts(presentation,ppt,objects){
 const used=JSON.stringify(objects.filter(o=>o.nativeKind==='text')),fonts=[];let bytes=0;
 for(const face of presentation.embeddedFonts||[]){if(!used.includes(face.renderFamily))continue;
  try{const data=ppt.coexDecodeEmbeddedFont(face.data);bytes+=data.byteLength;if(bytes>32*1024*1024)break;fonts.push({family:face.renderFamily,originalFamily:face.family,weight:face.weight,style:face.style,src:fontDataUrl(data)});}catch{}
 }return fonts;
}
