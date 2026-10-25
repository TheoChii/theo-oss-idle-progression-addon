import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=(await readFile('src/smartFarm.js','utf8')).replace(/^import .*;\n/gm,'');
const sockets=[],sent=[];
const timers=new Map();let nextTimer=0;
const oldST=globalThis.setTimeout,oldCT=globalThis.clearTimeout;
globalThis.setTimeout=(fn,delay)=>{const n=++nextTimer;timers.set(n,{fn,delay});return n};
globalThis.clearTimeout=id=>timers.delete(id);
const advance=(delay)=>{const e=[...timers].find(([id,t])=>t.delay===delay);assert(e,'missing timer '+delay);timers.delete(e[0]);e[1].fn();};
globalThis.localStorage={getItem:()=>null,setItem:()=>{}};
globalThis.window={ossIdleDesktop:{getToken:()=>null}};
globalThis.WebSocket=class{
 static OPEN=1;
 constructor(url){this.url=url;this.readyState=1;sockets.push(this);}
 send(text){sent.push(JSON.parse(text));}
 close(){if(this.readyState===3)return;this.readyState=3;this.onclose?.({code:1006});}
};
try {
const mod=await import('data:text/javascript;base64,'+Buffer.from(
"const FARM_SKILLS=[];const MAX_TIERS=30,MAX_OD=1000000;const makePolicies=()=>({});\n"+source).toString('base64'));
const instance=()=>{const f=new mod.SmartFarm();f.root={};f.character={id:17,local:false};f.lastCharacterId=17;f.plan={mod:'NM',rotation:[{beatmapId:12,rate:1.5}]};f.consent=true;return f;};
const state=(ws,label='Theo Smart Farm (managed)')=>ws.onmessage({data:JSON.stringify({type:'queue:state',state:{label,paused:false,prefs:{mode:'PLAYLIST',mods:[]}}})});
const character=(ws,id=17)=>ws.onmessage({data:JSON.stringify({type:'character',character:{id}})});
const first=instance();await first.startLive();const ws=sockets.at(-1);
character(ws);state(ws,'User playlist');
assert.equal(first.awaitingAck,true);
assert.equal(first.managedAck,false);
assert(first.wantLive&&first.live);
state(ws);assert(first.managedAck&&first.wantLive);
const sentBeforeDrop=sent.filter(x=>x.type==='queue:set').length;
ws.close();assert(first.reconnecting&&first.live&&first.wantLive);
assert(first.message.includes('Reconnecting'));
advance(2000);const ws2=sockets.at(-1);assert.notEqual(ws,ws2);
character(ws2);state(ws2);
assert(first.wantLive&&first.live&&first.managedAck&&!first.reconnecting);
assert.equal(sent.filter(x=>x.type==='queue:set').length,sentBeforeDrop,'resume must not replace server queue again');
state(ws2,'Changed from game');
assert(!first.wantLive&&!first.live,'external queue changes stop optimizer');
const sentBefore=sent.length;ws2.close();assert.equal(sent.length,sentBefore,'stop must not write to other queue');
assert(![...timers.values()].some(x=>[2000,4000,8000,16000,30000].includes(x.delay)),'no retries after takeover');

const hold=instance();await hold.startLive();const hws=sockets.at(-1);character(hws);state(hws,'Other');
assert(!hold.managedAck);
advance(12000); // first listed startup handshake timeout may still be present from prior socket
// Execute all pending 12 sec timers, then verify whichever belongs to current holder.
for(const [id,t] of [...timers])if(t.delay===12000){timers.delete(id);t.fn();}
assert(!hold.wantLive,'unacknowledged ownership must not auto-reclaim after timeout');
assert(!sent.some(x=>x.type==='queue:pause'),'no pause sent for unidentified queue');

const stop=instance();await stop.startLive();const sws=sockets.at(-1);
character(sws);state(sws,'Previous');state(sws);
sws.close();assert(stop.reconnecting);const numS=sockets.length;
const cleared=stop.stopLive(true);assert(!cleared,'offline Stop cannot confirm server queue clearance');
advanceNoopCheck();
function advanceNoopCheck(){assert(![...timers.values()].some(x=>[2000,4000,8000,16000,30000].includes(x.delay)));}
assert.equal(sockets.length,numS,'explicit Stop cancels reconnect');
const firstMismatch=instance();await firstMismatch.startLive();const aws=sockets.at(-1);
character(aws,18);assert(!firstMismatch.wantLive);
const exhausted=instance();await exhausted.startLive();
let retrySocket=sockets.at(-1);
for(const delay of [2000,4000,8000,16000,30000]){
 retrySocket.close();
 assert(exhausted.wantLive&&exhausted.reconnecting);
 advance(delay);
 retrySocket=sockets.at(-1);
}
retrySocket.close();
assert(!exhausted.wantLive&&!exhausted.live,'five failed reconnects disarm the manager');
assert(exhausted.error.includes('5 retries'));
const reloaded=new mod.SmartFarm();
assert(!reloaded.wantLive&&!reloaded.live,'new instance cannot auto-arm queue');
console.log('PASS: managed queue ACK race, transient reconnect without overwrite, external takeover, no blind re-claim, manual stop and character validation');
}finally{globalThis.setTimeout=oldST;globalThis.clearTimeout=oldCT;}
