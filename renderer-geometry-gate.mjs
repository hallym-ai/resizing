// Scratch: OOXML EMU vs same object's actual DOM rectangle in CSS pixels.
// This only accepts axis-aligned outer transforms and checks geometry/opacity;
// media provenance and seam quality are separate gates.
export function matchRendererGeometry(source,render,{cssPerEmu=1/9525,positionTolerance=.25,rotationTolerance=.05,opacityTolerance=.00011,cornerTolerance=.5}={}){
 const a=source?.geometry,b=render,nums=[a?.x,a?.y,a?.width,a?.height,a?.rotation,source?.opacity,b?.x,b?.y,b?.width,b?.height,b?.rotation,b?.opacity,cssPerEmu,positionTolerance,rotationTolerance,opacityTolerance,cornerTolerance];
 if(!nums.every(Number.isFinite)||cssPerEmu<=0||positionTolerance<0||rotationTolerance<0||opacityTolerance<0||cornerTolerance<0)return {status:'review',reason:'geometry-missing-or-invalid'};
 // A flipped DOM matrix decomposition is ambiguous without full matrix parity.
 if(a.flipH||a.flipV||b.flipH||b.flipV||source.groups?.length)return {status:'review',reason:'flip-or-group-needs-matrix-proof'};
 const errors=Object.fromEntries(['x','y','width','height'].map(k=>[k,Math.abs(a[k]*cssPerEmu-b[k])]));
 const rotationError=Math.abs((((a.rotation-b.rotation)%360)+540)%360-180),opacityError=Math.abs(source.opacity-b.opacity);
 const corner=(g,scale,ux,uy)=>{const w=g.width*scale,h=g.height*scale,cx=g.x*scale+w/2,cy=g.y*scale+h/2,rad=g.rotation*Math.PI/180,dx=ux*w/2,dy=uy*h/2;return [cx+Math.cos(rad)*dx-Math.sin(rad)*dy,cy+Math.sin(rad)*dx+Math.cos(rad)*dy]};
 let maxCornerError=0;for(const ux of [-1,1])for(const uy of [-1,1]){const x=corner(a,cssPerEmu,ux,uy),y=corner(b,1,ux,uy);maxCornerError=Math.max(maxCornerError,Math.hypot(x[0]-y[0],x[1]-y[1]));}
 if(Object.values(errors).some(v=>v>positionTolerance)||rotationError>rotationTolerance||opacityError>opacityTolerance||maxCornerError>cornerTolerance)return {status:'review',reason:'renderer-geometry-or-opacity-mismatch',errors,rotationError,opacityError,maxCornerError};
 return {status:'geometry-matched',errors,rotationError,opacityError,maxCornerError};
}
