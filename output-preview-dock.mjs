// Move existing controls/output nodes; no duplicate inputs, renderers or exports.
import './layers.mjs';
const by=id=>document.getElementById(id),editor=by('editor'),size=by('outputSizeControls'),result=by('previewImg')?.closest('.section'),dock=by('layerSizeDock'),work=by('layerWork');
if(editor&&size&&result){
 const outer=document.createElement('div');outer.id='outputPreviewWorkbench';
 const layout=by('layerStage')?.closest('.layer-layout');
 if(dock&&layout){const nativeHost=document.createElement('div');nativeHost.className='output-native-workbench';layout.before(nativeHost);nativeHost.append(dock);}
 const grid=document.createElement('div');grid.className='output-workbench-grid';
 const settings=document.createElement('div');settings.className='output-workbench-settings';
 outer.append(grid);grid.append(settings);editor.prepend(outer);
 result.classList.add('output-result-near-controls');
 const actions=by('downloadBtn')?.closest('.actions');if(actions)result.append(actions);
 const style=document.createElement('style');style.textContent=`
 #outputPreviewWorkbench{container-type:inline-size;padding:12px}
 #outputPreviewWorkbench[hidden]{display:none!important}
 .output-workbench-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:12px;align-items:start}
 .output-workbench-settings{min-width:0}
 .output-workbench-settings>#outputSizeControls{margin:0;padding:12px}
 .output-result-near-controls{min-width:0;margin:0!important;padding:12px!important;border:1px solid var(--border);border-radius:10px;background:var(--surface,#fff)}
 .output-result-near-controls .preview-wrap{margin:8px 0 0;padding:8px;min-height:160px}
 .output-result-near-controls #previewImg{max-height:min(42vh,360px);width:100%;object-fit:contain}
 .output-result-near-controls .actions{padding:12px 0 0;gap:8px;flex-wrap:wrap}
 .output-result-near-controls #editingBridge .sns-toolbar{gap:6px;flex-wrap:wrap}
 .output-native-workbench{container-type:inline-size;min-width:0;margin-bottom:12px}
 #layerSizeDock>#outputSizeControls{margin:0;padding:12px;border:1px solid var(--border);border-radius:10px;background:var(--surface,#fff)}
 #layerSizeDock .dims{flex-wrap:wrap}
 #layerSizeDock .dims .col{min-width:90px}
 #layerSizeDock{display:grid;grid-template-columns:minmax(0,1fr);gap:8px;align-items:start}
 #layerSizeDock>.output-result-near-controls{margin-top:0!important}
 @container (min-width:640px){
  .output-workbench-grid{grid-template-columns:minmax(230px,.8fr) minmax(0,1.2fr)}
  #layerSizeDock{grid-template-columns:minmax(230px,.8fr) minmax(0,1.2fr)}
  #layerSizeDock>#outputSizeControls,#layerSizeDock>.layer-help,#layerSizeDock>.layer-all-presets{grid-column:1}
  #layerSizeDock>.output-result-near-controls{grid-column:2;grid-row:1/span 3;position:sticky;top:12px}
 }
 `;document.head.append(style);
 let queued=false;
 function reconcile(){
  queued=false;
  const active=!!dock&&!!work&&!work.hidden&&dock.contains(size);
  if(active){outer.hidden=true;if(size.nextElementSibling!==result)size.after(result);}
  else{outer.hidden=false;if(size.parentNode!==settings)settings.append(size);if(result.parentNode!==grid)grid.append(result);}
 }
 function schedule(){if(queued)return;queued=true;queueMicrotask(reconcile);}
 const observer=new MutationObserver(schedule);
 // Watch only mounting points, not every edit/status mutation in the document.
 observer.observe(editor,{childList:true});observer.observe(settings,{childList:true});
 if(dock)observer.observe(dock,{childList:true});
 if(work)observer.observe(work,{attributes:true,attributeFilter:['hidden']});
 reconcile();
 window.addEventListener('pagehide',e=>{if(!e.persisted)observer.disconnect();});
}
