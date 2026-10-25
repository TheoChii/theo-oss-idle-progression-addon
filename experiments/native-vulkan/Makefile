CXX ?= g++
CXXFLAGS ?= -O3 -std=c++17 -Wall -Wextra -Wpedantic -Wno-missing-field-initializers
LDLIBS = -lvulkan -lshaderc_shared

.PHONY: all bench clean
all: vulkan-priority-bench
vulkan-priority-bench: main.cpp priority.comp
	$(CXX) $(CXXFLAGS) -o $@ main.cpp $(LDLIBS)
bench: vulkan-priority-bench
	./vulkan-priority-bench priority.comp 16384 5
	./vulkan-priority-bench priority.comp 262144 5
	./vulkan-priority-bench priority.comp 1048576 5
clean:
	rm -f vulkan-priority-bench
