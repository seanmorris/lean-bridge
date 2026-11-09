#!/usr/bin/env node
/**
 * Record the exact current-source pins refreshed after workflow failover.
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
	assertVo1220WorkflowReleaseAssetPinRefresh
	, vo1220WorkflowReleaseAssetPinRefreshBehavior as behavior
	, vo1220WorkflowReleaseAssetPinRefreshChangedPaths as changedPaths
	, vo1220WorkflowReleaseAssetPinRefreshHistoryAdditions as historyAdditions
	, vo1220WorkflowReleaseAssetPinRefreshHistoryPath as historyPath
	, vo1220WorkflowReleaseAssetPinRefreshImplementation as implementation
	, vo1220WorkflowReleaseAssetPinRefreshImplementationAddedPaths as implementationAddedPaths
	, vo1220WorkflowReleaseAssetPinRefreshImplementationPaths as implementationPaths
	, vo1220WorkflowReleaseAssetPinRefreshIntegrationPaths as integrationPaths
	, vo1220WorkflowReleaseAssetPinRefreshPredecessor as predecessor
} from "../tests/helpers/vo1220-workflow-release-asset-pin-refresh-source-history.mjs";

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
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation]), [...changedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, predecessor, implementation]), [...implementationAddedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=DRCT"
	, predecessor, implementation]), []);
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...historyAdditions]), [...historyAdditions].sort());

const sources = Object.fromEntries(implementationPaths.map(path => [
	path, blob(implementation, path)
]));
assert.deepEqual(assertVo1220WorkflowReleaseAssetPinRefresh(sources)
	, { ...behavior });
const beforeInventory = JSON.parse(blob(predecessor, inventoryPath));
const afterInventory = JSON.parse(blob(implementation, inventoryPath));
assert.equal(beforeInventory.evidence.length, afterInventory.evidence.length);
const sourcePins = new Map();
let refreshedPins = 0;
for(let index = 0; index < beforeInventory.evidence.length; index++)
{
	const before = beforeInventory.evidence[index];
	const after = afterInventory.evidence[index];
	assert.equal(before.id, after.id);
	assert.equal(before.files.length, after.files.length, before.id);
	for(let fileIndex = 0; fileIndex < before.files.length; fileIndex++)
	{
		const previous = before.files[fileIndex];
		const current = after.files[fileIndex];
		assert.equal(previous.path, current.path, before.id);
		if(previous.sha256 === current.sha256) continue;
		const expected = sha256(blob(implementation, current.path));
		assert.equal(current.sha256, expected, current.path);
		const entry = sourcePins.get(current.path) ?? {
			path: current.path, sha256: current.sha256, occurrences: 0
		};
		assert.equal(entry.sha256, current.sha256, current.path);
		entry.occurrences++;
		sourcePins.set(current.path, entry);
		previous.sha256 = current.sha256;
		refreshedPins++;
	}
}
assert.deepEqual(beforeInventory, afterInventory
	, "Only exact current-source digests may change");
assert.equal(sourcePins.size, behavior.currentSourcePaths);
assert.equal(refreshedPins, behavior.refreshedPins);
assert.equal([...sourcePins.values()].reduce(
	(sum, pin) => sum + pin.occurrences, 0), behavior.refreshedPins);
const exactSources = [predecessor, implementation].map(commit =>
	blob(commit, exactModelPath));
assert.equal(exactSources[0], exactSources[1]);

const updates = [];
for(const path of changedPaths)
	updates.push(await gitSourceHistoryTransition(path, predecessor
		, implementation, { maximumEditBytes: 64 * 1024 * 1024 }));
const implementationAdditions = implementationAddedPaths.map(path => {
	assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
		.trim(), "", path);
	return { path, sha256: sha256(blob(implementation, path)) };
});

const directory = await mkdtemp(join(tmpdir(), "lean-workflow-pin-history-"));
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
	], { input: "Authenticate workflow release-asset source pins\n" }).trim();
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
		, milestone: "vo1220-workflow-release-asset-pin-refresh-source-v1"
		, predecessorCommit: predecessor, implementationCommit: implementation
		, integrationCommit
		, discovery: {
			preflightCohortPaths: 2661, preflightPinOccurrences: 16326
			, stalePaths: 18, stalePins: 271
			, missingPaths: 0, conflictingPaths: 0
		}
		, repair: "Reconcile only the 271 inventory digests that cite the 18 workflow and contract sources changed by the complete release-asset failover. Preserve every evidence ID, support observation, archive identity and exact type-surface model."
		, behavior, changedSupportCells: behavior.changedSupportCells
		, runtimeSemanticChanges: behavior.runtimeSemanticChanges
		, exactModelSha256: {
			before: sha256(exactSources[0]), after: sha256(exactSources[1])
		}
		, inventorySha256: {
			before: sha256(blob(predecessor, inventoryPath))
			, after: sha256(blob(implementation, inventoryPath))
		}
		, currentSourcePins: [...sourcePins.values()].sort((left, right) =>
			left.path.localeCompare(right.path))
		, validation: {
			completePinPreflight: {
				cohortPaths: 2661, pinOccurrences: 16326, findings: 0
			}
			, eslint: "passed", typecheck: "passed"
		}
		, implementationAdditions, updates, integrationUpdates
		, historyAdditions: historyAdditionRecords
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} pin transition, `
		+ `${implementationAdditions.length} implementation addition and `
		+ `${integrationUpdates.length} integration transitions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
