#!/usr/bin/env node
/**
 * Record the exact live-pin repair for the bounded promotion contracts.
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
import {
	dependentCheckedRecordPromotionCurrentSourcePaths
	, reconcileDependentCheckedRecordSourcePins
} from "../tests/helpers/dependent-checked-record-promotion.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";
import {
	vo1220NestedPromotionMemoryBoundPinRepairAdditions as additions
	, vo1220NestedPromotionMemoryBoundPinRepairBehavior as behavior
	, vo1220NestedPromotionMemoryBoundPinRepairHistoryPath as historyPath
	, vo1220NestedPromotionMemoryBoundPinRepairImplementation as implementation
	, vo1220NestedPromotionMemoryBoundPinRepairImplementationPaths as implementationPaths
	, vo1220NestedPromotionMemoryBoundPinRepairIntegrationPaths as integrationPaths
	, vo1220NestedPromotionMemoryBoundPinRepairPredecessor as predecessor
	, vo1220NestedPromotionMemoryBoundPinRepairSourcePaths as sourcePaths
} from "../tests/helpers/vo1220-nested-promotion-memory-bound-pin-repair-source-history.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const exactModelPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
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
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...integrationPaths]), [...integrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...additions]), [...additions].sort());

const beforeSource = blob(predecessor, inventoryPath);
const before = JSON.parse(beforeSource);
assert.deepEqual(dependentCheckedRecordPromotionCurrentSourcePaths(
	before, sourcePaths).sort(), [...sourcePaths].sort());
const currentDigests = new Map();
for(const path of sourcePaths)
	currentDigests.set(path, sha256(await readFile(path)));
const reconciled = reconcileDependentCheckedRecordSourcePins(
	before, currentDigests);
assert.equal(reconciled.refreshed, behavior.refreshedPins);
const afterSource = JSON.stringify(reconciled.inventory, null, 2) + "\n";
assert.equal(afterSource, blob(implementation, inventoryPath));
assert.equal(blob(predecessor, exactModelPath)
	, blob(implementation, exactModelPath));
const pinCounts = sourcePaths.map(path => ({
	path
	, count: before.evidence.flatMap(item => item.files)
		.filter(file => file.path === path).length
	, previousSha256: [...new Set(before.evidence.flatMap(item => item.files)
		.filter(file => file.path === path).map(file => file.sha256))][0]
	, currentSha256: currentDigests.get(path)
}));
assert.deepEqual(pinCounts.map(item => item.count), [4, 4, 36]);
assert.ok(pinCounts.every(item => item.previousSha256 !== item.currentSha256));

const implementationUpdates = [];
for(const path of implementationPaths)
	implementationUpdates.push(await gitSourceHistoryTransition(path
		, predecessor, implementation, { maximumEditBytes: 64 * 1024 * 1024 }));

const directory = await mkdtemp(join(tmpdir(), "lean-nested-pin-repair-"));
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
	], { input: "Authenticate bounded promotion live-pin repair\n" }).trim();
	const integrationUpdates = [];
	for(const path of integrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(path
			, implementation, integrationCommit
			, { maximumEditBytes: 64 * 1024 * 1024 }));
	const additionRecords = [];
	for(const path of additions)
		additionRecords.push({ path, sha256: sha256(await readFile(path)) });
	const exactSource = blob(implementation, exactModelPath);
	const exact = JSON.parse(exactSource);
	await writeFile(historyPath, canonicalJson({
		schemaVersion: 1
		, milestone: "vo1220-nested-promotion-memory-bound-pin-repair-v1"
		, predecessorCommit: predecessor, implementationCommit: implementation
		, integrationCommit
		, rootCause: "The bounded promotion repair changed three inventory-cited test sources, while its first seal authenticated the implementation before refreshing their live source identities."
		, repair: "Refresh exactly the 44 live citations of those three files, preserve every other inventory byte, and register the reversible pin-only transition newest-first."
		, behavior, pinCounts
		, changedSupportCells: behavior.changedSupportCells
		, runtimeSemanticChanges: behavior.runtimeSemanticChanges
		, exactModel: {
			sha256: sha256(exactSource), bytes: Buffer.byteLength(exactSource)
			, cells: exact.model.length, stageEntries: exact.stageEntries
		}
		, inventorySha256: { before: sha256(beforeSource), after: sha256(afterSource) }
		, implementationUpdates, integrationUpdates, additions: additionRecords
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${implementationUpdates.length} implementation, `
		+ `${integrationUpdates.length} integration transitions and `
		+ `${reconciled.refreshed} refreshed pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
