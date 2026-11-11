// Serializable text support over measured glyph ink, including script overhangs.
// Uses textBackgroundColor so native pixel measurement can omit/support it correctly.
export function installReadabilityPanels(F){
 for(const C of[F.FabricText||F.Text,F.IText,F.Textbox]){if(!C?.prototype)continue;const original=C.prototype._renderTextLinesBackground;if(typeof original!=='function'||original.coexMeasuredPanel)continue;
  const render=function(ctx){const b=this.readabilityPanelBox;if(b&&this.textBackgroundColor&&[b.x,b.y,b.w,b.h].every(Number.isFinite)&&b.w>0&&b.h>0&&b.w<24000&&b.h<24000){ctx.save();ctx.fillStyle=this.textBackgroundColor;ctx.fillRect(b.x,b.y,b.w,b.h);ctx.restore();return;}return original.call(this,ctx);};render.coexMeasuredPanel=true;C.prototype._renderTextLinesBackground=render;
 }
}
export function setMeasuredPanelBox(o,inkBox,F){
 const inverse=F.util.invertTransform(o.calcTransformMatrix()),p=1.5,points=[[inkBox.x-p,inkBox.y-p],[inkBox.x+inkBox.w+p,inkBox.y-p],[inkBox.x-p,inkBox.y+inkBox.h+p],[inkBox.x+inkBox.w+p,inkBox.y+inkBox.h+p]].map(([x,y])=>F.util.transformPoint(new F.Point(x,y),inverse)),x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));o.set('readabilityPanelBox',{x,y,w:Math.max(...points.map(p=>p.x))-x,h:Math.max(...points.map(p=>p.y))-y});
}
