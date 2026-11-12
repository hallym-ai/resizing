// Experimental only. Metadata is not a guarantee of visual fidelity.
const fail=()=>{throw Error('잘못되었거나 지원하지 않는 복원 요소 데이터입니다.');};
const plain=x=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const keys=(x,k)=>plain(x)&&Object.keys(x).length===k.length&&k.every(a=>Object.hasOwn(x,a));
const num=x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=1e8;
const pos=x=>num(x)&&x>0;
const whole=x=>Number.isInteger(x)&&x>0&&x<=12000;
const png=x=>typeof x==='string'&&x.length<=12*1024*1024&&/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(x);
function pngHeaderMatches(src,width,height){
 try{const raw=atob(src.slice('data:image/png;base64,'.length,'data:image/png;base64,'.length+32));
  if(raw.length<24||[137,80,78,71,13,10,26,10].some((v,i)=>raw.charCodeAt(i)!==v)||raw.slice(12,16)!=='IHDR')return false;
  const u32=i=>(raw.charCodeAt(i)*16777216+raw.charCodeAt(i+1)*65536+raw.charCodeAt(i+2)*256+raw.charCodeAt(i+3));
  return u32(8)===13&&u32(16)===width&&u32(20)===height;
 }catch{return false;}
}
export async function sourceDigest(src){
 if(typeof src!=='string'||!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(src)||src.length>50*1024*1024)fail();
 const hash=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(src));
 return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export function outsideSourceChanged(object){
 const b=object?.trialOutsideRestore?.original;if(!b)return false;
 return !object.__outsideBaseElement||object.getElement?.()!==object.__outsideBaseElement||object.getSrc?.()!==object.__outsideBaseSource||object.width!==b.width||object.height!==b.height||(object.cropX??0)!==b.cropX||(object.cropY??0)!==b.cropY;
}
export function canonicalOutside(object){
 const m=object?.trialOutsideRestore;if(!m||outsideSourceChanged(object))return undefined;
 if(!plain(m)||!plain(m.original)||!plain(m.slide)||!plain(m.outer))fail();
 const {left,top,width,height,scaleX,scaleY,cropX,cropY}=m.original;
 const q=m.outer;
 return {version:1,status:'unverified',visible:object.__outsideTrialVisible===true,baseSourceDigest:m.baseSourceDigest,original:{left,top,width,height,scaleX,scaleY,cropX,cropY},slide:{width:m.slide.width,height:m.slide.height},outer:{src:q.src,left:q.left,top:q.top,width:q.width,height:q.height}};
}
export function validateOutside(m,object){
 if(!keys(m,['version','status','visible','baseSourceDigest','original','slide','outer'])||m.version!==1||m.status!=='unverified'||typeof m.visible!=='boolean'||!/^[0-9a-f]{64}$/.test(m.baseSourceDigest)||object.type!=='Image')fail();
 const b=m.original,p=m.outer,s=m.slide;
 if(!keys(b,['left','top','width','height','scaleX','scaleY','cropX','cropY'])||!num(b.left)||!num(b.top)||!pos(b.width)||!pos(b.height)||!pos(b.scaleX)||!pos(b.scaleY)||!num(b.cropX)||!num(b.cropY)||b.cropX!==(object.cropX??0)||b.cropY!==(object.cropY??0)||b.width!==object.width||b.height!==object.height)fail();
 if(!keys(s,['width','height'])||!whole(s.width)||!whole(s.height)||s.width*s.height>24000000)fail();
 if(!keys(p,['src','left','top','width','height'])||!png(p.src)||!num(p.left)||!num(p.top)||!whole(p.width)||!whole(p.height)||p.width*p.height>4000000||!pngHeaderMatches(p.src,p.width,p.height))fail();
 return p;
}
export function bindOutside(objects,serialized){
 if(objects.length!==serialized.length)fail();
 for(let i=0;i<objects.length;i++){
  const m=serialized[i].outsideRecovery;if(!m)continue;validateOutside(m,serialized[i]);
  objects[i].trialOutsideRestore={baseSourceDigest:m.baseSourceDigest,original:m.original,slide:m.slide,outer:m.outer,status:m.status};
  objects[i].__outsideTrialVisible=m.visible;
 }
}
export async function installOutside(objects,serialized){
 if(objects.length!==serialized.length)fail();
 for(let i=0;i<objects.length;i++){
  const m=serialized[i].outsideRecovery;if(!m)continue;
  validateOutside(m,serialized[i]);
  if(await sourceDigest(serialized[i].src)!==m.baseSourceDigest||objects[i].getSrc?.()!==serialized[i].src)throw Error('원본 이미지가 달라 복원 데이터를 적용하지 않았습니다.');
 }
 bindOutside(objects,serialized);
 if(objects.some(o=>o.trialOutsideRestore)){
  if(typeof globalThis.coexInstallOutsideTrialForObjects!=='function')throw Error('바깥 복원 요소를 불러올 수 없습니다.');
  await globalThis.coexInstallOutsideTrialForObjects({objects});
 }
}
