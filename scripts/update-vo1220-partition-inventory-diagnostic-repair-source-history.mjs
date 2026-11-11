#!/usr/bin/env node
/**
 * Record the retained-partition inventory diagnostic repair.
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
	assertVo1220PartitionInventoryDiagnosticRepair
	, vo1220PartitionInventoryDiagnosticRepairBehavior as behavior
	, vo1220PartitionInventoryDiagnosticRepairHistoryAdditions as historyAdditions
	, vo1220PartitionInventoryDiagnosticRepairHistoryPath as historyPath
	, vo1220PartitionInventoryDiagnosticRepairImplementation as implementation
	, vo1220PartitionInventoryDiagnosticRepairImplementationPaths as implementationPaths
	, vo1220PartitionInventoryDiagnosticRepairIntegrationPaths as integrationPaths
	, vo1220PartitionInventoryDiagnosticRepairPredecessor as predecessor
} from "../tests/helpers/vo1220-partition-inventory-diagnostic-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const blob = (commit, path) => git(["show", `${commit}:${path}`]);

assert.deepEqual(process.argv.slice(2), []);
assert.equal(existsSync(historyPath), false, "History already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Partition diagnostic history requires its exact implementation commit");
assert.equal(git(["rev-parse", "HEAD^"]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...implementationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...historyAdditions]), [...historyAdditions].sort());
const implementationSources = Object.fromEntries(
	implementationPaths.map(path => [path, blob(implementation, path)])
);
assert.deepEqual(assertVo1220PartitionInventoryDiagnosticRepair(
	implementationSources), behavior);

const updates = [];
for(const path of implementationPaths)
	updates.push(await gitSourceHistoryTransition(path, predecessor
		, implementation, { maximumEditBytes: 64 * 1024 * 1024 }));

const directory = await mkdtemp(join(tmpdir(), "lean-partition-diagnostic-"));
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
	], { input: "Authenticate retained partition diagnostics\n" }).trim();
	const integrationUpdates = [];
	for(const path of integrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(path
			, implementation, integrationCommit
			, { maximumEditBytes: 64 * 1024 * 1024 }));
	const historyAdditionRecords = [];
	for(const path of historyAdditions)
		historyAdditionRecords.push({
			path, sha256: sha256(await readFile(path))
		});
	await writeFile(historyPath, canonicalJson({
		schemaVersion: 1
		, milestone: "vo1220-partition-inventory-diagnostic-repair-source-v1"
		, predecessorCommit: predecessor, implementationCommit: implementation
		, integrationCommit
		, rootCause: "The component-array partition audit compared a redundant exact size vector before its membership and assignment contract. One intentional helper registration therefore hid every remaining stale expectation in the same finite inventory."
		, repair: "Remove redundant per-partition cardinality snapshots, report exact counts and both digests as one aggregate object, split structural and ownership checks into independent subtests, and apply the same complete diagnostic shape to the sibling retained-partition audit."
		, behavior, changedSupportCells: behavior.changedSupportCells
		, runtimeSemanticChanges: behavior.runtimeSemanticChanges
		, validation: {
			componentPartitionAudit: "4/4 passed"
			, nestedPartitionAudit: "5/5 passed"
			, exactCohortHistory: "6/6 passed"
			, nestedPromotionHistory: "4/4 passed"
			, scopedLint: "passed", diffCheck: "passed"
		}
		, updates, integrationUpdates
		, historyAdditions: historyAdditionRecords
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation transitions, `
		+ `${integrationUpdates.length} integration transitions and `
		+ `${historyAdditionRecords.length} history additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
