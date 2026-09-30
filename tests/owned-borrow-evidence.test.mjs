/**
 * Bind C result anchors to installed execution, current sources and required CI.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { beforeOwnedCppBorrow } from "./helpers/owned-cpp-borrow-history.mjs";
import { assertOwnedBorrowCiRepair } from "./helpers/owned-borrow-ci-evidence.mjs";
import { beforeOwnedBorrowCi, ownedBorrowCiHistoricalBytes, ownedBorrowCiPath
	, reverseOwnedBorrowCiUpdate } from "./helpers/owned-borrow-ci-history.mjs";
import { assertOwnedBorrowExecution, assertOwnedBorrowCi } from "./helpers/owned-borrow-evidence.mjs";
import { ownedBorrowPath, ownedBorrowBaseline, ownedBorrowPrevious
	, ownedBorrowAddedPaths, ownedBorrowChangedPaths, beforeOwnedBorrow
	, reverseOwnedBorrowUpdate } from "./helpers/owned-borrow-history.mjs";

const read = async () => JSON.parse(await readFile(ownedBorrowPath, "utf8"));

test("C result-anchor evidence preserves immutable predecessors and binds current source", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-borrow-results");
	assert.equal(record.planNode, 1219); assert.equal(record.baselineRevision, ownedBorrowBaseline);
	assert.deepEqual(record.previous, ownedBorrowPrevious);
	const bytes = await readFile(record.previous.path), previous = JSON.parse(bytes);
	assert.equal(sha256(bytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...Object.keys(previous.sources), ...ownedBorrowAddedPaths].sort());
	for(const [path, hash] of Object.entries(record.sources)) assert.equal(sha256(ownedBorrowCiHistoricalBytes(path, await readFile(path), hash)), hash, path);
	assert.deepEqual(record.updates.map(update => update.path), ownedBorrowChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path]);
		assert.equal(update.currentSha256, record.sources[update.path]);
		const source = beforeOwnedBorrowCi(update.path, await readFile(update.path, "utf8"), update.currentSha256), prior = beforeOwnedBorrow(update.path, source);
		assert.equal(sha256(prior), update.previousSha256);
		assert.equal(beforeOwnedBorrow(update.path, prior), prior);
		assert.equal(beforeOwnedBorrow(update.path, source, update.currentSha256), source);
		const unknown = source + "\n/* unrelated */\n";
		assert.equal(beforeOwnedBorrow(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedBorrowUpdate(unknown, update));
		for(const altered of [{ ...update, path: "unknown.mjs" }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseOwnedBorrowUpdate(source, altered));
	}
	const current = beforeOwnedBorrowCi("docs/type-surface.v1.json", await readFile("docs/type-surface.v1.json", "utf8"));
	const prior = JSON.parse(beforeOwnedBorrow("docs/type-surface.v1.json", current));
	for(const evidence of prior.evidence) for(const file of evidence.files) file.sha256 = sha256(ownedBorrowCiHistoricalBytes(file.path, await readFile(file.path), record.sources[file.path]));
	assert.deepEqual(JSON.parse(current), prior);
});

test("extractor-history repair authenticates frozen transfer receipts without changing them", async () => {
	await assertOwnedBorrowCiRepair(JSON.parse(await readFile(ownedBorrowCiPath, "utf8")));
});

test("extractor-history repair rejects unrelated edits and forged reversal identities", async () => {
	const record = JSON.parse(await readFile(ownedBorrowCiPath, "utf8"));
	for(const update of record.updates)
	{
		const source = beforeOwnedCppBorrow(update.path, await readFile(update.path, "utf8"), update.currentSha256), unknown = source + "\n/* unrelated */\n";
		assert.equal(beforeOwnedBorrowCi(update.path, unknown), unknown);
		assert.equal(beforeOwnedBorrowCi(update.path, source, update.currentSha256), source);
		assert.throws(() => reverseOwnedBorrowCiUpdate(unknown, update));
		assert.throws(() => reverseOwnedBorrowCiUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reverseOwnedBorrowCiUpdate(source, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
	for(const mutate of [
		value => { value.extractor.previousSha256 = "0".repeat(64); }
		, value => { value.repairedReceipts.pop(); }
		, value => { value.typeSupportPromotions = 1; }
	]) {
		const changed = structuredClone(record); mutate(changed);
		await assert.rejects(() => assertOwnedBorrowCiRepair(changed));
	}
});

test("C result anchors require compiled and relocated installed evidence", async () => {
	await assertOwnedBorrowExecution(await read());
});

test("C result-anchor evidence rejects missing execution and false scope claims", async () => {
	const record = await read();
	for(const mutate of [
		...["docker", "independentRebuild", "otherConsumerProjections", "receiverAnchors", "callbackResultAnchors"].map(key => value => { value.scope[key] = true; })
		, value => { value.scope.installedSupportPromotions = 1; }
		, value => { value.runs.installed.exitCode = 1; }
		, value => { value.runs.runtime.text += "unknown"; }
		, value => { value.runs.runtime.text = value.runs.runtime.text.replace("# skipped 0", "# skipped 1"); value.runs.runtime.sha256 = sha256(value.runs.runtime.text); }
		, value => { value.native.liveAllocations++; }
		, value => { value.native.rejectedMutations.pop(); }
		, value => { value.analyses[0].borrowedOnlyC.stdout = "0\n"; }
		, value => { value.runtime.pop(); }
		, value => { value.runtime[0].result.identities++; }
		, value => { value.runtime[1].result.beforeFailures = 0; }
		, value => { value.runtime[0].adapterSha256 = "0".repeat(64); }
		, value => { value.runtime[1].rejectedMutations.pop(); }
		, value => { value.packages[0].sourceFreeInstallation = false; }
		, value => { value.packages[1].checks.cmake = 0; }
		, value => { value.packages[0].model.ownedGraph.resultAnchors.exports[0].parameter = 999; }
		, value => { value.packages[1].adapterReceipt.ownedValues.resultAnchors.expiration = "session-close"; }
		, value => { value.packages[0].documentation.stdout = "0\n"; }
	]) {
		const changed = structuredClone(record); mutate(changed);
		await assert.rejects(() => assertOwnedBorrowExecution(changed), undefined, mutate.toString());
	}
});

test("C result-anchor CI requires both enabled gates and retained reports", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const manifest = JSON.parse(await readFile("package.json", "utf8"));
	assertOwnedBorrowCi(workflow, manifest);
	for(const command of [
		"          npm run test:owned-borrows > build/owned-borrows-runtime.log 2>&1"
		, "          rg '^# skipped 0$' build/owned-borrows-runtime.log"
		, "          rg '^# pass 2$' build/owned-borrows-installed.log"
		, "          test -s build/owned-borrows/installed-reviewed.json"
		, "            build/owned-borrows/"
	]) {
		assert.ok(workflow.includes(command + "\n"));
		assert.throws(() => assertOwnedBorrowCi(workflow.replace(command + "\n", ""), manifest));
	}
	for(const key of ["test:owned-borrows", "test:owned-borrow-packages"])
		assert.throws(() => assertOwnedBorrowCi(workflow, { ...manifest, scripts: { ...manifest.scripts, [key]: manifest.scripts[key].replace("=1", "=0") } }));
});
