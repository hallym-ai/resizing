import {buildPosterLayers} from './poster-separation.mjs';
self.onmessage=({data})=>{try{const result=buildPosterLayers(new Uint8ClampedArray(data.pixels),data.width,data.height,data.regions),buffers=[result.background.buffer,...result.layers.map(l=>l.rgba.buffer)];self.postMessage(result,buffers);}catch(e){self.postMessage({error:e.message});}};
