const $=id=>document.getElementById(id);
let generation=0,controller=null,selectedFile=null,result=null,originalCanvas=null,foregroundCanvas=null;
const supported=/\.(png|jpe?g|pptx)$/i;
function dimensions(){const width=Number($('backgroundWidth').value),height=Number($('backgroundHeight').value);if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>12000||height>12000||width*height>24000000)throw Error('출력 크기는 한 변 12,000px, 전체 2,400만 픽셀 이하의 양의 정수로 입력하세요.');return{width,height};}
function clearCanvas(c){if(c){c.width=0;c.height=0;}}
function message(text,error=false){$('backgroundStatus').textContent=text;$('backgroundStatus').style.color=error?'var(--danger)':'';}
function placeholder(host,text){const p=document.createElement('p');p.textContent=text;$(host).replaceChildren(p);}
function releaseResult(){const keep=new Set([originalCanvas]);for(const c of new Set([result?.canvas,foregroundCanvas]))if(c&&!keep.has(c))clearCanvas(c);result=null;foregroundCanvas=null;placeholder('backgroundHost','아직 배경을 만들지 않았습니다.');$('foregroundHost').replaceChildren();$('foregroundDetails').hidden=true;$('backgroundSize').textContent='';$('backgroundWarning').hidden=true;$('backgroundWarning').textContent='';$('backgroundDownload').disabled=true;}
function invalidate(){generation++;controller?.abort();controller=null;releaseResult();$('backgroundCancel').disabled=true;$('backgroundRun').disabled=!selectedFile;return generation;}
function discardOutput(output){for(const c of new Set([output?.canvas,output?.originalCanvas,output?.foregroundCanvas]))if(c&&c!==originalCanvas&&c!==result?.canvas&&c!==foregroundCanvas)clearCanvas(c);}
function showCanvas(host,c){$(host).replaceChildren(c);}
function validCanvas(c){return c instanceof HTMLCanvasElement&&c.width>0&&c.height>0;}
async function previewRaster(file,token){let bitmap;try{bitmap=await createImageBitmap(file);if(token!==generation)return;if(bitmap.width*bitmap.height>24000000)throw Error('원본 이미지가 너무 큽니다.');const c=document.createElement('canvas');c.width=bitmap.width;c.height=bitmap.height;c.getContext('2d').drawImage(bitmap,0,0);clearCanvas(originalCanvas);originalCanvas=c;showCanvas('originalHost',c);}catch{if(token===generation)placeholder('originalHost','원본 미리보기를 만들지 못했습니다. 처리 결과의 안내를 확인해 주세요.');}finally{bitmap?.close();}}
$('backgroundFile').addEventListener('change',()=>{selectedFile=null;const token=invalidate();clearCanvas(originalCanvas);originalCanvas=null;placeholder('originalHost','선택한 원본을 표시합니다.');const file=$('backgroundFile').files[0];if(!file){$('fileName').textContent='원본 파일을 선택하세요.';message('파일을 선택한 뒤 출력 규격을 정하세요.');return;}if(!supported.test(file.name)){message('PNG, JPG 또는 PPTX 파일을 선택하세요.',true);return;}if(file.size>100*1024*1024){message('이 화면에서는 100MB 이하의 파일을 선택하세요.',true);return;}selectedFile=file;$('fileName').textContent=file.name;$('backgroundRun').disabled=false;message('출력 규격을 정한 뒤 ‘배경만 만들기’를 누르세요.');if(/\.pptx$/i.test(file.name))placeholder('originalHost','PPTX 원본 비교 화면은 분석 후 표시합니다.');else void previewRaster(file,token);});
for(const id of ['backgroundWidth','backgroundHeight'])$(id).addEventListener('input',()=>{invalidate();$('backgroundPreset').value='custom';message('규격이 바뀌었습니다. 배경을 다시 만들어 주세요.');});
$('backgroundPreset').addEventListener('change',()=>{if($('backgroundPreset').value!=='custom'){const[w,h]=$('backgroundPreset').value.split('x');$('backgroundWidth').value=w;$('backgroundHeight').value=h;}invalidate();message('규격이 바뀌었습니다. 배경을 다시 만들어 주세요.');});
$('backgroundCancel').addEventListener('click',()=>{invalidate();message('중지했습니다. 이전 결과는 저장하지 않습니다.');});
$('backgroundRun').addEventListener('click',async()=>{
 if(!selectedFile)return;let size;try{size=dimensions();}catch(e){message(e.message,true);return;}
 const file=selectedFile,token=invalidate(),request=new AbortController();controller=request;$('backgroundRun').disabled=true;$('backgroundCancel').disabled=false;message('원본과 배경 분리 근거를 확인하고 있습니다…');
 try{
  const {extractBackground}=await import('./background-extractor.mjs?v=background-extract-20261101');
  if(token!==generation)return;
  const output=await extractBackground(file,{...size,signal:request.signal,onProgress:progress=>{if(token===generation)message(typeof progress==='string'?progress:progress?.message||'배경을 확인하고 있습니다…');}});
  if(token!==generation){discardOutput(output);return;}
  if(!output||!['ready','review','unavailable'].includes(output.status)){discardOutput(output);throw Error('배경 처리 결과를 확인하지 못했습니다.');}
  if(validCanvas(output.originalCanvas)&&output.originalCanvas!==output.canvas){if(originalCanvas!==output.originalCanvas)clearCanvas(originalCanvas);originalCanvas=output.originalCanvas;showCanvas('originalHost',originalCanvas);}
  if(output.status==='unavailable'){discardOutput(output);message(output.reason||'배경을 분리할 근거가 부족합니다.',true);placeholder('backgroundHost','배경을 분리하지 못해 결과를 만들지 않았습니다.');return;}
  if(!validCanvas(output.canvas)||output.canvas.width!==size.width||output.canvas.height!==size.height||output.canvas===originalCanvas){discardOutput(output);throw Error('요청한 크기의 독립 배경 결과가 없어 저장을 중단했습니다.');}
  result=output;showCanvas('backgroundHost',output.canvas);
  if(validCanvas(output.foregroundCanvas)&&output.foregroundCanvas!==output.canvas&&output.foregroundCanvas!==originalCanvas){foregroundCanvas=output.foregroundCanvas;showCanvas('foregroundHost',foregroundCanvas);$('foregroundDetails').hidden=false;}
  const warnings=(Array.isArray(output.warnings)?output.warnings:[]).filter(v=>typeof v==='string');if(output.status==='review')warnings.unshift(output.backgroundEvidence?.input==='pptx'?'독립 배경 후보로 구성한 결과입니다. 배경 용도와 반복 이음선, 글씨·상품 흔적을 검토하세요.':'추정해 재구성한 배경입니다. 이음선과 글씨·상품 흔적을 확인하세요. 가려진 실제 원본 배경을 복원했다는 뜻은 아닙니다.');
  $('backgroundWarning').textContent=warnings.join(' ');$('backgroundWarning').hidden=!warnings.length;$('backgroundSize').textContent=`${size.width} × ${size.height}px · 배경만 출력`;message(output.reason||'배경 결과를 만들었습니다. 원본과 비교해 주세요.');$('backgroundDownload').textContent=output.status==='review'?'검토용 배경 PNG 저장':'배경 PNG 저장';$('backgroundDownload').disabled=false;
 }catch(error){if(token===generation)message(error.name==='AbortError'?'중지했습니다.':error.message||'배경 처리 중 오류가 발생했습니다.',error.name!=='AbortError');}
 finally{if(token===generation){controller=null;$('backgroundRun').disabled=!selectedFile;$('backgroundCancel').disabled=true;}}
});
$('backgroundDownload').addEventListener('click',()=>{const output=result,token=generation,file=selectedFile;if(!validCanvas(output?.canvas))return;$('backgroundDownload').disabled=true;try{output.canvas.toBlob(blob=>{if(token!==generation||output!==result)return;$('backgroundDownload').disabled=false;if(!blob){message('PNG 저장에 실패했습니다.',true);return;}const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(file.name.replace(/\.[^.]+$/,'')||'poster')+`-background-${output.canvas.width}x${output.canvas.height}.png`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);},'image/png');}catch{if(token===generation){$('backgroundDownload').disabled=false;message('PNG 저장에 실패했습니다.',true);}}});
window.addEventListener('pagehide',()=>{controller?.abort();for(const c of new Set([originalCanvas,result?.canvas,foregroundCanvas]))clearCanvas(c);});


