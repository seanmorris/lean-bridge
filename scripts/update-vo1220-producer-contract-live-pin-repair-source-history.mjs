#!/usr/bin/env node
/**
 * Record the producer-contract current live-source pin repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";
import {
	assertVo1220ProducerContractLivePinRepair
	, vo1220ProducerContractLivePinRepairBehavior as behavior
	, vo1220ProducerContractLivePinRepairCurrentDigest as currentDigest
	, vo1220ProducerContractLivePinRepairHistoryAdditions as historyAdditions
	, vo1220ProducerContractLivePinRepairHistoryPath as historyPath
	, vo1220ProducerContractLivePinRepairImplementation as implementation
	, vo1220ProducerContractLivePinRepairImplementationPaths as implementationPaths
	, vo1220ProducerContractLivePinRepairIntegrationPaths as integrationPaths
	, vo1220ProducerContractLivePinRepairPredecessor as predecessor
	, vo1220ProducerContractLivePinRepairPreviousDigest as previousDigest
} from "../tests/helpers/vo1220-producer-contract-live-pin-repair-source-history.mjs";

const exactModelPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
const inventoryPath = "docs/type-surface.v1.json";
const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const blob = (commit, path) => git(["show", `${commit}:${path}`]);

assert.deepEqual(process.argv.slice(2), []);
assert.equal(existsSync(historyPath), false, "History already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation);
assert.equal(git(["rev-parse", "HEAD^"]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...implementationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...historyAdditions]), [...historyAdditions].sort());

const sources = Object.fromEntries(implementationPaths.map(path => [
	path, blob(implementation, path)
]));
assert.deepEqual(assertVo1220ProducerContractLivePinRepair(sources)
	, { ...behavior });
const exactSources = [predecessor, implementation].map(commit =>
	blob(commit, exactModelPath));
assert.equal(exactSources[0], exactSources[1]);
const inventorySources = [predecessor, implementation].map(commit =>
	blob(commit, inventoryPath));
assert.notEqual(inventorySources[0], inventorySources[1]);
assert.equal(inventorySources[1].split(currentDigest).length - 1, 4);
assert.equal(inventorySources[0].split(previousDigest).length - 1, 4);
assert.equal(inventorySources[1].replaceAll(currentDigest, previousDigest)
	, inventorySources[0]);
assert.equal(await readFile(inventoryPath, "utf8"), inventorySources[1]);

const updates = [];
for(const path of implementationPaths)
	updates.push(await gitSourceHistoryTransition(path, predecessor
		, implementation, { maximumEditBytes: 256 * 1024 * 1024 }));

const directory = await mkdtemp(join(tmpdir(), "lean-producer-pin-"));
try
{
	assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
		, "--", ...integrationPaths]), [...integrationPaths].sort());
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
	temporaryGit(["read-tree", implementation]);
	temporaryGit(["add", "--sparse", "--", ...integrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", implementation
	], { input: "Authenticate producer-contract live pins\n" }).trim();
	const integrationUpdates = [];
	for(const path of integrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(path
			, implementation, integrationCommit
			, { maximumEditBytes: 64 * 1024 * 1024 }));
	const historyAdditionRecords = [];
	for(const path of historyAdditions)
		historyAdditionRecords.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(historyPath, canonicalJson({
		schemaVersion: 1
		, milestone: "vo1220-producer-contract-live-pin-repair-source-v1"
		, predecessorCommit: predecessor, implementationCommit: implementation
		, integrationCommit
		, discovery: {
			localGate: "all current live-source pins match in one complete pass"
			, mismatches: 1, paths: ["tests/hosted-container-inventory.test.mjs"]
		}
		, rootCause: "The producer-era reader repair changed the authenticated current bytes of hosted-container-inventory.test.mjs. Four existing evidence entries still cited its preceding digest, so the complete aggregated current-source audit correctly refused the candidate."
		, repair: "Refresh all four and only those four existing citations to the authenticated implementation digest. Preserve every observation, support state, stage, evidence identity, immutable archive and exact #1220 model."
		, behavior, changedSupportCells: behavior.changedSupportCells
		, runtimeSemanticChanges: behavior.runtimeSemanticChanges
		, exactModelSha256: {
			before: sha256(exactSources[0]), after: sha256(exactSources[1])
		}
		, currentSourcePins: [{
			path: "tests/hosted-container-inventory.test.mjs", citations: 4
		}]
		, inventorySha256: {
			before: sha256(inventorySources[0]), after: sha256(inventorySources[1])
		}
		, validation: {
			completeLiveSourceAudit: { mismatches: 0, paths: 2661 }
			, exactCitationReplacement: { paths: 1, citations: 4 }
			, checkedJavaScriptTypecheck: "pending seal"
		}
		, updates, integrationUpdates
		, historyAdditions: historyAdditionRecords
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation transition and `
		+ `${integrationUpdates.length} integration transitions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
