CXX ?= g++
CXXFLAGS ?= -O3 -std=c++17 -Wall -Wextra -Wpedantic -Wno-missing-field-initializers
LDLIBS = -lvulkan -lshaderc_shared

.PHONY: all safe-check clean
all: vulkan-priority-bench
vulkan-priority-bench: main.cpp priority.comp
	$(CXX) $(CXXFLAGS) -o $@ main.cpp $(LDLIBS)
# Exercise only the safety guard, never run a GPU shader.
safe-check: vulkan-priority-bench
	@out=$$(env -u THEO_ALLOW_NATIVE_GPU_BENCH ./vulkan-priority-bench priority.comp 64 1 2>&1); \
	case "$$out" in *"GPU dispatch DISABLED"*) echo "PASS: default GPU interlock";; \
	*) echo "FAIL: default interlock not confirmed"; exit 1;; esac
clean:
	rm -f vulkan-priority-bench
