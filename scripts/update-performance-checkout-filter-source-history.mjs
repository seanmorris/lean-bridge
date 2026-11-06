#!/usr/bin/env node
/**
 * Record the bounded Performance checkout optimization and pin refresh.
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
	performanceCheckoutFilterCurrentSources as currentSources
	, performanceCheckoutFilterHistoryAdditions as historyAdditions
	, performanceCheckoutFilterHistoryPath as historyPath
	, performanceCheckoutFilterImplementation as implementation
	, performanceCheckoutFilterIntegrationPaths as integrationPaths
	, performanceCheckoutFilterPinRefresh as pinRefresh
	, performanceCheckoutFilterPredecessor as predecessor
} from "../tests/helpers/performance-checkout-filter-source-history.mjs";
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
	, "Usage: update-performance-checkout-filter-source-history.mjs");
assert.equal(existsSync(historyPath), false, "History already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim(), pinRefresh);
assert.equal(git(["rev-parse", "HEAD^"]).trim(), implementation);
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", predecessor
	, implementation, "--"]), [...currentSources].sort());
assert.deepEqual(names(["diff", "--name-only", implementation
	, pinRefresh, "--"]), [inventoryPath]);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...integrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...historyAdditions]), [...historyAdditions].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${pinRefresh}:${historyPath}`], { stdio: "ignore" }).status, 0);

const before = JSON.parse(git(["show", `${implementation}:${inventoryPath}`]));
const pinnedPaths = dependentCheckedRecordPromotionCurrentSourcePaths(
	before, currentSources);
assert.deepEqual(pinnedPaths, [currentSources[0]]);
const currentDigests = new Map();
for(const path of currentSources)
	currentDigests.set(path, sha256(git(["show", `${implementation}:${path}`])));
const reconciled = reconcileDependentCheckedRecordSourcePins(
	before, currentDigests);
assert.equal(reconciled.refreshed, 1);
assert.deepEqual(reconciled.inventory, JSON.parse(git(["show"
	, `${pinRefresh}:${inventoryPath}`])));
const preflightBefore = await auditCurrentSourcePins(before);
assert.deepEqual(preflightBefore.findings.map(item => item.path), pinnedPaths);
assert.deepEqual(previewCurrentSourcePinRefresh(before, preflightBefore)
	, { paths: 1, refreshed: 1 });
const preflightAfter = await auditCurrentSourcePins(reconciled.inventory);
assert.deepEqual(preflightAfter
	, { cohort: 2661, occurrences: 16326, findings: [] });

const implementationUpdates = [];
for(const path of currentSources)
	implementationUpdates.push(await gitSourceHistoryTransition(path, predecessor
		, implementation, { maximumEditBytes: 64 * 1024 * 1024 }));
const pinUpdates = [await gitSourceHistoryTransition(inventoryPath
	, implementation, pinRefresh
	, { maximumEditBytes: 512 * 1024 * 1024 })];
const exactModels = [predecessor, implementation, pinRefresh].map(commit =>
	git(["show", `${commit}:${exactModelPath}`]));
assert.equal(new Set(exactModels.map(source => sha256(source))).size, 1);
const exact = JSON.parse(exactModels[0]);

const directory = await mkdtemp(join(tmpdir()
	, "lean-performance-checkout-filter-history-"));
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
	temporaryGit(["read-tree", pinRefresh]);
	temporaryGit(["add", "--sparse", "--", ...integrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", pinRefresh
	], { input: "Authenticate Performance checkout filter\n" }).trim();
	const integrationUpdates = [];
	for(const path of integrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(path
			, pinRefresh, integrationCommit
			, { maximumEditBytes: 64 * 1024 * 1024 }));
	const additions = [];
	for(const path of historyAdditions)
		additions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(historyPath, canonicalJson({
		schemaVersion: 1
		, milestone: "performance-checkout-filter-v1"
		, predecessorCommit: predecessor
		, implementationCommit: implementation
		, pinRefreshCommit: pinRefresh, integrationCommit
		, scope: "Fetch historical Performance blobs only when read, retain full history for the native graph lane, keep the clean-build shared-clone source unfiltered, and use shallow sparse blobless checkouts for the five measurement/report lanes. Preserve every command, artifact, support claim and exact type-surface cell while refreshing only the one live workflow citation."
		, currentSourcePaths: currentSources
		, currentSourceDigests: currentSources.map(path => ({
			path, sha256: currentDigests.get(path)
		}))
		, pinnedPaths, refreshedPins: reconciled.refreshed
		, preflightBefore, preflightAfter
		, exactModel: {
			sha256: sha256(exactModels[0])
			, bytes: Buffer.byteLength(exactModels[0])
			, cells: exact.model.length, stageEntries: exact.stageEntries
		}
		, implementationUpdates, pinUpdates, integrationUpdates
		, historyAdditions: additions
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${implementationUpdates.length} implementation, `
		+ `${pinUpdates.length} pin and ${integrationUpdates.length} integration transitions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
