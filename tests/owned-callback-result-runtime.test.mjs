/**
 * Execute callback-local lifetimes through fresh Lean and the public C API.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedCPackage } from "../src/backends/c/owned-package.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { ownedCallbackResultConfiguration, ownedCallbackResultReviewedIr, ownedCallbackResultSource } from "./helpers/owned-callback-result-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

for(const mode of ["ordinary", "reviewed"]) for(const hostCallbacks of [false, true])
	test(`callback result owners execute with host callbacks ${hostCallbacks} (${mode})`, {
		skip: process.env.LEAN_BRIDGE_OWNED_CALLBACK_RESULT_TEST !== "1"
		, timeout: 600000
	}, async t => {
		const compiled = await compileOwnedAggregateFixture(t, {
			...mode === "ordinary" ? { configuration: await ownedCallbackResultConfiguration() } : { reviewedIr: ownedCallbackResultReviewedIr() }
			, sourceSuffix: ownedCallbackResultSource, hostCallbacks
			, evidenceName: `callback-result-${mode}-${hostCallbacks}-inputs.json`
		});
		const input = { metadata: compiled.metadata
			, sourceIdentity: compiled.sourceIdentity
			, component: compiled.model.component
			, hostCallbacks, callbackResultAnchors: true };
		const generated = generateOwnedCPackage(input);
		assert.equal(generated.layout.functions.filter(item => item.anchor !== undefined).length, 0);
		assert.equal(generated.layout.callbacks.filter(item => item.anchor !== undefined).length, 4);
		assert.throws(() => generateOwnedCPackage(input, { anchoredResults: true }), /callback result anchors/u);
		assert.throws(() => generateOwnedCPackage({ ...input, callbackResultAnchors: false }), /explicit output leases/u);
		const implementation = source => `#include <stddef.h>
extern void *owned_test_allocate(size_t);
extern void owned_test_free(void *);
#define LB_OWNED_ALLOC owned_test_allocate
#define LB_OWNED_FREE owned_test_free
${source}
size_t owned_test_identities(void) {
  lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot);
  return snapshot.live_identities;
}
`;
		for(const [path, source] of Object.entries(generated.files))
			await saveLakeFile(compiled.directory, path.startsWith("src/") ? "public-api.c" : path.split("/").at(-1), path.startsWith("src/") ? implementation(generated.source) : source);
		const probe = `#define HOST_CALLBACKS ${Number(hostCallbacks)}\n` + await readFile("tests/fixtures/structured-types/owned-callback-results.c", "utf8");
		const execute = await compiled.compile("callback-results", probe, false, ["public-api.c", "-lgmp"]);
		const normal = await execute(), result = JSON.parse(normal.stdout);
		assert.equal(normal.stderr, ""); assert.ok(result.checks > 100);
		assert.ok(result.allocationFailures > 10); assert.equal(result.live, 0); assert.equal(result.identities, 0);
		const sanitized = await compiled.compile("callback-results-sanitized", probe, true, ["public-api.c", "-lgmp"]);
		const environment = { LSAN_OPTIONS: "exitcode=0" };
		const cold = await sanitized([], { ...environment, LEAN_BRIDGE_OWNED_COLD_ONLY: "1" });
		const exercised = await sanitized([], environment);
		const normalize = value => value.replace(/==\d+==/gu, "==PID==").replace(/0x[0-9a-f]+/gu, "ADDRESS");
		assert.deepEqual(JSON.parse(cold.stdout), { cold: true });
		assert.equal(exercised.stdout, normal.stdout);
		assert.doesNotMatch(exercised.stderr, /ERROR: AddressSanitizer|runtime error:/u);
		assert.equal(normalize(exercised.stderr), normalize(cold.stderr));
		const mutations = [
			{ name: "unchecked-anchor-input"
				, source: generated.source.replaceAll("transaction.anchor_input = 1;", "transaction.anchor_input = 0;") }
			, { name: "independent-result-owner"
				, source: generated.source.replace("transaction->anchor\n    ? lb_owned_scope_commit_borrow(&transaction->scope, &owner->batch, transaction->anchor, transaction->anchor_generation)\n    : ", "") }
		];
		if(hostCallbacks) mutations.push({ name: "expired-host-result-before-handoff"
			, source: generated.source.replace(/( {2}if \(!status\) status = oc_v\d+_to\(&reply,)/gu, "  (void)ov_owner_clear(&argument_owner);\n$1") });
		for(const mutation of mutations)
		{
			assert.notEqual(mutation.source, generated.source);
			await saveLakeFile(compiled.directory, "public-api.c", implementation(mutation.source));
			const broken = await compiled.compile(mutation.name, probe, false, ["public-api.c", "-lgmp"]);
			await assert.rejects(() => broken(), /callback result check failed/u, mutation.name);
		}
		await saveLakeFile(compiled.directory, "public-api.c", implementation(generated.source));
		const restored = await (await compiled.compile("callback-results-restored", probe, false, ["public-api.c", "-lgmp"]))();
		assert.equal(restored.stdout, normal.stdout); assert.equal(restored.stderr, "");
		await saveLakeFile(resolve("build/owned-callback-results"), `runtime-${mode}-${hostCallbacks}.json`, canonicalJson({
			mode, hostCallbacks, input, result, sourceSha256: sha256(generated.source)
			, probeSha256: sha256(probe), sanitizer: "address,undefined"
			, startupLeakBaseline: normalize(cold.stderr)
			, mutations: mutations.map(({ name, source }) => ({ name, sourceSha256: sha256(source), compiled: true, semanticRejection: true }))
			, restored: result
		}));
		t.diagnostic(JSON.stringify(result));
	});
