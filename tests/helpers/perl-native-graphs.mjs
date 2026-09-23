/**
 * Private XS calls into freshly compiled ordinary and reviewed Lean components.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildNativeComponent, buildNativeSharedRuntime } from "../../src/build/native-component.mjs";
import { readVerifiedNativeComponent } from "../../src/build/native-artifacts.mjs";
import { nativeGraphCarrierAbi } from "../../src/build/native-graph-model.mjs";
import { generateNativeCopiedGraphAdapters } from "../../src/backends/c/native-graph-adapters.mjs";
import { generateCopiedPerlGraphXs } from "../../src/backends/perl/copied-graph-xs.mjs";
import { nativeRecursiveReviewedIr } from "./native-recursive-reviewed.mjs";
import { nativeRecursiveSource } from "./native-recursive-transport.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { nativeFixtureEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { perlGraphCommands, perlGraphInstrumentation, perlGraphProbeXs, preparePerlGraphProbe, compilePerlGraphProbe } from "./perl-graph-probes.mjs";

export const nativeHooks = `#include <lean/lean.h>
#include <assert.h>
#include <stdlib.h>
static size_t native_live, native_attempts, native_fail, native_decodes, native_encodes, native_bad, native_mode;
static void *perl_malloc(size_t size) {
  if (++native_attempts == native_fail) return NULL;
  void *value = malloc(size); if (value) ++native_live; return value;
}
static void perl_free(void *value) { assert(value && native_live); --native_live; free(value); }
static lean_object *perl_encode(lean_object *value) {
  if (++native_encodes == native_bad) { lean_dec(value); return lean_alloc_array(0, 0); }
  return value;
}
#define LB_GRAPH_MALLOC perl_malloc
#define LB_GRAPH_FREE perl_free
#define LB_GRAPH_DECODE() (++native_decodes)
#define LB_GRAPH_ENCODE(value) perl_encode(value)
`;

export const nativeProbes = `
void perl_native_reset(size_t fail, size_t bad, size_t mode) { native_attempts = native_decodes = native_encodes = 0; native_fail = fail; native_bad = bad; native_mode = mode; }
size_t perl_native_live(void) { return native_live; }
size_t perl_native_attempts(void) { return native_attempts; }
size_t perl_native_decodes(void) { return native_decodes; }
size_t perl_native_encodes(void) { return native_encodes; }
uint32_t perl_native_initialize(void) { return lean_bridge_native_component_initialize("recursive@1.0.0", ng_initialize) ? 0 : 5; }
int perl_native_ready(void) { return ng_ready(); }
void perl_native_retire(void) { lean_bridge_native_runtime_retire(); }
uint32_t perl_native_tree(const recursive_tree_t *input, recursive_tree_t *output) {
  uint32_t status = recursive_tree_graph(input, output);
  if (!status && native_mode == 1) output->kind = UINT32_MAX;
  if (!status && native_mode == 2) lean_bridge_native_runtime_retire();
  return status;
}
static recursive_scalars_t retained;
uint32_t perl_native_hold(void) {
  recursive_scalars_t input = {0}; input.text.data = "retained"; input.text.length = 8;
  return recursive_scalars_graph(&input, &retained);
}
void perl_native_release(void) { recursive_scalars_t_clear(&retained); }
void perl_native_detach(void) { lean_bridge_native_component_detach("recursive@1.0.0"); }
`;

const xsHooks = `#include <pthread.h>
extern void perl_native_reset(size_t, size_t, size_t);
extern size_t perl_native_live(void), perl_native_attempts(void), perl_native_decodes(void), perl_native_encodes(void);
extern uint32_t perl_native_initialize(void), perl_native_hold(void);
extern int perl_native_ready(void);
extern void perl_native_retire(void), perl_native_release(void), perl_native_detach(void);
static PerlInterpreter *probe_interpreter;
static pthread_t probe_thread;
static pid_t probe_pid;
#ifdef MULTIPLICITY
#define PROBE_CONTEXT aTHX
#else
#define PROBE_CONTEXT ((PerlInterpreter *)1)
#endif
static void lpg_check_context(pTHX) {
  if (probe_interpreter != PROBE_CONTEXT || probe_pid != getpid() || !pthread_equal(probe_thread, pthread_self()))
    croak("Graph probe requires its initiating process and Perl interpreter thread");
}
static uint32_t lpg_initialize(void) { return perl_native_initialize(); }
static int lpg_ready(void) { return perl_native_ready(); }
static void lpg_retire(void) { ++probe_retired; perl_native_retire(); }
#define recursive_tree_graph perl_native_tree
`;

export const nativeXs = `
void
native_reset(fail=0, bad=0, mode=0)
    unsigned int fail
    unsigned int bad
    unsigned int mode
  PPCODE:
    perl_native_reset(fail, bad, mode);

void
native_snapshot()
  PPCODE:
    EXTEND(SP, 5);
    PUSHs(sv_2mortal(newSVuv(perl_native_live()))); PUSHs(sv_2mortal(newSVuv(perl_native_attempts())));
    PUSHs(sv_2mortal(newSVuv(perl_native_decodes()))); PUSHs(sv_2mortal(newSVuv(perl_native_encodes())));
    PUSHs(boolSV(perl_native_ready()));

void
retire()
  PPCODE:
    perl_native_retire();

void
hold()
  PPCODE:
    XPUSHs(sv_2mortal(newSVuv(perl_native_hold())));

void
release()
  PPCODE:
    perl_native_release();

void
detach()
  PPCODE:
    perl_native_detach();

BOOT:
  probe_interpreter = PROBE_CONTEXT; probe_thread = pthread_self(); probe_pid = getpid();
`;

/**
 * Compile once per source path and run every selected Perl ABI independently.
 *
 * @param directory - Test-owned temporary workspace.
 */
export const checkPerlNativeGraphs = async directory => {
	const environment = nativeFixtureEnvironment(["perl"]), prefix = environment.LEAN_BRIDGE_LEAN_PREFIX;
	const runtime = await buildNativeSharedRuntime({ outputRoot: join(directory, "runtime"), leanPrefix: prefix });
	const original = await nativeRecursiveSource(), reviewedIr = nativeRecursiveReviewedIr();
	const fixture = await readFile("tests/fixtures/structured-types/recursive-perl-fixture.pl", "utf8");
	const probe = await readFile("tests/fixtures/structured-types/recursive-perl-lean.pl", "utf8");
	const observations = [];
	for(const reviewed of [false, true])
	{
		const root = join(directory, reviewed ? "reviewed" : "ordinary"), project = join(root, "project");
		await saveLakeFile(project, "Recursive.lean", original);
		await saveLakeFile(project, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
		await saveLakeFile(project, "lakefile.toml", 'name = "recursive"\nversion = "1.0.0"\n[[lean_lib]]\nname = "Recursive"\n');
		const selection = { schemaVersion: 1, modules: ["Recursive"] };
		if(!reviewed) selection.exports = reviewedIr.declarations.map(item => item.source.declaration);
		await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(selection));
		if(reviewed) await saveLakeFile(project, "reviewed.binding-ir.json", canonicalJson(reviewedIr));
		const compiled = await buildNativeComponent({ projectRoot: project, outputRoot: join(root, "component"), runtimeRoot: runtime.root, leanPrefix: prefix, targets: ["c"], copiedGraphs: true });
		const { model, receipt } = await readVerifiedNativeComponent(compiled.root, runtime.identity, { copiedGraphs: true });
		assert.equal(model.schemaVersion, reviewed ? 5 : 4);
		const native = generateNativeCopiedGraphAdapters(model.bindingIr, nativeGraphCarrierAbi(model), { initializer: receipt.initializer });
		const generated = generateCopiedPerlGraphXs(model.bindingIr, "LeanBridge::Recursive");
		assert.deepEqual(generated.layout, native.layout);
		await saveLakeFile(root, "recursive-graph.h", native.header);
		await saveLakeFile(root, "recursive-graph-types.h", native.typesHeader);
		const nativeSource = `${nativeHooks}\n${native.source}\n${nativeProbes}`;
		await saveLakeFile(root, "native.c", nativeSource);
		await runCopied("/usr/bin/cc", [
			"-std=c11", "-O2", "-Wall", "-Wextra", "-Werror", "-UNDEBUG", "-fPIC"
			, "-I", join(runtime.root, "include")
			, "-include", join(compiled.root, "component.h")
			, "-c", "native.c", "-o", "native.o"
		], root, environment);
		const xs = `${perlGraphInstrumentation}\n${xsHooks}\n${generated.source}\n${generated.xs}\n${perlGraphProbeXs}\n${nativeXs}`;
		await preparePerlGraphProbe(root, generated, xs, { objects: ["native.o"]
			, link: `-L${compiled.root} -L${join(runtime.root, "lib")} -l:${receipt.library} -llean_bridge_native -lleanshared -Wl,-rpath,${compiled.root}:${join(runtime.root, "lib")}` });
		await saveLakeFile(root, "check.pl", probe); await saveLakeFile(root, "fixture.pl", fixture);
		const scenarios = [];
		for(const perl of perlGraphCommands())
		{
			await compilePerlGraphProbe(root, perl);
			for(const mode of ["carrier", "raw", "during", "publication"])
			{
				const result = await runCopied(perl, ["-I", root, "check.pl", mode], root);
				assert.equal(result.stderr, ""); const report = JSON.parse(result.stdout);
				assert.ok(report.checks > 1000); assert.ok(report.nativeCheckpoints > 1); assert.ok(report.perlCheckpoints > 100);
				scenarios.push({ mode, ...report });
			}
		}
		observations.push({ reviewed
			, exports: generated.layout.roots.length, scenarios
			, modelSha256: receipt.modelSha256
			, binarySha256: receipt.nativeLibrary.sha256
			, sourceSha256: sha256(generated.source)
			, xsSha256: sha256(generated.xs)
			, valuesSha256: sha256(generated.valuesSource)
			, nativeSha256: sha256(nativeSource)
			, probeSha256: sha256(probe), fixtureSha256: sha256(fixture) });
	}
	return { schemaVersion: 1, compiledLean: true, installedPackage: false, observations };
};
