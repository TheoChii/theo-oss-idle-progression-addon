import assert from 'node:assert/strict';
import {gpuSupport,gpuScorer,GPU_SHADER,hybridRefineCandidates,benchmarkGpu,scoringVector,vectorScore} from './src/gpuAssist.js';
import {eligibleRefineRows} from './src/scanStrategy.js';

class FakeBuffer {
 constructor(size){this.bytes=new Uint8Array(size);this.size=size;this.dead=false;}
 async mapAsync(mode){assert.equal(mode,1);}
 getMappedRange(){return this.bytes.buffer;}
 unmap(){}
 destroy(){this.dead=true;}
}
const stats={dispatches:0,submitted:0,workgroups:0,devices:0};
const fakeGpu={
 async requestAdapter(){return {
   info:{description:'Test integrated GPU'},
   async requestDevice(){
    stats.devices++;
    return {
     createShaderModule({code}){assert(code.includes('@workgroup_size(64)'));return {code}},
     async createComputePipelineAsync(){return {getBindGroupLayout:()=>({})}},
     createBuffer({size}){return new FakeBuffer(size)},
     createBindGroup({entries}){return entries},
     createCommandEncoder(){
      const ops=[];
      return {
       beginComputePass(){let bind=null;return {
        setPipeline(){},setBindGroup(_,group){bind=group},
        dispatchWorkgroups(n){stats.dispatches++;stats.workgroups+=n;
         ops.push(()=>{
          const input=bind[0].resource.buffer,output=bind[1].resource.buffer;
          const raw=new Float32Array(input.bytes.buffer);
          const dst=new Float32Array(output.bytes.buffer);
          for(let i=0;i<dst.length;i++)dst[i]=vectorScore(raw.subarray(i*4,i*4+4));
         });
        },end(){} };
       },
       copyBufferToBuffer(src,srcOff,dst,dstOff,size){ops.push(()=>dst.bytes.set(src.bytes.subarray(srcOff,srcOff+size),dstOff));},
       finish(){return ops}
      };
     },
     queue:{
      writeBuffer(buffer,offset,array){buffer.bytes.set(new Uint8Array(array.buffer,array.byteOffset,array.byteLength),offset);},
      submit(commands){stats.submitted++;for(const cmd of commands)for(const op of cmd)op();}
     },
     destroy(){}
    };
   }
 }; }
};
assert.equal(typeof GPU_SHADER,'string');
const gpu=await gpuScorer(fakeGpu);
const input=new Float32Array([3,0,0,-1, 0,120,100,0.01, 0,80,90,1, 7,0,0,-1]);
const out=await gpu.score(input);
assert.equal(out.length,4);
for(let i=0;i<4;i++)assert(Math.abs(out[i]-vectorScore(input.subarray(i*4,i*4+4)))<1e-4);
assert.equal(stats.dispatches,1);
const rows=Array.from({length:28},(_,i)=>({
 beatmapId:i+1,rate:1,mod:'NM',setId:i+1,durationSec:40+i*3,
 failRate:i===24?1:0,perSecond:(28-i)/6, value:60+i,
 pp:80+i*4
}));
for(const goal of ['xp','pp']){
 const opts={goal,bestPP:new Map(rows.map(x=>[x.beatmapId,x.beatmapId%3===0?400:50])),
  ppRank:'gainPerMinute',overheadSec:8,limit:12};
 const cpu=eligibleRefineRows(rows,opts);
 const hybrid=await hybridRefineCandidates(rows,opts,gpu);
 assert.deepEqual(hybrid.map(x=>x.beatmapId),cpu.map(x=>x.beatmapId),goal+' candidate order must match CPU');
 assert.equal(hybrid.length,cpu.length);
}
await assert.rejects(hybridRefineCandidates(rows,{goal:'xp',limit:8},{score:async()=>new Float32Array(0)}),/incomplete/);
gpu.destroy();await assert.rejects(()=>gpu.score(input),/closed/);
const hadNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
Object.defineProperty(globalThis,'navigator',{value:{gpu:fakeGpu},configurable:true});
try{
 const measured=await benchmarkGpu();
 assert(measured.supported&&measured.validated);
 assert.equal(measured.count,16384);
 assert(measured.cpuMs>=0&&measured.gpuMs>=0);
 assert.equal(measured.adapterLabel,'Test integrated GPU');
}finally{
 if(hadNavigator)Object.defineProperty(globalThis,'navigator',hadNavigator);
 else delete globalThis.navigator;
}
assert(stats.dispatches>=6);
console.log('PASS: mock WGSL dispatch and GPU readback, half-CPU/half-GPU scores, parity fallback, benchmark and resource teardown');
