/**
 * Execute generated C/GMP values against an authenticated native component.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { generateCopiedGmpGraphConversions } from "../../src/backends/c/gmp-graph-conversions.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/**
 * Check real GMP ownership, limits and retirement with the compiled graph API.
 *
 * @param options - Verified component and native conversion artifacts.
 * @param options.directory - Test-owned workspace.
 * @param options.ir - Compiler-checked Binding IR.
 * @param options.compiled - Native component artifacts.
 * @param options.runtime - Matching shared runtime artifacts.
 * @param options.output - Retirement-aware C graph adapters.
 * @param options.run - Checked process runner.
 */
export const checkNativeRecursiveGmp = async ({ directory, ir, compiled, runtime, output, run }) => {
	const generated = generateCopiedGmpGraphConversions(ir, { lifecycle: true });
	await saveLakeFile(directory, "recursive-gmp-graph-values.h", generated.valuesHeader);
	await saveLakeFile(directory, "recursive-gmp-conversions.h", generated.header);
	await saveLakeFile(directory, "gmp-native.c", `#include <assert.h>
#include <stdlib.h>
size_t gmp_native_live, gmp_native_attempts, gmp_native_fail_at, gmp_native_decodes;
static void *gmp_native_malloc(size_t bytes) {
  if (++gmp_native_attempts == gmp_native_fail_at) return NULL;
  void *value = malloc(bytes); if (value) ++gmp_native_live; return value;
}
static void gmp_native_free(void *value) { assert(value && gmp_native_live); --gmp_native_live; free(value); }
#define LB_GRAPH_MALLOC gmp_native_malloc
#define LB_GRAPH_FREE gmp_native_free
#define LB_GRAPH_DECODE() (++gmp_native_decodes)
${output.source}
`);
	const aliases = [];
	for(const node of generated.types.filter(node => node.ref.id === "lean:Recursive.Envelope"))
		for(const field of node.fields) aliases.push(`#define ENVELOPE_${field.name.toUpperCase()} ${generated.types.find(node => node.id === field.type).name}`);
	for(const root of generated.layout.roots)
		aliases.push(`#define ${root.name.toUpperCase()}_RESULT ${generated.types.find(node => node.id === root.result).name}`);
	await saveLakeFile(directory, "gmp-test-types.h", `${aliases.join("\n")}\n`);
	await saveLakeFile(directory, "gmp-check.c", await readFile("tests/fixtures/structured-types/gmp-native-graph-check.c", "utf8"));
	await run("cc", ["-std=c11", "-O2", "-Wall", "-Wextra", "-Werror", "-UNDEBUG"
		, "-I", join(runtime.root, "include")
		, "-include", join(compiled.root, "component.h")
		, "-c", "gmp-native.c", "-o", "gmp-native.o"]);
	await run("cc", ["-std=c11", "-O1", "-Wall", "-Wextra", "-Werror", "-UNDEBUG"
		, "-I", join(runtime.root, "include"), "gmp-check.c", "gmp-native.o", "-lgmp"
		, "-L", compiled.root, "-L", join(runtime.root, "lib")
		, `-l:${compiled.receipt.library}`, "-llean_bridge_native", "-lleanshared"
		, `-Wl,-rpath,${compiled.root}:${join(runtime.root, "lib")}`
		, "-o", "gmp-check"]);
	const observed = await run(join(directory, "gmp-check"), []);
	assert.match(observed.stdout, /^gmp-native-graphs-ok \d+\n$/u); assert.equal(observed.stderr, "");
	return Number(observed.stdout.trim().split(" ").at(-1));
};
