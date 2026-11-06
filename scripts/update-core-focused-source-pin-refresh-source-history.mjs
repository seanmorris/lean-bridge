#!/usr/bin/env node
/**
 * Record the focused Core current-source pin refresh.
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
	dependentCheckedRecordPromotionCurrentSourcePaths
	, reconcileDependentCheckedRecordSourcePins
} from "../tests/helpers/dependent-checked-record-promotion.mjs";
import {
	coreFocusedSourcePinRefreshCurrentSources as currentSources
	, coreFocusedSourcePinRefreshHistoryAdditions as historyAdditions
	, coreFocusedSourcePinRefreshHistoryPath as historyPath
	, coreFocusedSourcePinRefreshImplementation as implementation
	, coreFocusedSourcePinRefreshImplementationCurrentSources as implementationSources
	, coreFocusedSourcePinRefreshImplementationPaths as implementationPaths
	, coreFocusedSourcePinRefreshIntegrationPaths as integrationPaths
	, coreFocusedSourcePinRefreshPredecessor as predecessor
} from "../tests/helpers/core-focused-source-pin-refresh-source-history.mjs";
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
	, "Usage: update-core-focused-source-pin-refresh-source-history.mjs");
assert.equal(existsSync(historyPath), false, "Pin-refresh history already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation);
assert.equal(git(["rev-parse", "HEAD^"]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation
	, "--"]), [...implementationPaths].sort());
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
const implementationDigests = new Map([...currentDigests]
	.filter(([path]) => implementationSources.includes(path)));
const implementationReconciliation = reconcileDependentCheckedRecordSourcePins(
	before, implementationDigests);
assert.equal(implementationReconciliation.refreshed, 177);
assert.deepEqual(implementationReconciliation.inventory
	, JSON.parse(git(["show", `${implementation}:${inventoryPath}`])));
const finalReconciliation = reconcileDependentCheckedRecordSourcePins(
	before, currentDigests);
assert.deepEqual(finalReconciliation.inventory
	, JSON.parse(await readFile(inventoryPath, "utf8")));
const integrationRefreshedPins = finalReconciliation.refreshed
	- implementationReconciliation.refreshed;
assert.equal(integrationRefreshedPins, 0);
const implementationUpdates = [];
for(const path of implementationPaths)
	implementationUpdates.push(await gitSourceHistoryTransition(path, predecessor
		, implementation, { maximumEditBytes: 64 * 1024 * 1024 }));
const exactModels = [predecessor, implementation].map(commit =>
	git(["show", `${commit}:${exactModelPath}`]));
assert.equal(new Set(exactModels.map(source => sha256(source))).size, 1);
const exact = JSON.parse(exactModels[0]);

const directory = await mkdtemp(join(tmpdir(), "lean-core-focused-pin-refresh-"));
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
	], { input: "Authenticate focused Core source pins\n" }).trim();
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
		, milestone: "core-focused-source-pin-refresh-v1"
		, predecessorCommit: predecessor, implementationCommit: implementation
		, integrationCommit
		, discovery: {
			runs: [42166666205, 42166666098]
			, observed: "HostNull and direct proof-erasure archives and cells passed, then their current-source audits rejected the stale generator digest"
		}
		, scope: "Refresh every live type-surface citation affected by the focused Core repairs and their history registration in one generated pass. Preserve all 1,054 support cells, observations, evidence claims and immutable archives."
		, implementationRefreshedPins: implementationReconciliation.refreshed
		, integrationRefreshedPins
		, refreshedPins: finalReconciliation.refreshed
		, currentSourcePaths: currentSources
		, currentSourceDigests: currentSources.map(path => ({
			path, sha256: currentDigests.get(path)
		}))
		, exactModel: {
			sha256: sha256(exactModels[0])
			, bytes: Buffer.byteLength(exactModels[0])
			, cells: exact.model.length, stageEntries: exact.stageEntries
		}
		, implementationUpdates, integrationUpdates
		, historyAdditions: additions
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${finalReconciliation.refreshed} refreshed pins, `
		+ `${implementationUpdates.length} implementation and `
		+ `${integrationUpdates.length} integration transitions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
