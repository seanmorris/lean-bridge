/**
 * Execute generated C++ calls against a freshly verified native Lean component.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { generateCopiedCppGraphConversions } from "../../src/backends/cpp/copied-graph-conversions.mjs";
import { boostSources } from "../../src/backends/cpp/boost.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/**
 * Run an independent C++ caller with native arena and C++ allocation ledgers.
 *
 * @param options - Freshly built, verified component and C conversion artifacts.
 * @param options.directory - Test-owned workspace.
 * @param options.ir - Compiler-checked Binding IR.
 * @param options.compiled - Native component artifacts.
 * @param options.runtime - Matching native runtime artifacts.
 * @param options.output - Generated C graph adapters.
 * @param options.run - Checked process runner in the temporary workspace.
 * @param options.lifecycle - Exercise the shared runtime's permanent retirement.
 */
export const checkNativeRecursiveCpp = async ({ directory, ir, compiled, runtime, output, run, lifecycle = false }) => {
	const generated = generateCopiedCppGraphConversions(ir);
	for(const [path, content] of Object.entries(boostSources())) await saveLakeFile(directory, path, content);
	await saveLakeFile(directory, "recursive-values.hpp", generated.valuesHeader);
	await saveLakeFile(directory, "recursive-conversions.hpp", generated.header);
	await saveLakeFile(directory, "cpp-native.c", `#include <lean/lean.h>
#include <assert.h>
#include <stdlib.h>
size_t cpp_graph_live, cpp_graph_attempts, cpp_graph_fail_at, cpp_graph_decodes, cpp_graph_encodes, cpp_graph_bad_encode;
static void *cpp_graph_malloc(size_t bytes) {
  if (++cpp_graph_attempts == cpp_graph_fail_at) return NULL;
  void *value = malloc(bytes); if (value) ++cpp_graph_live; return value;
}
static void cpp_graph_free(void *value) {
  assert(value && cpp_graph_live); --cpp_graph_live; free(value);
}
static lean_object *cpp_graph_encode(lean_object *value) {
  if (++cpp_graph_encodes == cpp_graph_bad_encode) { lean_dec(value); return lean_alloc_array(0, 0); }
  return value;
}
#define LB_GRAPH_MALLOC cpp_graph_malloc
#define LB_GRAPH_FREE cpp_graph_free
#define LB_GRAPH_DECODE() (++cpp_graph_decodes)
#define LB_GRAPH_ENCODE(value) cpp_graph_encode(value)
${output.source}
`);
	const source = await readFile("tests/fixtures/structured-types/cpp-native-graph-check.cpp", "utf8");
	await saveLakeFile(directory, "cpp-check.cpp", source.replaceAll("COMPONENT_INITIALIZER", compiled.receipt.initializer));
	await run("cc", ["-std=c11", "-O2", "-Wall", "-Wextra", "-Werror"
		, "-UNDEBUG", "-fPIC"
		, "-I", join(runtime.root, "include")
		, "-include", join(compiled.root, "component.h")
		, "-c", "cpp-native.c", "-o", "cpp-native.o"]);
	// Keep Lean and its exported unwinder behind the same shared C boundary as
	// installed packages. Directly linking leanshared into a GCC C++ executable
	// interposes its unwinder ahead of libgcc_s and breaks C++ exception handling.
	await run("cc", ["-shared", "cpp-native.o", "-L", compiled.root
		, "-L", join(runtime.root, "lib"), `-l:${compiled.receipt.library}`
		, "-llean_bridge_native", "-lleanshared", "-Wl,--no-undefined"
		, `-Wl,-rpath,${compiled.root}:${join(runtime.root, "lib")}`
		, "-o", "libcpp-native-test.so"]);
	await run("c++", ["-std=c++20", "-O1", "-Wall", "-Wextra", "-Werror"
		, ...lifecycle ? ["-DLB_GRAPH_LIFECYCLE=1"] : []
		, "-UNDEBUG", "-I", "include", "-I", join(runtime.root, "include")
		, "cpp-check.cpp", "-L", directory, "-l:libcpp-native-test.so"
		, "-L", compiled.root, "-L", join(runtime.root, "lib")
		, `-l:${compiled.receipt.library}`, "-llean_bridge_native"
		, `-Wl,-rpath,${directory}:${compiled.root}:${join(runtime.root, "lib")}`
		, "-o", "cpp-check"]);
	const observed = await run(join(directory, "cpp-check"), []);
	assert.match(observed.stdout, /^cpp-native-graphs-ok \d+\n$/u); assert.equal(observed.stderr, "");
	return Number(observed.stdout.trim().split(" ").at(-1));
};
