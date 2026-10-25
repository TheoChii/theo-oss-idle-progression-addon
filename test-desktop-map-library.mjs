import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {desktopEntries,desktopLibrary,desktopSets,desktopIndex,desktopJobCharts,desktopSnapshot} from './src/desktopMaps.js';
import {createChartCache} from './src/scanCache.js';
const encode=text=>new TextEncoder().encode(text);
const calls=[];
const library={
 async list(kind){calls.push(['list',kind]);return [
  {name:'42 Artist Song',info:{id:42,versions:[{id:401,mode:3,keys:4,file:'Folder/Alpha.OSU'},{id:402,mode:3,keys:4,file:'Beta.osu'}]},files:[{path:'folder/ALPHA.osu'},{path:'Beta.osu'},{path:'track.mp3'}]},
  {name:'43 Other',info:{id:43,versions:[{id:403,mode:3,keys:4,file:'song.osu'}]},files:[{path:'song.osu'}]},
  {name:'Bad folder',info:{artist:'N/A'},files:[]}
 ];},
 async read(kind,name,path){calls.push(['read',kind,name,path]);assert.equal(kind,'maps');return encode(path.includes('ALPHA')?'alpha':'beta');}
};
globalThis.window={ossIdleDesktop:{library}};
assert.equal(desktopLibrary(),library);
const metas=await desktopSets();
assert.equal(metas.length,2);
const index=await desktopIndex();
assert.equal(index.size,2);
const charts=await desktopJobCharts(library,index,42,[{beatmapId:401},{beatmapId:402}]);
assert.deepEqual(charts,{401:'alpha',402:'beta'});
assert.equal(calls.filter(x=>x[0]==='read').length,2,'read selected chart files only');
assert(!calls.some(x=>x[3]?.endsWith('track.mp3')),'no audio or unrelated maps loaded');
const cache=createChartCache(1024);
const before=calls.filter(x=>x[0]==='read').length;
await desktopJobCharts(library,index,42,[{beatmapId:401},{beatmapId:402}],cache);
await desktopJobCharts(library,index,42,[{beatmapId:401},{beatmapId:402}],cache);
assert.equal(calls.filter(x=>x[0]==='read').length,before+2,'repeat refinement avoids duplicate desktop IPC reads');
assert.equal(cache.stats.hits,2,'two charts reused for three-run refinement');
assert.equal((await desktopSnapshot(library)).sets.length,2,'one snapshot supplies both folder metadata and index');
const noChart=await desktopJobCharts(library,index,42,[{beatmapId:499}]);
assert.deepEqual(noChart,{},'missing difficulty is handled by worker');
globalThis.window={};
assert.equal(desktopLibrary(),null);
assert.equal(await desktopSets(),null,'browser retains IndexedDB fallback');
const [client,worker,protocol]=await Promise.all(['src/engine/client.ts','src/engine/sim.worker.ts','src/engine/protocol.ts'].map(f=>readFile(f,'utf8')));
assert(client.includes('desktop ? await desktopSnapshot(desktop) : null'));
assert(client.includes('await desktopJobCharts(desktop,folderIndex,job.setId,job.maps,chartCache,ioLimiter)'));
assert(worker.includes('job.charts ?? await beatmapStore.charts(setId)'));
assert(protocol.includes('charts?: Record<number,string>'));
console.log('PASS: desktop v1.2.5 map folders, per-job .osu transfer, no media loads, browser IndexedDB fallback');
