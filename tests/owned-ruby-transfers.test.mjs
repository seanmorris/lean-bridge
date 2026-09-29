/**
 * Ruby consuming inputs at the compiled Lean handoff on both authoring paths.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedCPackage } from "../src/backends/c/owned-package.mjs";
import { generateOwnedRubyConversions } from "../src/backends/ruby/owned-conversions.mjs";
import { ownedRubyRuntime } from "../src/backends/ruby/owned-runtime.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { ownedCppCompositionReviewedIr } from "./helpers/owned-cpp-composition-fixture.mjs";
import { ownedPythonScalarsReviewedIr } from "./helpers/owned-python-scalars-fixture.mjs";
import { ownedRustTransferReviewedIr, ownedRustTransferConfiguration, ownedRustTransferSource } from "./helpers/owned-rust-transfer-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

test("Ruby consuming inputs require explicit capability without changing borrowed APIs", () => {
	const ir = ownedRustTransferReviewedIr(), original = structuredClone(ir);
	assert.throws(() => generateOwnedRubyConversions(ir), /call-scoped input borrows/u);
	const generated = generateOwnedRubyConversions(ir, { transferredInputs: true });
	assert.deepEqual(ir, original);
	assert.equal(generated.c.functions.filter(fn => fn.transfers?.length).length, 20);
	assert.equal(generated.valuesSource.split("# Consumes resource leases in ").length - 1, 20);
	assert.match(generated.valuesSource, /# Consumes resource leases in arg0, arg2 at the Lean call boundary\./u);
	assert.match(generated.cSource, /arg0, owned_aggregates_result \*\*input_owner0/u);
	assert.match(generated.source, /moves\.arm/u);
	assert.match(generated.source, /scope\.moves\.add/u);
	const reversed = structuredClone(ir); reversed.types.reverse();
	const reordered = generateOwnedRubyConversions(reversed, { transferredInputs: true });
	for(const key of ["valuesSource", "source", "cSource"]) assert.equal(reordered[key], generated[key]);
	for(const fixture of [ownedCppCompositionReviewedIr, ownedPythonScalarsReviewedIr])
	{
		const original = generateOwnedRubyConversions(fixture());
		const enabled = generateOwnedRubyConversions(fixture(), { transferredInputs: true });
		for(const key of ["valuesSource", "source", "cSource"]) assert.equal(enabled[key], original[key]);
	}
});

for(const mode of ["ordinary", "reviewed"]) test(`Ruby leases move at the compiled Lean handoff (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_RUBY_TRANSFER_TEST !== "1", timeout: 900000
}, async t => {
	const compiled = await compileOwnedAggregateFixture(t, {
		...(mode === "ordinary" ? { configuration: await ownedRustTransferConfiguration() } : { reviewedIr: ownedRustTransferReviewedIr() })
		, hostCallbacks: true, sourceSuffix: ownedRustTransferSource
		, evidenceName: `ruby-transfers-${mode}-inputs.json`
	});
	const c = generateOwnedCPackage({ metadata: compiled.metadata
		, sourceIdentity: compiled.sourceIdentity, component: compiled.model.component
		, hostCallbacks: true, transferredInputs: true });
	const generated = generateOwnedRubyConversions(c.values.native.model.bindingIr, { transferredInputs: true });
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
${generated.cSource}
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
		, "-o", "libowned-ruby-transfers.so"]
	, compiled.directory, { PATH: "/usr/bin:/bin" });
	const runtime = ownedRubyRuntime(c.values.prefix, { transferredInputs: true });
	const helpers = await readFile("tests/fixtures/structured-types/owned-ruby-probe.rb", "utf8");
	const source = await readFile("tests/fixtures/structured-types/owned-ruby-transfers.rb", "utf8");
	await saveLakeFile(compiled.directory, "runtime.rb", `module LeanBridge\nmodule ${generated.componentName}\n${runtime}\nend\nend\n`);
	await saveLakeFile(compiled.directory, "values.rb", generated.valuesSource);
	await saveLakeFile(compiled.directory, "native.rb", generated.source);
	await saveLakeFile(compiled.directory, "probe.rb", helpers);
	await saveLakeFile(compiled.directory, "consumer.rb", source);
	let executed;
	try
	{ executed = await runCopied(resolve(process.env.LEAN_BRIDGE_RUBY ?? ".toolchains/ruby33/bin/ruby"), ["--disable-gems", "consumer.rb", join(compiled.directory, "libowned-ruby-transfers.so")], compiled.directory, { PATH: "/usr/bin:/bin" }); }
	catch(error)
	{ throw new Error(JSON.stringify(error.details), { cause: error }); }
	assert.equal(executed.stderr, ""); const observed = JSON.parse(executed.stdout);
	assert.ok(observed.checks > 500);
	for(const key of ["rubyBefore", "rubyAfter", "nativeBefore", "nativeAfter"
		, "multiRubyBefore", "multiRubyAfter"
		, "multiNativeBefore", "multiNativeAfter"])
		assert.ok(observed[key] > 0, key);
	assert.equal(observed.live, 0); assert.equal(observed.identities, 0);
	t.diagnostic(JSON.stringify(observed));
	await saveLakeFile(resolve("build/owned-ruby-transfers"), `${mode}.json`, canonicalJson({
		mode, actualLean: true, installedPackage: false, observed
		, input: { metadata: compiled.metadata, sourceIdentity: compiled.sourceIdentity, component: compiled.model.component }
		, publicSha256: sha256(generated.valuesSource)
		, conversionsSha256: sha256(generated.source)
		, boundarySha256: sha256(generated.cSource), runtimeSha256: sha256(runtime)
		, helpersSha256: sha256(helpers), probeSha256: sha256(source)
	}));
});
