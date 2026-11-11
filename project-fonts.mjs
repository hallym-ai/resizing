const activeFonts=new Set();
// Project-local font bytes. No network font URLs are accepted.
export function fontDataUrl(bytes){let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));return 'data:font/ttf;base64,'+btoa(binary);}
export async function loadProjectFonts(fonts=[]){
 if(!Array.isArray(fonts)||fonts.length>64)throw Error('글꼴 정보가 너무 많습니다.');
 const faces=[];let total=0;
 try{for(const f of fonts){
  if(typeof f.family!=='string'||!/^[\p{L}\p{N} _.-]{1,200}$/u.test(f.family)||!/^data:(?:font\/[a-z0-9.+-]+|application\/octet-stream);base64,[A-Za-z0-9+/=]+$/i.test(f.src||''))throw Error('프로젝트 글꼴 형식이 올바르지 않습니다.');
  total+=f.src.length;if(total>48*1024*1024)throw Error('프로젝트 글꼴 용량이 큽니다.');
  const bytes=Uint8Array.from(atob(f.src.split(',')[1]),c=>c.charCodeAt(0));
  const face=new FontFace(f.family,bytes,{weight:/^(normal|bold|[1-9]00)$/.test(String(f.weight))?String(f.weight):'400',style:['normal','italic','oblique'].includes(f.style)?f.style:'normal'});
  await face.load();document.fonts.add(face);faces.push(face);activeFonts.add({spec:f,face});
 }}catch(error){faces.forEach(face=>{document.fonts.delete(face);for(const r of activeFonts)if(r.face===face)activeFonts.delete(r);});throw error;}
 return{dispose(){faces.forEach(face=>{document.fonts.delete(face);for(const r of activeFonts)if(r.face===face)activeFonts.delete(r);});}};
}

// FontFaceSet.check can succeed through a fallback. Check the exact loaded
// project instance instead. A detached but loaded face can be re-added without
// a network request or a different font substituting for the stored bytes.
export function restoreLoadedProjectFonts(fonts=[]){
 const repaired=[];
 for(const f of fonts){
  const record=[...activeFonts].find(r=>r.spec.family===f.family&&r.spec.src===f.src&&String(r.spec.weight||'400')===String(f.weight||'400')&&(r.spec.style||'normal')===(f.style||'normal'));
  if(!record||record.face.status!=='loaded'){const e=Error('프로젝트 글꼴을 복원하지 못했습니다. 원본 PPTX 또는 글꼴이 포함된 JSON을 다시 열어 주세요.');e.code='PROJECT_FONT_UNAVAILABLE';throw e;}
  if(!document.fonts.has(record.face)){document.fonts.add(record.face);if(!document.fonts.has(record.face)){const e=Error('프로젝트 글꼴을 등록하지 못해 출력을 중지했습니다.');e.code='PROJECT_FONT_UNAVAILABLE';throw e;}repaired.push(f.family);}
 }
 return [...new Set(repaired)];
}

export function assertProjectFontReferences(objects,fonts=[]){
 if(!Array.isArray(fonts))throw Error('프로젝트 글꼴 정보가 올바르지 않습니다.');
 const provided=new Set(fonts.map(f=>f.family));
 const visit=o=>{
  const names=[o.fontFamily,...Object.values(o.styles||{}).flatMap(row=>Object.values(row).map(s=>s.fontFamily))].filter(Boolean);
  for(const value of names)for(const family of String(value).split(',').map(s=>s.trim().replace(/^['"]|['"]$/g,'')))if(/^(?:__pptx_embedded_|CoexFont-)/.test(family)&&!provided.has(family)){const e=Error('내장 글꼴 데이터가 없는 프로젝트입니다. 원본 PPTX 또는 글꼴을 포함한 JSON을 다시 열어 주세요.');e.code='PROJECT_FONT_UNAVAILABLE';throw e;}
  (o.getObjects?.()||o.objects||[]).forEach(visit);
 };
 objects.forEach(visit);
}
