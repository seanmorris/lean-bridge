/**
 * Execute ownership-aware Ruby value and callback adapters against real Lean.
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
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

test("Ruby owned adapters keep bounded exact conversions and private pointer calls", () => {
	const model = generateOwnedRubyConversions(ownedCppCompositionReviewedIr());
	assert.equal(model.types.length, 41); assert.equal(model.callModels.length, 79);
	assert.match(model.source, /scope\.pin_lease/u);
	assert.match(model.source, /return status/u);
	assert.match(model.source, /TracePoint\.new\(:c_call\)/u);
	assert.match(model.cSource, /owned_aggregates_ruby_callback/u);
	assert.match(model.cSource, /host->call\(host->context, session/u);
	assert.match(model.cSource, /host1->call \? \(void \*\)host1 : host1->context/u);
	assert.match(ownedRubyRuntime(model.c.prefix), /handle_interrupt\(::Object => :never/u);
});

for(const scalar of [true, false]) for(const reviewed of [false, true]) test(`Ruby ${scalar ? "scalar" : "composed"} conversions execute compiled Lean (${reviewed ? "reviewed" : "ordinary"})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 900000
}, async t => {
	const compiled = await compileOwnedAggregateFixture(t, {
		fixture: scalar ? "owned-scalars" : "owned-cpp-composition"
		, hostCallbacks: true
		, ...scalar ? { witness: "import Owned\n" } : {}
		, ...reviewed ? { reviewedIr: scalar ? ownedPythonScalarsReviewedIr() : ownedCppCompositionReviewedIr() } : {}
	});
	const c = generateOwnedCPackage({ metadata: compiled.metadata
		, sourceIdentity: compiled.sourceIdentity
		, component: compiled.model.component, hostCallbacks: true });
	const model = generateOwnedRubyConversions(c.values.native.model.bindingIr);
	const implementation = `#include <stdlib.h>
#include <stddef.h>
static size_t live = 0; static ptrdiff_t fail_after = -1;
static void *allocate(size_t size) {
  if (fail_after == 0) return NULL;
  if (fail_after > 0) --fail_after;
  void *value = malloc(size); if (value) ++live; return value;
}
static void deallocate(void *value) { if (value) { --live; free(value); } }
#define LB_OWNED_ALLOC allocate
#define LB_OWNED_FREE deallocate
${c.source}
${model.cSource}
size_t owned_test_live(void) { return live; }
void owned_test_fail_after(ptrdiff_t point) { fail_after = point; }
size_t owned_test_identities(void) { lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot); return snapshot.live_identities; }
`;
	for(const [path, source] of Object.entries(c.files))
		await saveLakeFile(compiled.directory, path.startsWith("src/") ? "public-api.c" : path.split("/").at(-1), path.startsWith("src/") ? implementation : source);
	await runCopied("/usr/bin/cc", ["-std=c11", "-O1", "-g", "-Wall"
		, "-Wextra", "-Werror", "-fPIC", "-shared"
		, "-I", join(compiled.directory, "runtime/include"), "public-api.c"
		, "Owned.o", "Carriers.o", "Witness.o"
		, ...compiled.callbackSource ? ["Callbacks.o"] : []
		, "-L", join(compiled.directory, "runtime/lib")
		, "-llean_bridge_native", "-lleanshared", "-lgmp"
		, "-Wl,-rpath," + join(compiled.directory, "runtime/lib")
		, "-o", "libowned-ruby.so"], compiled.directory, { PATH: "/usr/bin:/bin" });
	const runtime = ownedRubyRuntime(c.values.prefix);
	const helpers = await readFile("tests/fixtures/structured-types/owned-ruby-probe.rb", "utf8");
	await saveLakeFile(compiled.directory, "runtime.rb", `module LeanBridge\nmodule ${model.componentName}\n${runtime}\nend\nend\n`);
	await saveLakeFile(compiled.directory, "values.rb", model.valuesSource);
	const table = new Map(model.types.map(node => [node.id, node]));
	const introspection = model.types.map(node => `${JSON.stringify(node.name ?? node.id)} => { index: ${node.index}, size: ${node.size}, alignment: ${node.alignment}, aggregate: ${node.aggregate}, pack: ${node.pack ? JSON.stringify(node.pack) : "nil"}, fields: [${node.fields.map(field => `{ name: ${JSON.stringify(field.publicName ?? field.name)}, offset: ${field.offset}, index: ${table.get(field.type).index}, pointer: ${field.pointer} }`).join(", ")}] }`);
	await saveLakeFile(compiled.directory, "native.rb", model.source + `\n${model.namespace}.const_get(:Native).const_set(:TYPE_INFO, {${introspection.join(", ")}})\n`);
	await saveLakeFile(compiled.directory, "probe.rb", helpers);
	const observations = [], probes = [];
	for(const mode of scalar ? ["scalars"] : ["values", "malformed", "callables"])
	{
		const path = `tests/fixtures/structured-types/owned-ruby-${mode === "malformed" ? "values" : mode}.rb`;
		const source = await readFile(path, "utf8");
		await saveLakeFile(compiled.directory, "consumer.rb", source);
		const result = await runCopied(resolve(process.env.LEAN_BRIDGE_RUBY ?? ".toolchains/ruby33/bin/ruby"), ["--disable-gems", "consumer.rb", join(compiled.directory, "libowned-ruby.so"), mode], compiled.directory, { PATH: "/usr/bin:/bin" });
		assert.equal(result.stderr, "");
		const observed = JSON.parse(result.stdout);
		assert.equal(observed.live, 0); assert.equal(observed.identities, 0);
		if(scalar) assert.equal(observed.primitives, 19);
		if(mode !== "malformed")
		{ assert.ok(observed.nativeFaults > 0); assert.equal(observed.rubyFaults, observed.rubyCheckpoints); assert.ok(observed.rubyFaults > 0); }
		observations.push({ mode, ...observed }); probes.push({ path, sha256: sha256(source) });
		t.diagnostic(JSON.stringify(observations.at(-1)));
	}
	await saveLakeFile(resolve("build/owned-ruby-conversions"), `${scalar ? "scalars-" : ""}${reviewed ? "reviewed" : "ordinary"}.json`, canonicalJson({
		observations, compiledLean: true, installedPackage: false
		, sourceIdentitySha256: compiled.sourceIdentitySha256
		, bindingIr: c.values.native.model.bindingIr, runtimeSha256: sha256(runtime)
		, valuesSha256: sha256(model.valuesSource)
		, conversionsSha256: sha256(model.source)
		, boundarySha256: sha256(model.cSource)
		, helpersSha256: sha256(helpers), probes
	}));
});
