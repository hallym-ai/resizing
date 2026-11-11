import RgbQuant from './vendor/design/rgbquant.mjs';
import {converter,formatHex,clampChroma,wcagContrast} from './vendor/design/culori.mjs';
const oklch=converter('oklch');
export const colorToken=(l,c,h)=>formatHex(clampChroma({mode:'oklch',l,c,h:Number.isFinite(h)?h:35},'oklch','rgb'));
const native=o=>['text','textbox','itext'].includes(String(o.type).toLowerCase());
const hex=(value,F)=>{try{if(typeof value!=='string'||value==='transparent')return null;const c=new F.Color(value);return c.getAlpha()<.5?null:'#'+c.toHex();}catch{return null;}};
const generated=o=>o.layerName==='시안 배경'||o.layerName?.startsWith('시안 장식 ·');
export function informationKinds(text){return [
 ['price',/(?:[₩$€¥]\s*\d|\d[\d,.]*\s*(?:원|KRW|USD|EUR))/i],
 ['date',/(?:\d{4}[-./년]\s*\d{1,2}|\d{1,2}월\s*\d{1,2}일)/],
 ['contact',/(?:\+?\d[\d -]{7,}\d|[\w.+-]+@[\w.-]+\.[a-z]{2,})/i],
 ['time',/(?:\d{1,2}\s*[:：]\s*\d{2}|\b(?:AM|PM|Monday|Friday|Saturday|Sunday)\b|영업|운영)/i]
].filter(([,r])=>r.test(text)).map(([key])=>key);}
export async function analyzeSourceDesign(state,doc,semantics=[],settings={}){
 const {F}=state,colors=new Map(),elements=[],warnings=[];
 const add=(color,weight,source)=>{if(!color)return;const old=colors.get(color)||{color,weight:0,sources:[]};old.weight+=weight;if(!old.sources.includes(source))old.sources.push(source);colors.set(color,old);};
 const area=state.width*state.height;
 state.objects.forEach((o,id)=>{
  if(o.visible===false||generated(o))return;
  const b=o.getBoundingRect(),kind=native(o)?'native-text':o.sourceText?'raster-text':String(o.type).toLowerCase()==='image'?'image':'shape';
  const role=o.layoutManualRole||semantics[id]?.semanticRole||o.layerRole||'other',text=native(o)?o.text:o.sourceText||'';
  const fill=hex(o.fill,F),weight=Math.min(1,b.width*b.height/area);
  add(fill,weight*(role==='title'?4:role==='logo'?3:1),'object:'+role);
  for(const row of Object.values(o.styles||{}))for(const st of Object.values(row))add(hex(st.fill,F),weight*.1,'text-run');
  const representation=native(o)?'native-text':kind==='raster-text'?'object-raster':kind==='image'?(o.sourceElementId||o.cutoutMethod?'object-raster':'flat-raster'):o.getObjects?'object-group':'native-vector';
  elements.push({id,name:o.layerName||o.type,kind,representation,sourceElementId:o.sourceElementId||null,sourceElementType:o.sourceElementType||null,nativeKind:o.nativeKind||null,role,text,information:informationKinds(text),protected:text?'wording':kind==='image'&&role!=='background'?'asset':role==='logo'?'asset':null,group:o.layoutManualGroup||semantics[id]?.semanticUnit||o.sourceElementId||'element:'+id,font:native(o)?{family:o.fontFamily,size:o.fontSize*Math.abs(o.scaleY),weight:o.fontWeight,style:o.fontStyle}:null,bounds:{x:b.left,y:b.top,w:b.width,h:b.height},cutoutMethod:o.cutoutMethod||null,locked:!!o.layerLocked});
 });
 // Bounded 192px sampling. It supplies palette evidence, never object identity
 // or permission to crop the product. The editor's snapshot is not modified.
 let sampleColors=[],sampleInput='unavailable';
 try{
  const linkedSource=globalThis.getLayerAnalysisSource?.(),image=state.sourceKey&&state.sourceKey===linkedSource?.key?linkedSource.source:null,owned=!image;sampleInput=image?'matching-source-key':'editor-snapshot';
  const source=image||globalThis.coexLayerLayout.snapshot(state.width,state.height);
  try{const canvas=document.createElement('canvas'),scale=192/Math.max(state.width,state.height);canvas.width=Math.max(1,Math.round(state.width*scale));canvas.height=Math.max(1,Math.round(state.height*scale));const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,0,0,canvas.width,canvas.height);const data=ctx.getImageData(0,0,canvas.width,canvas.height),q=new RgbQuant({colors:8,method:1,initColors:256});for(let i=3;i<data.data.length;i+=4)if(data.data[i]<192)data.data[i]=0;q.sample(data);const rgb=q.palette(true),counts=rgb.map(()=>0);for(let i=0;i<data.data.length;i+=4){if(data.data[i+3]<192)continue;let at=0,best=Infinity;rgb.forEach((c,j)=>{const d=c.reduce((sum,v,k)=>sum+(v-data.data[i+k])**2,0);if(d<best){best=d;at=j;}});counts[at]++;}const ranked=rgb.map((c,i)=>({color:'#'+c.map(v=>v.toString(16).padStart(2,'0')).join(''),count:counts[i]})).sort((a,b)=>b.count-a.count),total=counts.reduce((a,b)=>a+b,0)||1;sampleColors=ranked.map(e=>e.color);ranked.forEach(e=>add(e.color,.6*e.count/total,'sample'));}finally{if(owned){source.width=source.height=1;}}
 }catch{warnings.push('이미지 대표색을 읽지 못해 객체 색상만 분석했습니다.');}
 const ranked=[...colors.values()].sort((a,b)=>b.weight-a.weight);
 const chromatic=ranked.filter(c=>(oklch(c.color)?.c||0)>.045),objectAccent=chromatic.find(c=>c.sources.some(s=>/object:(title|logo|decoration)|text-run/.test(s)));
 const primary=(objectAccent||chromatic[0]||ranked[0])?.color||'#315b70';
 const bg=elements.filter(e=>e.role==='background').sort((a,b)=>b.bounds.w*b.bounds.h-a.bounds.w*a.bounds.h)[0];
 const background=bg?hex(state.objects[bg.id].fill,F)||sampleColors[0]||'#ffffff':sampleColors[0]||'#ffffff';
 const textElements=elements.filter(e=>e.text),nativeCount=textElements.filter(e=>e.kind==='native-text').length,rasterCount=textElements.length-nativeCount;
 const separated=rasterCount>0&&textElements.filter(e=>e.kind==='raster-text').every(e=>['flat-background','original-alpha'].includes(e.cutoutMethod));
 const confidence=nativeCount>=2&&!rasterCount?'native':rasterCount&&separated?'separated-raster':rasterCount?'review':nativeCount?'mixed':'unseparated';
 if(rasterCount)warnings.push('이미지형 글자는 원본 픽셀입니다. 글꼴·글자색·줄바꿈을 정확히 바꿀 수 없습니다.');
 if(confidence==='unseparated'||confidence==='review')warnings.push('요소 분리가 불확실합니다. 원본 유지 또는 영역·묶음을 확인해야 합니다.');
 if(elements.some(e=>e.locked&&e.role!=='background'))warnings.push('잠긴 요소는 자유 재배치를 제한합니다.');
 const fonts=[...new Set(elements.flatMap(e=>e.font?[e.font.family]:[]))];
 const embedded=[];
 for(const font of (doc.fonts||[]).slice(0,64)){
  const text=elements.filter(e=>e.font&&(e.font.family===font.family||(e.role==='title'?settings.titleFont:settings.bodyFont)===font.family)).map(e=>e.text).join(''),chars=[...new Set([...text])].filter(c=>!/^\s$/u.test(c)).slice(0,4096);
  if(!chars.length){embedded.push({family:font.family,status:'unused',tested:0,missing:[]});continue;}
  try{const bytes=Uint8Array.from(atob(font.src.split(',')[1]),c=>c.charCodeAt(0));if(bytes.byteLength>32*1024*1024)throw Error('size');const {parse}=await import('./vendor/design/opentype.mjs'),parsed=parse(bytes.buffer);const missing=chars.filter(c=>parsed.charToGlyphIndex(c)===0);embedded.push({family:font.family,status:chars.length?'checked':'unused',tested:chars.length,missing});if(missing.length)warnings.push('업로드 글꼴에 없는 글자: '+missing.slice(0,12).join(' '));}
  catch{embedded.push({family:font.family,status:'unverified',tested:0,missing:[]});warnings.push('일부 글꼴의 글리프 검사를 지원하지 않습니다. 브라우저 실제 렌더링을 확인하세요.');}
 }
 const roles=Object.fromEntries(['title','body','details','subject','logo','decoration','background','other'].map(role=>[role,elements.filter(e=>e.role===role).length]));
 return {schema:'coex-source-design-v1',width:state.width,height:state.height,confidence,counts:{nativeText:nativeCount,rasterText:rasterCount,images:elements.filter(e=>e.kind==='image'&&e.role!=='background').length},palette:{primary,background,colors:ranked.slice(0,12),sampleColors,sampleInput},roles,elements,typography:{families:fonts,embedded,coverage:'Embedded fonts only; system-font glyph coverage is unknown.'},warnings};
}
export function sourceStyle(settings,index){
 const p=settings.sourceProfile;if(!p)return null;
 const base=oklch(p.palette.primary),h=Number.isFinite(base?.h)?base.h:35,c=Math.max(.05,Math.min(.18,base?.c||.08));
 const variants=[
  {primary:p.palette.primary,background:p.palette.background,name:'원본 분위기 · 재배치'},
  {primary:colorToken(.46,c,h),background:colorToken(.97,.018,h),name:'원본 색감 · 라이트'},
  {primary:colorToken(.84,c*.65,h),background:colorToken(.21,.035,h),name:'원본 색감 · 다크'},
  {primary:colorToken(.44,c,h+30),background:colorToken(.92,.045,h+30),name:'원본 색감 · 변주'}
 ];
 const v=variants[index];
 return {...settings,theme:index===0?'original':'brand',primary:v.primary,background:settings.useBackground?settings.background:v.background,useBackground:true,keepBackground:index===0&&!settings.useBackground?true:settings.keepBackground,titleFont:index===0&&settings.titleFont==='auto'?'':settings.titleFont,bodyFont:index===0&&settings.bodyFont==='auto'?'':settings.bodyFont,styleName:v.name,paletteProvenance:{origin:index===0?'source-preserved':'source-derived',sourcePrimary:p.palette.primary,method:index===0?'original objects':'OKLCH',userBackgroundOverride:!!settings.useBackground}};
}
export function profileContrast(a,b){return wcagContrast(a,b);}
