/**
 * Authenticate the deferred-lane guard on the Core evidence oracle.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	assertDeferredLaneOracleGuard
	, beforeDeferredLaneOracleGuardSource
	, deferredLaneOracleGuardBehavior
	, deferredLaneOracleGuardHistoryAdditions
	, deferredLaneOracleGuardHistoryPath
	, deferredLaneOracleGuardImplementation
	, deferredLaneOracleGuardImplementationPaths
	, deferredLaneOracleGuardIntegrationPaths
	, deferredLaneOracleGuardPredecessor
	, reverseDeferredLaneOracleGuardUpdate
} from "./deferred-lane-oracle-guard-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone, sourceAtFinHistoryRecordSource }
	from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	deferredLaneOracleGuardHistoryPath, "utf8"));
const blobSource = (commit, path) => git(["show", `${commit}:${path}`]);
const implementationSources = () => Object.fromEntries(
	deferredLaneOracleGuardImplementationPaths.map(path => [path
		, blobSource(deferredLaneOracleGuardImplementation, path)]));

test("deferred-lane oracle guard records its parent and the superseded guards", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "deferred-lane-oracle-guard-v1");
	assert.equal(value.predecessorCommit, deferredLaneOracleGuardPredecessor);
	assert.equal(value.implementationCommit
		, deferredLaneOracleGuardImplementation);
	assert.equal(git(["rev-parse", `${deferredLaneOracleGuardImplementation}^`])
		.trim(), deferredLaneOracleGuardPredecessor);
	assert.deepEqual(value.supersedes.regexGuard
		, "50a36dde0a7486c60e84b86a4f70600ef739f998");
	assert.deepEqual(value.supersedes.astGuard
		, "238c02004036390d1daf9b1e093acbcdf95e012a");
	assert.deepEqual(value.behavior, { ...deferredLaneOracleGuardBehavior });
	assert.equal(value.changedSupportCells, 0);
	assert.equal(value.runtimeSemanticChanges, 0);
	assert.deepEqual(value.updates.map(item => item.path)
		, deferredLaneOracleGuardImplementationPaths);
	assert.deepEqual(value.integrationUpdates.map(item => item.path)
		, deferredLaneOracleGuardIntegrationPaths);
	assert.deepEqual(value.historyAdditions.map(item => item.path)
		, deferredLaneOracleGuardHistoryAdditions);
	assert.deepEqual(git(["diff", "--name-only"
		, deferredLaneOracleGuardPredecessor
		, deferredLaneOracleGuardImplementation, "--"]).trim().split("\n").sort()
	, [...deferredLaneOracleGuardImplementationPaths].sort());
});

test("deferred-lane oracle guard binds the oracle, the loaders and the round trip", () => {
	const sources = implementationSources();
	assert.deepEqual(assertDeferredLaneOracleGuard(sources)
		, { ...deferredLaneOracleGuardBehavior });
	const guardPath = "tests/retained-contract-tests.test.mjs";
	const zeroPath = "tests/helpers/fin-record-zero-ci-history-tests.mjs";
	for(const [label, mutate] of [
		["regex guard restored", changed => {
			changed[guardPath] = `const retainedReaderShapes = [];\n${changed[guardPath]}`;
		}]
		, ["oracle import dropped", changed => {
			changed[guardPath] = changed[guardPath].replace(
				"import { coreContractEvidenceDirectoryReferences,"
				, "import { somethingElse,");
		}]
		, ["loader identity unbound", changed => {
			changed[guardPath] = changed[guardPath].replace(
				"assert.deepEqual(modules, [...nativeRetainedLoaders[parent]], parent);"
				, "assert.equal(modules.length, nativeRetainedLoaders[parent].length);");
		}]
		, ["one loader removed", changed => {
			changed[guardPath] = changed[guardPath].replace(
				"\t\t, \"./helpers/fin-record-zero-ci-history-tests.mjs\"\n", "");
		}]
		, ["reference-only helper dropped", changed => {
			changed[guardPath] = changed[guardPath].replace(
				"module: \"tests/helpers/native-fin-reply-evidence.mjs\""
				, "module: \"tests/helpers/native-fin-reply-model.mjs\"");
		}]
		, ["current module unbound", changed => {
			changed[guardPath] = changed[guardPath].replace(
				"\t, { parent: \"tests/native-fin-records.test.mjs\"\n"
				+ "\t\t, module: \"tests/helpers/native-fin-diagnostic-tests.mjs\" }\n", "");
		}]
		, ["milestone round trip removed", changed => {
			changed[zeroPath] = changed[zeroPath].replace(
				"assert.equal(disableFinRecordZeroWorkflow(current, name), previous, path);\n", "");
		}]
	]) {
		const changed = structuredClone(sources);
		mutate(changed);
		assert.notEqual(canonical(changed), canonical(sources), label);
		assert.throws(() => assertDeferredLaneOracleGuard(changed)
			, { name: "AssertionError" }, label);
	}
});
const canonical = sources => JSON.stringify(sources);

test("deferred-lane oracle guard reverses source and integration", async () => {
	const value = await record();
	for(const update of value.updates)
	{
		const current = blobSource(deferredLaneOracleGuardImplementation
			, update.path);
		const previous = blobSource(deferredLaneOracleGuardPredecessor
			, update.path);
		assert.equal(update.previousSha256, sha256(previous), update.path);
		assert.equal(update.currentSha256, sha256(current), update.path);
		assert.equal(reverseDeferredLaneOracleGuardUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeDeferredLaneOracleGuardSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryRecordSource(
			deferredLaneOracleGuardHistoryPath, update.path, update.currentSha256);
		const previous = blobSource(deferredLaneOracleGuardImplementation
			, update.path);
		assert.equal(reverseDeferredLaneOracleGuardUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const path of [
		...deferredLaneOracleGuardImplementationPaths
		, ...deferredLaneOracleGuardIntegrationPaths
	]) assert.ok(finRefinementNormalizationPaths.includes(path), path);
});

test("deferred-lane oracle guard changes no pin, model or support cell", async () => {
	const value = await record();
	const inventories = [deferredLaneOracleGuardPredecessor
		, deferredLaneOracleGuardImplementation].map(commit =>
		sha256(blobSource(commit, "docs/type-surface.v1.json")));
	assert.equal(inventories[0], inventories[1]);
	assert.equal(value.inventorySha256, inventories[0]);
	assert.equal(value.integrationUpdates.some(update =>
		update.path === "docs/type-surface.v1.json"), false);
	assert.deepEqual(value.exactModel, {
		sha256: "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f"
		, bytes: 16916757, cells: 1054, stageEntries: 5270
	});
	assert.deepEqual(value.validation.reportedByCodex.sparseSevenEntryWall
		, { tests: 189, pass: 153, skip: 36, fail: 0, seconds: 38.2 });
	assert.equal(value.validation.measured[
		"tests/retained-contract-tests.test.mjs"].fail, 0);
});

test("deferred-lane oracle guard authenticates every history addition", async () => {
	const value = await record();
	for(const addition of value.historyAdditions)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${deferredLaneOracleGuardImplementation}:${addition.path}`]
		, { stdio: "ignore" }).status, 0, addition.path);
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256)), addition.sha256, addition.path);
	}
});

test("deferred-lane oracle guard rejects forged transitions and another writer", async () => {
	const update = (await record()).updates[0];
	const current = blobSource(deferredLaneOracleGuardImplementation
		, update.path);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() => reverseDeferredLaneOracleGuardUpdate(current, forged));
	assert.equal(beforeDeferredLaneOracleGuardSource(update.path
		, `${current}unknown\n`), `${current}unknown\n`);
	assert.equal(beforeDeferredLaneOracleGuardSource("unknown.mjs", current)
		, current);
	const result = spawnSync(process.execPath, [
		"scripts/update-deferred-lane-oracle-guard-source-history.mjs"
	], { encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /History already exists/u);
});
