/** Parse oss!idle v1.2.6.0's approved live beatmap catalog.
 * IMPORTANT: catalogSet.ranked means APPROVED (ranked OR loved) since
 * v1.2.6.0. Only non-loved approved maps can yield PP. */
export function parseMapEligibility(data){
 if(!data||!Array.isArray(data.beatmaps))throw Error('Unexpected beatmap catalog response.');
 const xp=new Set(),pp=new Set(),loved=new Set(),setStatus=new Map();
 const intro=Number(data.intro?.id);
 for(const set of data.beatmaps){
  if(!set||!Number.isSafeInteger(Number(set.id))||!Array.isArray(set.versions))continue;
  if(Number(set.id)===intro)continue;
  // Catalog ranked=true ALSO describes loved since v1.2.6.
  const isLoved=set.loved===true||set.status==='loved';
  const status=isLoved?'loved':'ranked';
  setStatus.set(Number(set.id),status);
  for(const version of set.versions){
   const id=Number(version?.id);
   if(!Number.isSafeInteger(id)||id<=0)continue;
   xp.add(id);
   if(isLoved)loved.add(id);
   else pp.add(id);
  }
 }
 return {xp,pp,loved,setStatus};
}
export function filterBestPP(best,eligible){
 const filtered=new Map();
 if(!best)return filtered;
 for(const [rawId,rawPP] of best){
  const id=Number(rawId),pp=Number(rawPP);
  if(eligible?.has(id)&&Number.isFinite(pp)&&pp>0)filtered.set(id,pp);
 }
 return filtered;
}
