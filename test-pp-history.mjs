import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizeBestPP} from './src/ppFarm.js';
const raw=await readFile('src/ppHistory.js','utf8');
const source=raw.replace("import {gameDb} from '@oss-idle/addon-sdk';",'const gameDb=globalThis.__ppHistoryDb;')
 .replace("import {normalizeBestPP} from './ppFarm.js';",'const normalizeBestPP=globalThis.__ppNormalizeBest;');
globalThis.__ppNormalizeBest=normalizeBestPP;
let dbCalls=0,apiCalls=[];
globalThis.__ppHistoryDb={ready:async()=>{},select:async(sql,args)=>{dbCalls++;assert(sql.includes('onlineId > 0'));assert.equal(args[0],42);return [{beatmapId:1,pp:180},{beatmapId:3,pp:70}]}};
globalThis.fetch=async(url,opts)=>{
 apiCalls.push({url,opts});
 const page=Number(url.split('/').at(-1));
 return {ok:true,json:async()=>page===1?
   {items:[{best_pp:{beatmapId:1,pp:'150'}},{best_pp:{beatmapId:2,pp:'200'}}],hasMore:true}:
   {items:[{best_pp:{beatmapId:4,pp:40}}],hasMore:false}};
};
const mod=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const r=await mod.readBestPP(42);
assert.equal(r.fetched,true);
assert.equal(r.best.get(1),180,'better local registered score beats stale server top');
assert.equal(r.best.get(2),200);
assert.equal(r.best.get(3),70);
assert.equal(r.best.get(4),40);
assert.equal(apiCalls.length,2);
assert(apiCalls.every(x=>x.opts.credentials==='omit'),'server PP lookup is public read-only without credentials');
assert.equal(dbCalls,1);
globalThis.fetch=async()=>({ok:false,status:404});
const local=await mod.readBestPP(42);
assert.equal(local.fetched,false);
assert.equal(local.best.size,2,'fallback to valid local PP scores if server fails');
assert(local.source.includes('local'));
console.log('PASS: server top-PP pages, personal best merge, public read-only access, and local-history fallback');
