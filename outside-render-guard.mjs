import {hasTrustedOutsideReference} from './final-outside-overlay.mjs';

// Object-local geometry cannot establish a fixed original slide frame after
// JSON/history restores. Only the trusted canvas overlay may draw outer pixels.
export function installOutsideRenderGuard(o){
 if(o.__outsideRenderInstalled)return;
 o.__outsideBaseElement=o.getElement?.();o.__outsideBaseSource=o.getSrc?.();
 const render=o._render;
 o._render=function(ctx){
  const active=this.__outsideTrialVisible&&!globalThis.coexDisableOutsideTrial;
  const held=!!active&&!hasTrustedOutsideReference(this.canvas);
  if(held||!active){
   const changed=!!this.__outsideReview!==held||!!this.__outsideLegacy;
   this.__outsideReview=held;this.__outsideLegacy=false;
   if(changed)queueMicrotask(()=>window.dispatchEvent(new Event('coex:outside-recovery-change')));
  }
  // The trusted overlay independently validates each patch on every draw.
  // Never clear its per-candidate review result here when trust is present.
  render.call(this,ctx);
 };
 o.__outsideRenderInstalled=true;
}
