/**
 * Exercise original owner anchors through the public C API and compiled Lean.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedCPackage } from "../src/backends/c/owned-package.mjs";
import { generateOwnedCValues } from "../src/backends/c/owned-values.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../src/build/native-graph-model.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { ownedBorrowConfiguration, ownedBorrowReviewedIr, ownedBorrowSource } from "./helpers/owned-borrow-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("C borrowed results require the original anchor owner and an explicit backend capability", () => {
	const ir = ownedBorrowReviewedIr({ mixed: true });
	assert.throws(() => generateOwnedCValues(ir, { transferredInputs: true }), /explicit output leases/u);
	const values = generateOwnedCValues(ir, { transferredInputs: true, anchoredResults: true, hostCallbacks: true });
	assert.equal(values.functions.filter(item => item.anchor !== undefined).length, 19);
	assert.match(values.header, /owned_aggregates_retain_ticket\(owned_aggregates_session \*session, owned_aggregates_ticket_t a0, owned_aggregates_result \*a0_owner,/u);
	assert.match(values.header, /owned_aggregates_ticket_t_equal/u);
	assert.match(values.header, /owned_aggregates_result_validate/u);
});

for(const mode of ["ordinary", "reviewed"]) test(`${mode} C borrowed results expire with their exact owner across calls and reentry`, {
	skip: process.env.LEAN_BRIDGE_OWNED_BORROW_TEST !== "1", timeout: 600000
}, async t => {
	const compiled = await compileOwnedAggregateFixture(t, {
		...mode === "ordinary" ? { configuration: await ownedBorrowConfiguration({ mixed: true }) } : { reviewedIr: ownedBorrowReviewedIr({ mixed: true }) }
		, hostCallbacks: true, sourceSuffix: ownedBorrowSource
		, evidenceName: `borrow-c-${mode}-inputs.json`
	});
	const options = {
		metadata: compiled.metadata, sourceIdentity: compiled.sourceIdentity
		, component: compiled.model.component
		, hostCallbacks: true
		, transferredInputs: true
		, anchoredResults: true
	};
	const generated = generateOwnedCPackage(options);
	const capabilities = { ownedGraphs: true, ownedHostCallbacks: true
		, ownedInputTransfers: true, ownedAnchoredResults: true };
	assert.throws(() => createCompiledNativeModel(options, { ...capabilities, ownedAnchoredResults: false }), { code: "native-owned-anchors-unavailable" });
	assert.throws(() => createCompiledNativeModel(options, { ...capabilities, ownedAnchoredResults: "true" }), /must be explicit/u);
	assert.throws(() => createCompiledNativeModel(options, { ownedAnchoredResults: true }), /ownership-aware/u);
	const model = createCompiledNativeModel(options, capabilities);
	assert.equal(model.schemaVersion, 9); assert.equal(model.ownedGraph.schemaVersion, 4);
	assert.equal(model.ownedGraph.resultAnchors.exports.length, 19);
	assert.deepEqual(model.ownedGraph.resultAnchors.exports.find(item => item.bindingId === "lean:Owned.bundle"), { bindingId: "lean:Owned.bundle", parameter: 2 });
	assert.ok(generateCompiledNativeLeanAdapters(model).callbackSource);
	for(const mutate of [
		value => { delete value.ownedGraph.resultAnchors; }
		, value => { value.ownedGraph.resultAnchors.exports.pop(); }
		, value => { value.ownedGraph.resultAnchors.exports[0].parameter = 999; }
		, value => { value.ownedGraph.resultAnchors.expiration = "session-close"; }
		, value => { value.ownedGraph.resultAnchors.maximumDepth = 256; }
		, value => { value.schemaVersion = 8; value.ownedGraph.schemaVersion = 3; }
	]) {
		const changed = structuredClone(model); mutate(changed);
		assert.throws(() => generateCompiledNativeLeanAdapters(changed));
	}
	const withoutCallbacks = createCompiledNativeModel(options, { ...capabilities, ownedHostCallbacks: false });
	assert.equal(generateCompiledNativeLeanAdapters(withoutCallbacks).callbackSource, undefined);
	assert.throws(() => generateOwnedCPackage({ ...options, anchoredResults: false }), /explicit output leases/u);
	assert.throws(() => generateOwnedCPackage(options, { transferredInputs: true }), /does not support anchored results/u);
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
	for(const [name, source] of Object.entries(generated.files))
		await saveLakeFile(compiled.directory, name.startsWith("src/") ? "public-api.c" : name.split("/").at(-1)
			, name.startsWith("src/") ? implementation(source) : source);
	const copies = [
		["OPTION", "echoOption"], ["ARRAY", "echoArray"], ["LIST", "echoList"]
		, ["RESULT", "echoResult"]
		, ["TUPLE", "echoTuple"]
		, ["ROW", "echoRow"]
		, ["NESTED", "echoNested"]
	];
	await saveLakeFile(compiled.directory, "borrow-copies.h", copies.map(([macro, name]) => {
		const type = generated.values.functions.find(item => item.name === name).parameters[0];
		return `#define COPY_${macro} ${generated.values.copies.find(item => item.id === type).cName}`;
	}).join("\n") + "\n");
	const source = await readFile("tests/fixtures/structured-types/owned-public-borrows.c", "utf8");
	const run = await compiled.compile(`${mode}-borrowed`, source, false, ["public-api.c", "-lgmp"]);
	const normal = await run(); assert.equal(normal.stderr, "");
	const result = JSON.parse(normal.stdout); assert.ok(result.checks > 100);
	assert.equal(result.live, 0); assert.equal(result.identities, 0);
	const sanitized = await compiled.compile(`${mode}-borrowed-sanitized`, source, true, ["public-api.c", "-lgmp"]);
	const environment = { LSAN_OPTIONS: "exitcode=0" };
	const cold = await sanitized([], { ...environment, LEAN_BRIDGE_OWNED_COLD_ONLY: "1" });
	const exercised = await sanitized([], environment);
	const normalize = value => value.replace(/==\d+==/gu, "==PID==").replace(/0x[0-9a-f]+/gu, "ADDRESS");
	assert.deepEqual(JSON.parse(cold.stdout), { cold: true });
	assert.deepEqual(JSON.parse(exercised.stdout), result);
	assert.equal(normalize(exercised.stderr), normalize(cold.stderr));
	assert.doesNotMatch(exercised.stderr, /ERROR: AddressSanitizer|runtime error:/u);
	const mutations = [
		{ name: "unbound-result"
			, before: "status = transaction->anchor\n    ? lb_owned_scope_commit_borrow"
			, after: "status = 0\n    ? lb_owned_scope_commit_borrow" }
		, { name: "canonical-view-escape"
			, before: "if (!arena->view_batch) { *out = token; return LB_OWNED_OK; }"
			, after: "if (1) { *out = token; return LB_OWNED_OK; }" }
		, { name: "missing-owner-membership"
			, before: "transaction->anchor_input\n  ?"
			, after: "0\n  ?", all: true }
		, { name: "missing-view-identity-release"
			, before: "if (lean_bridge_native_identity_release(view->key,"
			, after: "if (0 && lean_bridge_native_identity_release(view->key," }
		, { name: "callback-view-escape"
			, before: ", .view_batch = &argument_owner.batch, .views = &argument_views"
			, after: ", .views = &argument_views", all: true }
		, { name: "missing-ancestor-transfer-check"
			, before: "if (ancestor == candidate) return LB_OWNED_INVALID;"
			, after: "if (0 && ancestor == candidate) return LB_OWNED_INVALID;" }
	];
	for(const mutation of mutations)
	{
		assert.ok(generated.source.includes(mutation.before), mutation.name);
		const changed = mutation.all ? generated.source.replaceAll(mutation.before, mutation.after)
			: generated.source.replace(mutation.before, mutation.after);
		assert.notEqual(changed, generated.source);
		await saveLakeFile(compiled.directory, "public-api.c", implementation(changed));
		const broken = await compiled.compile(`${mode}-${mutation.name}`, source, false, ["public-api.c", "-lgmp"]);
		await assert.rejects(() => broken(), /borrow C check failed/u, mutation.name);
	}
	const report = {
		mode, result, realLean: true, anchoredResults: 19, consumingFunctions: 2
		, adapterSha256: sha256(generated.source), probeSha256: sha256(source)
		, inputs: { metadata: compiled.metadata
			, sourceIdentity: compiled.sourceIdentity
			, component: compiled.model.component }
		, sanitizer: "address,undefined", leakBaselineUnchanged: true
		, rejectedMutations: mutations.map(item => item.name)
		, model, modelContractTamperingRejected: true
	};
	await saveLakeFile(resolve("build/owned-borrows"), `c-${mode}.json`, canonicalJson(report));
	t.diagnostic(JSON.stringify({ mode, ...result }));
});
