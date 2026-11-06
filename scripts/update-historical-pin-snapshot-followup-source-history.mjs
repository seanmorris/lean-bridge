#!/usr/bin/env node
/**
 * Record the remaining historical pin-snapshot isolation repairs.
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
	historicalPinSnapshotFollowupHistoryAdditions as historyAdditions
	, historicalPinSnapshotFollowupHistoryPath as historyPath
	, historicalPinSnapshotFollowupImplementation as implementation
	, historicalPinSnapshotFollowupImplementationPaths as implementationPaths
	, historicalPinSnapshotFollowupIntegrationPaths as integrationPaths
	, historicalPinSnapshotFollowupPredecessor as predecessor
} from "../tests/helpers/historical-pin-snapshot-followup-source-history.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";

const exactModelPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-historical-pin-snapshot-followup-source-history.mjs");
assert.equal(existsSync(historyPath), false, "History already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation);
assert.equal(git(["rev-parse", "HEAD^"]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", predecessor
	, implementation, "--"]), [...implementationPaths].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...integrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...historyAdditions]), [...historyAdditions].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${historyPath}`], { stdio: "ignore" }).status, 0);

const updates = [];
for(const path of implementationPaths)
	updates.push(await gitSourceHistoryTransition(path, predecessor
		, implementation, { maximumEditBytes: 64 * 1024 * 1024 }));
const exactSources = [predecessor, implementation].map(commit =>
	git(["show", `${commit}:${exactModelPath}`]));
assert.equal(new Set(exactSources.map(source => sha256(source))).size, 1);
const exact = JSON.parse(exactSources[0]);

const directory = await mkdtemp(join(tmpdir()
	, "lean-historical-pin-followup-history-"));
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
	], { input: "Authenticate historical pin snapshot follow-up\n" }).trim();
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
		, milestone: "historical-pin-snapshot-followup-v1"
		, predecessorCommit: predecessor, implementationCommit: implementation
		, integrationCommit
		, scope: "Bind the value-index evidence-pin and Python dependent-Fin no-pin assertions to their exact milestone inventories. Reconstruct the legacy replacement record directly so the recurring matrix test is both historical and fast. Preserve every support claim, source pin, archive and exact type-surface cell."
		, changedSupportCells: 0
		, exactModel: {
			sha256: sha256(exactSources[0]), bytes: Buffer.byteLength(exactSources[0])
			, cells: exact.model.length, stageEntries: exact.stageEntries
		}
		, updates, integrationUpdates, historyAdditions: additions
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} source and `
		+ `${integrationUpdates.length} integration transitions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
