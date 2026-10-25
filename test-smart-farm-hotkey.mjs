import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const raw=await readFile(new URL('./src/smartFarm.js',import.meta.url),'utf8');
assert(!raw.includes('id="farm-open"'),'floating Smart Farm launcher must be removed');
assert(!raw.includes('.fab{'),'launcher CSS must be removed');
assert(!raw.includes("if(cmd==='farm-open')"),'dead launcher action must be removed');
const source=raw.replace(/^import .*;\n/gm,'');
assert(!source.startsWith('import '));
const panels=[],win=new EventTarget();
globalThis.window=win;
globalThis.localStorage={getItem:()=>null,setItem(){}};
globalThis.document={
 createElement:()=>({
  dataset:{},style:{},remove(){const i=panels.indexOf(this);if(i!==-1)panels.splice(i,1);},
  attachShadow(){
   const shadow={innerHTML:'',addEventListener(){},getElementById:id=>id==='farm-main'?{innerHTML:''}:null};
   this.shadowRoot=shadow;return shadow;
  }
 }),
 body:{append(x){panels.push(x)}}
};
const realInterval=globalThis.setInterval,realClear=globalThis.clearInterval;
globalThis.setInterval=()=>11;
globalThis.clearInterval=()=>{};
const key=(props={})=>{
 const e=new Event('keydown',{cancelable:true});
 Object.assign(e,{ctrlKey:false,shiftKey:false,altKey:false,metaKey:false,repeat:false,code:'',...props});
 win.dispatchEvent(e);return e;
};
try{
 const mod=await import('data:text/javascript;base64,'+Buffer.from('const FARM_SKILLS=[\'accuracy\'];const MAX_TIERS=30,MAX_OD=1000000;const makePolicies=(keys)=>Object.fromEntries(keys.map(k=>[k,{enabled:false,targets:Array(30).fill(0)}]));\n'+source).toString('base64'));
 const farm=new mod.SmartFarm();
 farm.mount();
 assert.equal(panels.length,1);
 assert(!panels[0].shadowRoot.innerHTML.includes('class="fab"'),'no clickable launcher');
 assert(panels[0].shadowRoot.innerHTML.includes('id="farm-close"'),'close icon remains');
 assert(raw.includes('id="farm-gpu-test"'),'GPU compatibility button is declared in Smart Farm panel');
 assert(raw.includes('data-setting="gpuAssist"'),'experimental hybrid checkbox is declared');
 assert.equal(panels[0].dataset.open,'false','closed and hidden on mount');
 key({ctrlKey:true,shiftKey:true,code:'KeyP'});
 assert.equal(panels[0].dataset.open,'false','calculator keybind does not toggle Smart Farm');
 const opened=key({ctrlKey:true,shiftKey:true,code:'KeyG'});
 assert.equal(panels[0].dataset.open,'true','Ctrl+Shift+G opens');
 assert.equal(opened.defaultPrevented,true,'shortcut prevents game action');
 key({ctrlKey:true,shiftKey:true,code:'KeyG',repeat:true});
 assert.equal(panels[0].dataset.open,'true','held shortcut does not toggle back');
 key({ctrlKey:true,shiftKey:true,code:'KeyG'});
 assert.equal(panels[0].dataset.open,'false','Ctrl+Shift+G closes');
 key({ctrlKey:true,shiftKey:true,altKey:true,code:'KeyG'});
 assert.equal(panels[0].dataset.open,'false','Alt shortcut does not match');
 key({ctrlKey:true,shiftKey:true,metaKey:true,code:'KeyG'});
 assert.equal(panels[0].dataset.open,'false','Meta shortcut does not match');
 key({ctrlKey:true,shiftKey:true,code:'KeyG'});
 assert.equal(panels[0].dataset.open,'true');
 key({code:'Escape'});
 assert.equal(panels[0].dataset.open,'false','Escape closes');
 key({ctrlKey:true,shiftKey:true,code:'KeyG'});
 await farm.action('farm-close');
 assert.equal(panels[0].dataset.open,'false','close button still works');
 farm.unmount();assert.equal(panels.length,0);
 key({ctrlKey:true,shiftKey:true,code:'KeyG'});
 assert.equal(panels.length,0,'shortcut removed after unmount');
 farm.mount();assert.equal(panels[0].dataset.open,'false');
 farm.unmount();assert.equal(panels.length,0);
 console.log('PASS: floating button removed, Ctrl+Shift+G toggle, repeat suppression, Esc, close icon, teardown and remount');
}finally{globalThis.setInterval=realInterval;globalThis.clearInterval=realClear;}
