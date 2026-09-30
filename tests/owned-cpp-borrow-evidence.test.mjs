/**
 * Bind whole-value C++ result anchors to installed execution and exact sources.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertOwnedCppBorrowExecution, assertOwnedCppBorrowCi } from "./helpers/owned-cpp-borrow-evidence.mjs";
import { ownedCppBorrowPath, ownedCppBorrowBaseline, ownedCppBorrowPrevious
	, ownedCppBorrowAddedPaths, ownedCppBorrowChangedPaths, beforeOwnedCppBorrow
	, reverseOwnedCppBorrowUpdate } from "./helpers/owned-cpp-borrow-history.mjs";

const read = async () => JSON.parse(await readFile(ownedCppBorrowPath, "utf8"));

test("C++ borrow evidence authenticates unchanged predecessors and complete current sources", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-cpp-borrows");
	assert.equal(record.planNode, 1219); assert.equal(record.baselineRevision, ownedCppBorrowBaseline);
	assert.deepEqual(record.previous, ownedCppBorrowPrevious);
	const bytes = await readFile(record.previous.path), previous = JSON.parse(bytes);
	assert.equal(sha256(bytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...Object.keys(previous.sources), ...ownedCppBorrowAddedPaths].sort());
	for(const [path, hash] of Object.entries(record.sources)) assert.equal(sha256(await readFile(path)), hash, path);
	assert.deepEqual(record.updates.map(update => update.path), ownedCppBorrowChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path]);
		assert.equal(update.currentSha256, record.sources[update.path]);
		const source = await readFile(update.path, "utf8"), prior = beforeOwnedCppBorrow(update.path, source);
		assert.equal(sha256(prior), update.previousSha256);
		assert.equal(beforeOwnedCppBorrow(update.path, prior), prior);
		assert.equal(beforeOwnedCppBorrow(update.path, source, update.currentSha256), source);
		const unknown = source + "\n/* unrecorded change */\n";
		assert.equal(beforeOwnedCppBorrow(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedCppBorrowUpdate(unknown, update));
		for(const changed of [{ ...update, path: "unrelated.mjs" }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseOwnedCppBorrowUpdate(source, changed));
	}
	const current = await readFile("docs/type-surface.v1.json", "utf8");
	const prior = JSON.parse(beforeOwnedCppBorrow("docs/type-surface.v1.json", current));
	for(const evidence of prior.evidence) for(const file of evidence.files) file.sha256 = sha256(await readFile(file.path));
	assert.deepEqual(JSON.parse(current), prior);
});

test("C++ borrowed results require both real-Lean and relocated installed source paths", async () => {
	await assertOwnedCppBorrowExecution(await read());
});

test("C++ borrow evidence rejects missing execution, altered contracts and false scope", async () => {
	const record = await read();
	for(const mutate of [
		...["docker", "independentRebuild", "otherConsumerProjections", "receiverAnchors", "callbackResultAnchors"].map(key => value => { value.scope[key] = true; })
		, value => { value.scope.installedSupportPromotions = 1; }
		, value => { value.runs.headers.exitCode = 1; }
		, value => { value.runs.runtime.exitCode = 1; }
		, value => { value.runs.installed.text += "unknown"; }
		, value => { value.runs.runtime.text = value.runs.runtime.text.replace("# skipped 0", "# skipped 1"); value.runs.runtime.sha256 = sha256(value.runs.runtime.text); }
		, value => { value.runtime.pop(); }
		, value => { value.runtime[0].result.identities++; }
		, value => { value.runtime[1].sanitizer.before = 0; }
		, value => { value.runtime[0].rejectedMutations.pop(); }
		, value => { value.runtime[1].contract.resultAnchors.emptyValues = "discarded"; }
		, value => { value.packages.pop(); }
		, value => { value.packages[0].sourceFreeInstallation = false; }
		, value => { value.packages[1].checks.cmake = 0; }
		, value => { value.packages[0].consumerSha256 = "0".repeat(64); }
		, value => { value.packages[1].input.sourceIdentity.extractorSha256 = "0".repeat(64); }
		, value => { value.packages[0].model.ownedGraph.resultAnchors.exports[0].parameter = 999; }
		, value => { value.packages[1].adapterReceipt.cppValues.resultAnchors.expiration = "session-close"; }
		, value => { value.packages[0].documentation.stdout = "0\n"; }
		, value => { value.packages[1].forgedAnchorContractsRejected.pop(); }
	]) {
		const changed = structuredClone(record); mutate(changed);
		await assert.rejects(() => assertOwnedCppBorrowExecution(changed), undefined, mutate.toString());
	}
});

test("C++ borrowed-result CI requires enabled runtime and package tests with retained reports", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const manifest = JSON.parse(await readFile("package.json", "utf8"));
	assertOwnedCppBorrowCi(workflow, manifest);
	for(const line of [
		"          npm run test:owned-cpp-borrows > build/owned-cpp-borrows.log 2>&1"
		, "          rg '^# pass 5$' build/owned-cpp-borrows.log"
		, "          rg '^# fail 0$' build/owned-cpp-borrows.log"
		, "          rg '^# skipped 0$' build/owned-cpp-borrows.log"
		, "          test -s build/owned-cpp-borrows/ordinary.json"
		, "          test -s build/owned-cpp-borrows/reviewed.json"
		, "          test -s build/owned-cpp-borrow-packaging/ordinary.json"
		, "          test -s build/owned-cpp-borrow-packaging/reviewed.json"
		, "            build/owned-cpp-borrows/"
		, "            build/owned-cpp-borrow-packaging/"
		, "            build/owned-cpp-borrows.log"
	]) {
		assert.ok(workflow.includes(line + "\n"));
		assert.throws(() => assertOwnedCppBorrowCi(workflow.replace(line + "\n", ""), manifest));
	}
	const key = "test:owned-cpp-borrows";
	assert.throws(() => assertOwnedCppBorrowCi(workflow, { ...manifest, scripts: { ...manifest.scripts, [key]: manifest.scripts[key].replace("=1", "=0") } }));
});
