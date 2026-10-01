/**
 * Authenticate source history and reject incomplete WIT borrowed-result claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { classifyRepositoryTest } from "../src/adoption/test-profiles.mjs";
import { assertOwnedWitBorrowExecution } from "./helpers/wit-owned-borrow-evidence.mjs";
import { ownedWitBorrowPath, ownedWitBorrowBaseline, ownedWitBorrowPrevious
	, ownedWitBorrowChangedPaths, ownedWitBorrowAddedPaths
	, beforeOwnedWitBorrow, reverseOwnedWitBorrowUpdate } from "./helpers/wit-owned-borrow-history.mjs";

const read = async () => JSON.parse(await readFile(ownedWitBorrowPath, "utf8"));

test("WIT borrowed results preserve predecessor sources without support promotions", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "wit-owned-borrows");
	assert.equal(record.planNode, 1219); assert.equal(record.baselineRevision, ownedWitBorrowBaseline);
	assert.deepEqual(record.previous, ownedWitBorrowPrevious);
	const bytes = await readFile(record.previous.path), previous = JSON.parse(bytes);
	assert.equal(sha256(bytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...Object.keys(previous.sources), ...ownedWitBorrowAddedPaths].sort());
	for(const [path, identity] of Object.entries(record.sources)) assert.equal(sha256(await readFile(path)), identity, path);
	assert.deepEqual(record.updates.map(update => update.path), ownedWitBorrowChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path]);
		assert.equal(update.currentSha256, record.sources[update.path]);
		const source = await readFile(update.path, "utf8"), prior = beforeOwnedWitBorrow(update.path, source);
		assert.equal(sha256(prior), update.previousSha256);
		assert.equal(beforeOwnedWitBorrow(update.path, prior), prior);
		assert.equal(beforeOwnedWitBorrow(update.path, source, update.currentSha256), source);
		const unknown = source + "\n/* unrecorded edit */\n";
		assert.equal(beforeOwnedWitBorrow(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedWitBorrowUpdate(unknown, update));
		for(const changed of [{ ...update, path: "unrelated.mjs" }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseOwnedWitBorrowUpdate(source, changed));
	}
	const path = "docs/type-surface.v1.json", current = await readFile(path, "utf8");
	const prior = JSON.parse(beforeOwnedWitBorrow(path, current));
	for(const evidence of prior.evidence) for(const file of evidence.files) file.sha256 = sha256(await readFile(file.path));
	assert.deepEqual(JSON.parse(current), prior, "Source refresh must not promote unrelated support cells");
	for(const name of ["wit-owned-borrows", "wit-owned-borrow-packaging", "wit-owned-borrow-evidence"])
		assert.equal(classifyRepositoryTest(`tests/${name}.test.mjs`), "contract");
});

test("WIT borrowed-result evidence reconstructs compiled and installed execution", async () => {
	await assertOwnedWitBorrowExecution(await read());
});

test("WIT borrowed-result evidence rejects missing execution and inflated scope", async () => {
	const record = await read();
	for(const mutate of [
		value => { value.acceptance = "pending"; }
		, value => { value.scope.receiverAnchors = true; }
		, value => { value.scope.callbackResultAnchors = true; }
		, value => { value.scope.callerOwnedStores = true; }
		, value => { value.scope.standaloneWasi = true; }
		, value => { value.scope.docker = true; }
		, value => { value.scope.installedSupportPromotions = 1; }
		, value => { value.run.exitCode = 1; }
		, value => { value.run.text += "unrecorded"; }
		, value => { value.run.text = value.run.text.replace("# skipped 0", "# skipped 1"); value.run.sha256 = sha256(value.run.text); }
		, value => { value.runtime.pop(); }
		, value => { value.runtime[0].sourceSha256 = "0".repeat(64); }
		, value => { value.runtime[0].manifest.graph.resultAnchors.pop(); }
		, value => { value.runtime[1].counts.exports--; }
		, value => { value.runtime[1].counts.nativeImports--; }
		, value => { value.runtime[1].result.afterFailures = 0; }
		, value => { value.runtime[1].result.identities++; }
		, value => { value.runtime[0].mutations.pop(); }
		, value => { value.runtime[1].mutations[0].compiled = false; }
		, value => { value.borrowOnly[0].result.emptyShapes = 0; }
		, value => { value.borrowOnly[0].result.maximumBorrowDepth--; }
		, value => { value.borrowOnly[1].input.transferredInputs = true; }
		, value => { value.borrowOnly[1].result.live++; }
		, value => { value.packages[0].sourceRemovedBeforeInstall = false; }
		, value => { value.packages[0].cliRemovedBeforeConsumerInstall = false; }
		, value => { value.packages[1].installedCli.filesVerified--; }
		, value => { value.packages[1].installedCli.offlineInstall = false; }
		, value => { value.packages[1].installedCli.report.files[0].sha256 = "0".repeat(64); }
		, value => { value.packages[1].cliBuilds.pop(); }
		, value => { value.packages[1].cliVerification.status = "failed"; }
		, value => { value.packages[1].independentRebuild = false; }
		, value => { value.packages[1].documentation.stdout = "42\n"; }
		, value => { value.packages[1].model.ownedGraph.resultAnchors.exports.pop(); }
		, value => { value.packages[0].rejected = 0; }
		, value => { value.packages[0].loader.reports.pop(); }
	]) {
		const changed = structuredClone(record); mutate(changed);
		await assert.rejects(() => assertOwnedWitBorrowExecution(changed), undefined, mutate.toString());
	}
});
