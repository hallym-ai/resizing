import Yoga from './vendor/yoga/dist/src/index.js';

export const solverInfo=Object.freeze({name:'yoga',version:'3.2.1',rules:'coex-flex-v1'});
const directions={row:Yoga.FLEX_DIRECTION_ROW,column:Yoga.FLEX_DIRECTION_COLUMN};
const alignments={start:Yoga.ALIGN_FLEX_START,center:Yoga.ALIGN_CENTER,end:Yoga.ALIGN_FLEX_END,stretch:Yoga.ALIGN_STRETCH};
const justify={start:Yoga.JUSTIFY_FLEX_START,center:Yoga.JUSTIFY_CENTER,end:Yoga.JUSTIFY_FLEX_END,'space-between':Yoga.JUSTIFY_SPACE_BETWEEN};

/** Resolve declarative container rules. All coordinates come from real Yoga nodes. */
export function solveFlexTree(rule){
 const config=Yoga.Config.create();config.setUseWebDefaults(true);config.setPointScaleFactor(0);
 let root;const records=[],keys=new Set();
 const build=(spec,parent)=>{
  if(!spec||typeof spec.key!=='string'||keys.has(spec.key))throw Error('배치 규칙에 중복되거나 잘못된 요소가 있습니다.');
  keys.add(spec.key);const node=Yoga.Node.create(config);if(parent)parent.insertChild(node,parent.getChildCount());else root=node;
  records.push({node,key:spec.key,parent});
  node.setFlexDirection(directions[spec.direction||'column']);node.setAlignItems(alignments[spec.align||'stretch']);node.setJustifyContent(justify[spec.justify||'start']);
  node.setFlexShrink(spec.shrink??1);
  for(const [key,setter]of [['width','setWidth'],['height','setHeight'],['minWidth','setMinWidth'],['minHeight','setMinHeight'],['maxWidth','setMaxWidth'],['maxHeight','setMaxHeight'],['grow','setFlexGrow'],['basis','setFlexBasis']])if(spec[key]!=null){if(!Number.isFinite(spec[key])||spec[key]<0)throw Error('배치 규칙 크기를 확인해 주세요.');node[setter](spec[key]);}
  if(spec.padding!=null)node.setPadding(Yoga.EDGE_ALL,spec.padding);
  if(spec.gap!=null)node.setGap(Yoga.GUTTER_ALL,spec.gap);
  for(const child of spec.children||[])build(child,node);
  return node;
 };
 try{
  build(rule,null);root.calculateLayout(rule.width,rule.height,Yoga.DIRECTION_LTR);
  const boxes={},positions=new Map();
  for(const {node,key,parent}of records){const r=node.getComputedLayout(),origin=positions.get(parent)||{x:0,y:0},b={x:origin.x+r.left,y:origin.y+r.top,w:r.width,h:r.height};if(!Object.values(b).every(Number.isFinite)||b.w<0||b.h<0)throw Error('배치 엔진이 유효한 크기를 계산하지 못했습니다.');boxes[key]=b;positions.set(node,b);}
  return{boxes,engine:solverInfo,nodeCount:records.length};
 }finally{root?.freeRecursive();config.free();}
}
