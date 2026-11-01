#!/usr/bin/env node
/**
 * Record the sparse consumer-suite and JVM HostNull contract repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";
import {
	assertConsumerSuiteContractRepair
	, consumerSuiteContractRepairHistoryAdditions
	, consumerSuiteContractRepairHistoryPath
	, consumerSuiteContractRepairImplementation
	, consumerSuiteContractRepairImplementationAdditions
	, consumerSuiteContractRepairImplementationPaths
	, consumerSuiteContractRepairIntegrationPaths
	, consumerSuiteContractRepairModifiedPaths
	, consumerSuiteContractRepairPredecessor
} from "../tests/helpers/consumer-suite-contract-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const gitBytes = arguments_ => execFileSync("git", arguments_, {
	maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-consumer-suite-contract-repair-source-history.mjs");
assert.equal(existsSync(consumerSuiteContractRepairHistoryPath), false
	, "Consumer-suite repair history already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, consumerSuiteContractRepairImplementation);
assert.equal(git(["rev-parse"
	, `${consumerSuiteContractRepairImplementation}^`]).trim()
, consumerSuiteContractRepairPredecessor);
assert.deepEqual(names(["diff", "--name-only"
	, consumerSuiteContractRepairPredecessor
	, consumerSuiteContractRepairImplementation, "--"])
, [...consumerSuiteContractRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, consumerSuiteContractRepairPredecessor
	, consumerSuiteContractRepairImplementation, "--"])
, [...consumerSuiteContractRepairModifiedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, consumerSuiteContractRepairPredecessor
	, consumerSuiteContractRepairImplementation, "--"])
, [...consumerSuiteContractRepairImplementationAdditions].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...consumerSuiteContractRepairIntegrationPaths])
, [...consumerSuiteContractRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...consumerSuiteContractRepairHistoryAdditions])
, [...consumerSuiteContractRepairHistoryAdditions].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${consumerSuiteContractRepairImplementation}:${
		consumerSuiteContractRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0);

const implementationSources = Object.fromEntries(
	consumerSuiteContractRepairImplementationPaths.map(path => [path
		, git(["show", `${consumerSuiteContractRepairImplementation}:${path}`])])
);
assertConsumerSuiteContractRepair(implementationSources);

const exactModelPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
const exactModels = [
	consumerSuiteContractRepairPredecessor
	, consumerSuiteContractRepairImplementation
].map(commit => git(["show", `${commit}:${exactModelPath}`]));
assert.equal(new Set(exactModels.map(source => sha256(source))).size, 1);
assert.equal(sha256(exactModels[0])
	, "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f");
assert.equal(Buffer.byteLength(exactModels[0]), 16916757);
const exact = JSON.parse(exactModels[0]);
assert.equal(exact.model.length, 1054);
assert.equal(exact.stageEntries, 5270);

const updates = [];
for(const path of consumerSuiteContractRepairModifiedPaths)
	updates.push(await gitSourceHistoryTransition(path
		, consumerSuiteContractRepairPredecessor
		, consumerSuiteContractRepairImplementation
		, { maximumEditBytes: 64 * 1024 * 1024 }));
const implementationAdditions = [];
for(const path of consumerSuiteContractRepairImplementationAdditions)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${consumerSuiteContractRepairPredecessor}:${path}`]
	, { stdio: "ignore" }).status, 0, path);
	implementationAdditions.push({
		path
		, currentSha256: sha256(gitBytes(["show"
			, `${consumerSuiteContractRepairImplementation}:${path}`]))
	});
}

const directory = await mkdtemp(join(
	tmpdir(), "lean-consumer-suite-contract-history-"));
try
{
	const environment = {
		...process.env, GIT_INDEX_FILE: join(directory, "index")
		, GIT_AUTHOR_NAME: "Lean Bridge history writer"
		, GIT_AUTHOR_EMAIL: "history@example.invalid"
		, GIT_COMMITTER_NAME: "Lean Bridge history writer"
		, GIT_COMMITTER_EMAIL: "history@example.invalid"
		, GIT_AUTHOR_DATE: "2000-01-01T00:00:00Z"
		, GIT_COMMITTER_DATE: "2000-01-01T00:00:00Z"
	};
	const temporaryGit = (arguments_, options = {}) => execFileSync(
		"git", arguments_, {
			encoding: "utf8", maxBuffer: 512 * 1024 * 1024
			, env: environment, ...options
		}
	);
	temporaryGit(["read-tree", consumerSuiteContractRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...consumerSuiteContractRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", consumerSuiteContractRepairImplementation
	], { input: "Authenticate consumer-suite contract repair\n" }).trim();
	const integrationUpdates = [];
	for(const path of consumerSuiteContractRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(path
			, consumerSuiteContractRepairImplementation, integrationCommit
			, { maximumEditBytes: 64 * 1024 * 1024 }));
	const historyAdditions = [];
	for(const path of consumerSuiteContractRepairHistoryAdditions)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${consumerSuiteContractRepairImplementation}:${path}`]
		, { stdio: "ignore" }).status, 0, path);
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	}
	await writeFile(consumerSuiteContractRepairHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "consumer-suite-contract-repair-source-v1"
		, predecessorCommit: consumerSuiteContractRepairPredecessor
		, implementationCommit: consumerSuiteContractRepairImplementation
		, integrationCommit
		, discovery: [
			{
				run: 41288729186, job: 124801897251
				, lane: "Node and browser npm consumers"
				, failure: "retained Scalar Fin evidence was absent from the bounded sparse consumer checkout"
			}
			, {
				run: 41288729186, job: 124801897579
				, lane: "Managed consumer (jvm)"
				, failure: "the legacy compound caller expected generic wrapper construction to reject null"
			}
		]
		, rootCauses: {
			sparseRegistration: "The installed Scalar Fin runtime test imported four retained-history suites whose archive is intentionally absent from the bounded Consumer sparse checkout. Runtime acceptance and immutable evidence authentication were coupled even though Core already has the complete repository."
			, jvmHostNull: "The HostNull projection correctly made generic Option, Result and Pair wrappers capable of retaining Some(null) and equivalent nested branches. The older compound caller still expected wrapper construction itself to throw, contradicting the explicit HostNull contract."
		}
		, repairs: {
			sparseRegistration: "Keep runtime assertions in the sparse Consumer test and register every retained evidence/history suite exactly once through a dedicated Core-discovered test. Reconstruct old workflow milestones through their immutable ledgers instead of unwinding later gates manually."
			, jvmHostNull: "Assert that generic wrappers retain null, then require the generated API conversion boundary to reject those carriers at every non-HostNull Option, Result and Pair site in both Java and Kotlin."
		}
		, exactModel: {
			sha256: sha256(exactModels[0])
			, bytes: Buffer.byteLength(exactModels[0])
			, cells: exact.model.length, stageEntries: exact.stageEntries
		}
		, changedSupportCells: 0, runtimeSemanticChanges: 0
		, livePinRefreshes: 20
		, updates, implementationAdditions, integrationUpdates
		, historyAdditions
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation updates, `
		+ `${implementationAdditions.length} implementation additions and `
		+ `${integrationUpdates.length} integration transitions for the `
		+ "consumer-suite contract repair.\n");
}
finally
{ await rm(directory, { recursive: true, force: true }); }
