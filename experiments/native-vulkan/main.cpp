#include <vulkan/vulkan.h>
#include <shaderc/shaderc.h>
#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

#define CHECK_VK(expr) do { VkResult r_=(expr); if(r_!=VK_SUCCESS) \
  throw std::runtime_error(std::string(#expr)+" failed (VkResult "+std::to_string(r_)+")"); } while(0)

using Clock=std::chrono::steady_clock;
static double ms(Clock::time_point from){return std::chrono::duration<double,std::milli>(Clock::now()-from).count();}
struct alignas(16) Row{float xp,pp,best,factor;};
static_assert(sizeof(Row)==16);
float cpuScore(const Row &r){
  if(r.factor<0.f)return r.xp;
  const float gain=std::max(0.f,r.pp-r.best)+std::max(0.f,r.best*0.02f);
  return gain*r.factor;
}

struct Buffer{
 VkBuffer buffer=VK_NULL_HANDLE;
 VkDeviceMemory memory=VK_NULL_HANDLE;
 void* mapped=nullptr;
};
static uint32_t memoryType(VkPhysicalDevice pd,uint32_t bits,VkMemoryPropertyFlags flags){
 VkPhysicalDeviceMemoryProperties m{};
 vkGetPhysicalDeviceMemoryProperties(pd,&m);
 for(uint32_t i=0;i<m.memoryTypeCount;i++)
  if((bits&(1u<<i))&&(m.memoryTypes[i].propertyFlags&flags)==flags)return i;
 throw std::runtime_error("No host-visible coherent Vulkan memory type on this GPU.");
}
static Buffer createBuffer(VkDevice dev,VkPhysicalDevice pd,VkDeviceSize size,VkBufferUsageFlags usage){
 Buffer b;
 VkBufferCreateInfo bi{VK_STRUCTURE_TYPE_BUFFER_CREATE_INFO};
 bi.size=size;bi.usage=usage;bi.sharingMode=VK_SHARING_MODE_EXCLUSIVE;
 CHECK_VK(vkCreateBuffer(dev,&bi,nullptr,&b.buffer));
 VkMemoryRequirements req{};vkGetBufferMemoryRequirements(dev,b.buffer,&req);
 VkMemoryAllocateInfo ma{VK_STRUCTURE_TYPE_MEMORY_ALLOCATE_INFO};
 ma.allocationSize=req.size;
 ma.memoryTypeIndex=memoryType(pd,req.memoryTypeBits,VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT|VK_MEMORY_PROPERTY_HOST_COHERENT_BIT);
 CHECK_VK(vkAllocateMemory(dev,&ma,nullptr,&b.memory));
 CHECK_VK(vkBindBufferMemory(dev,b.buffer,b.memory,0));
 CHECK_VK(vkMapMemory(dev,b.memory,0,size,0,&b.mapped));
 return b;
}
static void destroyBuffer(VkDevice dev,Buffer &b){
 if(b.mapped)vkUnmapMemory(dev,b.memory);
 if(b.buffer)vkDestroyBuffer(dev,b.buffer,nullptr);
 if(b.memory)vkFreeMemory(dev,b.memory,nullptr);
 b={};
}
static std::vector<uint32_t> compile(const std::string& path){
 std::ifstream file(path);
 if(!file)throw std::runtime_error("Cannot open shader: "+path);
 std::ostringstream ss;ss<<file.rdbuf();std::string glsl=ss.str();
 shaderc_compiler_t c=shaderc_compiler_initialize();
 if(!c)throw std::runtime_error("shaderc compiler initialization failed");
 shaderc_compile_options_t o=shaderc_compile_options_initialize();
 shaderc_compile_options_set_target_env(o,shaderc_target_env_vulkan,shaderc_env_version_vulkan_1_0);
 shaderc_compilation_result_t r=shaderc_compile_into_spv(
   c,glsl.data(),glsl.size(),shaderc_compute_shader,path.c_str(),"main",o);
 if(!r)throw std::runtime_error("Shader compilation returned null");
 if(shaderc_result_get_compilation_status(r)!=shaderc_compilation_status_success){
  std::string message=shaderc_result_get_error_message(r);
  shaderc_result_release(r);shaderc_compile_options_release(o);shaderc_compiler_release(c);
  throw std::runtime_error("Shader compilation: "+message);
 }
 const size_t len=shaderc_result_get_length(r);
 if(len%4)throw std::runtime_error("Invalid SPIR-V size");
 std::vector<uint32_t> code(len/4);
 std::memcpy(code.data(),shaderc_result_get_bytes(r),len);
 shaderc_result_release(r);shaderc_compile_options_release(o);shaderc_compiler_release(c);
 return code;
}
static void run(const std::string& path,uint32_t count,int rounds){
 VkApplicationInfo app{VK_STRUCTURE_TYPE_APPLICATION_INFO};
 app.pApplicationName="Theo Smart Farm Native Vulkan Benchmark";
 app.apiVersion=VK_API_VERSION_1_0;
 VkInstanceCreateInfo ici{VK_STRUCTURE_TYPE_INSTANCE_CREATE_INFO};
 ici.pApplicationInfo=&app;
 VkInstance instance;CHECK_VK(vkCreateInstance(&ici,nullptr,&instance));
 uint32_t total=0;CHECK_VK(vkEnumeratePhysicalDevices(instance,&total,nullptr));
 std::vector<VkPhysicalDevice> devices(total);
 if(total)CHECK_VK(vkEnumeratePhysicalDevices(instance,&total,devices.data()));
 VkPhysicalDevice gpu=VK_NULL_HANDLE;
 VkPhysicalDeviceProperties props{};
 for(auto pd:devices){
  VkPhysicalDeviceProperties p{};vkGetPhysicalDeviceProperties(pd,&p);
  // Fail closed: Mesa's llvmpipe is a CPU, not an Intel GPU.
  if(p.vendorID==0x8086 && p.deviceType==VK_PHYSICAL_DEVICE_TYPE_INTEGRATED_GPU){
   gpu=pd;props=p;break;
  }
 }
 if(!gpu)throw std::runtime_error("No Intel integrated Vulkan GPU found. CPU/software Vulkan is intentionally excluded.");
 // Check the shader's storage buffers and the intended workgroup count
 // against device limits before creating resources (no GPU dispatch here).
 const uint32_t groups=(count+63u)/64u;
 if(groups>props.limits.maxComputeWorkGroupCount[0] ||
    64u>props.limits.maxComputeWorkGroupSize[0] ||
    64u>props.limits.maxComputeWorkGroupInvocations ||
    static_cast<uint64_t>(count)*sizeof(Row)>props.limits.maxStorageBufferRange ||
    static_cast<uint64_t>(count)*sizeof(float)>props.limits.maxStorageBufferRange)
  throw std::runtime_error("Benchmark exceeds Intel GPU compute/storage limits.");
 uint32_t familyCount=0;vkGetPhysicalDeviceQueueFamilyProperties(gpu,&familyCount,nullptr);
 std::vector<VkQueueFamilyProperties> families(familyCount);
 vkGetPhysicalDeviceQueueFamilyProperties(gpu,&familyCount,families.data());
 int family=-1;
 for(uint32_t i=0;i<familyCount;i++)
  if(families[i].queueCount && (families[i].queueFlags & VK_QUEUE_COMPUTE_BIT)){family=static_cast<int>(i);break;}
 if(family<0)throw std::runtime_error("Intel Vulkan device exposes no compute queue");
 float priority=1.f;
 VkDeviceQueueCreateInfo qi{VK_STRUCTURE_TYPE_DEVICE_QUEUE_CREATE_INFO};
 qi.queueFamilyIndex=static_cast<uint32_t>(family);qi.queueCount=1;qi.pQueuePriorities=&priority;
 VkDeviceCreateInfo dci{VK_STRUCTURE_TYPE_DEVICE_CREATE_INFO};
 dci.queueCreateInfoCount=1;dci.pQueueCreateInfos=&qi;
 VkDevice dev;CHECK_VK(vkCreateDevice(gpu,&dci,nullptr,&dev));
 VkQueue queue;vkGetDeviceQueue(dev,static_cast<uint32_t>(family),0,&queue);
 const auto spirv=compile(path);
 VkShaderModuleCreateInfo si{VK_STRUCTURE_TYPE_SHADER_MODULE_CREATE_INFO};
 si.codeSize=spirv.size()*4;si.pCode=spirv.data();
 VkShaderModule shader;CHECK_VK(vkCreateShaderModule(dev,&si,nullptr,&shader));
 VkDescriptorSetLayoutBinding bindings[2]{};
 for(uint32_t i=0;i<2;i++){bindings[i].binding=i;bindings[i].descriptorCount=1;
  bindings[i].descriptorType=VK_DESCRIPTOR_TYPE_STORAGE_BUFFER;bindings[i].stageFlags=VK_SHADER_STAGE_COMPUTE_BIT;}
 VkDescriptorSetLayoutCreateInfo li{VK_STRUCTURE_TYPE_DESCRIPTOR_SET_LAYOUT_CREATE_INFO};
 li.bindingCount=2;li.pBindings=bindings;
 VkDescriptorSetLayout layout;CHECK_VK(vkCreateDescriptorSetLayout(dev,&li,nullptr,&layout));
 VkPipelineLayoutCreateInfo pli{VK_STRUCTURE_TYPE_PIPELINE_LAYOUT_CREATE_INFO};
 pli.setLayoutCount=1;pli.pSetLayouts=&layout;
 VkPipelineLayout pl;CHECK_VK(vkCreatePipelineLayout(dev,&pli,nullptr,&pl));
 VkComputePipelineCreateInfo ci{VK_STRUCTURE_TYPE_COMPUTE_PIPELINE_CREATE_INFO};
 ci.layout=pl;ci.stage.sType=VK_STRUCTURE_TYPE_PIPELINE_SHADER_STAGE_CREATE_INFO;
 ci.stage.stage=VK_SHADER_STAGE_COMPUTE_BIT;ci.stage.module=shader;ci.stage.pName="main";
 VkPipeline pipeline;CHECK_VK(vkCreateComputePipelines(dev,VK_NULL_HANDLE,1,&ci,nullptr,&pipeline));
 VkDescriptorPoolSize ps{VK_DESCRIPTOR_TYPE_STORAGE_BUFFER,2};
 VkDescriptorPoolCreateInfo pci{VK_STRUCTURE_TYPE_DESCRIPTOR_POOL_CREATE_INFO};
 pci.maxSets=1;pci.poolSizeCount=1;pci.pPoolSizes=&ps;
 VkDescriptorPool pool;CHECK_VK(vkCreateDescriptorPool(dev,&pci,nullptr,&pool));
 VkDescriptorSetAllocateInfo ai{VK_STRUCTURE_TYPE_DESCRIPTOR_SET_ALLOCATE_INFO};
 ai.descriptorPool=pool;ai.descriptorSetCount=1;ai.pSetLayouts=&layout;
 VkDescriptorSet ds;CHECK_VK(vkAllocateDescriptorSets(dev,&ai,&ds));
 Buffer in=createBuffer(dev,gpu,sizeof(Row)*count,VK_BUFFER_USAGE_STORAGE_BUFFER_BIT);
 Buffer out=createBuffer(dev,gpu,sizeof(float)*count,VK_BUFFER_USAGE_STORAGE_BUFFER_BIT);
 VkDescriptorBufferInfo info[2]{{in.buffer,0,VK_WHOLE_SIZE},{out.buffer,0,VK_WHOLE_SIZE}};
 VkWriteDescriptorSet updates[2]{};
 for(uint32_t i=0;i<2;i++){
  updates[i].sType=VK_STRUCTURE_TYPE_WRITE_DESCRIPTOR_SET;
  updates[i].dstSet=ds;updates[i].dstBinding=i;updates[i].descriptorType=VK_DESCRIPTOR_TYPE_STORAGE_BUFFER;
  updates[i].descriptorCount=1;updates[i].pBufferInfo=&info[i];
 }
 vkUpdateDescriptorSets(dev,2,updates,0,nullptr);
 VkCommandPoolCreateInfo pooli{VK_STRUCTURE_TYPE_COMMAND_POOL_CREATE_INFO};
 pooli.queueFamilyIndex=family;
 VkCommandPool cmdPool;CHECK_VK(vkCreateCommandPool(dev,&pooli,nullptr,&cmdPool));
 VkCommandBufferAllocateInfo cmdai{VK_STRUCTURE_TYPE_COMMAND_BUFFER_ALLOCATE_INFO};
 cmdai.commandPool=cmdPool;cmdai.level=VK_COMMAND_BUFFER_LEVEL_PRIMARY;cmdai.commandBufferCount=1;
 VkCommandBuffer cmd;CHECK_VK(vkAllocateCommandBuffers(dev,&cmdai,&cmd));
 VkCommandBufferBeginInfo begin{VK_STRUCTURE_TYPE_COMMAND_BUFFER_BEGIN_INFO};
 CHECK_VK(vkBeginCommandBuffer(cmd,&begin));
 vkCmdBindPipeline(cmd,VK_PIPELINE_BIND_POINT_COMPUTE,pipeline);
 vkCmdBindDescriptorSets(cmd,VK_PIPELINE_BIND_POINT_COMPUTE,pl,0,1,&ds,0,nullptr);
 vkCmdDispatch(cmd,(count+63)/64,1,1);
 // Khronos' shader-write -> CPU-read example requires an explicit memory
 // dependency. Host-coherent memory alone does not replace this barrier.
 VkMemoryBarrier visibility{VK_STRUCTURE_TYPE_MEMORY_BARRIER};
 visibility.srcAccessMask=VK_ACCESS_SHADER_WRITE_BIT;
 visibility.dstAccessMask=VK_ACCESS_HOST_READ_BIT;
 vkCmdPipelineBarrier(cmd,
  VK_PIPELINE_STAGE_COMPUTE_SHADER_BIT,VK_PIPELINE_STAGE_HOST_BIT,
  0,1,&visibility,0,nullptr,0,nullptr);
 CHECK_VK(vkEndCommandBuffer(cmd));
 VkFenceCreateInfo fi{VK_STRUCTURE_TYPE_FENCE_CREATE_INFO};
 VkFence fence;CHECK_VK(vkCreateFence(dev,&fi,nullptr,&fence));
 std::vector<Row> rows(count);
 for(uint32_t i=0;i<count;i++){
  const float x=static_cast<float>(i%1000)/37.f;
  const float pp=70.f+static_cast<float>((i*17u)%241);
  const float best=static_cast<float>((i*29u)%251);
  rows[i]={x,pp,best,(i%3==0)?-1.f:1.f/(40.f+static_cast<float>(i%240))};
 }
 std::memcpy(in.mapped,rows.data(),sizeof(Row)*count);
 std::vector<float> baseline(count);
 volatile double checksum=0;
 auto cpuOnce=[&](){
  double local=0;
  for(uint32_t i=0;i<count;i++){baseline[i]=cpuScore(rows[i]);local+=baseline[i];}
  checksum=local;
 };
 auto gpuOnce=[&](){
  CHECK_VK(vkResetFences(dev,1,&fence));
  VkSubmitInfo sub{VK_STRUCTURE_TYPE_SUBMIT_INFO};sub.commandBufferCount=1;sub.pCommandBuffers=&cmd;
  CHECK_VK(vkQueueSubmit(queue,1,&sub,fence));
  CHECK_VK(vkWaitForFences(dev,1,&fence,VK_TRUE,30000000000ULL));
 };
 cpuOnce();gpuOnce();
 double cpuTime=0,gpuTime=0;
 for(int i=0;i<rounds;i++){
  auto t=Clock::now();cpuOnce();cpuTime+=ms(t);
  t=Clock::now();gpuOnce();gpuTime+=ms(t);
 }
 const float *observed=static_cast<const float*>(out.mapped);
 double maxErr=0,sumAbs=0;
 uint32_t bad=0;
 for(uint32_t i=0;i<count;i++){
  double error=std::abs(static_cast<double>(baseline[i])-observed[i]);
  maxErr=std::max(maxErr,error);sumAbs+=error;
  if(!std::isfinite(observed[i])||error>std::max(.002, std::abs(baseline[i])*.001))bad++;
 }
 std::cout<<std::fixed<<std::setprecision(5)
  <<"{\"device\":\""<<props.deviceName<<"\",\"vendorId\":"<<props.vendorID
  <<",\"softwareFallback\":false,\"computeQueue\":"<<family
  <<",\"elements\":"<<count<<",\"rounds\":"<<rounds
  <<",\"cpuMs\":"<<(cpuTime/rounds)<<",\"gpuMs\":"<<(gpuTime/rounds)
  <<",\"maxAbsError\":"<<maxErr<<",\"meanAbsError\":"<<(sumAbs/count)
  <<",\"badValues\":"<<bad<<",\"checksum\":"<<checksum<<"}\n";
 vkDeviceWaitIdle(dev);
 vkDestroyFence(dev,fence,nullptr);
 vkDestroyCommandPool(dev,cmdPool,nullptr);
 destroyBuffer(dev,out);destroyBuffer(dev,in);
 vkDestroyDescriptorPool(dev,pool,nullptr);
 vkDestroyPipeline(dev,pipeline,nullptr);vkDestroyPipelineLayout(dev,pl,nullptr);
 vkDestroyDescriptorSetLayout(dev,layout,nullptr);
 vkDestroyShaderModule(dev,shader,nullptr);
 vkDestroyDevice(dev,nullptr);vkDestroyInstance(instance,nullptr);
 if(bad)throw std::runtime_error("Vulkan output differs from CPU beyond tolerance.");
}
int main(int argc,char** argv){
 try{
  // Safety interlock: this exact Intel HD 520 experienced an i915 GPU hang.
  const char* acknowledgement=std::getenv("THEO_ALLOW_NATIVE_GPU_BENCH");
  if(!acknowledgement||std::strcmp(acknowledgement,"YES")!=0)
   throw std::runtime_error("GPU dispatch DISABLED: an i915 GPU hang occurred during repeat testing. Only run with THEO_ALLOW_NATIVE_GPU_BENCH=YES after reviewing README safety notes, while game and other GPU workloads are closed.");
  const std::string shader=argc>=2?argv[1]:"priority.comp";
  uint32_t size=argc>=3?static_cast<uint32_t>(std::stoul(argv[2])):262144;
  int rounds=argc>=4?std::stoi(argv[3]):5;
  if(size<64||size>1048576||rounds<1||rounds>20)
   throw std::runtime_error("Allowed sizes 64–1048576 and rounds 1–20");
  run(shader,size,rounds);return 0;
 }catch(const std::exception& e){std::cerr<<"GPU benchmark failed: "<<e.what()<<"\n";return 1;}
}
