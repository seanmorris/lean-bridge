/**
 * Authenticate optimized JVM lifetimes without extending installed-package claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertOwnedJvmReceiverGcAcceptance } from "./helpers/owned-jvm-receiver-gc-evidence.mjs";
import { ownedJvmReceiverGcPath, ownedJvmReceiverGcBaseline, ownedJvmReceiverGcPrevious
	, ownedJvmReceiverGcChangedPaths, ownedJvmReceiverGcAddedPaths
	, beforeOwnedJvmReceiverGc, reverseOwnedJvmReceiverGcUpdate } from "./helpers/owned-jvm-receiver-gc-history.mjs";

const read = async () => JSON.parse(await readFile(ownedJvmReceiverGcPath, "utf8"));

test("JVM receiver GC history authenticates sources without changing support cells", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-jvm-receiver-gc");
	assert.equal(record.planNode, 1219); assert.equal(record.baselineRevision, ownedJvmReceiverGcBaseline);
	assert.deepEqual(record.previous, ownedJvmReceiverGcPrevious);
	const bytes = await readFile(record.previous.path), previous = JSON.parse(bytes);
	assert.equal(sha256(bytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...Object.keys(previous.sources), ...ownedJvmReceiverGcAddedPaths].sort());
	for(const [path, digest] of Object.entries(record.sources)) assert.equal(sha256(await readFile(path)), digest, path);
	assert.deepEqual(record.updates.map(update => update.path), ownedJvmReceiverGcChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path]);
		assert.equal(update.currentSha256, record.sources[update.path]);
		const source = await readFile(update.path, "utf8"), prior = beforeOwnedJvmReceiverGc(update.path, source);
		assert.equal(sha256(prior), update.previousSha256);
		assert.equal(beforeOwnedJvmReceiverGc(update.path, prior), prior);
		assert.equal(beforeOwnedJvmReceiverGc(update.path, source, update.currentSha256), source);
		const unknown = source + "\n/* unrecorded edit */\n";
		assert.equal(beforeOwnedJvmReceiverGc(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedJvmReceiverGcUpdate(unknown, update));
		for(const changed of [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, edits: [...update.edits, update.edits[0]] }
			, { ...update, path: "unknown.mjs" }])
			assert.throws(() => reverseOwnedJvmReceiverGcUpdate(source, changed));
	}
	const path = "docs/type-surface.v1.json", current = await readFile(path, "utf8");
	const prior = JSON.parse(beforeOwnedJvmReceiverGc(path, current));
	for(const evidence of prior.evidence) for(const file of evidence.files) file.sha256 = sha256(await readFile(file.path));
	assert.deepEqual(JSON.parse(current), prior);
});

test("JVM receiver GC evidence requires optimized Java and Kotlin calls from both author paths", async () => {
	await assertOwnedJvmReceiverGcAcceptance(await read());
});

test("JVM receiver GC evidence rejects missing collections, fences and optimizing compilation", async () => {
	const record = await read();
	await assertOwnedJvmReceiverGcAcceptance(record);
	for(const mutate of [
		value => { value.acceptance = "pending"; }
		, value => { value.scope.callbackResultAnchors = true; }
		, value => { value.scope.installedPackages = true; }
		, value => { value.scope.docker = true; }
		, value => { value.scope.installedSupportPromotions = 1; }
		, value => { value.run.exitCode = 1; }
		, value => { value.run.command += " || true"; }
		, value => { value.run.text += "unknown"; }
		, value => { value.run.text = value.run.text.replace("# skipped 0", "# skipped 1"); value.run.sha256 = sha256(value.run.text); }
		, value => { value.run.text = value.run.text.replace('"javaChecks":10627', '"javaChecks":10628'); value.run.sha256 = sha256(value.run.text); }
		, value => { value.run.text += value.run.text.split("\n").find(line => line.startsWith("# {")) + "\n"; value.run.sha256 = sha256(value.run.text); }
		, value => { value.runtime.pop(); }
		, value => { value.runtime[1].mode = "ordinary"; }
	]) {
		const changed = structuredClone(record); mutate(changed);
		await assert.rejects(() => assertOwnedJvmReceiverGcAcceptance(changed), undefined, mutate.toString());
	}
	for(const index of [0, 1]) for(const mutate of [
		value => { value.actualGc = false; }
		, value => { value.installedPackage = true; }
		, value => { value.input.receiverExports = false; }
		, value => { value.observed.live++; }
		, value => { value.observed.duringCalls = 0; }
		, value => { value.observed.javaCollected--; }
		, value => { value.observed.kotlinCollected--; }
		, value => { value.observed.rounds = 0; }
		, value => { value.restored.identities++; }
		, value => { value.optimized.pop(); }
		, value => { value.optimized[0].lines = []; }
		, value => { value.optimized[1].lines[0] = value.optimized[1].lines[0].replace("compiler='c2'", "compiler='c1'"); }
		, value => { value.javaProbeSha256 = "0".repeat(64); }
		, value => { value.kotlinProbeSha256 = "0".repeat(64); }
		, value => { value.instrumentedBindingsSha256 = "0".repeat(64); }
		, value => { value.nativeProbeSha256 = "0".repeat(64); }
		, value => { value.missingFencesRejected = false; }
		, value => { value.mutations.pop(); }
		, value => { value.mutations[0].compiled = false; }
		, value => { value.mutations[1].semanticRejection = false; }
		, value => { value.mutations[0].optimized.pop(); }
		, value => { value.mutations[1].optimized[0].lines = []; }
		, value => { value.mutations[0].optimized[1].lines[0] = value.mutations[0].optimized[1].lines[0].replace("compiler='c2'", "compiler='c1'"); }
		, value => { value.mutations[1].compilationSha256 = "0".repeat(64); }
	]) {
		const changed = structuredClone(record); mutate(changed.runtime[index]);
		await assert.rejects(() => assertOwnedJvmReceiverGcAcceptance(changed), undefined, mutate.toString());
	}
});
