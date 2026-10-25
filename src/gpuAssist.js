/** Experimental WebGPU *refinement scoring* only.
 * CPU workers always do gameplay and rosu-pp simulation. GPU computes scores
 * for half of the eligible rows while CPU computes the other half. All input
 * validity and final ranking decisions remain on CPU, with parity validation.
 */
import {filterRefineCandidates,scoreRefineCandidate,finishRefineCandidates} from './scanStrategy.js';
import {withTimeout} from './scanGuard.js';

export const GPU_SHADER=`
@group(0) @binding(0) var<storage, read> rows: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> scores: array<f32>;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let i=id.x;
  if(i>=arrayLength(&scores)) { return; }
  let r=rows[i];
  let increase=max(0.0,r.y-r.z)+max(0.0,r.z*0.02);
  scores[i]=select(r.x,increase*r.w,r.w>=0.0);
}
`;
export const gpuSupport=()=>({
 exposed:typeof navigator!=='undefined'&&Boolean(navigator.gpu?.requestAdapter),
 secure:typeof isSecureContext==='undefined'?null:Boolean(isSecureContext)
});
export const scoringVector=(row,opts={})=>{
 const goal=opts.goal==='pp'?'pp':'xp';
 if(goal==='xp')return [Number(row.perSecond)||0,0,0,-1];
 const old=Number(opts.bestPP?.get(row.beatmapId))||0;
 const pp=Number(row.pp)||0;
 const divisor=Number(row.durationSec)+Math.max(0,Number(opts.overheadSec)||0);
 const factor=opts.ppRank==='gain'?1:(divisor>0?1/divisor:0);
 return [0,pp,old,factor];
};
export const vectorScore=(v)=>v[3]<0?v[0]:(Math.max(0,v[1]-v[2])+Math.max(0,v[2]*0.02))*v[3];
export async function gpuScorer(gpu=typeof navigator!=='undefined'?navigator.gpu:null){
 if(!gpu?.requestAdapter)throw Error('WebGPU not exposed by this Electron/Chromium session.');
 const adapter=await withTimeout('WebGPU adapter',7000,()=>gpu.requestAdapter({powerPreference:'low-power'}));
 if(!adapter)throw Error('No usable WebGPU adapter; Intel Gen9 is often unsupported on Linux Chromium.');
 const device=await withTimeout('WebGPU device',7000,()=>adapter.requestDevice());
 let pipeline;
 try{
  const module=device.createShaderModule({code:GPU_SHADER});
  pipeline=device.createComputePipelineAsync
   ?await withTimeout('GPU shader compilation',7000,()=>device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}}))
   :device.createComputePipeline({layout:'auto',compute:{module,entryPoint:'main'}});
 }catch(e){device.destroy();throw e;}
 let destroyed=false;
 const score=async packed=>{
  if(destroyed)throw Error('GPU scorer was closed.');
  const n=packed.length/4;
  if(!Number.isInteger(n)||n<1||n>65536)throw Error('GPU candidate batch must have 1–65536 rows.');
  const U=typeof GPUBufferUsage!=='undefined'?GPUBufferUsage:{STORAGE:128,COPY_DST:8,COPY_SRC:4,MAP_READ:1};
  const M=typeof GPUMapMode!=='undefined'?GPUMapMode:{READ:1};
  const input=device.createBuffer({size:packed.byteLength,usage:U.STORAGE|U.COPY_DST});
  const output=device.createBuffer({size:n*4,usage:U.STORAGE|U.COPY_SRC});
  const read=device.createBuffer({size:n*4,usage:U.COPY_DST|U.MAP_READ});
  try{
   device.queue.writeBuffer(input,0,packed);
   const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[
    {binding:0,resource:{buffer:input}},{binding:1,resource:{buffer:output}}
   ]});
   const enc=device.createCommandEncoder();
   const pass=enc.beginComputePass();
   pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(Math.ceil(n/64));pass.end();
   enc.copyBufferToBuffer(output,0,read,0,n*4);
   device.queue.submit([enc.finish()]);
   await withTimeout('GPU readback',8000,()=>read.mapAsync(M.READ));
   const result=new Float32Array(read.getMappedRange().slice(0));
   read.unmap();
   return result;
  }finally{input.destroy();output.destroy();read.destroy();}
 };
 return {score,destroy:()=>{if(!destroyed){destroyed=true;device.destroy();}},adapterLabel:adapter.info?.description||adapter.info?.device||'WebGPU adapter'};
}
/** Half GPU, half CPU. The entire eligible set is validated on CPU; if the
 * GPU is blocked or disagrees, caller retries the all-CPU ranking. */
export async function hybridRefineCandidates(ranked,opts,scorer){
 const all=filterRefineCandidates(ranked,opts);
 if(all.length<2)return finishRefineCandidates(all.map(row=>({...row,refineScore:scoreRefineCandidate(row,opts)})),opts.limit);
 const cpu=[],gpu=[],packed=new Float32Array(Math.ceil(all.length/2)*4);
 for(let i=0;i<all.length;i++){
  if(i%2){cpu.push(i);continue;}
  gpu.push(i);packed.set(scoringVector(all[i],opts),gpu.length*4-4);
 }
 const wait=scorer.score(packed.subarray(0,gpu.length*4));
 for(const i of cpu)all[i]={...all[i],refineScore:scoreRefineCandidate(all[i],opts)};
 const computed=await wait;
 if(computed.length!==gpu.length)throw Error('WebGPU returned incomplete refinement batch.');
 for(let j=0;j<gpu.length;j++){
  const i=gpu[j],value=computed[j],expected=scoreRefineCandidate(all[i],opts);
  if(!Number.isFinite(value)||Math.abs(value-expected)>Math.max(.002,Math.abs(expected)*.001))
   throw Error('GPU/CPU scoring mismatch; using CPU rankings.');
  all[i]={...all[i],refineScore:value};
 }
 return finishRefineCandidates(all,opts.limit);
}
export async function benchmarkGpu(){
 const started=performance.now();
 let scorer;
 try{
  scorer=await gpuScorer();
  const n=16384;
  const vectors=new Float32Array(n*4);
  for(let i=0;i<n;i++){
   vectors[i*4]=i/1000;
   vectors[i*4+1]=150+i%160;
   vectors[i*4+2]=i%120;
   vectors[i*4+3]=i%2?-1:1/(50+i%80);
  }
  let cpuMs=0,gpuMs=0,maxError=0;
  for(let round=0;round<3;round++){
   let t=performance.now();
   const cpu=new Float32Array(n);
   for(let i=0;i<n;i++)cpu[i]=vectorScore(vectors.subarray(i*4,i*4+4));
   cpuMs+=performance.now()-t;
   t=performance.now();
   const out=await scorer.score(vectors);
   gpuMs+=performance.now()-t;
   for(let i=0;i<n;i++)maxError=Math.max(maxError,Math.abs(cpu[i]-out[i]));
  }
  const passed=maxError<.03;
  if(!passed)throw Error('GPU numerical comparison failed (max difference '+maxError.toFixed(5)+').');
  return {supported:true,validated:true,cpuMs:cpuMs/3,gpuMs:gpuMs/3,
   setupMs:performance.now()-started-(cpuMs+gpuMs),count:n,maxError,
   adapterLabel:scorer.adapterLabel};
 }finally{scorer?.destroy();}
}
