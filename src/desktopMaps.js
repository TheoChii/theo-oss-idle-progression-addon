/** Game v1.2.5.0 stores downloaded maps in desktop folders rather than IndexedDB.
 * Use only the official read-only library bridge. Browser clients still use
 * SDK IndexedDB; never open the old desktop IDB after its migration. */
import {withTimeout} from './scanGuard.js';
import {mapLimit} from './scanCache.js';
export const desktopLibrary=()=>typeof window!=='undefined'?window.ossIdleDesktop?.library??null:null;
export const desktopEntries=async(library=desktopLibrary())=>{
 if(!library)return null;
 const entries=await withTimeout('Desktop maps folder list',15000,()=>library.list('maps'));
 if(!Array.isArray(entries))throw Error('Desktop map library returned invalid folders.');
 return entries.filter(x=>x&&Array.isArray(x.info?.versions));
};
export const desktopSnapshot=async(library=desktopLibrary())=>{
 const entries=await desktopEntries(library);
 if(entries===null)return null;
 const index=new Map();
 const sets=[];
 for(const entry of entries){
  const id=Number(entry.info?.id);
  if(!Number.isSafeInteger(id)||index.has(id))continue;
  index.set(id,entry);sets.push(entry.info);
 }
 return {sets,index};
};
export const desktopSets=async(library=desktopLibrary())=>(await desktopSnapshot(library))?.sets??null;
export const desktopIndex=async(library=desktopLibrary())=>(await desktopSnapshot(library))?.index??null;
const normalized=p=>String(p??'').replaceAll('\\','/').toLowerCase();
/** Read only the requested charts in one queued set, never whole .osz folders
 * or music files. Call once as each worker becomes ready. */
export async function desktopJobCharts(library,index,setId,maps,cache,limitRead){
 const entry=index?.get(Number(setId));
 if(!entry)throw Error('Downloaded map folder not found for beatmapset '+setId);
 const paths=new Map((entry.files||[]).map(f=>[normalized(f.path),f.path]));
 const versions=new Map((entry.info?.versions||[]).map(v=>[Number(v.id),v]));
 const unique=[...new Set(maps.map(map=>Number(map.beatmapId)))];
 const values=await mapLimit(unique,4,async id=>{
  const cached=cache?.get(setId,id);
  if(cached!==undefined)return [id,cached];
  const path=paths.get(normalized(versions.get(id)?.file));
  if(!path)return [id,undefined];
  const task=()=>withTimeout('Reading desktop chart '+id,15000,()=>library.read('maps',entry.name,path));
  const bytes=limitRead?await limitRead(task):await task();
  if(!bytes)return [id,undefined];
  const chart=typeof bytes==='string'?bytes:new TextDecoder().decode(bytes);
  cache?.put(setId,id,chart);
  return [id,chart];
 });
 return Object.fromEntries(values.filter(([,text])=>text!==undefined));
}
