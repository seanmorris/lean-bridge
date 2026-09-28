/**
 * Execute bounded PHP owned converters against fresh ordinary and reviewed Lean.
 *
 * @file
 */
import assert from "node:assert/strict";
import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedCPackage } from "../src/backends/c/owned-package.mjs";
import { generateOwnedPhpConversions } from "../src/backends/php/owned-conversions.mjs";
import { ownedPhpRuntime } from "../src/backends/php/owned-runtime.mjs";
import { copiedPhpLoader } from "../src/backends/php/copied-assets.mjs";
import { bundledBrickMath } from "../src/backends/php/brick-math.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { ownedCppCompositionReviewedIr } from "./helpers/owned-cpp-composition-fixture.mjs";
import { ownedPythonScalarsReviewedIr } from "./helpers/owned-python-scalars-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

test("native PHP owned schemas preserve finite C layouts and all nineteen primitives", () => {
	for(const fixture of [ownedCppCompositionReviewedIr, ownedPythonScalarsReviewedIr])
	{
		const ir = fixture(), before = structuredClone(ir), model = generateOwnedPhpConversions(ir);
		assert.deepEqual(ir, before); assert.deepEqual(model.files, generateOwnedPhpConversions(ir).files);
		assert.equal(model.descriptors.length, model.types.length);
		assert.match(model.nativeSource, /mpz_sizeinbase/u);
		assert.doesNotMatch(model.definitions, /#include|extern "C"/u);
		for(const [index, node] of model.types.entries())
		{
			assert.equal(model.descriptors[index].ctype, node.cName);
			assert.equal(model.descriptors[index].identity, node.identity);
			assert.equal(model.descriptors[index].leaf, node.leaf);
		}
		if(fixture === ownedPythonScalarsReviewedIr) assert.equal(model.types.filter(node => node.kind === "primitive").length, 19);
	}
});

test("generated owned PHP converters load with FFI disabled", {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1"
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-owned-php-load-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	for(const fixture of [ownedCppCompositionReviewedIr, ownedPythonScalarsReviewedIr])
	{
		const model = generateOwnedPhpConversions(fixture());
		for(const [path, source] of Object.entries(model.files)) await saveLakeFile(directory, path, source);
		const result = await runCopied(process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php", ["-d"
			, "ffi.enable=0", "-r"
			, "require 'src/Api.php'; require 'src/Internal/OwnedConversions.php'; echo 'loaded';"], directory);
		assert.equal(result.stdout, "loaded"); assert.equal(result.stderr, "");
	}
});

for(const scalar of [true, false]) for(const reviewed of [false, true]) test(`native PHP ${scalar ? "scalar" : "composed"} converters execute Lean (${reviewed ? "reviewed" : "ordinary"})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 600000
}, async t => {
	const compiled = await compileOwnedAggregateFixture(t, { fixture: scalar ? "owned-scalars" : "owned-cpp-composition"
		, hostCallbacks: true, ...scalar ? { witness: "import Owned\n" } : {}
		, ...reviewed ? { reviewedIr: scalar ? ownedPythonScalarsReviewedIr() : ownedCppCompositionReviewedIr() } : {} });
	const generated = generateOwnedCPackage({ metadata: compiled.metadata
		, sourceIdentity: compiled.sourceIdentity
		, component: compiled.model.component, hostCallbacks: true });
	const model = generateOwnedPhpConversions(generated.values.native.model.bindingIr), p = model.c.prefix;
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
${generated.source}
${model.nativeSource}
size_t owned_test_live(void) { return live; }
void owned_test_fail_after(ptrdiff_t value) { fail_after = value; }
size_t owned_test_identities(void) {
  lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot); return snapshot.live_identities;
}
`;
	for(const [path, source] of Object.entries(generated.files))
		await saveLakeFile(compiled.directory, path.startsWith("src/") ? "public-api.c" : path.split("/").at(-1), path.startsWith("src/") ? implementation : source);
	await runCopied("/usr/bin/cc", ["-std=c11", "-O1", "-g", "-Wall"
		, "-Wextra", "-Werror", "-fPIC", "-shared"
		, "-I", join(compiled.directory, "runtime/include")
		, "public-api.c", "Owned.o", "Carriers.o", "Witness.o"
		, ...compiled.callbackSource ? ["Callbacks.o"] : []
		, "-L", join(compiled.directory, "runtime/lib")
		, "-llean_bridge_native", "-lleanshared", "-lgmp"
		, "-Wl,-rpath," + join(compiled.directory, "runtime/lib")
		, "-o", "libowned-php.so"], compiled.directory, { PATH: "/usr/bin:/bin" });
	await copyFile(join(compiled.directory, "libowned-php.so"), join(compiled.directory, "runtime/lib/libowned-php.so"));
	const runtime = ownedPhpRuntime(p), probe = await readFile("tests/fixtures/structured-types/owned-php-conversions.php", "utf8");
	const helpers = await readFile("tests/fixtures/structured-types/owned-php-conversion-probe.php", "utf8");
	for(const [path, source] of Object.entries({ ...model.files, ...bundledBrickMath() })) await saveLakeFile(compiled.directory, path, source);
	await saveLakeFile(compiled.directory, "src/Internal/OwnedRuntime.php", `<?php\ndeclare(strict_types=1);\nnamespace ${model.namespace}\\Internal;\n${runtime}`);
	await saveLakeFile(compiled.directory, "loader.php", copiedPhpLoader);
	await saveLakeFile(compiled.directory, "consumer.php", probe);
	await saveLakeFile(compiled.directory, "probe.php", helpers);
	const indices = new Map(model.types.map(node => [node.id, node.index]));
	const calls = Object.fromEntries([...model.c.functions, ...model.c.callbacks, ...model.c.retains, ...model.c.copies].map(fn => [
		fn.retain ? `retain:${indices.get(fn.id)}` : fn.copy ? `copy:${indices.get(fn.id)}`
			: model.c.callbacks.includes(fn) ? `closure:${indices.get(fn.id)}` : fn.name
		, { symbol: fn.cName
			, parameters: fn.parameters.map((id, index) => ({ type: indices.get(id), host: model.c.hostArgument(fn, index) }))
			, result: indices.get(fn.result) }
	]));
	await saveLakeFile(compiled.directory, "probe-model.json", canonicalJson({ calls
		, types: Object.fromEntries(model.types.map(node => [node.name ?? node.id, node.index])) }));
	const loadOrder = ["libleanshared.so", "liblean_bridge_native.so", "libowned-php.so"], libraries = {};
	for(const name of loadOrder) libraries[name] = sha256(await readFile(join(compiled.directory, "runtime/lib", name)));
	await saveLakeFile(compiled.directory, "native-evidence.json", canonicalJson({ libraries
		, loadOrder
		, library: "libowned-php.so"
		, componentId: generated.layout.model.bindingIr.component.id
		, runtimeIdentity: sha256(canonicalJson(loadOrder.slice(0, 2).map(name => libraries[name])))
		, identity: sha256(implementation) }));
	const result = await runCopied(process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php", ["-d", "ffi.enable=1", "-d", "display_errors=stderr", "consumer.php", scalar ? "scalars" : "composition"], compiled.directory);
	assert.equal(result.stderr, ""); const observation = JSON.parse(result.stdout);
	assert.ok(observation.checks > 80); assert.ok(observation.phpFailures > 0); assert.ok(observation.nativeFailures > 0);
	assert.equal(observation.live, 0); assert.equal(observation.identities, 0);
	if(scalar) assert.equal(observation.primitives, 19);
	t.diagnostic(JSON.stringify(observation));
	await saveLakeFile("build/owned-php-conversions", `${scalar ? "scalars" : "composition"}-${reviewed ? "reviewed" : "ordinary"}.json`, canonicalJson({
		observation, compiledLean: true, installedPackage: false, phpCallbacks: false
		, sourceIdentitySha256: compiled.sourceIdentitySha256
		, files: Object.fromEntries(Object.entries(model.files).map(([path, source]) => [path, sha256(source)]))
		, nativeSha256: sha256(model.nativeSource), runtimeSha256: sha256(runtime)
		, probeSha256: sha256(probe), helpersSha256: sha256(helpers)
	}));
});
