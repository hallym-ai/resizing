import {CreateMLCEngine} from './vendor/webllm/webllm.mjs';
import {designSchema} from './free-ai-contract.mjs';
let engine=null;
self.onmessage=async({data})=>{
 const {job,messages}=data;
 try{
  if(!engine){
   const adapter=await navigator.gpu?.requestAdapter();if(!adapter)throw Error('이 브라우저에서는 무료 AI 계산을 지원하지 않습니다. 최신 Chrome·Edge에서 GPU 가속을 확인해 주세요.');
   const model='Qwen2.5-0.5B-Instruct-'+(adapter.features.has('shader-f16')?'q4f16_1':'q4f32_1')+'-MLC';
   engine=await CreateMLCEngine(model,{initProgressCallback:r=>self.postMessage({job,kind:'progress',progress:r.progress})});
  }
  self.postMessage({job,kind:'inference'});
  const response=await engine.chat.completions.create({messages,response_format:{type:'json_object',schema:JSON.stringify(designSchema)},temperature:.75,max_tokens:600,seed:Date.now()%100000});
  if(response.choices[0]?.finish_reason!=='stop')throw Error('AI 배치안 출력이 중단되었습니다. 요청을 짧게 하거나 다시 시도해 주세요.');
  self.postMessage({job,kind:'complete',text:response.choices[0]?.message?.content,model:response.model||'Qwen2.5-0.5B-Instruct',usage:response.usage});
 }catch(error){self.postMessage({job,kind:'error',message:error.message||'무료 AI 실행을 완료하지 못했습니다.'});}
};
