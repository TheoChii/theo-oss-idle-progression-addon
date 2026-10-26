import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const raw=await readFile('src/smartFarm.js','utf8');
// Isolate the queue transport class without starting the heavy worker.
const safety=(await readFile('src/farm/safety.js','utf8')).replace(/^export /gm,'');
const source=safety+raw.replace(/^import .*;\n/gm,'');
assert(!source.startsWith('import '));
const sockets=[];const sent=[];
globalThis.localStorage={getItem(){return null},setItem(){}};
globalThis.window={ossIdleDesktop:{getToken:()=>null}};
globalThis.WebSocket=class {
 static OPEN=1;
 constructor(url){this.url=url;this.readyState=1;sockets.push(this);}
 send(v){sent.push(JSON.parse(v));}
 close(){this.readyState=3;this.onclose?.();}
};
const oldSetTimeout=globalThis.setTimeout;
globalThis.setTimeout=()=>777;
try{
 const mod=await import('data:text/javascript;base64,'+Buffer.from('const FARM_SKILLS=[];const MAX_TIERS=30,MAX_OD=1000000;const makePolicies=(keys)=>Object.fromEntries(keys.map(k=>[k,{enabled:false,targets:Array(30).fill(0)}]));\n'+source).toString('base64'));
 const f=new mod.SmartFarm();
 f.root={};f.character={id:12,local:false};f.lastCharacterId=12;
 f.safetyReady=true;f.results=[{beatmapId:1,rate:1.5,mod:'HR',failRate:0,isRefined:true},{beatmapId:2,rate:1,mod:'HR',failRate:0,isRefined:true}];f.plan={mod:'HR',rotation:[...f.results]};
 await assert.rejects(()=>f.startLive(),/Review the queue and check the confirmation/);
 assert.equal(sockets.length,0,'no queue connection without confirmation');
 // When called directly, the UI requires a confirmation first.
 assert(!f.live);
 f.consent=true;await f.startLive();
 assert.equal(sockets.length,1);
 const ws=sockets[0];
 assert(ws.url.startsWith('wss://api.oss.idle.rhythmgamers.net/v1/ws'));
 assert.equal(sent.length,0,'no message before character and queue confirmation');
 ws.onmessage({data:JSON.stringify({type:'character',character:{id:12}})});
 assert.equal(sent.length,0);
 ws.onmessage({data:JSON.stringify({type:'queue:state',state:{label:'Existing game queue',paused:true,prefs:{mode:'DISABLED',mods:['SD']}}})});
 assert(f.live);
 const msg=sent.find(x=>x.type==='queue:set');
 assert.equal(msg.source.label,'Theo Smart Farm (managed)');
 assert.deepEqual(msg.entries,[{beatmapId:1,rate:1.5},{beatmapId:2,rate:1}]);
 assert(sent.some(x=>x.type==='queue:prefs'&&x.prefs.mode==='PLAYLIST'&&JSON.stringify(x.prefs.mods)===JSON.stringify(['HR'])),'first start applies HR globally');
 assert(sent.some(x=>x.type==='queue:start'));
 // New rankings must replace, not append, the managed queue.
 ws.onmessage({data:JSON.stringify({type:'queue:state',state:{label:'Theo Smart Farm (managed)',paused:false,prefs:{mode:'PLAYLIST',mods:['HR']}}})});
 f.lastChange=0;f.results=[{beatmapId:3,rate:2,mod:'NM',failRate:0,isRefined:true}];f.plan={mod:'NM',rotation:[...f.results]};
 await f.publish();
 assert.deepEqual(sent.filter(x=>x.type==='queue:set').at(-1).entries,[{beatmapId:3,rate:2}]);
 assert(sent.filter(x=>x.type==='queue:start').length>=2,'idle re-queue is rescheduled');
 assert(sent.some(x=>x.type==='queue:prefs'&&JSON.stringify(x.prefs.mods)===JSON.stringify([])),'new rotation switches to No Mod globally');
 ws.onmessage({data:JSON.stringify({type:'queue:state',state:{label:'Theo Smart Farm (managed)',paused:false,prefs:{mode:'PLAYLIST',mods:[]}}})});
 const beforeRepeat=sent.length;f.lastChange=0;await f.publish();assert.equal(sent.length,beforeRepeat,'same song and mod queue does not resend');
 // If the game changes mods while the optimizer is explicitly active, restore its selected global mode.
 ws.onmessage({data:JSON.stringify({type:'queue:state',state:{label:'Theo Smart Farm (managed)',paused:false,prefs:{mode:'PLAYLIST',mods:['SD']}}})});
 f.lastChange=0;await f.publish();
 assert.deepEqual(sent.at(-1),{type:'queue:prefs',prefs:{mods:[]}},'restore global mods when a game setting drifts');
 f.stopLive(true);
 assert(sent.some(x=>x.type==='queue:pause'&&x.paused));
 assert.deepEqual(sent.filter(x=>x.type==='queue:set').at(-1).entries,[]);
 assert(sent.some(x=>x.type==='queue:prefs'&&x.prefs.mode==='DISABLED'&&JSON.stringify(x.prefs.mods)===JSON.stringify(['SD'])),'restore prior autopilot mode and global mods');
 assert.equal(f.live,false);
 const mismatch=new mod.SmartFarm();mismatch.root={};mismatch.character={id:14,local:false};mismatch.safetyReady=true;mismatch.results=[{beatmapId:1,rate:1,mod:'NM',failRate:0,isRefined:true}];mismatch.plan={mod:'NM',rotation:[...mismatch.results]};mismatch.consent=true;
 await mismatch.startLive();
 const other=sockets.at(-1);
 other.onmessage({data:JSON.stringify({type:'character',character:{id:15}})});
 assert(!mismatch.live,'wrong character must disable queue');
 assert(!sent.some(x=>x.source?.label==='Theo Smart Farm (managed)'&&x.entries?.some(y=>y.beatmapId===14)));
 console.log('PASS: explicit consent, identity, HR/NM global mod writes, queue switching, cooldown, stop and original mod restore');
}finally{globalThis.setTimeout=oldSetTimeout;}
