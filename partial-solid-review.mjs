export function partialConnectionReview(state){
 const rows=(state?.inputKind==='layered'?state.objects:[])||[],w=state.width,h=state.height,t=Math.max(2,Math.min(w,h)*.002);
 let potential=false,edited=false;
 for(const o of rows){if(o.visible===false||o.sourceElementType!=='picture'||!o.getBoundingRect)continue;const b=o.getBoundingRect();if(!b||![b.left,b.top,b.width,b.height,w,h].every(Number.isFinite)||w<=0||h<=0)continue;
  potential ||= (Math.abs(b.left)<=t&&Math.abs(b.left+b.width-w)<=t&&b.height>=h*.08&&b.height<=h*.45)||(Math.abs(b.top)<=t&&Math.abs(b.top+b.height-h)<=t&&b.width>=w*.08&&b.width<=w*.45);
  if(o.layerLocked||o.gridSourceUserEdited)edited ||= (b.width>=w*.4&&b.height>=h*.08&&b.height<=h*.45)||(b.height>=h*.4&&b.width>=w*.08&&b.width<=w*.45);
 }
 return {potential,edited,review:potential||edited,reason:edited?' 직접 편집하거나 잠근 요소는 자동 연결을 보류했습니다. 해당 영역을 확인하세요.':potential?' 독립 영역의 연결 여부는 확인이 필요합니다.':''};
}
