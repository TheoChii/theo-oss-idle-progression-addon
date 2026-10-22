import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

// Minimal test DOM. Verifies the module mount contract and real keydown events.
const addons = [];
const win = new EventTarget();
globalThis.window = win;
globalThis.localStorage = { getItem:()=>null, setItem:()=>{} };
const content = {innerHTML:''};
const tabs = new Map();
const fakeShadow = () => ({
  innerHTML:'',
  addEventListener(){},
  removeEventListener(){},
  querySelector(selector) {
    if(selector==='#contents')return content;
    if(!tabs.has(selector))tabs.set(selector,{classList:{add(){},toggle(){}}});
    return tabs.get(selector);
  },
  querySelectorAll(){return []}
});
globalThis.document = {
  getElementById(id){return addons.find(a=>a.id===id)||null;},
  createElement(){return {
    id:'',shadowRoot:null,
    classList:{
      flags:new Set(),
      add(name){this.flags.add(name);},
      contains(name){return this.flags.has(name);},
      remove(name){this.flags.delete(name);},
      toggle(name){const newState=!this.flags.has(name);if(newState)this.flags.add(name);else this.flags.delete(name);return newState;}
    },
    attachShadow(){this.shadowRoot=fakeShadow();return this.shadowRoot;},
    remove(){const i=addons.indexOf(this);if(i!==-1)addons.splice(i,1);}
  };},
  body:{appendChild(element){addons.push(element);}}
};
function keyboard({ctrlKey=false,shiftKey=false,altKey=false,metaKey=false,code='',key='',repeat=false}={}){
  const e=new Event('keydown',{cancelable:true});
  Object.assign(e,{ctrlKey,shiftKey,altKey,metaKey,code,key,repeat});
  win.dispatchEvent(e);
  return e;
}
const contentJS=await fs.readFile(new URL('./progression-toolkit.addon.js',import.meta.url),'utf8');
const mod=await import('data:text/javascript;base64,'+Buffer.from(contentJS).toString('base64'));
assert.equal(typeof mod.mount,'function'); assert.equal(typeof mod.unmount,'function');
mod.mount();
assert.equal(addons.length,1);
assert(!addons[0].shadowRoot.innerHTML.includes('class="launch"'),'Old launcher must be gone');
assert(addons[0].shadowRoot.innerHTML.includes('z-index:50000'),'Overlay must stay below game cursor');
assert(addons[0].shadowRoot.innerHTML.includes(':host(.open) .panel{display:flex}'),'Open state MUST use valid Shadow DOM CSS');
assert(!addons[0].shadowRoot.innerHTML.includes(':host.open .panel'),'Reject invalid selector that kept panel invisible');
assert(addons[0].shadowRoot.innerHTML.includes('transform:translate(-50%,-50%)'),'Overlay panel must be centered');
assert(addons[0].shadowRoot.innerHTML.includes('Ctrl+Shift+P'),'Hotkey hint should be shown');
assert(content.innerHTML.includes('All 11 skills'),'Improvement calculator rendered');
assert(content.innerHTML.includes('improveSkill'),'Skill selector rendered');
assert(content.innerHTML.includes('Speed')&&content.innerHTML.includes('Memory'),'All eleven skill names rendered');
assert(content.innerHTML.includes('Sustained NPS'),'Speed metrics rendered');
const wrapper=addons[0];
assert(!wrapper.classList.contains('open'));
keyboard({ctrlKey:true,shiftKey:true,key:'x',code:'KeyX'});
assert(!wrapper.classList.contains('open'),'Unrelated shortcut must do nothing');
const open=keyboard({ctrlKey:true,shiftKey:true,key:'P',code:'KeyP'});
assert(wrapper.classList.contains('open'),'Ctrl+Shift+P opens');
assert(open.defaultPrevented,'Shortcut is intercepted before game');
keyboard({ctrlKey:true,shiftKey:true,key:'P',code:'KeyP',repeat:true});
assert(wrapper.classList.contains('open'),'Key repeat does not repeatedly toggle');
keyboard({ctrlKey:true,shiftKey:true,key:'p',code:'KeyP'});
assert(!wrapper.classList.contains('open'),'Ctrl+Shift+P closes');
keyboard({ctrlKey:true,shiftKey:true,key:'p',code:'KeyP'});
assert(wrapper.classList.contains('open'));
keyboard({key:'Escape',code:'Escape'});
assert(!wrapper.classList.contains('open'),'Escape closes');
keyboard({ctrlKey:true,shiftKey:true,altKey:true,key:'P',code:'KeyP'});
assert(!wrapper.classList.contains('open'),'Alt must not open');
mod.unmount();
assert.equal(addons.length,0);
keyboard({ctrlKey:true,shiftKey:true,key:'P',code:'KeyP'});
assert.equal(addons.length,0,'Shortcut removed after unmount');
mod.mount(); assert.equal(addons.length,1);
mod.unmount(); assert.equal(addons.length,0);
console.log('PASS: mount, panel rendered, shortcut open/close, key repeat, Esc, modifiers, unmount and remount');
