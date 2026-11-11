import {semanticPlan} from './semantic-layout.mjs';
import {designZones,packDesignUnits,inspectLayout,solverInfo} from './design-layout.mjs';
/* Role-based layout of independent elements. No raster stretching or remote AI. */
const permittedRoles=new Set(['background','logo','title','details','subject','decoration','other']);
const detailPattern=/(?:\d{4}\s*년|\d{1,2}\s*(?:월|일|시)|\d{1,2}[./-]\d{1,2}|장소|기간|문의|입장|예약|등록|주소|서울|전시장|venue|location|date|ticket|october|november|december|january|february|march|april|june|july|august|september)/i;
const area=e=>e.w*e.h;
export function validLayoutSize(w,h){return Number.isInteger(w)&&Number.isInteger(h)&&w>0&&h>0&&w<=12000&&h<=12000&&w*h<=24000000;}
export function boundsOf(elements){const x=Math.min(...elements.map(e=>e.x)),y=Math.min(...elements.map(e=>e.y)),right=Math.max(...elements.map(e=>e.x+e.w)),bottom=Math.max(...elements.map(e=>e.y+e.h));return{x,y,w:right-x,h:bottom-y};}
export function inferRoles(elements,sourceWidth,sourceHeight){
 const roles=new Map();const visible=elements.filter(e=>!e.hidden);
 for(const e of visible){let role=permittedRoles.has(e.role)?e.role:'other';
  if(role==='other'&&!e.text&&e.shapeType==='rect'&&e.x<=sourceWidth*.025&&e.y<=sourceHeight*.025&&e.w>=sourceWidth*.95&&e.h>=sourceHeight*.95)role='background';
  if(role==='other'&&/로고|logo/i.test(e.name||''))role='logo';
  if(role==='other'&&e.text&&detailPattern.test(e.text))role='details';
  roles.set(e.id,role);
 }
 const unassignedText=visible.filter(e=>roles.get(e.id)==='other'&&e.text);
 if(unassignedText.length&&!visible.some(e=>roles.get(e.id)==='title')){
  const title=[...unassignedText].sort((a,b)=>b.h/Math.max(1,b.text.split(/\n/).length)-a.h/Math.max(1,a.text.split(/\n/).length))[0];roles.set(title.id,'title');
 }
 const graphic=visible.filter(e=>roles.get(e.id)==='other'&&!e.text&&area(e)>sourceWidth*sourceHeight*.008);
 for(const e of graphic)roles.set(e.id,'subject');
 // Keep a native shape and its separately editable label under the same affine layout.
 const sourceGroups=new Map();for(const e of visible)if(e.sourceGroup){if(!sourceGroups.has(e.sourceGroup))sourceGroups.set(e.sourceGroup,[]);sourceGroups.get(e.sourceGroup).push(e);}
 for(const items of sourceGroups.values()){const label=items.find(e=>e.text);if(items.length<2||!label)continue;const role=roles.get(label.id)==='other'?'body':roles.get(label.id);for(const e of items)if(roles.get(e.id)!=='background')roles.set(e.id,role);}
 return roles;
}
export function layoutZones(width,height){
 const m=Math.min(width,height)*.055,g=Math.min(width,height)*.025,W=width-2*m,H=height-2*m,r=width/height;
 const box=(x,y,w,h)=>({x,y,w:Math.max(width*.001,w),h:Math.max(height*.001,h)});
 let mode,zones;
 if(r>=2.5){
  mode='wide';zones={logo:box(m,m,W*.13,H),title:box(m+W*.16,m,W*.33,H),body:box(m+W*.16,m+H*.62,W*.33,H*.35),subject:box(m+W*.53,m,W*.25,H),details:box(m+W*.81,m,W*.19,H)};
 }else if(r>=1.25){
  mode='landscape';zones={logo:box(m,m,W*.40,H*.115),title:box(m,m+H*.15,W*.51,H*.34),body:box(m,m+H*.53,W*.51,H*.21),details:box(m,m+H*.79,W*.51,H*.21),subject:box(m+W*.56,m+H*.04,W*.44,H*.92)};
 }else if(r<=.8){
  mode='portrait';zones={logo:box(m,m,W*.5,H*.075),title:box(m,m+H*.10,W,H*.20),subject:box(m,m+H*.34,W,H*.38),body:box(m,m+H*.76,W,H*.10),details:box(m,m+H*.89,W,H*.11)};
 }else{
  mode='square';zones={logo:box(m,m,W*.45,H*.085),title:box(m,m+H*.12,W,H*.20),subject:box(m,m+H*.36,W,H*.37),body:box(m,m+H*.77,W,H*.095),details:box(m,m+H*.90,W,H*.10)};
 }
 // A wide title and body share a column, never the same vertical band.
 if(mode==='wide'){zones.title.h=H*.57;}
 zones.decoration={...zones.subject};return{mode,zones,margin:m,gap:g};
}
export function planLayout(elements,{sourceWidth,sourceHeight,width,height,design=null}){
 if(!validLayoutSize(width,height)||!validLayoutSize(sourceWidth,sourceHeight))throw Error('크기는 양의 정수, 한 변 12,000px / 전체 2,400만 픽셀 이하로 지정해 주세요.');
 for(const e of elements)if(![e.x,e.y,e.w,e.h].every(Number.isFinite)||e.w<=0||e.h<=0)throw Error('크기를 계산할 수 없는 요소가 있습니다. 요소를 확인해 주세요.');
 const semantic=semanticPlan(elements,{sourceWidth,sourceHeight,width,height,design});if(semantic)return semantic;
 const roles=inferRoles(elements,sourceWidth,sourceHeight),groups=new Map(),warnings=[];
 const visible=elements.filter(e=>!e.hidden),backgrounds=visible.filter(e=>roles.get(e.id)==='background');
 const lockedGroups=new Set(visible.filter(e=>e.locked&&e.sourceGroup&&roles.get(e.id)!=='background').map(e=>e.sourceGroup));
 for(const e of visible){const role=roles.get(e.id);if(role==='background')continue;if(e.locked||lockedGroups.has(e.sourceGroup)){warnings.push('잠긴 요소와 같은 원본 묶음은 유지했습니다. 위치를 확인해 주세요.');continue;}const key=role==='other'?(e.text?'body':'decoration'):role;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(e);}
 if(!groups.size)throw Error('재배치할 개별 요소가 없습니다. 파일의 글자·그림 인식이 끝난 뒤 다시 시도하거나 잠금을 해제해 주세요.');
 const {mode,zones,margin,gap}=designZones(width,height,groups,design),placements=[];
 for(const [role,items]of groups){const zone=zones[role]||zones.body;
  for(const {items:unit,b,cell}of packDesignUnits(items,role,zone,gap,mode)){
   const short=Math.min(width,height),caps={logo:.055,title:.12,body:.046,details:.036},textCap=caps[role]||.046,textScales=unit.filter(e=>e.text).map(e=>short*textCap/Math.max(1,e.fontSize||e.h*.82/Math.max(1,e.text.split(/\n/).length))),scale=Math.min(cell.w/b.w,cell.h/b.h,...textScales),center=mode==='portrait'||mode==='square'||['subject','decoration'].includes(role),left=center?cell.x+(cell.w-b.w*scale)/2:cell.x,top=cell.y+(cell.h-b.h*scale)/2;
   for(const e of unit)placements.push({id:e.id,role:roles.get(e.id),groupRole:role,scale,x:left+(e.x-b.x)*scale,y:top+(e.y-b.y)*scale,w:e.w*scale,h:e.h*scale,zone:unit.length===1?cell:null,align:center?'center':'left'});
  }
 }
 if(elements.some(e=>!e.hidden&&e.text&&e.kind==='image'))warnings.push('이미지형 글자는 픽셀 비율을 유지합니다. 줄바꿈을 바꾸려면 편집 글자로 교체하세요.');
 if(backgrounds.some(e=>e.kind==='image'))warnings.push('배경 이미지는 원본 보호 설정에 맞춰 배치합니다. 새 규격의 빈 공간은 배경 연결 후보로 채울 수 있습니다.');
 const actual=visible.filter(e=>roles.get(e.id)!=='background').map(e=>({...e,role:roles.get(e.id),...placements.find(p=>p.id===e.id)})),quality=inspectLayout(actual,width,height,margin);
 const unlockedOutside=quality.outside.filter(id=>placements.some(p=>p.id===id));if(unlockedOutside.length)throw Error('요소가 안전 여백을 벗어나 재배치를 중단했습니다.');
 if(quality.outside.length)warnings.push('잠긴 요소가 안전 여백 밖에 있습니다. 잠금을 해제해 다시 배치하세요.');
 if(quality.overlaps.length)warnings.push('유지된 요소 사이에 겹침이 있습니다. 배치 결과를 확인하세요.');
 if(placements.some(p=>p.h<12&&elements.find(e=>e.id===p.id)?.text))warnings.push('작은 출력에서는 글자가 작아질 수 있습니다. 글자 크기를 확인해 주세요.');
 return{width,height,mode,design,solver:solverInfo,roles:Object.fromEntries(roles),placements,backgrounds:backgrounds.map(e=>e.id),margin,gap,quality,warnings:[...new Set(warnings)],counts:Object.fromEntries([...groups].map(([role,items])=>[role,items.length]))};
}
