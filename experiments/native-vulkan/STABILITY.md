# Native Vulkan stability audit — 2026-10-25

Status: **UNRESOLVED; GPU dispatch remains DISABLED.**
This audit was read-only/static: no repeat compute dispatch, driver changes, kernel parameters, restarts, or stopping oss!idle.

## Observed evidence

Hardware: Fedora 44, kernel 7.2.7-200.fc44.x86_64, Intel HD Graphics 520 (8086:1916, i915), Mesa Vulkan 26.2.3, Core i5-6200U. The first run selected physical Intel integrated GPU rather than llvmpipe; all tested candidate-scoring values matched the CPU. First-run performance figures are preserved in README.md.

Immediately after that successful run, a repeat 16K vector dispatch returned VK_ERROR_DEVICE_LOST (-4) from vkWaitForFences. Kernel journal at 2026-10-25 09:02:48 -0700:
- i915: Resetting rcs0 for preemption time out
- vulkan-priority process context reset due to GPU hang
- GPU HANG: ecode 9:1:85ddfffa, in vulkan-priority
- GPU error state saved to /sys/class/drm/card1/error

The error state is root-only (0600). It was not read, changed or uploaded. A subsequent kernel log at 09:10:38 showed an atomic-display update timing failure; causality is unverified.

oss!idle's Electron GPU/renderer processes and KDE Wayland compositor were active. In later inspection RAM available was ~1.1 GiB and swap usage was high. The GPU has a shared graphics+compute queue. Contention is plausible but *not proven* to be the cause.

## Static audit — definite Vulkan correctness issue

The original native code ended the command buffer immediately after a shader storage-buffer write. It omitted the explicit COMPUTE_SHADER/SHADER_WRITE to HOST/HOST_READ memory barrier expected before reading mapped CPU memory. A fence wait alone does not establish this memory visibility dependency, even with host-coherent memory.

Patched the experimental main.cpp:
- Add a Vulkan 1.0 VkMemoryBarrier and vkCmdPipelineBarrier immediately after vkCmdDispatch and before vkEndCommandBuffer.
- Reject workgroup counts and storage buffer sizes beyond device limits before submitting.
- Keep explicit environment opt-in and software-GPU rejection.
- Only compile and verify default execution refusal; NO GPU compute retest.

**Fixing memory visibility does not prove GPU hang stability**. Missing readback synchronization is a plausible correctness fault for host-visible results, not an established explanation for the GPU engine preemption timeout.

Command-buffer reuse after completed fence waits is allowed by the Vulkan state model; no evidence of concurrent overlapping submissions in this program.

## Authoritative references

- Vulkan compute-to-host synchronization examples:
  https://docs.vulkan.org/guide/latest/synchronization_examples.html
- Vulkan synchronization spec (fence not sufficient for host data visibility):
  https://docs.vulkan.org/spec/latest/chapters/synchronization.html
- Mesa ANV driver debugging controls (stall/sync as supervised diagnostics):
  https://docs.mesa3d.org/drivers/anv.html
- Intel GPU error state collection:
  https://www.intel.com/content/www/us/en/docs/graphics-for-linux/developer-reference/1-0/gpu-error-state.html
- Intel bug reporting:
  https://drm.pages.freedesktop.org/intel-docs/how-to-file-i915-bugs.html

Do NOT disable i915 hangcheck or preemption protections. No INTEL_DEBUG flags were enabled.

## What is known and unknown

Confirmed: native Vulkan compute can run on this GPU; a real GPU context hang occurred; synchronization was incomplete and has been repaired *statically*.
Unknown: if corrected code is stable, whether the problem reproduces with oss!idle closed, if driver regression or memory pressure contributes, whether OpenCL is safer, and whether this improves actual scan throughput.

## Next steps

1. Keep draft PR unmerged; main Smart Farm v0.5.9 unchanged.
2. Do not run another GPU dispatch while the game is open. For future testing, user should save work and close graphics-heavy applications with explicit approval.
3. For deeper diagnosis, the machine owner may examine the root-only error dump locally before reboot; it may include sensitive GPU memory/context, so sanitize before uploading publicly.
4. Later use validation layers / modest workloads under supervision, with a stable system, and only then consider IPC integration.
