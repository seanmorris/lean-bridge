#!/usr/bin/env node
/**
 * Record the final live-only VO #1220 zero-gap assertion.
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
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";
import {
	vo1220LiveZeroGapHistoryAdditions, vo1220LiveZeroGapHistoryPath
	, vo1220LiveZeroGapImplementation, vo1220LiveZeroGapImplementationPaths
	, vo1220LiveZeroGapIntegrationPaths, vo1220LiveZeroGapPredecessor
} from "../tests/helpers/vo1220-live-zero-gap-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-vo1220-live-zero-gap-source-history.mjs");
assert.equal(existsSync(vo1220LiveZeroGapHistoryPath), false
	, `${vo1220LiveZeroGapHistoryPath} already exists`);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, vo1220LiveZeroGapImplementation);
const parent = git(["rev-parse", `${vo1220LiveZeroGapImplementation}^`]).trim();
assert.equal(parent, vo1220LiveZeroGapPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, vo1220LiveZeroGapPredecessor, vo1220LiveZeroGapImplementation, "--"])
, [...vo1220LiveZeroGapImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, vo1220LiveZeroGapPredecessor, vo1220LiveZeroGapImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${vo1220LiveZeroGapImplementation}:${vo1220LiveZeroGapHistoryPath}`]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...vo1220LiveZeroGapIntegrationPaths])
, [...vo1220LiveZeroGapIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...vo1220LiveZeroGapHistoryAdditions])
, [...vo1220LiveZeroGapHistoryAdditions].sort());

const updates = [];
for(const path of vo1220LiveZeroGapImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, vo1220LiveZeroGapPredecessor, vo1220LiveZeroGapImplementation));
const directory = await mkdtemp(join(tmpdir(), "lean-vo1220-live-zero-gap-"));
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
			encoding: "utf8", maxBuffer: 64 * 1024 * 1024
			, env: environment, ...options
		}
	);
	temporaryGit(["read-tree", vo1220LiveZeroGapImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...vo1220LiveZeroGapIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", vo1220LiveZeroGapImplementation
	], { input: "Authenticate live VO 1220 zero-gap closure\n" }).trim();
	const integrationUpdates = [];
	for(const path of vo1220LiveZeroGapIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, vo1220LiveZeroGapImplementation, integrationCommit
			, { maximumEditBytes: 16 * 1024 * 1024 }
		));
	const historyAdditions = [];
	for(const path of vo1220LiveZeroGapHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(vo1220LiveZeroGapHistoryPath, canonicalJson({
		schemaVersion: 1, milestone: "vo1220-live-zero-gap-source-v1"
		, predecessorCommit: vo1220LiveZeroGapPredecessor
		, implementationCommit: vo1220LiveZeroGapImplementation
		, scope: "Remove the prepublication synthetic HostNull promotion fallback from the final owner-derived VO #1220 audit. Require the live checked-in inventory itself to contain all ten owned shapes, exactly 1,054 fully passing cells and 5,270 passing stage entries with zero gaps, missing observations, invalid evidence or reviewed exclusions, while retaining all four mutation refusals."
		, updates, integrationUpdates, historyAdditions
		, owner: 1220, cells: 1054, stageEntries: 5270
		, passedCells: 1054, gapEntries: 0, syntheticFallback: false
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} live zero-gap transition and `
		+ `${integrationUpdates.length} registrations.\n`);
}
finally
{ await rm(directory, { recursive: true, force: true }); }
