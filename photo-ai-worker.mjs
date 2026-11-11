import {checkModelPart,decodeModelPart} from './photo-model-reader.mjs';
import * as ort from './vendor/ai/ort.webgpu.min.mjs';
ort.env.logLevel='error';ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;ort.env.wasm.wasmPaths=new URL('./vendor/ai/',import.meta.url).href;
let session=null,manifest=null,provider=null;
const base=new URL('./vendor/ai/',import.meta.url),hex=buffer=>[...new Uint8Array(buffer)].map(v=>v.toString(16).padStart(2,'0')).join('');
async function modelBytes(id){
 manifest=await(await fetch(new URL('model-web512-fp32.json',base))).json();const output=new Uint8Array(manifest.bytes);let offset=0,cache;
 try{cache=await caches.open('coex-birefnet-'+manifest.revision);}catch{}
 for(let i=0;i<manifest.chunks.length;i++){
  const c=manifest.chunks[i],url=new URL(c.path,base).href;let response=await cache?.match(url),bytes,kind;
  if(response){bytes=await response.arrayBuffer();kind=await checkModelPart(bytes,c);if(!kind){await cache.delete(url);bytes=null;}}
  if(!bytes){response=await fetch(url);if(!response.ok)throw Error('사진 모델 다운로드에 실패했습니다.');bytes=await response.arrayBuffer();kind=await checkModelPart(bytes,c);if(!kind)throw Error('사진 모델 무결성을 확인하지 못했습니다.');try{await cache?.put(url,new Response(bytes.slice(0)));}catch{}}
  const raw=await decodeModelPart(bytes,c,kind);output.set(new Uint8Array(raw),offset);offset+=raw.byteLength;postMessage({id,phase:'download',progress:Math.round(offset/manifest.bytes*100)});
 }
 if(offset!==manifest.bytes)throw Error('사진 모델 크기가 다릅니다.');return output;
}
self.onmessage=async({data})=>{
 const {id,tensor}=data;let input,result;
 try{
  if(!session){const adapter=data.backend==='wasm'?null:await navigator.gpu?.requestAdapter();provider=adapter?'webgpu':'wasm';postMessage({id,phase:'backend',provider});const bytes=await modelBytes(id);postMessage({id,phase:'prepare'});session=await ort.InferenceSession.create(bytes,{executionProviders:[provider],graphOptimizationLevel:'all'});}
  postMessage({id,phase:'inference'});const started=performance.now();input=new ort.Tensor('float32',new Float32Array(tensor),[1,3,512,512]);result=await session.run({[session.inputNames[0]]:input});
  const output=result[session.outputNames.at(-1)],raw=output.data,mask=new Uint8ClampedArray(512*512);if(raw.length!==mask.length)throw Error('사진 모델 출력 크기가 다릅니다.');
  for(let i=0;i<mask.length;i++)mask[i]=Math.round(255/(1+Math.exp(-Math.max(-80,Math.min(80,raw[i])))));
  postMessage({id,mask:mask.buffer,width:512,height:512,provider,precision:manifest.precision,elapsedMs:Math.round(performance.now()-started)},[mask.buffer]);
 }catch(error){postMessage({id,error:error.message||String(error)});}
 finally{input?.dispose();if(result)for(const output of Object.values(result))output.dispose();}
};
