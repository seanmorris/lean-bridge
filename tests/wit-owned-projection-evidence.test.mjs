/**
 * Bind owned WIT projection evidence without promoting installed support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { compileCopiedWitModel } from "../src/backends/wit/copied-model.mjs";
import { compileCopiedWitGraphModel } from "../src/backends/wit/copied-graph-model.mjs";
import { compileCallableWitGraphModel } from "../src/backends/wit/callable-graph-model.mjs";
import { structuredCallableReviewedIr } from "./helpers/structured-callable-fixture.mjs";
import { nativeRecursiveReviewedIr } from "./helpers/native-recursive-reviewed.mjs";
import { nativeRecursiveCallableReviewedIr } from "./helpers/native-recursive-callable-fixture.mjs";
import { beforeOwnedJavaScriptNix, ownedJavaScriptNixHistoricalBytes } from "./helpers/owned-javascript-nix-history.mjs";
import { beforeOwnedWitProjection, ownedWitProjectionAddedPaths
	, ownedWitProjectionBaseline, ownedWitProjectionChangedPaths
	, ownedWitProjectionPath, ownedWitProjectionPrevious
	, reverseOwnedWitProjectionUpdate } from "./helpers/wit-owned-projection-history.mjs";

const read = async () => JSON.parse(await readFile(ownedWitProjectionPath, "utf8"));

test("owned WIT successor authenticates changes and preserves installed classifications", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "wit-owned-projection");
	assert.equal(record.planNode, 1219); assert.equal(record.baselineRevision, ownedWitProjectionBaseline);
	assert.deepEqual(record.previous, ownedWitProjectionPrevious);
	const previousBytes = await readFile(record.previous.path), previous = JSON.parse(previousBytes);
	assert.equal(sha256(previousBytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...new Set([...Object.keys(previous.sources), ...ownedWitProjectionAddedPaths])].sort());
	for(const [path, hash] of Object.entries(record.sources)) assert.equal(sha256(ownedJavaScriptNixHistoricalBytes(path, await readFile(path), hash)), hash, path);
	assert.deepEqual(record.updates.map(update => update.path), ownedWitProjectionChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path], update.path);
		assert.equal(update.currentSha256, record.sources[update.path], update.path);
		const current = beforeOwnedJavaScriptNix(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(beforeOwnedWitProjection(update.path, current)), update.previousSha256);
		assert.equal(beforeOwnedWitProjection(update.path, current, update.currentSha256), current);
	}
	const current = beforeOwnedJavaScriptNix("docs/type-surface.v1.json", await readFile("docs/type-surface.v1.json", "utf8"));
	const prior = JSON.parse(beforeOwnedWitProjection("docs/type-surface.v1.json", current));
	for(const evidence of prior.evidence) for(const file of evidence.files) file.sha256 = sha256(ownedJavaScriptNixHistoricalBytes(file.path, await readFile(file.path)));
	assert.deepEqual(JSON.parse(current), prior, "Projection tests cannot promote installed support");
});

test("owned WIT history rejects unknown edits, altered ancestors and overlapping spans", async () => {
	for(const update of (await read()).updates)
	{
		const current = beforeOwnedJavaScriptNix(update.path, await readFile(update.path, "utf8")), unknown = current + "\n/* unrelated */\n";
		assert.equal(beforeOwnedWitProjection(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedWitProjectionUpdate(unknown, update));
		for(const changed of [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unrecorded.mjs" }
			, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseOwnedWitProjectionUpdate(current, changed));
	}
});

test("owned WIT evidence retains the complete synthetic runtime and model test run", async () => {
	const record = await read(); assert.equal(record.acceptance, "passed");
	assert.deepEqual(record.scope, { canonicalRuntime: true
		, typedOwnedGraphProjection: true
		, compiledLean: false, installedPackages: false, supportPromotions: 0 });
	assert.deepEqual(Object.keys(record.runs), ["projection"]);
	const run = record.runs.projection;
	assert.equal(run.command, "source scripts/env.sh\nLEAN_BRIDGE_WIT_OWNED_CANONICAL_TEST=1 LEAN_BRIDGE_WASMTIME_C_API=/app/.toolchains/wasmtime42 node --test tests/wit-owned-canonical.test.mjs tests/wit-owned-graph-model.test.mjs");
	assert.equal(run.exitCode, 0); assert.equal(sha256(run.text), run.sha256);
	for(const [key, count] of Object.entries({ tests: 37, pass: 37, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
		assert.match(run.text, new RegExp("^# " + key + " " + count + "$", "mu"));
	assert.doesNotMatch(run.text, /^not ok|# SKIP|# TODO/mu);
	for(const mode of ["record", "list", "option-list", "variant", "indirect-variant", "wide-record", "alias", "result", "indirect-result", "tuple", "indirect-option-list", "mixed", "indirect-mixed", "list-mixed", "wide-variant"])
	{
		const transfers = mode === "list-mixed" ? 512 : mode.endsWith("mixed") ? 1024 : 0;
		assert.ok(run.text.includes(`# ${mode}: calls=1024 owned-result-drops=1024 transfers=${transfers} original-owner-live=true`));
	}
	assert.match(run.text, /ok 16 - missing cleanup reproduces the borrow-handle trap/u);
	assert.match(run.text, /owned WIT aliases preserve resource, scalar and container identities/u);
});

test("owned forwarding changes preserve predecessor copied and callable component bytes", () => {
	const structured = compileCopiedWitModel(structuredCallableReviewedIr(), {}, { callables: true });
	const graph = compileCopiedWitGraphModel(nativeRecursiveReviewedIr());
	const callable = compileCallableWitGraphModel(nativeRecursiveCallableReviewedIr());
	assert.equal(sha256(structured.wat), "7ea40ee30842bc4c318d3665a3a48a7e7091a64708bc7193a29cab6a76d7605b");
	assert.equal(sha256(graph.wat), "7183742583cbd1877df69499ee5b9262af57c8061eff2a5d48d63a5576ed04e3");
	assert.equal(sha256(callable.wat), "1f551167488ea4a16b015a35467d6280f94c98ee8ea33c324efa6bb8a92842e9");
});

test("WIT CI requires ownership projection checks with the component-enabled runtime", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	assert.match(workflow, /LEAN_BRIDGE_WIT_OWNED_CANONICAL_TEST: "1"/u);
	assert.match(workflow, /node --test tests\/wit-owned-canonical\.test\.mjs tests\/wit-owned-graph-model\.test\.mjs/u);
	const enforce = workflow.slice(workflow.indexOf("- name: Enforce WIT and WASI support"), workflow.indexOf("  docker-engine:"));
	assert.match(enforce, /steps\.owned_wit_projection\.outcome != 'success'/u);
});
