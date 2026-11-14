// Pure trial planner. Call only with a real, evidence-backed source descriptor.
// New area is confined to source edges; original output geometry is not moved.
const valid=b=>b&&[b.x,b.y,b.w,b.h].every(Number.isFinite)&&b.w>0&&b.h>0;
const inside=(b,w,h)=>b.x>=-1e-6&&b.y>=-1e-6&&b.x+b.w<=w+1e-6&&b.y+b.h<=h+1e-6;
const area=b=>Math.max(0,b.w)*Math.max(0,b.h);
const overlap=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
const fail=reason=>({status:'review',reason});
export function isOpaqueSolidRgba({pixels,width,height}){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>2_000_000||pixels?.length!==width*height*4)return false;
 const r=pixels[0],g=pixels[1],b=pixels[2];for(let i=0;i<pixels.length;i+=4)if(pixels[i]!==r||pixels[i+1]!==g||pixels[i+2]!==b||pixels[i+3]!==255)return false;
 return true;
}
// Region is an independent object, not a group or a flattened slide.
// verifiedSolid must be backed by a CSS rect fill or every pixel of the source,
// not an image sample, role, name or file-specific ID.
export function planPartialSolidExtension({sourceWidth:sw,sourceHeight:sh,targetWidth:tw,targetHeight:th,region,objects=[]}){
 if(![sw,sh,tw,th].every(n=>Number.isFinite(n)&&n>0&&n<=10000)||!region||!valid(region.sourceBox)||!valid(region.outputBox))return fail('invalid-geometry');
 if(!region.independent||region.role!=='background'||!['user-confirmed','source-verified'].includes(region.roleEvidence)||region.visible===false||region.locked||region.group||region.clip||region.shadow||region.filter||region.rotation||region.skew||region.flip||region.crop||region.opacity!==1||region.composite!=='source-over'||!region.verifiedSolid||!Number.isInteger(region.paintIndex))return fail('source-not-proven-safe');
 const s=region.sourceBox,o=region.outputBox;if(!inside(o,tw,th))return fail('output-outside');
 const t=Math.max(2,Math.min(sw,sh)*.002),left=Math.abs(s.x)<=t,right=Math.abs(s.x+s.w-sw)<=t,top=Math.abs(s.y)<=t,bottom=Math.abs(s.y+s.h-sh)<=t;
 // Full-frame backgrounds are already handled by the existing background code.
 if(left&&right&&top&&bottom)return fail('full-frame-existing-path');
 // A transverse span is necessary to distinguish decorative panels/labels from
 // an edge-to-edge region. Geometry alone is never evidence of semantic intent.
 const horizontal=left&&right&&s.w>=sw*.96,vertical=top&&bottom&&s.h>=sh*.96;
 if(!horizontal&&!vertical)return fail('not-edge-to-edge-region');
 const b={...o};if(horizontal){b.x=0;b.w=tw;if(top){b.h+=b.y;b.y=0;}if(bottom)b.h=th-b.y;}
 if(vertical){b.y=0;b.h=th;if(left){b.w+=b.x;b.x=0;}if(right)b.w=tw-b.x;}
 if(!inside(b,tw,th)||area(b)<=area(o)+1e-6)return {status:'no-change',reason:'no-padding-to-fill'};
 // Only newly covered area matters. Lower paint-order objects would be hidden;
 // later elements stay in place and naturally paint above the same-color region.
 for(const item of objects){if(item.id===region.id||item.visible===false||item.paintIndex>=region.paintIndex)continue;
  if(!valid(item.outputBox)||!Number.isInteger(item.paintIndex))return fail('lower-layer-geometry-unknown');
  if(item.isVerifiedBaseBackground)continue;
  const added=overlap(item.outputBox,b)-overlap(item.outputBox,o);if(added>1e-6)return fail('would-cover-lower-layer');
 }
 return {status:'candidate',id:region.id,sourceBox:{...s},oldBox:{...o},newBox:b,sourcePaintIndex:region.paintIndex,warning:'색상 영역을 가장자리까지 확장합니다. 원본 영역과 전경의 위치·순서는 유지되며 시각 확인이 필요합니다.'};
}

