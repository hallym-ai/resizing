// Scratch prototype. Stores long ASCII base64 data URLs once across scene
// snapshots. It never parses or executes URLs and exactly reconstructs JSON.
const encoder = new TextEncoder(), decoder = new TextDecoder('utf-8',{fatal:true});
const base64=c=>(c>=65&&c<=90)||(c>=97&&c<=122)||(c>=48&&c<=57)||c===43||c===47||c===61;
function findAssets(s){const found=[];let at=0;while(at<s.length){const start=s.indexOf('data:',at);if(start<0)break;const offset=s.slice(start+5,start+133).indexOf(';base64,');if(offset<0){at=start+5;continue;}const marker=start+5+offset,media=s.slice(start+5,marker);if(!/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(media)){at=start+5;continue;}const body=marker+8;let end=body;while(end<s.length&&base64(s.charCodeAt(end)))end++;if(end-body>=1024){found.push({start,end});if(found.length>512)return [];}at=Math.max(end,start+5);}return found;}
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return (h>>>0)+':'+s.length;}
// Avoid V8 retaining an entire multi-megabyte input buffer via a substring.
function copy(s){return JSON.parse(JSON.stringify(s));}
export class HistoryStore {
 constructor({maxEntries=20,maxBytes=48*1024*1024}={}){this.maxEntries=maxEntries;this.maxBytes=maxBytes;this.entries=[];this.cursor=-1;this.pool=new Map();this.bytes=0;}
 clear(){this.entries=[];this.cursor=-1;this.pool.clear();this.bytes=0;}
 _asset(s){const key=hash(s),bucket=this.pool.get(key)||[];for(const v of bucket){if(v.bytes.length!==s.length)continue;let equal=true;for(let i=0;i<s.length;i++)if(v.bytes[i]!==s.charCodeAt(i)){equal=false;break;}if(equal){v.refs++;return v;}}
  const v={key,bytes:encoder.encode(s),refs:1};bucket.push(v);this.pool.set(key,bucket);this.bytes+=v.bytes.length+64;return v;}
 _releaseAsset(p){p.refs--;if(!p.refs){const b=this.pool.get(p.key),i=b.indexOf(p);b.splice(i,1);if(!b.length)this.pool.delete(p.key);this.bytes-=p.bytes.length+64;}}
 _release(e){this.bytes-=e.localBytes;for(const p of e.parts)if(typeof p!=='string')this._releaseAsset(p);}
 _encode(s){const matches=findAssets(s);
  const parts=[];let pos=0,local=128;try{for(const x of matches){const prefix=copy(s.slice(pos,x.start));parts.push(prefix,this._asset(s.slice(x.start,x.end)));local+=prefix.length*2+32;pos=x.end;}
  const tail=copy(s.slice(pos));parts.push(tail);local+=tail.length*2+16;const fingerprint=hash(s);this.bytes+=local;return {parts,localBytes:local,fingerprint};}catch(err){for(const p of parts)if(typeof p!=='string')this._releaseAsset(p);throw err;}}
 read(i=this.cursor){const e=this.entries[i];if(!e)throw new RangeError('history entry unavailable');return e.parts.map(p=>typeof p==='string'?p:decoder.decode(p.bytes)).join('');}
 push(s){if(typeof s!=='string')throw new TypeError('history must be serialized text');const current=this.entries[this.cursor];if(current&&current.fingerprint===hash(s)&&this.read()===s)return false;
  const e=this._encode(s);while(this.entries.length>this.cursor+1)this._release(this.entries.pop());this.entries.push(e);while(this.entries.length>1&&(this.entries.length>this.maxEntries||this.bytes>this.maxBytes))this._release(this.entries.shift());this.cursor=this.entries.length-1;return true;}
 canUndo(){return this.cursor>0;} canRedo(){return this.cursor>=0&&this.cursor<this.entries.length-1;}
 // Advance only after the caller has successfully restored the scene.
 peek(delta){const i=this.cursor+delta;if(!Number.isInteger(delta)||i<0||i>=this.entries.length)throw new RangeError('history target unavailable');return {index:i,json:this.read(i)};}
 commit(index){if(!Number.isInteger(index)||index<0||index>=this.entries.length)throw new RangeError('history target unavailable');this.cursor=index;}
 stats(){let assets=0;for(const b of this.pool.values())assets+=b.length;return{entries:this.entries.length,cursor:this.cursor,assets,bytes:this.bytes};}
}
