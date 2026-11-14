import assert from 'node:assert/strict';
import {splitPhotoPixels} from './photo-separation-mask.mjs';
const source=new Uint8ClampedArray([40,50,60,255,100,110,120,200,50,30,10,128,200,40,10,0]);
const estimate=new Uint8ClampedArray([0,0,0,255,0,0,0,40,0,0,0,64,0,0,0,0]);
const {foreground,background,stats}=splitPhotoPixels(source,estimate,4,1);
assert.deepEqual(stats,{visible:3,front:2,back:1});
for(let i=0;i<source.length;i+=4){const pick=foreground[i+3]?foreground:background;assert.deepEqual([...pick.slice(i,i+4)],source[i+3]?[...source.slice(i,i+4)]:[0,0,0,0]);assert(!(foreground[i+3]&&background[i+3]),'source pixel assigned to only one layer');}
assert.throws(()=>splitPhotoPixels(source,estimate,5,1),/올바르지/);
assert.throws(()=>splitPhotoPixels(source,new Uint8ClampedArray(source.length),4,1),/구별하지/);
assert.throws(()=>splitPhotoPixels(source,source,4,1),/구별하지/);
console.log('pass: exact original pixel ownership, source alpha, invalid or empty masks');
