// Independent scratch concept: outside pixels are drawn from a few scalar grid
// parameters; no image patch, reflection, texture, logo or glyph is copied.

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),dist=(a,b)=>Math.max(...a.map((v,i)=>Math.abs(v-b[i]))),lum=c=>c[0]+c[1]+c[2];
function modes(data,w,h,y0,y1){const counts=new Map();for(let y=y0;y<y1;y++)for(let x=0;x<w;x++){let i=(y*w+x)*4;if(data[i+3]!==255)continue;let k=(data[i]<<16)|(data[i+1]<<8)|data[i+2];counts.set(k,(counts.get(k)||0)+1);if(counts.size>4096)return []}return [...counts].sort((a,b)=>b[1]-a[1]).map(([k,n])=>({rgb:[k>>16&255,k>>8&255,k&255],n}));}
function edgeProfile(data,w,h,x,bg,line){let top=null,inside=null;for(let y=0;y<h;y++){let i=(y*w+x)*4;if(top===null&&data[i+3]>=250)top=y;if(top!==null&&data[i+3]===255){let c=[data[i],data[i+1],data[i+2]];if(dist(c,bg)<=3||dist(c,line)<=3){inside=y;break}}}if(top===null||inside===null||inside<top)return null;return{top,thickness:inside-top};}
function fitRows(data,w,h){const start=Math.floor(h*.45),vals=[];for(let y=start;y<h;y++){let sum=0,n=0;for(let x=0;x<w;x+=2){const i=(y*w+x)*4;if(data[i+3]!==255)return null;sum+=(data[i]+data[i+1]+data[i+2])/3;n++}vals.push(sum/n)}const lo=Math.min(...vals),hi=Math.max(...vals);if(hi-lo<6)return null;const threshold=lo+(hi-lo)*.42,peaks=[];for(let i=0;i<vals.length;){if(vals[i]>threshold){i++;continue}const begin=i;let wt=0,total=0;while(i<vals.length&&vals[i]<=threshold){const z=threshold-vals[i]+.01;total+=(start+i)*z;wt+=z;i++}if(i-begin>12)return null;peaks.push(total/wt)}if(peaks.length<4)return null;let mi=(peaks.length-1)/2,avg=peaks.reduce((x,y)=>x+y,0)/peaks.length,a=0,b=0;for(let i=0;i<peaks.length;i++){a+=(i-mi)*(peaks[i]-avg);b+=(i-mi)**2}const period=a/b,origin=avg-period*mi;if(!(period>=8&&period<=128)||peaks.some((y,i)=>Math.abs(y-origin-i*period)>Math.max(1.5,period*.055)))return null;return{period,origin,lineCount:peaks.length}}
export function modelGrid({data,width:w,height:h,detectVerticalGridPhase}){
 if(typeof detectVerticalGridPhase!=='function'||!Number.isInteger(w)||!Number.isInteger(h)||w<64||h<64||w*h>2_000_000||data?.length!==w*h*4)return null;
 const v=detectVerticalGridPhase({data,width:w,height:h}),hor=fitRows(data,w,h);if(!v||!hor)return null;
 const colors=modes(data,w,h,Math.floor(h*.58),h),bg=colors[0]?.rgb,line=colors.find(c=>dist(c.rgb,bg||[])>=6&&lum(c.rgb)<lum(bg))?.rgb;if(!bg||!line||colors[0].n<w*h*.12)return null;
 const left=edgeProfile(data,w,h,0,bg,line),right=edgeProfile(data,w,h,w-1,bg,line);if(!left||!right||left.thickness>h*.25||right.thickness>h*.25)return null;
 const top=modes(data,w,h,0,Math.max(1,Math.floor(h*.45)));const paper=top.find(c=>dist(c.rgb,bg)>=6&&dist(c.rgb,line)>=6&&lum(c.rgb)>lum(bg))?.rgb||bg;
 return {width:w,height:h,periodX:v.period,originX:v.origin,periodY:hor.period,originY:hor.origin,bg,line,paper,left,right,quality:'review',warning:'바깥 격자는 원본을 추정해 새로 그렸습니다. 이음새와 종이 경계를 확인하세요.'};
}
export function drawOutside({data,width:w,height:h,left,right,bottom,model}){
 if(!model||model.width!==w||model.height!==h||![left,right,bottom].every(n=>Number.isInteger(n)&&n>=0)||data?.length!==w*h*4)return null;const width=w+left+right,height=h+bottom;if(width*height>4_000_000)return null;
 let out=new Uint8ClampedArray(width*height*4);for(let y=0;y<h;y++)out.set(data.subarray(y*w*4,(y+1)*w*4),(y*width+left)*4);
 const mod=(n,p)=>(n%p+p)%p,phase=(n,origin,p)=>{const t=mod(n-origin+p/2,p)-p/2;return Math.abs(t)};
 function color(x,y){let side=x<0?model.left:model.right,u=x<0?-x:x-w+1;let wave=side.top>0&&side.thickness>0?5*Math.sin(u/49)+3*Math.sin(u/19)+2*Math.sin(u/91):0;let boundary=clamp(side.top+wave,0,h*.4);if(y<boundary)return [0,0,0,0];if(y<boundary+side.thickness)return [...model.paper,255];let dx=phase(x,model.originX,model.periodX),dy=phase(y,model.originY,model.periodY),a=clamp(1.9-Math.min(dx,dy),0,1);return [0,1,2].map(i=>Math.round(model.bg[i]*(1-a)+model.line[i]*a)).concat(255);}
 for(let y=0;y<height;y++)for(let x=-left;x<w+right;x++){if(x>=0&&x<w&&y<h)continue;let val=color(x,y),i=(y*width+x+left)*4;out.set(val,i)}return {data:out,width,height,original:{x:left,y:0,width:w,height:h},quality:'review',model};
}
