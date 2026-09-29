/**
 * Python consuming inputs at the real Lean handoff, on both authoring paths.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedCPackage } from "../src/backends/c/owned-package.mjs";
import { generateOwnedPythonConversions } from "../src/backends/python/owned-conversions.mjs";
import { ownedPythonRuntime } from "../src/backends/python/owned-runtime.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { ownedAggregateReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import { ownedRustTransferReviewedIr, ownedRustTransferConfiguration, ownedRustTransferSource } from "./helpers/owned-rust-transfer-fixture.mjs";
import { pythonGraphInterpreters } from "./helpers/python-graph-probes.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

test("Python consuming inputs require explicit capability and preserve borrow-only output", () => {
	const ir = ownedRustTransferReviewedIr(), before = structuredClone(ir);
	assert.throws(() => generateOwnedPythonConversions(ir), /call-scoped input borrows/u);
	const generated = generateOwnedPythonConversions(ir, { transferredInputs: true });
	assert.deepEqual(ir, before);
	assert.equal(generated.c.functions.filter(fn => fn.transfers?.length).length, 20);
	assert.equal(generated.valuesSource.split('"""Consume resource leases in ').length - 1, 20);
	assert.equal(generated.stub.split('"""Consume resource leases in ').length - 1, 20);
	for(const key of ["valuesSource", "stub"]) assert.match(generated[key]
		, /def bundle\([^\n]+\n {4}"""Consume resource leases in arg0, arg2 at the Lean call boundary\./u);
	assert.match(generated.source, /moves\.arm\(\)/u);
	assert.match(generated.source, /scope\.moves\.add\(value\._lease/u);
	const reversed = structuredClone(ir); reversed.types.reverse();
	const reordered = generateOwnedPythonConversions(reversed, { transferredInputs: true });
	for(const key of ["valuesSource", "stub", "source"]) assert.equal(reordered[key], generated[key]);
	const borrowed = ownedAggregateReviewedIr();
	const enabled = generateOwnedPythonConversions(borrowed, { transferredInputs: true });
	const baseline = generateOwnedPythonConversions(borrowed);
	for(const key of ["valuesSource", "stub", "source"]) assert.equal(enabled[key], baseline[key]);
});

for(const mode of ["ordinary", "reviewed"]) test(`Python leases move at the compiled Lean handoff (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_PYTHON_TRANSFER_TEST !== "1"
	, timeout: 900000
}, async t => {
	// Reuse the independently authored twenty-contract Lean fixture, not a
	// model inferred from the Python generator or its observed output.
	const compiled = await compileOwnedAggregateFixture(t, {
		...(mode === "ordinary" ? { configuration: await ownedRustTransferConfiguration() } : { reviewedIr: ownedRustTransferReviewedIr() })
		, hostCallbacks: true, sourceSuffix: ownedRustTransferSource
		, evidenceName: `python-transfers-${mode}-inputs.json`
	});
	const c = generateOwnedCPackage({ metadata: compiled.metadata
		, sourceIdentity: compiled.sourceIdentity, component: compiled.model.component
		, hostCallbacks: true, transferredInputs: true });
	const generated = generateOwnedPythonConversions(c.values.native.model.bindingIr, { transferredInputs: true });
	const handoff = "static inline void oc_transfer_consume(void *context) {";
	assert.ok(c.source.includes(handoff));
	const implementation = `#include <stdlib.h>
#include <stddef.h>
static size_t live, handoffs; static ptrdiff_t fail_after = -1;
static void *allocate(size_t size) {
  if (fail_after == 0) return NULL;
  if (fail_after > 0) --fail_after;
  void *value = malloc(size); if (value) ++live; return value;
}
static void deallocate(void *value) { if (value) { --live; free(value); } }
#define LB_OWNED_ALLOC allocate
#define LB_OWNED_FREE deallocate
${c.source.replace(handoff, handoff + "\n  ++handoffs;")}
size_t owned_test_live(void) { return live; }
size_t owned_test_handoffs(void) { return handoffs; }
void owned_test_fail_after(ptrdiff_t value) { fail_after = value; }
size_t owned_test_identities(void) { lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot); return snapshot.live_identities; }
`;
	for(const [path, source] of Object.entries(c.files))
		await saveLakeFile(compiled.directory, path.startsWith("src/") ? "public-api.c" : path.split("/").at(-1), path.startsWith("src/") ? implementation : source);
	await runCopied("/usr/bin/cc", ["-std=c11", "-O1", "-g", "-Wall"
		, "-Wextra", "-Werror", "-fPIC", "-shared"
		, "-I", join(compiled.directory, "runtime/include")
		, "public-api.c", "Owned.o", "Carriers.o", "Witness.o", "Callbacks.o"
		, "-L", join(compiled.directory, "runtime/lib")
		, "-llean_bridge_native", "-lleanshared", "-lgmp", "-Wl,--no-undefined"
		, "-Wl,-rpath," + join(compiled.directory, "runtime/lib")
		, "-o", "libowned-python-transfers.so"]
	, compiled.directory, { PATH: "/usr/bin:/bin" });
	const runtime = ownedPythonRuntime(c.values.prefix, { transferredInputs: true });
	const probe = await readFile("tests/fixtures/structured-types/owned-python-transfers.py", "utf8");
	const observations = [];
	for(const interpreter of await pythonGraphInterpreters(compiled.directory))
	{
		const root = join(interpreter.site, generated.packageDir);
		await saveLakeFile(root, "__init__.py", generated.valuesSource);
		await saveLakeFile(root, "__init__.pyi", generated.stub);
		await saveLakeFile(root, "_owned.py", runtime);
		await saveLakeFile(root, "_native.py", generated.source);
		await saveLakeFile(interpreter.directory, "probe.py", probe);
		let observed;
		try
		{ observed = await runCopied(interpreter.command, ["-I", "-B", "probe.py", join(compiled.directory, "libowned-python-transfers.so")], interpreter.directory); }
		catch(error)
		{ throw new Error(JSON.stringify(error.details), { cause: error }); }
		assert.equal(observed.stderr, ""); const result = JSON.parse(observed.stdout);
		assert.ok(result.checks > 500);
		for(const key of ["pythonBefore", "pythonAfter", "nativeBefore", "nativeAfter"
			, "multiPythonBefore", "multiPythonAfter"
			, "multiNativeBefore", "multiNativeAfter"])
			assert.ok(result[key] > 0, key);
		assert.equal(result.live, 0); assert.equal(result.identities, 0);
		observations.push({ name: interpreter.name, typing: interpreter.typing, ...result });
		t.diagnostic(JSON.stringify(observations.at(-1)));
	}
	await saveLakeFile(resolve("build/owned-python-transfers"), `${mode}.json`, canonicalJson({
		mode, actualLean: true, installedPackage: false, observations
		, input: { metadata: compiled.metadata, sourceIdentity: compiled.sourceIdentity, component: compiled.model.component }
		, publicSha256: sha256(generated.valuesSource)
		, stubSha256: sha256(generated.stub)
		, conversionsSha256: sha256(generated.source), runtimeSha256: sha256(runtime)
		, probeSha256: sha256(probe), nativeSha256: sha256(implementation)
	}));
});
