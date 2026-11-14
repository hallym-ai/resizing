// A proposal assigns each original pixel to exactly one layer. The model output
// only chooses ownership; RGB and alpha always come from the source photograph.
// The missing background behind the subject is deliberately not invented.
export function splitPhotoPixels(source,estimate,width,height){
 if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width*height>4000000||source?.length!==width*height*4||estimate?.length!==source.length)throw Error('사진 크기 또는 분리 마스크가 올바르지 않습니다.');
 const foreground=new Uint8ClampedArray(source.length),background=new Uint8ClampedArray(source.length);let visible=0,front=0,back=0;
 for(let i=0;i<source.length;i+=4){const alpha=source[i+3];if(alpha===0)continue;visible++;const isFront=estimate[i+3]*2>=alpha;const out=isFront?foreground:background;out[i]=source[i];out[i+1]=source[i+1];out[i+2]=source[i+2];out[i+3]=alpha;if(isFront)front++;else back++;}
 if(!visible||front<Math.max(1,visible*.005)||back<Math.max(1,visible*.005))throw Error('상품과 배경을 충분히 구별하지 못했습니다. 원본을 유지합니다.');
 return {foreground,background,stats:{visible,front,back}};
}
