import {buildForegroundLayers} from './foreground-mask.mjs';
self.onmessage=({data})=>{try{const result=buildForegroundLayers(new Uint8ClampedArray(data.pixels),data.width,data.height,data.regions,data.background);self.postMessage(result,[result.background.buffer,...result.layers.map(layer=>layer.rgba.buffer)]);}catch(error){self.postMessage({error:error.message||'요소 배경을 분리하지 못했습니다.'});}};
