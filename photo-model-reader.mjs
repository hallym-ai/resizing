const hex=buffer=>[...new Uint8Array(buffer)].map(v=>v.toString(16).padStart(2,'0')).join('');
export async function checkModelPart(bytes,part){
 const digest=hex(await crypto.subtle.digest('SHA-256',bytes));
 if(bytes.byteLength===part.bytes&&digest===part.sha256)return 'transport';
 // Some static hosts automatically decode HTTP Content-Encoding: gzip.
 if(part.rawBytes&&bytes.byteLength===part.rawBytes&&digest===part.rawSha256)return 'raw';
 return null;
}
export async function decodeModelPart(bytes,part,kind){
 if(!kind)throw Error('사진 모델 무결성을 확인하지 못했습니다.');
 if(part.compression!=='gzip'||kind==='raw')return bytes;
 if(!globalThis.DecompressionStream)throw Error('이 브라우저는 사진 모델 압축 해제를 지원하지 않습니다.');
 const output=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
 if(output.byteLength!==part.rawBytes||hex(await crypto.subtle.digest('SHA-256',output))!==part.rawSha256)throw Error('압축 해제한 사진 모델 무결성을 확인하지 못했습니다.');
 return output;
}
