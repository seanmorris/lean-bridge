#!/usr/bin/env node
/**
 * Record the final-audit registration and static preflight repair.
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
import { collectCoreContractTestPaths, coreContractShardLabels
	, coreContractShardManifest, verifyCoreContractShardManifests }
	from "./core-contract-shards.mjs";
import { dependentCheckedRecordPromotionCurrentSourcePaths }
	from "../tests/helpers/dependent-checked-record-promotion.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";
import {
	coreFinalAuditRegistrationHistoryAdditions
	, coreFinalAuditRegistrationHistoryPath
	, coreFinalAuditRegistrationImplementation
	, coreFinalAuditRegistrationImplementationPaths
	, coreFinalAuditRegistrationIntegrationPaths
	, coreFinalAuditRegistrationPins
	, coreFinalAuditRegistrationPredecessor
	, coreFinalAuditRegistrationTest
} from "../tests/helpers/core-final-audit-registration-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-core-final-audit-registration-source-history.mjs");
assert.equal(existsSync(coreFinalAuditRegistrationHistoryPath), false
	, `${coreFinalAuditRegistrationHistoryPath} already exists`);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, coreFinalAuditRegistrationImplementation);
assert.equal(git(["rev-parse", `${coreFinalAuditRegistrationImplementation}^`])
	.trim(), coreFinalAuditRegistrationPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, coreFinalAuditRegistrationPredecessor
	, coreFinalAuditRegistrationImplementation, "--"])
, [...coreFinalAuditRegistrationImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, coreFinalAuditRegistrationPredecessor
	, coreFinalAuditRegistrationImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${coreFinalAuditRegistrationImplementation}:${
		coreFinalAuditRegistrationHistoryPath}`]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...coreFinalAuditRegistrationIntegrationPaths])
, [...coreFinalAuditRegistrationIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...coreFinalAuditRegistrationHistoryAdditions])
, [...coreFinalAuditRegistrationHistoryAdditions].sort());

const inventoryPath = coreFinalAuditRegistrationImplementationPaths[0];
const before = git(["show"
	, `${coreFinalAuditRegistrationPredecessor}:${inventoryPath}`]);
const after = git(["show"
	, `${coreFinalAuditRegistrationImplementation}:${inventoryPath}`]);
let restored = after;
for(const pin of coreFinalAuditRegistrationPins)
{
	restored = restored.replaceAll(pin.current, pin.previous);
	assert.equal(after.split(pin.current).length - 1, pin.count);
	assert.equal(after.includes(pin.previous), false);
	assert.equal(sha256(await readFile(pin.path)), pin.current);
}
assert.equal(restored, before);

const implementationDocument = JSON.parse(after);
assert.deepEqual(dependentCheckedRecordPromotionCurrentSourcePaths(
	implementationDocument, coreFinalAuditRegistrationIntegrationPaths).sort()
, []);

const profile = await readFile("src/adoption/test-profiles.mjs", "utf8");
const profileTest = await readFile("tests/test-profiles.test.mjs", "utf8");
const packageDocument = JSON.parse(await readFile("package.json", "utf8"));
assert.ok(profile.includes(`"${coreFinalAuditRegistrationTest}"`));
assert.ok(profileTest.includes(
	`"tests/${coreFinalAuditRegistrationTest}.test.mjs"`));
assert.match(packageDocument.scripts["env:check:core"]
	, /inventory\.sh --profile core.*test-profiles\.test\.mjs/u);
const contractPaths = await collectCoreContractTestPaths();
const contract = verifyCoreContractShardManifests(contractPaths
	, coreContractShardLabels.map(label =>
		coreContractShardManifest(contractPaths, label)));
assert.equal(contract.contractFiles, 1094);
assert.equal(contract.contractSha256
	, "4f6019a4dcd54f51d08a4c05b836005c6bbc252d0932029e90e58a7abf6ff9cc");

const updates = [];
for(const path of coreFinalAuditRegistrationImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, coreFinalAuditRegistrationPredecessor
		, coreFinalAuditRegistrationImplementation
		, { maximumEditBytes: 128 * 1024 * 1024 }));
const directory = await mkdtemp(join(
	tmpdir(), "lean-core-final-audit-registration-"));
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
	temporaryGit(["read-tree", coreFinalAuditRegistrationImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...coreFinalAuditRegistrationIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", coreFinalAuditRegistrationImplementation
	], { input: "Authenticate final-audit registration preflight\n" }).trim();
	const integrationUpdates = [];
	for(const path of coreFinalAuditRegistrationIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, coreFinalAuditRegistrationImplementation, integrationCommit
			, { maximumEditBytes: 128 * 1024 * 1024 }
		));
	const historyAdditions = [];
	for(const path of coreFinalAuditRegistrationHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(coreFinalAuditRegistrationHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "core-final-audit-registration-source-v1"
		, predecessorCommit: coreFinalAuditRegistrationPredecessor
		, implementationCommit: coreFinalAuditRegistrationImplementation
		, detectedFailure: "Unclassified repository test: tests/core-final-type-surface-audit-source-history.test.mjs"
		, detectedBeforeHostedShardExecution: true
		, activeCoreRun: 41170510543
		, registeredTest: coreFinalAuditRegistrationTest
		, refreshedPins: coreFinalAuditRegistrationPins
		, integrationRefreshedPins: 0
		, contractFiles: contract.contractFiles
		, contractSha256: contract.contractSha256
		, scope: "Register the final immutable-audit test in the closed Core profile, assert its explicit classification, and make the static env preflight execute the complete profile classifier before evidence checkout or shard allocation. Refresh exactly 127 implementation citations and only the current integration citations for the history hub and partition. Preserve every type-surface profile, observation, stage and evidence identity. Record the local shard-planner refusal before hosted shards ran; do not relabel the in-progress old-head workflow."
		, updates, integrationUpdates, historyAdditions
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation transitions, `
		+ `${integrationUpdates.length} integration transitions and `
		+ "zero integration pins.\n");
}
finally
{ await rm(directory, { recursive: true, force: true }); }
