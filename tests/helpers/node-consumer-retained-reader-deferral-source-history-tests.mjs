/**
 * Authenticate the Node consumer lane's retained-reader deferral.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import {
	assertNodeConsumerRetainedReaderDeferral
	, beforeNodeConsumerRetainedReaderDeferralSource
	, nodeConsumerRetainedReaderDeferralFamilies
	, nodeConsumerRetainedReaderDeferralHistoryAdditions
	, nodeConsumerRetainedReaderDeferralHistoryPath
	, nodeConsumerRetainedReaderDeferralImplementation
	, nodeConsumerRetainedReaderDeferralImplementationAdditions
	, nodeConsumerRetainedReaderDeferralImplementationPaths
	, nodeConsumerRetainedReaderDeferralIntegrationPaths
	, nodeConsumerRetainedReaderDeferralLoaders
	, nodeConsumerRetainedReaderDeferralPredecessor
	, reverseNodeConsumerRetainedReaderDeferralUpdate
} from "./node-consumer-retained-reader-deferral-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone, sourceAtFinHistoryRecordSource }
	from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	nodeConsumerRetainedReaderDeferralHistoryPath, "utf8"));
const blobDigest = (commit, path) => sha256(git([
	"show", `${commit}:${path}`
]));
const blobSource = path => git(["show"
	, `${nodeConsumerRetainedReaderDeferralImplementation}:${path}`]);
const implementationSources = () => Object.fromEntries([
	...nodeConsumerRetainedReaderDeferralImplementationPaths
	, ...nodeConsumerRetainedReaderDeferralImplementationAdditions
].map(path => [path, blobSource(path)]));
const expectedBehavior = {
	deferredLoaders: 7, retainedFamilies: 7, extractedTests: 1
	, staticRetainedReaders: 0, changedSupportCells: 0
	, runtimeSemanticChanges: 0
};

test("retained-reader deferral records the exact hosted ENOENT failure", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "node-consumer-retained-reader-deferral-v1");
	assert.equal(value.predecessorCommit
		, nodeConsumerRetainedReaderDeferralPredecessor);
	assert.equal(value.implementationCommit
		, nodeConsumerRetainedReaderDeferralImplementation);
	assert.equal(git(["rev-parse"
		, `${nodeConsumerRetainedReaderDeferralImplementation}^`]).trim()
	, nodeConsumerRetainedReaderDeferralPredecessor);
	assert.deepEqual(value.failedRun, {
		workflow: 42177405137, job: 127767402756
		, headSha: "aa3297a61bfdb1bcb7a0c56b6efd9eaebf04e0f1"
		, jobName: "Node and browser npm consumers"
		, step: "Compile locked and dependency-free projects and install relocated npm releases offline"
	});
	assert.deepEqual(value.missingFamilies
		, [...nodeConsumerRetainedReaderDeferralFamilies]);
	assert.deepEqual(value.behavior, expectedBehavior);
	assert.equal(value.changedSupportCells, 0);
	assert.equal(value.runtimeSemanticChanges, 0);
	assert.deepEqual(value.updates.map(item => item.path)
		, nodeConsumerRetainedReaderDeferralImplementationPaths);
	assert.deepEqual(value.implementationAdditions.map(item => item.path)
		, nodeConsumerRetainedReaderDeferralImplementationAdditions);
	assert.deepEqual(value.integrationUpdates.map(item => item.path)
		, nodeConsumerRetainedReaderDeferralIntegrationPaths);
	assert.deepEqual(value.historyAdditions.map(item => item.path)
		, nodeConsumerRetainedReaderDeferralHistoryAdditions);
	assert.deepEqual(git(["diff", "--name-only", "--diff-filter=M"
		, nodeConsumerRetainedReaderDeferralPredecessor
		, nodeConsumerRetainedReaderDeferralImplementation, "--"])
		.trim().split("\n").sort()
	, [...nodeConsumerRetainedReaderDeferralImplementationPaths].sort());
	assert.deepEqual(git(["diff", "--name-only", "--diff-filter=A"
		, nodeConsumerRetainedReaderDeferralPredecessor
		, nodeConsumerRetainedReaderDeferralImplementation, "--"])
		.trim().split("\n").sort()
	, [...nodeConsumerRetainedReaderDeferralImplementationAdditions].sort());
});

test("retained-reader deferral keeps every reader behind a loader", () => {
	const sources = implementationSources();
	assert.deepEqual(assertNodeConsumerRetainedReaderDeferral(sources)
		, expectedBehavior);
	for(const loader of nodeConsumerRetainedReaderDeferralLoaders)
	{
		const eager = structuredClone(sources);
		eager[loader.parent] = `import "${loader.module}";\n`
			+ eager[loader.parent];
		assert.throws(() => assertNodeConsumerRetainedReaderDeferral(eager)
			, { name: "AssertionError" }, `eager ${loader.module}`);
		const dropped = structuredClone(sources);
		dropped[loader.parent] = dropped[loader.parent].replace(
			`() => import("${loader.module}")`, "() => Promise.resolve()");
		assert.notEqual(dropped[loader.parent], sources[loader.parent]);
		assert.throws(() => assertNodeConsumerRetainedReaderDeferral(dropped)
			, { name: "AssertionError" }, `dropped ${loader.module}`);
	}
	const restored = structuredClone(sources);
	restored["tests/helpers/reviewed-fin-wasm-contract-tests.mjs"]
		+= sources["tests/helpers/reviewed-fin-wasm-archived-identity-tests.mjs"];
	assert.throws(() => assertNodeConsumerRetainedReaderDeferral(restored)
		, { name: "AssertionError" });
	const unproven = structuredClone(sources);
	unproven["tests/retained-contract-tests.test.mjs"] = unproven[
		"tests/retained-contract-tests.test.mjs"].replace(
		"assert.deepEqual(readers, []);", "");
	assert.throws(() => assertNodeConsumerRetainedReaderDeferral(unproven)
		, { name: "AssertionError" });
});

test("retained-reader deferral reverses source and integration", async () => {
	const value = await record();
	for(const update of value.updates)
	{
		const current = git(["show"
			, `${nodeConsumerRetainedReaderDeferralImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${nodeConsumerRetainedReaderDeferralPredecessor}:${update.path}`]);
		assert.equal(update.previousSha256, sha256(previous), update.path);
		assert.equal(update.currentSha256, sha256(current), update.path);
		assert.equal(reverseNodeConsumerRetainedReaderDeferralUpdate(
			current, update), previous, update.path);
		assert.equal(beforeNodeConsumerRetainedReaderDeferralSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryRecordSource(
			nodeConsumerRetainedReaderDeferralHistoryPath, update.path
			, update.currentSha256);
		const previous = git(["show"
			, `${nodeConsumerRetainedReaderDeferralImplementation}:${update.path}`]);
		assert.equal(reverseNodeConsumerRetainedReaderDeferralUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const path of [
		...nodeConsumerRetainedReaderDeferralImplementationPaths
		, ...nodeConsumerRetainedReaderDeferralIntegrationPaths
	]) assert.ok(finRefinementNormalizationPaths.includes(path), path);
});

test("retained-reader deferral refreshes one live pin and no model cell"
	, async () => {
		const value = await record();
		assert.deepEqual(value.currentSourcePin, {
			path: "tests/generic-records-browser.test.mjs", count: 1
			, previous: blobDigest(nodeConsumerRetainedReaderDeferralPredecessor
				, "tests/generic-records-browser.test.mjs")
			, current: blobDigest(nodeConsumerRetainedReaderDeferralImplementation
				, "tests/generic-records-browser.test.mjs")
		});
		const inventory = value.integrationUpdates.find(update =>
			update.path === "docs/type-surface.v1.json");
		assert.ok(inventory);
		const digestPattern = /[0-9a-f]{64}/gu;
		let pins = 0;
		for(const edit of inventory.edits)
		{
			assert.equal(edit.current.replace(digestPattern, "")
				, edit.previous.replace(digestPattern, ""), inventory.path);
			assert.deepEqual(edit.previous.match(digestPattern)
				, [value.currentSourcePin.previous]);
			assert.deepEqual(edit.current.match(digestPattern)
				, [value.currentSourcePin.current]);
			pins += 1;
		}
		assert.equal(pins, 1);
		assert.deepEqual(value.exactModel, {
			sha256: "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f"
			, bytes: 16916757, cells: 1054, stageEntries: 5270
		});
	}
);

test("retained-reader deferral authenticates every addition", async () => {
	const value = await record();
	for(const addition of value.implementationAdditions)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${nodeConsumerRetainedReaderDeferralPredecessor}:${addition.path}`]
		, { stdio: "ignore" }).status, 0, addition.path);
		assert.equal(blobDigest(nodeConsumerRetainedReaderDeferralImplementation
			, addition.path), addition.sha256, addition.path);
	}
	for(const addition of value.historyAdditions)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${nodeConsumerRetainedReaderDeferralImplementation}:${addition.path}`]
		, { stdio: "ignore" }).status, 0, addition.path);
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256)), addition.sha256, addition.path);
	}
});

test("retained-reader deferral rejects forged transitions and another writer"
	, async () => {
		const update = (await record()).updates[0];
		const current = git(["show"
			, `${nodeConsumerRetainedReaderDeferralImplementation}:${update.path}`]);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }
			, { ...update, edits: [] }
		]) assert.throws(() =>
			reverseNodeConsumerRetainedReaderDeferralUpdate(current, forged));
		assert.equal(beforeNodeConsumerRetainedReaderDeferralSource(update.path
			, `${current}unknown\n`), `${current}unknown\n`);
		assert.equal(beforeNodeConsumerRetainedReaderDeferralSource("unknown.mjs"
			, current), current);
		const result = spawnSync(process.execPath, [
			"scripts/update-node-consumer-retained-reader-deferral-source-history.mjs"
		], { encoding: "utf8" });
		assert.equal(result.status, 1);
		assert.match(result.stderr, /History already exists/u);
	}
);
