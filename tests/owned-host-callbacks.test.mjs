/**
 * Real compiled host callbacks for values containing explicitly owned resources.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedCPackage } from "../src/backends/c/owned-package.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { ownedHostCallbackReviewedIr } from "./helpers/owned-host-callback-fixture.mjs";
import { compileOwnedAggregateModel } from "../src/abi/owned-aggregate-model.mjs";
import { ownedCallbackRecovery } from "../src/build/owned-callback-carriers.mjs";

test("owned callback recovery needs real witnesses for opaque resources", () => {
	const model = compileOwnedAggregateModel(ownedHostCallbackReviewedIr());
	const byName = name => model.declarations.find(item => item.name === name);
	const callback = (name, index) => model.types.find(node => node.id === byName(name).parameters[index].type);
	const render = id => id.replaceAll(":", "_");
	assert.equal(ownedCallbackRecovery(model, callback("factory", 0), render), null);
	assert.ok(ownedCallbackRecovery(model, callback("construct", 1), render));
	assert.ok(ownedCallbackRecovery(model, callback("callbackRecursive", 1), render));
	const record = ownedCallbackRecovery(model, callback("callbackRecord", 1), render);
	assert.match(record[0], /:= a0$/u);
	assert.equal(record.at(-1), "recovery0");
});

test("CI enables actual owned host callbacks and retains both source paths", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const command = "LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test tests/owned-host-callbacks.test.mjs";
	assert.ok(workflow.includes("          " + command + "\n"));
	assert.ok(workflow.includes('consumer_command="$consumer_command && ' + command + '"'));
	for(const name of ["ordinary", "reviewed"])
	{
		assert.ok(workflow.includes(`test -s build/owned-host-callbacks/${name}.json`));
		assert.ok(workflow.includes(`            build/owned-host-callbacks/${name}.json\n`));
	}
});

test("owned host callback wrappers compile with typed recovery and matching C signatures", {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 600000
}, async t => {
	const fixture = await compileOwnedAggregateFixture(t, { hostCallbacks: true });
	assert.ok(fixture.hostCallbacks.length >= 2);
	assert.ok(fixture.hostCallbacks.every(callback => callback.automaticRecovery));
	assert.doesNotMatch(fixture.leanSource, /unsafe|sorry|panic!|default\s*:/);
});

for(const reviewed of [false, true]) test(`owned public C host callbacks preserve resources and recover from failed calls (${reviewed ? "reviewed" : "ordinary"})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 600000
}, async t => {
	const compiled = await compileOwnedAggregateFixture(t, { hostCallbacks: true
		, fixture: "owned-host-callbacks"
		, ...(reviewed ? { reviewedIr: ownedHostCallbackReviewedIr() } : {}) });
	const generated = generateOwnedCPackage({ metadata: compiled.metadata
		, sourceIdentity: compiled.sourceIdentity
		, component: compiled.model.component, hostCallbacks: true });
	assert.ok(generated.carriers.hostCallbacks.some(callback => !callback.automaticRecovery));
	const implementation = `#include <stddef.h>
extern void *owned_test_allocate(size_t);
extern void owned_test_free(void *);
#define LB_OWNED_ALLOC owned_test_allocate
#define LB_OWNED_FREE owned_test_free
${generated.source}
size_t owned_test_identities(void) {
  lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot);
  return snapshot.live_identities;
}
`;
	for(const [path, source] of Object.entries(generated.files))
		await saveLakeFile(compiled.directory, path.startsWith("src/") ? "public-api.c" : path.split("/").at(-1), path.startsWith("src/") ? implementation : source);
	const source = await readFile("tests/fixtures/structured-types/owned-host-callbacks.c", "utf8");
	const sanitized = await compiled.compile("host-callbacks-sanitized", source, true, ["public-api.c", "-lgmp"]);
	const cold = await sanitized([], { LSAN_OPTIONS: "exitcode=0", LEAN_BRIDGE_OWNED_COLD_ONLY: "1" });
	const checked = await sanitized([], { LSAN_OPTIONS: "exitcode=0" });
	assert.doesNotMatch(checked.stderr, /ERROR: AddressSanitizer|runtime error:/u);
	assert.deepEqual(JSON.parse(cold.stdout), { cold: true });
	const normalize = value => value.replace(/==\d+==/gu, "==PID==").replace(/0x[0-9a-f]+/gu, "ADDRESS");
	assert.equal(normalize(checked.stderr), normalize(cold.stderr), "Host callbacks added leaks beyond the unsuppressed cold control");
	const run = await compiled.compile("host-callbacks", source, false, ["public-api.c", "-lgmp"]);
	const relocations = await runCopied("/usr/bin/readelf", ["-rW", "host-callbacks"], compiled.directory);
	assert.doesNotMatch(relocations.stdout, /R_X86_64_COPY[^\n]*l_ByteArray_empty/u);
	const result = await run(); assert.equal(result.stderr, "");
	t.diagnostic(result.stdout);
	const observed = JSON.parse(result.stdout);
	assert.ok(observed.checks > 100); assert.ok(observed.failures > 10);
	assert.equal(observed.live, 0); assert.equal(observed.identities, 0);
	assert.deepEqual(JSON.parse(checked.stdout), observed);
	await saveLakeFile(resolve("build/owned-host-callbacks"), `${reviewed ? "reviewed" : "ordinary"}.json`, canonicalJson({
		result: observed, hostCallbacks: generated.carriers.hostCallbacks
		, bindingIrSha256: generated.layout.model.bindingIrSha256
		, sourceIdentitySha256: compiled.sourceIdentitySha256
		, headerSha256: sha256(generated.publicHeader)
		, adapterSha256: sha256(generated.source)
		, probeSha256: sha256(source), noLeanGlobalCopyRelocation: true
		, startupLeakBaseline: normalize(cold.stderr).replaceAll(compiled.directory, "<probe>")
	}));
});
