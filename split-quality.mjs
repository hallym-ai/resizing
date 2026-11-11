/* Do not present ambiguous OCR/graphic crops as independent objects. */
export function assessSplit(regions,width,height){
 const text=regions.filter(b=>b.type==='text'&&b.include),pictures=regions.filter(b=>b.type==='image'&&b.include);
 const overlap=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
 if(text.some(t=>pictures.some(p=>overlap(t,p)>Math.max(9,t.w*t.h*.025))))return{safe:false,reason:'글자와 그림의 추정 영역이 겹쳐 함께 잘릴 수 있습니다.'};
 if(text.length&&pictures.some(p=>p.w*p.h>width*height*.55))return{safe:false,reason:'큰 그림과 글자가 합쳐진 영역을 정확히 나누지 못했습니다.'};
 return{safe:true,reason:''};
}
