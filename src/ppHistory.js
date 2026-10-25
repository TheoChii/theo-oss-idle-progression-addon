import {gameDb} from '@oss-idle/addon-sdk';
import {normalizeBestPP} from './ppFarm.js';
const API='https://api.oss.idle.rhythmgamers.net/v1';
const num=v=>Number.isFinite(Number(v))?Math.max(0,Number(v)):0;

/** Local history contains only scores successfully stored on this device.
 * onlineId > 0 excludes unsynced/local-only plays from the ranked PP projection. */
export async function localBestPP(characterId){
 await gameDb.ready();
 const rows=await gameDb.select(
  'SELECT beatmapId, MAX(pp) AS pp FROM score WHERE characterId = ? AND onlineId > 0 GROUP BY beatmapId',
  [Number(characterId)]);
 return normalizeBestPP((rows||[]).map(x=>({beatmapId:Number(x.beatmapId),pp:num(x.pp)})));
}
/** Read the server's authoritative top list to catch ranked bests not on this device.
 * 6 pages = up to 255 scores. Values below that rank carry near-zero 0.95^i weight.
 * Never sends credentials, changes account state or polls in the background. */
export async function serverBestPP(characterId){
 const rows=[];
 for(let page=1;page<=6;page++){
  const ctrl=typeof AbortSignal!=='undefined'&&AbortSignal.timeout?AbortSignal.timeout(8500):undefined;
  const resp=await fetch(API+'/characters/'+encodeURIComponent(Number(characterId))+'/bestpp/'+page,
   {credentials:'omit',signal:ctrl});
  if(!resp.ok)throw Error('Best-PP endpoint '+resp.status);
  const data=await resp.json();
  if(!data||!Array.isArray(data.items))throw Error('Unexpected best-PP response');
  for(const item of data.items){
   const score=item?.best_pp||item?.bestPP||item;
   rows.push({beatmapId:Number(score.beatmapId),pp:num(score.pp)});
  }
  if(!data.hasMore)break;
 }
 return normalizeBestPP(rows);
}
/** Public top scores + verified locally stored online plays. The source is
 * exposed to callers so they can show whether the estimate is partial. */
export async function readBestPP(characterId,{server=true}={}){
 const local=await localBestPP(characterId);
 if(!server)return {best:local,source:'local ranked score cache',fetched:false};
 try{
  const remote=await serverBestPP(characterId);
  for(const [id,pp] of local)remote.set(id,Math.max(remote.get(id)||0,pp));
  return {best:remote,source:'official best-PP leaderboard (top 255) + local ranked scores',fetched:true};
 }catch(e){
  return {best:local,source:'local ranked score cache only — server lookup unavailable',fetched:false,error:e?.message||String(e)};
 }
}
