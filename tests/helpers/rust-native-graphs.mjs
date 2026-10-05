/**
 * Compile ordinary/reviewed Lean graphs and exercise the Rust conversion boundary.
 * These are compiled interop probes, not installed Cargo package acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildNativeComponent, buildNativeSharedRuntime } from "../../src/build/native-component.mjs";
import { readVerifiedNativeComponent } from "../../src/build/native-artifacts.mjs";
import { nativeGraphCarrierAbi } from "../../src/build/native-graph-model.mjs";
import { generateNativeCopiedGraphAdapters } from "../../src/backends/c/native-graph-adapters.mjs";
import { generateCopiedRustGraphConversions } from "../../src/backends/rust/copied-graph-conversions.mjs";
import { copiedRustLock } from "../../src/backends/rust/copied-values.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { nativeRecursiveReviewedIr } from "./native-recursive-reviewed.mjs";
import { nativeRecursiveSource } from "./native-recursive-transport.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { nativeFixtureEnvironment } from "./copied-fixture-install.mjs";

/**
 * Test fresh compiler artifacts on both paths with separate retirement processes.
 *
 * @param directory - New test-owned temporary directory.
 */
export const checkRustNativeGraphs = async directory => {
	const environment = nativeFixtureEnvironment(["rust"]), prefix = environment.LEAN_BRIDGE_LEAN_PREFIX;
	const runtime = await buildNativeSharedRuntime({ outputRoot: join(directory, "runtime"), leanPrefix: prefix });
	const original = await nativeRecursiveSource(), reviewedIr = nativeRecursiveReviewedIr();
	const probe = await readFile("tests/fixtures/structured-types/recursive-rust-lean.rs", "utf8");
	const observations = [];
	for(const reviewed of [false, true])
	{
		const root = join(directory, reviewed ? "reviewed" : "ordinary"), project = join(root, "project");
		await saveLakeFile(project, "Recursive.lean", original);
		await saveLakeFile(project, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
		await saveLakeFile(project, "lakefile.toml", 'name = "recursive"\nversion = "1.0.0"\n[[lean_lib]]\nname = "Recursive"\n');
		await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson({
			schemaVersion: 1
			, modules: ["Recursive"]
			, ...reviewed ? {} : { exports: reviewedIr.declarations.map(item => item.source.declaration) } }));
		if(reviewed) await saveLakeFile(project, "reviewed.binding-ir.json", canonicalJson(reviewedIr));
		const compiled = await buildNativeComponent({
			projectRoot: project
			, outputRoot: join(root, "component")
			, runtimeRoot: runtime.root
			, leanPrefix: prefix
			, targets: ["c"]
			, copiedGraphs: true });
		const { model, receipt } = await readVerifiedNativeComponent(compiled.root, runtime.identity, { copiedGraphs: true });
		assert.equal(model.schemaVersion, reviewed ? 5 : 4);
		const native = generateNativeCopiedGraphAdapters(model.bindingIr, nativeGraphCarrierAbi(model), { initializer: receipt.initializer });
		const generated = generateCopiedRustGraphConversions(model.bindingIr);
		assert.deepEqual(generated.layout, native.layout);
		await saveLakeFile(root, "recursive-graph.h", native.header);
		await saveLakeFile(root, "recursive-graph-types.h", native.typesHeader);
		const fixture = `#include <lean/lean.h>
#include <assert.h>
#include <stdlib.h>
static size_t native_live, native_attempts, native_fail, native_decodes, native_encodes, native_bad;
static void *rust_malloc(size_t size) {
  if (++native_attempts == native_fail) return NULL;
  void *value = malloc(size); if (value) ++native_live; return value;
}
static void rust_free(void *value) { assert(value && native_live); --native_live; free(value); }
static lean_object *rust_encode(lean_object *value) {
  if (++native_encodes == native_bad) { lean_dec(value); return lean_alloc_array(0, 0); }
  return value;
}
#define LB_GRAPH_MALLOC rust_malloc
#define LB_GRAPH_FREE rust_free
#define LB_GRAPH_DECODE() (++native_decodes)
#define LB_GRAPH_ENCODE(value) rust_encode(value)
${native.source}
void rust_native_reset(size_t fail, size_t bad) { native_attempts = native_decodes = native_encodes = 0; native_fail = fail; native_bad = bad; }
size_t rust_native_live(void) { return native_live; }
size_t rust_native_attempts(void) { return native_attempts; }
size_t rust_native_decodes(void) { return native_decodes; }
uint32_t rust_native_initialize(void) { return lean_bridge_native_component_initialize("recursive@1.0.0", ng_initialize) ? 0 : 5; }
int rust_native_ready(void) { return ng_ready(); }
void rust_native_retire(void) { lean_bridge_native_runtime_retire(); }
static recursive_scalars_t retained;
uint32_t rust_native_hold(void) {
  recursive_scalars_t input = {0}; input.text.data = "retained"; input.text.length = 8;
  return recursive_scalars_graph(&input, &retained);
}
void rust_native_release(void) { recursive_scalars_t_clear(&retained); }
void rust_native_detach(void) { lean_bridge_native_component_detach("recursive@1.0.0"); }
`;
		await saveLakeFile(root, "native.c", fixture);
		const env = { ...environment
			, RUSTC: environment.LEAN_BRIDGE_RUSTC
			, RUSTFLAGS: `-Dwarnings -Lnative=${root} -ldylib=rust-native-test -Clink-arg=-Wl,-rpath,${root}`
			, CARGO_NET_OFFLINE: "true"
			, CARGO_INCREMENTAL: "0"
			, CARGO_HOME: process.env.CARGO_HOME ?? resolve(".toolchains/cargo-copied")
			, CARGO_TARGET_DIR: join(root, "target") };
		const run = (command, args, extra = {}) => processBuildRunner.capture({ command, args, cwd: root, env: { ...env, ...extra }, timeoutMs: 180_000 })
			.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		await run("cc", [
			"-std=c11", "-O2", "-Wall", "-Wextra", "-Werror", "-UNDEBUG", "-fPIC"
			, "-I", join(runtime.root, "include")
			, "-include", join(compiled.root, "component.h")
			, "-c", "native.c", "-o", "native.o"]);
		// Preserve the shared C boundary. Linking Lean's unwinder directly into a
		// Rust executable can interpose libgcc_s and invalidate panic cleanup tests.
		await run("cc", [
			"-shared", "native.o", "-L", compiled.root
			, "-L", join(runtime.root, "lib")
			, `-l:${receipt.library}`, "-llean_bridge_native", "-lleanshared"
			, "-Wl,--no-undefined"
			, `-Wl,-rpath,${compiled.root}:${join(runtime.root, "lib")}`
			, "-o", "librust-native-test.so"]);
		const raw = new Map(generated.rawTypes.map(node => [node.id, node.name]));
		const host = new Map(generated.types.map(node => [node.id, node.name]));
		const input = new Map(generated.inputTypes.map(node => [node.id, node.name]));
		const wrappers = generated.layout.roots.map(fn => {
			const name = fn.name.slice(generated.layout.prefix.length + 1), args = fn.parameters.map((_, i) => `arg${i}`);
			const signature = [...fn.parameters.map((id, i) => `${args[i]}: *const ${raw.get(id)}`), `out: *mut ${raw.get(fn.result)}`].join(", ");
			return `unsafe extern "C" { fn ${fn.name}_graph(${signature}) -> u32; }
fn call_${name}(${fn.parameters.map((id, i) => `${args[i]}: &${input.get(id)}`).join(", ")}) -> Result<${host.get(fn.result)}, GraphError> {
    unsafe { graph_call_${name}_guarded(Some(&LIFECYCLE), ${fn.name}_graph${args.map(arg => `, ${arg}`).join("")}) }
}`;
		});
		const treeRaw = raw.get(generated.layout.roots.find(fn => fn.name === "recursive_tree").result);
		const wide = `fn wide_value() -> Wide { Wide::Next { ${Array.from({ length: 255 }, (_, i) => `field${i}: ${i},`).join(" ")} child: Box::new(Wide::Leaf { value: 17 }) } }`;
		await saveLakeFile(root, "Cargo.toml", '[package]\nname="recursive-lean"\nversion="1.0.0"\nedition="2021"\n[dependencies]\nnum-bigint="=0.4.6"\nsha2="=0.10.9"\n[profile.dev]\ndebug=0\nincremental=false\n');
		await saveLakeFile(root, "Cargo.lock", await copiedRustLock("recursive-lean", "1.0.0"));
		await saveLakeFile(root, "src/lib.rs", generated.valuesSource + "\nmod native;\n");
		await saveLakeFile(root, "src/native.rs", generated.source + `\n#[cfg(test)] mod tests { use super::*;\ntype TreeRaw = ${treeRaw};\n${wrappers.join("\n")}\n${wide}\n${probe}\n}`);
		const scenarios = [];
		for(const mode of ["carrier", "raw", "during"])
		{
			const observed = await run(environment.LEAN_BRIDGE_CARGO, ["test", "--offline", "--locked", "--lib", "--", "--nocapture", "--test-threads=1"], { LEAN_BRIDGE_GRAPH_FAILURE: mode });
			assert.match(observed.stdout, /1 passed; 0 failed/);
			const counts = observed.stdout.match(/rust-lean-graphs:(\d+):(\d+):(\d+)/);
			assert.ok(counts, observed.stdout);
			scenarios.push({ mode, checks: Number(counts[1]), nativeCheckpoints: Number(counts[2]), rustCheckpoints: Number(counts[3]), stdout: observed.stdout });
		}
		observations.push({
			reviewed
			, exports: generated.layout.roots.length
			, scenarios
			, modelSha256: receipt.modelSha256
			, binarySha256: receipt.nativeLibrary.sha256
			, rustSourceSha256: sha256(generated.source)
			, rustValuesSha256: sha256(generated.valuesSource)
			, nativeSourceSha256: sha256(fixture)
			, probeSha256: sha256(probe) });
	}
	return { schemaVersion: 1, compiledLean: true, installedPackage: false, observations };
};
