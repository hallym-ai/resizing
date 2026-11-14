import {aiPolicy} from './resize-policy.mjs';
/* BiRefNet runs entirely in a local browser worker; only same-origin model GETs. */
let worker=null,active=null,id=0,idleTimer=null,previewUrl=null;
const abortError=()=>new DOMException('Cancelled','AbortError');
function terminate(){worker?.terminate();worker=null;clearTimeout(idleTimer);}
function getWorker(){if(worker)return worker;worker=new Worker(new URL('./photo-ai-worker.mjs',import.meta.url),{type:'module'});
 worker.onmessage=({data})=>{if(!active||data.id!==active.id)return;if(data.phase){active.onProgress?.(data);return;}const job=active;active=null;job.cleanup();if(data.error){terminate();job.reject(Error(data.error));}else{idleTimer=setTimeout(terminate,60000);job.resolve(data);}};
 worker.onerror=()=>{if(active){const job=active;active=null;job.cleanup();job.reject(Error('사진 AI 실행기를 준비하지 못했습니다.'));}terminate();};return worker;
}
function infer(tensor,{signal,onProgress}){return new Promise((resolve,reject)=>{if(signal?.aborted){reject(abortError());return;}if(active){reject(Error('사진 AI가 다른 이미지를 처리 중입니다.'));return;}clearTimeout(idleTimer);const currentId=++id;let timer;
 const cancel=()=>{if(active?.id!==currentId)return;active=null;cleanup();terminate();reject(abortError());};
 const cleanup=()=>{clearTimeout(timer);signal?.removeEventListener('abort',cancel);};active={id:currentId,resolve,reject,cleanup,onProgress};signal?.addEventListener('abort',cancel,{once:true});
 timer=setTimeout(()=>{if(active?.id!==currentId)return;active=null;cleanup();terminate();reject(Error('사진 AI 처리 시간이 초과되었습니다. 원본 리사이징은 계속 사용할 수 있습니다.'));},300000);
 try{getWorker().postMessage({id:currentId,tensor:tensor.buffer},[tensor.buffer]);}catch(e){active=null;cleanup();terminate();reject(e);}
});}
export async function removePhotoBackground(source,{signal,onProgress}={}){
 if(!aiPolicy.photoEnabled)throw Error(aiPolicy.photoReason||aiPolicy.reason);
 if(!globalThis.Worker||!globalThis.WebAssembly||!crypto.subtle)throw Error('이 브라우저는 로컬 사진 AI를 지원하지 않습니다.');
 const started=performance.now(),w=source.naturalWidth||source.width,h=source.naturalHeight||source.height;
 if(w*h>8000000)throw Error('사진 AI 분석 이미지는 800만 픽셀 이하로 사용해 주세요.');
 const prep=document.createElement('canvas');prep.width=prep.height=512;const pc=prep.getContext('2d',{willReadFrequently:true});pc.fillStyle='#fff';pc.fillRect(0,0,512,512);pc.drawImage(source,0,0,512,512);const rgba=pc.getImageData(0,0,512,512).data,input=new Float32Array(3*512*512),mean=[.485,.456,.406],std=[.229,.224,.225];
 for(let c=0;c<3;c++)for(let p=0;p<512*512;p++)input[c*512*512+p]=(rgba[p*4+c]/255-mean[c])/std[c];prep.width=prep.height=0;
 const result=await infer(input,{signal,onProgress});if(signal?.aborted)throw abortError();
 const maskCanvas=document.createElement('canvas');maskCanvas.width=maskCanvas.height=512;const maskPixels=new Uint8ClampedArray(512*512*4),mask=new Uint8Array(result.mask);for(let p=0;p<mask.length;p++){maskPixels[p*4]=maskPixels[p*4+1]=maskPixels[p*4+2]=mask[p];maskPixels[p*4+3]=255;}maskCanvas.getContext('2d').putImageData(new ImageData(maskPixels,512,512),0,0);
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(maskCanvas,0,0,w,h);const alpha=ctx.getImageData(0,0,w,h).data;ctx.clearRect(0,0,w,h);ctx.drawImage(source,0,0,w,h);const image=ctx.getImageData(0,0,w,h);let transparent=0,opaque=0,minX=w,minY=h,maxX=-1,maxY=-1;
 for(let p=0;p<w*h;p++){const value=Math.round(image.data[p*4+3]*alpha[p*4]/255);image.data[p*4+3]=value<=2?0:value;if(value<16)transparent++;if(value>240)opaque++;if(value>2){const x=p%w,y=Math.floor(p/w);minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}}
 maskCanvas.width=maskCanvas.height=0;if(maxX<0){canvas.width=canvas.height=0;throw Error('사진에서 전경을 구별하지 못했습니다.');}ctx.putImageData(image,0,0);
 return{canvas,bounds:{x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1},stats:{engine:'BiRefNet_lite-512',runtime:'onnxruntime-web 1.23.2',provider:result.provider,precision:result.precision,inferenceMs:result.elapsedMs,totalMs:Math.round(performance.now()-started),transparentPixels:transparent,opaquePixels:opaque,width:w,height:h,estimated:true}};
}
function resultPanel(){let panel=document.getElementById('photoAIResult');if(panel)return panel;panel=document.createElement('section');panel.id='photoAIResult';panel.className='card photo-ai-result';panel.hidden=true;panel.innerHTML='<h2>사진 AI 전경 분리 결과</h2><p id="photoAIResultStatus" role="status"></p><img id="photoAIImage" alt="브라우저에서 AI로 배경을 제거한 전경 미리보기"><a id="photoAIDownload" class="doc-btn" download>배경 제거 PNG 다운로드</a><p class="photo-ai-note">전경·배경을 추정한 결과입니다. 사진 속 글자·로고의 원래 레이어 복원이나 지워진 배경 복원은 아닙니다. 머리카락·반투명 부분·원래 배경과 같은 색을 확인하세요.</p>';document.getElementById('autoLayerPanel').after(panel);return panel;}
export async function showPhotoResult(result,name,{textMixed=false,signal}={}){const blob=await new Promise(resolve=>result.canvas.toBlob(resolve,'image/png'));if(signal?.aborted)throw abortError();if(!blob)throw Error('사진 AI PNG를 만들지 못했습니다.');clearPhotoResult();const panel=resultPanel();previewUrl=URL.createObjectURL(blob);document.getElementById('photoAIImage').src=previewUrl;const link=document.getElementById('photoAIDownload');link.href=previewUrl;link.download=(name||'photo')+'_foreground.png';document.getElementById('photoAIResultStatus').textContent=`사진 AI 분리 완료 · ${result.stats.width} × ${result.stats.height}px · ${(result.stats.inferenceMs/1000).toFixed(1)}초 추론. `+(result.stats.sourceWidth>result.stats.width||result.stats.sourceHeight>result.stats.height?'큰 원본은 분석용 크기로 축소되었습니다. ':'')+(textMixed?'글자가 포함되어 원래 글자·그림 객체로 자동 재배치하지 않았습니다. PNG로 받거나 원본 PPTX를 사용하세요.':'배경을 제거한 전경을 레이어 편집기로 준비합니다.');panel.dataset.engine=result.stats.engine;panel.dataset.inferenceMs=result.stats.inferenceMs;panel.hidden=false;}
export function clearPhotoResult(){if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null;}const panel=document.getElementById('photoAIResult');if(panel){panel.hidden=true;document.getElementById('photoAIImage').removeAttribute('src');document.getElementById('photoAIDownload').removeAttribute('href');}}
globalThis.clearPhotoAIResult=clearPhotoResult;
window.addEventListener('pagehide',e=>{if(!e.persisted){if(active){const job=active;active=null;job.cleanup();job.reject(abortError());}terminate();clearPhotoResult();}});

export function markPhotoResult(message){const panel=document.getElementById('photoAIResult');if(panel&&!panel.hidden)document.getElementById('photoAIResultStatus').textContent=message;}
