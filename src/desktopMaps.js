/** Game v1.2.5.0 stores downloaded maps in desktop folders rather than IndexedDB.
 * Use only the official read-only library bridge. Browser clients still use
 * SDK IndexedDB; never open the old desktop IDB after its migration. */
import {withTimeout} from './scanGuard.js';
export const desktopLibrary=()=>typeof window!=='undefined'?window.ossIdleDesktop?.library??null:null;
export const desktopEntries=async(library=desktopLibrary())=>{
 if(!library)return null;
 const entries=await withTimeout('Desktop maps folder list',15000,()=>library.list('maps'));
 if(!Array.isArray(entries))throw Error('Desktop map library returned invalid folders.');
 return entries.filter(x=>x&&Array.isArray(x.info?.versions));
};
export const desktopSets=async(library=desktopLibrary())=>{
 const entries=await desktopEntries(library);
 return entries===null?null:entries.map(x=>x.info);
};
export const desktopIndex=async(library=desktopLibrary())=>{
 const entries=await desktopEntries(library);
 if(entries===null)return null;
 const bySet=new Map();
 for(const entry of entries){
  const id=Number(entry.info.id);
  if(!Number.isSafeInteger(id)||bySet.has(id))continue;
  bySet.set(id,entry);
 }
 return bySet;
};
const normalized=p=>String(p??'').replaceAll('\\','/').toLowerCase();
/** Read only the requested charts in one queued set, never whole .osz folders
 * or music files. Call once as each worker becomes ready. */
export async function desktopJobCharts(library,index,setId,maps){
 const entry=index?.get(Number(setId));
 if(!entry)throw Error('Downloaded map folder not found for beatmapset '+setId);
 const charts={};
 for(const map of maps){
  const version=entry.info?.versions?.find(v=>Number(v.id)===Number(map.beatmapId));
  const candidate=version?.file;
  const path=candidate&&entry.files?.find(x=>normalized(x.path)===normalized(candidate))?.path;
  if(!path)continue; // the worker reports the missing difficulty
  const bytes=await withTimeout('Reading desktop chart '+map.beatmapId,15000,
   ()=>library.read('maps',entry.name,path));
  if(bytes){
   if(typeof bytes==='string')charts[map.beatmapId]=bytes;
   else charts[map.beatmapId]=new TextDecoder().decode(bytes);
  }
 }
 return charts;
}
