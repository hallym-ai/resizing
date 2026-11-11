// Native object relationships only. Pixel profiles are hints, never OCR or crop permission.
const area=b=>b.w*b.h,hit=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
export function catalogEvidence(nodes,sw,sh){
 const eligible=n=>!n.manualRole&&!n.manualGroup&&!n.locked&&n.roleConfidence!=='declared',text=nodes.filter(n=>n.kind==='text'||n.text&&n.cutoutMethod==='verified-flat-background'),images=nodes.filter(n=>n.kind==='image'&&!n.text&&n.role!=='background'),photos=images.filter(n=>eligible(n)&&n.visualProfile?.variance>500&&n.visualProfile?.paletteFraction<.7&&area(n.source)>sw*sh*.035);
 if(text.length<3||!photos.length||nodes.some(n=>n.manualGroup||n.manualRole))return null;
 if(photos.length===1&&photos[0].visualProfile.coverage<.85)return null;
 const mark=(n,role,kind,target)=>{n.role=role;n.materialKind=kind;n.materialAttachTo=target?.id;n.roleConfidence='object-profile-inferred';n.roleEvidence.push('native-layout:'+kind);};
 for(const n of images.filter(eligible)){const p=n.visualProfile,b=n.source;if(!p||photos.includes(n)||n.materialKind)continue;
  if(p.variance<1&&p.coverage>.98&&area(b)>sw*sh*.2&&photos.some(h=>hit(b,h.source)>area(h.source)*.25)){mark(n,'background','flat-panel');continue;}
  const band=b.w>=sw*.95&&b.y>sh*.8&&p.variance<1&&p.coverage>.9;
  if(band){mark(n,'decoration','brand-band');for(const t of text.filter(t=>hit(b,t.source)>area(t.source)*.85)){t.catalogRole='brand';t.role='logo';t.brandBand=n.id;}continue;}
  const label=text.filter(t=>hit(b,t.source)>area(t.source)*.85&&area(b)<sw*sh*.2).sort((a,c)=>area(a.source)-area(c.source))[0];
  if(label&&p.paletteFraction>.9){mark(n,label.role,'text-backing',label);continue;}
  if(n.cutoutMethod==='verified-flat-background'&&p.mean){const candidates=text.filter(t=>t.visualProfile?.mean&&Math.hypot(...p.mean.map((v,k)=>v-t.visualProfile.mean[k]))<50).sort((a,c)=>Math.abs(a.source.y-b.y)-Math.abs(c.source.y-b.y));if(candidates.length){mark(n,candidates[0].role,'unconfirmed-lettering-kept-with-copy',candidates[0]);continue;}}
  const badge=area(b)<sw*sh*.03&&b.w/b.h>2.5&&p.paletteFraction>.8&&b.y>Math.min(...photos.map(h=>h.source.y))&&b.y<Math.max(...photos.map(h=>h.source.y+h.source.h));
  if(badge){const t=text.filter(t=>Math.abs(t.source.y+t.source.h/2-b.y-b.h/2)<b.h*1.5).sort((a,c)=>Math.abs(a.source.x+a.source.w/2-b.x-b.w/2)-Math.abs(c.source.x+c.source.w/2-b.x-b.w/2))[0];if(t){mark(n,t.role,'text-backing',t);continue;}}
  if((p.paletteFraction>.8||p.variance<200)&&area(b)<sw*sh*.12&&area(b)*p.coverage<sw*sh*.015)mark(n,'decoration','floating');
 }
 const parent=new Map(photos.map(p=>[p.id,p.id])),find=id=>parent.get(id)===id?id:find(parent.get(id));
 for(const a of photos)for(const b of photos)if(a.id!==b.id&&hit(a.source,b.source)>Math.min(area(a.source),area(b.source))*.025)parent.set(find(a.id),find(b.id));
 const cards=[];for(const p of photos){const key=find(p.id);let card=cards.find(c=>c.key===key);if(!card){card={key,photos:[],texts:[]};cards.push(card);}card.photos.push(p.id);p.productPhotoKey='product:'+key;}
 for(const card of cards){const a=card.photos.map(id=>nodes.find(n=>n.id===id).source),x=Math.min(...a.map(b=>b.x)),y=Math.min(...a.map(b=>b.y));card.box={x,y,w:Math.max(...a.map(b=>b.x+b.w))-x,h:Math.max(...a.map(b=>b.y+b.h))-y};}
 cards.sort((a,b)=>a.box.y-b.box.y||a.box.x-b.box.x);
 const firstY=Math.min(...cards.map(c=>c.box.y)),lastY=Math.max(...cards.map(c=>c.box.y+c.box.h));
 const maxFont=Math.max(...text.map(n=>n.originalFont));for(const t of text)if(eligible(t)&&t.role==='body'&&t.originalFont<maxFont*.1&&t.source.y<firstY){t.role='logo';t.catalogRole='info';}
 for(const t of text){if(t.role==='title'||t.catalogRole==='brand')continue;const b=t.source;if(b.y+b.h<firstY*.98||b.y>lastY+sh*.025)continue;
  const ranked=cards.map(c=>({c,d:Math.abs(b.y+b.h/2-c.box.y-c.box.h/2)/sh+.12*Math.abs(b.x+b.w/2-c.box.x-c.box.w/2)/sw})).sort((a,c)=>a.d-c.d);t.productKey='product:'+ranked[0].c.key;ranked[0].c.texts.push(t.id);
 }
 if(cards.length>1){for(const c of cards){const copy=c.texts.map(id=>nodes.find(n=>n.id===id)),prices=copy.filter(n=>n.information.includes('price')),names=copy.filter(n=>!prices.includes(n)).sort((a,b)=>b.originalFont-a.originalFont);for(const n of copy)n.catalogRole=prices.includes(n)?'price':n===names[0]?'name':'description';}}
 if(cards.length===1&&nodes.find(n=>n.id===cards[0].photos[0]).visualProfile.coverage<.85)return null;
 return{schema:'native-product-cards-v1',mode:cards.length>1?'catalog':'photo-scene',cards,classification:'native geometry + palette; inferred, review required',backgrounds:nodes.filter(n=>n.role==='background').map(n=>n.id)};
}
