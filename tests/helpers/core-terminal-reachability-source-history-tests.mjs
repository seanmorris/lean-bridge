/**
 * Prove that the bounded Core repair closes only its declared source gaps.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
	beforeCoreTerminalReachabilityRepairSource
	, beforeCoreTerminalReachabilitySource
	, coreTerminalReachabilityAddedPaths
	, coreTerminalReachabilityChangedPaths
	, coreTerminalReachabilityHistoryPath
	, coreTerminalReachabilityPredecessor
	, coreTerminalReachabilityTerminalPaths
	, coreTerminalReachabilityTerminalSpecs
	, reverseCoreTerminalReachabilityEntry
	, reverseCoreTerminalReachabilityUpdate
} from "./core-terminal-reachability-source-history.mjs";
import { finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import { beforePhpCallbackInstalledStaging } from "./php-callback-installed-staging-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 128 * 1024 * 1024
});

test("Core terminal repair has one exact reversible lineage", async () => {
	const record = JSON.parse(await readFile(
		coreTerminalReachabilityHistoryPath, "utf8"
	));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "core-terminal-reachability-v1");
	assert.equal(record.predecessorCommit, coreTerminalReachabilityPredecessor);
	assert.deepEqual(record.updates.map(update => update.path)
		, coreTerminalReachabilityChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, coreTerminalReachabilityAddedPaths);
	assert.equal(record.pathsSha256, sha256(JSON.stringify(
		coreTerminalReachabilityChangedPaths
	)));
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeCoreTerminalReachabilityRepairSource
		);
		const previous = git(["show"
			, `${coreTerminalReachabilityPredecessor}:${update.path}`]);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(reverseCoreTerminalReachabilityUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeCoreTerminalReachabilityRepairSource(
			update.path, current), previous, update.path);
		assert.equal(beforeCoreTerminalReachabilityRepairSource(
			update.path, current, update.currentSha256), current, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
		const unknown = current + "unknown";
		assert.equal(beforeCoreTerminalReachabilityRepairSource(
			update.path, unknown), unknown, update.path);
	}
});

test("Core terminal bridges are exact, stop-specific and fail closed", async () => {
	const record = JSON.parse(await readFile(
		coreTerminalReachabilityHistoryPath, "utf8"
	));
	assert.deepEqual(record.terminalEntries.map(entry => ({
		path: entry.path, expectedCommit: entry.expectedCommit
		, currentCommit: entry.currentCommit
	})), coreTerminalReachabilityTerminalSpecs);
	assert.deepEqual(record.terminalEntries.map(entry => entry.path)
		, coreTerminalReachabilityTerminalPaths);
	for(const entry of record.terminalEntries)
	{
		const current = git(["show", `${entry.currentCommit}:${entry.path}`]);
		const expected = git(["show", `${entry.expectedCommit}:${entry.path}`]);
		assert.equal(sha256(current), entry.currentSha256, entry.path);
		assert.equal(sha256(expected), entry.expectedSha256, entry.path);
		assert.equal(reverseCoreTerminalReachabilityEntry(current, entry)
			, expected, entry.path);
		assert.equal(beforeCoreTerminalReachabilitySource(
			entry.path, current, entry.expectedSha256), expected, entry.path);
		assert.equal(beforeCoreTerminalReachabilitySource(
			entry.path, current), current, entry.path);
		assert.equal(beforeCoreTerminalReachabilitySource(
			entry.path, current, "0".repeat(64)), current, entry.path);
		const unknown = current + "unknown";
		assert.equal(beforeCoreTerminalReachabilitySource(
			entry.path, unknown, entry.expectedSha256), unknown, entry.path);
		assert.throws(() => reverseCoreTerminalReachabilityEntry(
			current, { ...entry, expectedSha256: "0".repeat(64) }
		));
		const reader = entry.path.startsWith(
			"tests/helpers/owned-perl-callback-result-variant-"
		) ? beforePhpCallbackInstalledStaging : undefined;
		const reconstructed = await sourceAtFinHistoryMilestone(
			entry.path, entry.expectedSha256, reader
		);
		assert.equal(reconstructed, expected, entry.path);
	}
});

test("Core terminal repair closes additions and refreshed pins", async () => {
	const record = JSON.parse(await readFile(
		coreTerminalReachabilityHistoryPath, "utf8"
	));
	for(const addition of record.additions)
	{
		assert.equal(sha256(await readFile(addition.path))
			, addition.currentSha256, addition.path);
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${coreTerminalReachabilityPredecessor}:${addition.path}`]
		, { stdio: "ignore" }).status, 0, addition.path);
	}
	const previous = JSON.parse(git(["show"
		, `${coreTerminalReachabilityPredecessor}:docs/type-surface.v1.json`]));
	let count = 0;
	for(const pin of record.pinUpdates)
	{
		const update = record.updates.find(item => item.path === pin.path);
		assert.ok(update, pin.path);
		assert.equal(update.previousSha256, pin.previousSha256, pin.path);
		assert.equal(update.currentSha256, pin.currentSha256, pin.path);
		let found = 0;
		for(const evidence of previous.evidence) for(const file of evidence.files)
			if(file.path === pin.path && file.sha256 === pin.previousSha256)
			{
				file.sha256 = pin.currentSha256;
				found++;
			}
		assert.equal(found, pin.count, pin.path);
		count += found;
	}
	assert.equal(count, record.pinCount);
	const inventory = record.updates.find(update =>
		update.path === "docs/type-surface.v1.json"
	);
	assert.ok(inventory);
	const current = await sourceAtFinHistoryMilestone(
		inventory.path, inventory.currentSha256
		, beforeCoreTerminalReachabilityRepairSource
	);
	assert.equal(current, JSON.stringify(previous, null, 2) + "\n");
});

test("Core terminal repair writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-core-terminal-reachability-guard-"
	));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const localGit = args => execFileSync("git", args, {
		cwd: root, env: environment, stdio: "pipe"
	});
	localGit(["init", "--quiet"]);
	localGit(["-c", "user.name=Test", "-c"
		, "user.email=test@example.invalid", "-c", "commit.gpgsign=false"
		, "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-core-terminal-reachability-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /must stay on its exact predecessor/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
