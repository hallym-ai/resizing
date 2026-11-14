// Stage one uses the imported slide background, never colour-key removal or
// a size/role guess. Every other visible source object stays in the elements.
export function sourceBackgroundParts(state){
 const backgrounds=[],foreground=[];
 for(const [id,object] of (state?.objects||[]).entries()){
  if(object.visible===false)continue;
  const item={id,object,name:object.layerName||'요소'};
  if(object.cutoutMethod==='pptx-slide-background'&&object.sourceElementType==='slide-background')backgrounds.push(item);
  else foreground.push(item);
 }
 return {backgrounds,foreground,unresolved:[],separated:backgrounds.length===1};
}

export function slideSourceObjectIds(xml){
 if(typeof xml!=='string'||xml.length>4_000_000||/<!DOCTYPE|<!ENTITY/i.test(xml))return null;
 try{
  const P='http://schemas.openxmlformats.org/presentationml/2006/main';
  const doc=new DOMParser().parseFromString(xml,'application/xml'),root=doc.documentElement;
  if(doc.doctype||doc.querySelector('parsererror')||root?.namespaceURI!==P||root.localName!=='sld')return null;
  const children=(n,name)=>[...n.children].filter(c=>c.namespaceURI===P&&c.localName===name);
  const slides=children(root,'cSld');if(slides.length!==1)return null;
  const trees=children(slides[0],'spTree');if(trees.length!==1)return null;
  const ids=[],types=new Set(['sp','pic','graphicFrame','cxnSp','contentPart']);
  const visit=group=>{for(const n of group.children){if(n.namespaceURI!==P)continue;if(n.localName==='grpSp'){visit(n);continue;}if(!types.has(n.localName))continue;
   const props=n.getElementsByTagNameNS(P,'cNvPr');if(props.length!==1)throw Error('Unidentified source object');
   const id=props[0].getAttribute('id');if(!/^\d+$/.test(id||''))throw Error('Invalid object id');ids.push('slide:'+id);
  }};
  visit(trees[0]);return new Set(ids).size===ids.length?ids:null;
 }catch{return null;}
}

export function sourceObjectCoverage(nodes,objects,sourceIds=null){
 const expected=[...new Set(sourceIds||nodes.map(n=>String(n.info?.id||'')).filter(Boolean))];
 const retained=new Set(objects.map(o=>String(o.sourceElementId||'')).filter(Boolean));
 const missing=expected.filter(id=>!retained.has(id));
 return {expected:expected.length,retained:expected.length-missing.length,missing};
}

export function withSeparationVisibility(state,parts,kind,callback){
 if(!['background','foreground'].includes(kind))throw Error('분리 보기 종류를 확인하세요.');
 const canvas=state.objects.find(o=>o.canvas)?.canvas,backdrop=canvas?.backgroundColor;
 const visible=state.objects.map(o=>o.visible),selected=new Set((kind==='background'?parts.backgrounds:parts.foreground).map(p=>p.object));
 if(canvas)canvas.backgroundColor='';
 try{state.objects.forEach(o=>o.visible=selected.has(o));return callback();}
 finally{state.objects.forEach((o,i)=>o.visible=visible[i]);if(canvas){canvas.backgroundColor=backdrop;canvas.requestRenderAll?.();}}
}
