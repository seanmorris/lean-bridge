#!/usr/bin/env node
/**
 * Record the complete current-source pin refresh and aggregate preflight.
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
import {
	auditCurrentSourcePins, previewCurrentSourcePinRefresh
} from "../tests/helpers/current-source-pin-preflight.mjs";
import {
	dependentCheckedRecordPromotionCurrentSourcePaths
	, reconcileDependentCheckedRecordSourcePins
} from "../tests/helpers/dependent-checked-record-promotion.mjs";
import {
	completeCurrentSourcePinPreflightCurrentSources as currentSources
	, completeCurrentSourcePinPreflightHistoryAdditions as historyAdditions
	, completeCurrentSourcePinPreflightHistoryPath as historyPath
	, completeCurrentSourcePinPreflightImplementation as implementation
	, completeCurrentSourcePinPreflightImplementationAdditions as implementationAdditions
	, completeCurrentSourcePinPreflightImplementationPaths as implementationPaths
	, completeCurrentSourcePinPreflightIntegrationPaths as integrationPaths
	, completeCurrentSourcePinPreflightPinRefresh as pinRefresh
	, completeCurrentSourcePinPreflightPredecessor as predecessor
} from "../tests/helpers/complete-current-source-pin-preflight-source-history.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const exactModelPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-complete-current-source-pin-preflight-source-history.mjs");
assert.equal(existsSync(historyPath), false, "History already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation);
assert.equal(git(["rev-parse", "HEAD^"]).trim(), pinRefresh);
assert.equal(git(["rev-parse", `${pinRefresh}^`]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", predecessor, pinRefresh, "--"])
	, [inventoryPath]);
assert.deepEqual(names(["diff", "--name-only", pinRefresh, implementation
	, "--"]), [
	...implementationAdditions, "tests/checked-javascript-partition-11.test.mjs"
	].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...integrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...historyAdditions]), [...historyAdditions].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${historyPath}`], { stdio: "ignore" }).status, 0);

const before = JSON.parse(git(["show", `${predecessor}:${inventoryPath}`]));
assert.deepEqual(dependentCheckedRecordPromotionCurrentSourcePaths(
	before, currentSources).sort(), [...currentSources]);
const currentDigests = new Map();
for(const path of currentSources)
	currentDigests.set(path, sha256(await readFile(path)));
const reconciled = reconcileDependentCheckedRecordSourcePins(
	before, currentDigests);
assert.equal(reconciled.refreshed, 216);
assert.deepEqual(reconciled.inventory, JSON.parse(git(["show"
	, `${pinRefresh}:${inventoryPath}`])));
assert.deepEqual(reconciled.inventory, JSON.parse(git(["show"
	, `${implementation}:${inventoryPath}`])));

const beforeAudit = await auditCurrentSourcePins(before);
const beforePreview = previewCurrentSourcePinRefresh(before, beforeAudit);
assert.equal(beforeAudit.cohort, 2661);
assert.equal(beforeAudit.occurrences, 16326);
assert.deepEqual(beforeAudit.findings.map(item => item.path), currentSources);
assert.deepEqual(beforePreview, { paths: 5, refreshed: 216 });
const afterAudit = await auditCurrentSourcePins(reconciled.inventory);
assert.deepEqual(afterAudit, {
	cohort: 2661, occurrences: 16326, findings: []
});

const implementationUpdates = [];
for(const path of implementationPaths)
	implementationUpdates.push(await gitSourceHistoryTransition(path, predecessor
		, implementation, { maximumEditBytes: 64 * 1024 * 1024 }));
const implementationAddedFiles = [];
for(const path of implementationAdditions)
{
	assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
		.trim(), "", path);
	implementationAddedFiles.push({ path
		, sha256: sha256(git(["show", `${implementation}:${path}`])) });
}
const exactModels = [predecessor, pinRefresh, implementation].map(commit =>
	git(["show", `${commit}:${exactModelPath}`]));
assert.equal(new Set(exactModels.map(source => sha256(source))).size, 1);
const exact = JSON.parse(exactModels[0]);

const directory = await mkdtemp(join(tmpdir(), "lean-complete-pin-preflight-"));
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
	temporaryGit(["read-tree", implementation]);
	temporaryGit(["add", "--sparse", "--", ...integrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", implementation
	], { input: "Authenticate complete current-source preflight\n" }).trim();
	const integrationUpdates = [];
	for(const path of integrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(path
			, implementation, integrationCommit
			, { maximumEditBytes: 64 * 1024 * 1024 }));
	const additions = [];
	for(const path of historyAdditions)
		additions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(historyPath, canonicalJson({
		schemaVersion: 1
		, milestone: "complete-current-source-pin-preflight-v1"
		, predecessorCommit: predecessor, pinRefreshCommit: pinRefresh
		, implementationCommit: implementation, integrationCommit
		, discovery: {
			completeCohortPaths: beforeAudit.cohort
			, completeCohortPinOccurrences: beforeAudit.occurrences
			, stalePaths: beforeAudit.findings.length
			, stalePinOccurrences: beforeAudit.findings.reduce(
				(sum, item) => sum + item.pins, 0)
			, findings: beforeAudit.findings
		}
		, scope: "Audit every non-archive source cited by the public inventory in one pass, report all stale, missing and conflicting identities before exiting, and refresh the complete discovered cohort without changing profiles, observations, support cells, evidence claims or immutable archives."
		, currentSourcePaths: currentSources
		, currentSourceDigests: currentSources.map(path => ({
			path, sha256: currentDigests.get(path)
		}))
		, refreshedPins: reconciled.refreshed
		, finalPreflight: afterAudit
		, exactModel: {
			sha256: sha256(exactModels[0])
			, bytes: Buffer.byteLength(exactModels[0])
			, cells: exact.model.length, stageEntries: exact.stageEntries
		}
		, implementationUpdates, integrationUpdates
		, implementationAdditions: implementationAddedFiles
		, historyAdditions: additions
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${reconciled.refreshed} refreshed pins, `
		+ `${beforeAudit.findings.length} aggregate findings and `
		+ `${integrationUpdates.length} integration transitions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
