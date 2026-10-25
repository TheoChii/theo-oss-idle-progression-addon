# Native Vulkan compute experiment (not shipped in oss!idle)

**Status: GPU execution succeeded once; a repeat caused an Intel i915 GPU hang. NOT suitable for production.**

## Scope
This standalone C++ / Vulkan / shaderc experiment tests parallel candidate priority scoring outside Chromium. It does not run the oss!idle gameplay/PP simulator, install packages or drivers, modify your current add-on, open any server, or enable native GPU usage from JavaScript.

The program selects vendor 0x8086 + INTEGRATED_GPU explicitly and rejects llvmpipe or other software rendering. It compiles priority.comp through the installed shaderc library, dispatches a Vulkan compute shader, reads the GPU output and compares every value with C++ arithmetic.

## Tested Fedora hardware
Intel Core i5-6200U (4 logical CPUs), Intel HD Graphics 520 Skylake GT2, Fedora 44, Mesa 26.2.3 i915; system Vulkan loader, headers and libshaderc-devel were already present. No additional packages or drivers were installed.

## First successful execution (5 rounds, means; lower is better)
| Inputs | CPU | Intel GPU | Parity |
| ---: | ---: | ---: | --- |
| 16,384 | 0.08704 ms | 0.16564 ms | 0 mismatches |
| 262,144 | 3.18149 ms | 3.04363 ms | 0 mismatches |
| 1,048,576 | 7.79503 ms | 5.36865 ms | 0 mismatches |

For the largest batch GPU was approximately 1.45x faster. This is not whole-scanner acceleration. Data transfer between JavaScript and an external helper, initialization, parsing, gameplay simulation, and PP are NOT included.

## Critical instability discovered
On the immediately following repeat, the 16K batch's Vulkan fence returned VK_ERROR_DEVICE_LOST (-4). Fedora kernel logs dated October 25, 2026 09:02:48:
- i915: Resetting rcs0 for preemption time out
- vulkan-priority process context reset due to GPU hang
- GPU HANG ecode 9:1:85ddfffa

The graphics device still enumerated afterward. At the time, several oss!idle processes were consuming CPU and memory. The exact root cause is not proven; Mesa/i915, shader behavior, and resource contention are all possible. Further GPU dispatch tests were STOPPED.

**Do not run this during gameplay or deploy it into Smart Farm.** GPU context resets can temporarily freeze the desktop or the game.

## Safe build and safety interlock
From this directory, 'make all' compiles an executable; it does not dispatch GPU work. The executable is gitignored. Calling the program normally REFUSES Vulkan execution and prints a warning; explicit environment variable THEO_ALLOW_NATIVE_GPU_BENCH=YES is required before it will dispatch. Do not set that globally or use it without investigating the GPU hang and saving your work first. 'make bench' also refuses to run without explicit acknowledgement. No unattended jobs are installed.

Build dependencies: g++, make, vulkan-loader-devel, vulkan-headers, libshaderc-devel, mesa-vulkan-drivers.

## Architecture and integration status
main.cpp: Vulkan device selection, buffers, shaderc compile, dispatch, timings, parity validation and risk guard.
priority.comp: same simple candidate priority formula as the Smart Farm GPU prototype.
Makefile: compiler/link commands.
.gitignore: excludes native binary and temporary shader outputs.

This is a research prototype only. In oss!idle, contextIsolation=true and nodeIntegration=false; the JavaScript add-on cannot directly launch this binary. A safe local IPC bridge with an opt-in launcher and narrow access controls would need separate design and testing, AFTER GPU driver stability is demonstrated.

## Next steps
Investigate i915 GPU hang; do not add more GPU stress while oss!idle is active. If stability is established, benchmark startup and interprocess transfer, then assess whether offloading a substantial simulation workload is even worthwhile. Keep the v0.5.9 CPU scanner as production default.
