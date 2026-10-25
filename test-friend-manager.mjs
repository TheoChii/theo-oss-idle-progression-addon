import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile(new URL('./progression-toolkit.addon.js',import.meta.url),'utf8');
assert(source.includes('v0.5.3'));
const mod=await import('data:text/javascript;base64,'+Buffer.from(source+'\nexport {friendState,friendPause,friendId,FRIEND_DELAY_MS,FRIEND_QUEUE_LIMIT};').toString('base64'));
const {friendState,friendPause,friendId,FRIEND_DELAY_MS,FRIEND_QUEUE_LIMIT}=mod;
assert.equal(friendId('5'),5);
assert.equal(friendId('garbage'),null);
assert.equal(FRIEND_DELAY_MS,6500);
assert.equal(FRIEND_QUEUE_LIMIT,100);
const handlers={},content={innerHTML:''},panels=[];
globalThis.localStorage={getItem:()=>null,setItem:()=>{}};
globalThis.window=new EventTarget();
globalThis.document={getElementById:()=>null,
 createElement:()=>({id:'',dataset:{},shadowRoot:null,classList:{contains(){return false},toggle(){},remove(){},add(){}},
 attachShadow(){this.shadowRoot={innerHTML:'',addEventListener(name,fn){handlers[name]=fn},querySelector(selector){return selector==='#contents'?content:{classList:{add(){},toggle(){}}}},querySelectorAll(){return []}};return this.shadowRoot;},remove(){} }),
 body:{appendChild(panel){panels.push(panel)}}};
const requests=[];
const followers=[{userId:4,name:'Previous friend'}];
const missingUsers=new Set([999]);
let putError=null;
globalThis.fetch=async(url,opts={})=>{
 requests.push({url,opts});
 const path=new URL(url).pathname;
 if(path==='/v1/auth/me')return {ok:true,json:async()=>({id:2})};
 if(path==='/v1/social/friends'&&opts.method!=='PUT')return {ok:true,json:async()=>followers};
 if(path==='/v1/social/relation/2')return {ok:true,json:async()=>({followers:25})};
 if(path==='/v1/characters/search')return {ok:true,json:async()=>[
  {userId:2,character:{name:'Me'}},
  {userId:4,character:{name:'Existing'}},
  {userId:5,character:{name:'Alice <test>'}},
  {userId:6,character:{name:'Bob'}}]};
 if(/^\/v1\/characters\/\d+$/.test(path)){
  const id=Number(path.split('/').at(-1));
  if(id===999)return {ok:false,status:404,json:async()=>({message:'Character not found'})};
  return {ok:true,json:async()=>({id,userId:id===9?8:id,name:'Profile #'+id})};
 }
 if(/^\/v1\/users\/\d+$/.test(path)){
  const id=Number(path.split('/').at(-1));
  if(missingUsers.has(id))return {ok:false,status:404,json:async()=>({message:'User not found'})};
  return {ok:true,json:async()=>({id,username:'Account '+id})};
 }
 if(path.startsWith('/v1/social/friends/')&&opts.method==='PUT') {
  if(putError)return {ok:false,status:429,json:async()=>({error:putError})};
  return {ok:true,json:async()=>({mutual:false})};
 }
 throw Error('Unexpected request '+url+' '+opts.method);
};
const realSetTimeout=globalThis.setTimeout,realClearTimeout=globalThis.clearTimeout,realNow=Date.now;
let simulatedNow=100000;Date.now=()=>simulatedNow;
const waiting=[];
globalThis.setTimeout=(fn,ms)=>{const i=waiting.length;waiting.push({fn,ms,active:true});return i+1;};
globalThis.clearTimeout=i=>{if(waiting[i-1])waiting[i-1].active=false;};
const tick=()=>{const w=waiting.find(w=>w.active);if(w){w.active=false;simulatedNow+=w.ms;w.fn();}};
const settle=async()=>{for(let i=0;i<24;i++)await Promise.resolve();};
const clickSection=name=>handlers.click({target:{closest(){return{classList:{contains(){return false}},dataset:{section:name}}}},stopPropagation(){}});
const clickAction=action=>handlers.click({target:{closest(){return{classList:{contains(){return false}},dataset:{friendAction:action}}}},stopPropagation(){}});
const input=(which,value)=>handlers.input({target:{dataset:{friendInput:which},value},stopPropagation(){}});
const checkPlayer=(id,checked)=>handlers.change({target:{dataset:{friendPick:String(id)},checked,hasAttribute:()=>false},stopPropagation(){}});
const approve=checked=>handlers.change({target:{dataset:{},checked,hasAttribute:name=>name==='data-friend-approve'},stopPropagation(){}});
const putCalls=()=>requests.filter(x=>x.opts.method==='PUT');
mod.mount();
clickSection('Friends');
assert(content.innerHTML.includes('Friend Manager'));
assert.equal(requests.length,0,'no requests before explicit actions');
clickAction('refresh');await settle();
assert(friendState.ready,'signed in');
assert.equal(friendState.accountId,2);
assert.equal(friendState.followers,25);
assert(content.innerHTML.includes('100'));
input('search','ali');
clickAction('search');await settle();
assert.equal(friendState.results.length,3);
assert(!friendState.results.some(x=>x.id===2));
assert(content.innerHTML.includes('Alice &lt;test&gt;'),'escape player names');
checkPlayer(4,true);checkPlayer(5,true);checkPlayer(6,true);
clickAction('queue-selected');
assert.deepEqual(friendState.queue.map(x=>x.id),[5,6],'exclude already followed');
input('ids','6, 7, 7, 2');
clickAction('queue-ids');await settle();
assert.deepEqual(friendState.queue.map(x=>x.id),[5,6,7],'deduplicate and exclude self');
clickAction('start');await settle();
assert.equal(putCalls().length,0,'no account writes before user approval');
approve(true);
clickAction('start');await settle();
assert.equal(putCalls().length,1);
assert(putCalls()[0].url.endsWith('/friends/5'));
assert.equal(putCalls()[0].opts.credentials,'include');
assert.equal(waiting[0].ms,6500);
await settle();
assert.equal(putCalls().length,1,'must wait at least 6500 ms');
tick();await settle();
assert.equal(putCalls().length,2);
assert(putCalls()[1].url.endsWith('/friends/6'));
clickAction('pause');await settle();
assert.equal(friendState.running,false);
tick();await settle();
assert.equal(putCalls().length,2,'paused queue must not make more writes');
assert.deepEqual(friendState.queue.map(x=>x.id),[7]);
approve(true);
putError='Too many requests';
clickAction('start');await settle();
assert.equal(putCalls().length,2,'quick restart must not exceed the rate limit');
assert(waiting.at(-1).ms===6500);
tick();await settle();
assert.equal(putCalls().length,3);
assert.equal(friendState.running,false,'rate limit should stop');
assert(friendState.error.includes('Rate limit reached'));
assert(friendState.queue.length===1,'failed target must remain queued');
putError=null;
approve(true);
clickAction('start');await settle();
assert.equal(putCalls().length,3,'even an errored PUT holds the cooldown');
tick();await settle();
assert.equal(putCalls().length,4);
assert.equal(friendState.queue.length,0);
assert.equal(friendState.sent,3);
assert.equal(friendState.running,false);
// Profile URLs resolve to the owning ACCOUNT, not the character ID.
input('ids','https://oss.idle.rhythmgamers.net/web/c/9 999');
clickAction('queue-ids');await settle();
assert.deepEqual(friendState.queue.map(x=>x.id),[8]);
assert(friendState.error.includes('Character not found'),'bad profile link is rejected');
assert(!putCalls().some(x=>x.url.endsWith('/friends/9')),'never add profile ID as account ID');
// Explicit account-ID mode does NOT rewrite valid account numbers.
handlers.change({target:{dataset:{},value:'account',hasAttribute:key=>key==='data-friend-id-type'},stopPropagation(){}});
input('ids','17, 999');
clickAction('queue-ids');await settle();
assert.deepEqual(friendState.queue.map(x=>x.id),[8,17]);
assert(friendState.error.includes('User not found'),'invalid account must be rejected before queueing');
// If a queued user disappears between lookup and approval, skip them without a PUT.
missingUsers.add(8);
approve(true);clickAction('start');await settle();
// Existing cooldown still applies before validating the next queued account.
tick();await settle();
assert.equal(friendState.skipped,1);
assert(!putCalls().some(x=>x.url.endsWith('/friends/8')),'invalid account skipped before PUT');
assert(friendState.queue.length===0);
assert(putCalls().some(x=>x.url.endsWith('/friends/17')),'later valid accounts still processed');
mod.unmount();
assert.equal(friendState.ready,false);
globalThis.setTimeout=realSetTimeout;
globalThis.clearTimeout=realClearTimeout;
Date.now=realNow;
console.log('PASS: character-to-account resolution, preflight 404 skip, name search, auth, pacing, pause, 429 stop, no messaging and cleanup');
