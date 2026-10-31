#!/usr/bin/env node
/**
 * Record the complete VO #1220 exact-model audit.
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
	vo1220ExactModelHistoryAdditions
	, vo1220ExactModelHistoryPath
	, vo1220ExactModelImplementation
	, vo1220ExactModelImplementationAdditions
	, vo1220ExactModelImplementationPaths
	, vo1220ExactModelIntegrationPaths
	, vo1220ExactModelPredecessor
} from "../tests/helpers/vo1220-exact-model-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-vo1220-exact-model-source-history.mjs");
assert.equal(existsSync(vo1220ExactModelHistoryPath), false
	, vo1220ExactModelHistoryPath + " already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, vo1220ExactModelImplementation);
assert.equal(git(["rev-parse"
	, vo1220ExactModelImplementation + "^"]).trim()
, vo1220ExactModelPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, vo1220ExactModelPredecessor, vo1220ExactModelImplementation, "--"])
, [...vo1220ExactModelImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, vo1220ExactModelPredecessor, vo1220ExactModelImplementation, "--"])
, [...vo1220ExactModelImplementationAdditions].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, vo1220ExactModelImplementation + ":" + vo1220ExactModelHistoryPath]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...vo1220ExactModelIntegrationPaths])
, [...vo1220ExactModelIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...vo1220ExactModelHistoryAdditions])
, [...vo1220ExactModelHistoryAdditions].sort());
assert.equal(spawnSync("git", ["diff", "--quiet"
	, vo1220ExactModelPredecessor, vo1220ExactModelImplementation
	, "--", "docs/type-surface.v1.json"]).status, 0);

const updates = [];
for(const path of vo1220ExactModelImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, vo1220ExactModelPredecessor, vo1220ExactModelImplementation));
const implementationAdditions = vo1220ExactModelImplementationAdditions
	.map(path => {
		const source = git(["show", vo1220ExactModelImplementation + ":" + path]);
		return { path, sha256: sha256(source), bytes: Buffer.byteLength(source) };
	});
const exactModel = implementationAdditions.find(item =>
	item.path === "docs/evidence/vo1220-exact-type-surface-v1.json");
assert.deepEqual(exactModel, {
	path: "docs/evidence/vo1220-exact-type-surface-v1.json"
	, sha256: "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f"
	, bytes: 16916757
});

const directory = await mkdtemp(join(tmpdir(), "lean-vo1220-exact-model-"));
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
	temporaryGit(["read-tree", vo1220ExactModelImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...vo1220ExactModelIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", vo1220ExactModelImplementation
	], { input: "Authenticate complete 1220 exact model\n" }).trim();
	const integrationUpdates = [];
	for(const path of vo1220ExactModelIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, vo1220ExactModelImplementation, integrationCommit
			, { maximumEditBytes: 16 * 1024 * 1024 }
		));
	const historyAdditions = [];
	for(const path of vo1220ExactModelHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(vo1220ExactModelHistoryPath, canonicalJson({
		schemaVersion: 1, milestone: "vo1220-exact-model-source-v1"
		, predecessorCommit: vo1220ExactModelPredecessor
		, implementationCommit: vo1220ExactModelImplementation
		, scope: "Freeze one reviewable expected model for all 1,054 VO #1220 cells and all 5,270 stage entries. Compare every identity, supported position, ordered evidence list, host type, scope and limitation string, stage state and note in one deterministic pass. Aggregate every mismatch instead of allowing the first stale assertion to conceal the rest of the matrix. Preserve the already-green zero-gap behavior and change no type-surface observation, evidence identity or product byte."
		, updates, implementationAdditions, integrationUpdates, historyAdditions
		, owner: 1220, cells: 1054, stageEntries: 5270
		, passedStageEntries: 5270, reportedMutationMismatches: 4
		, exactModel: { sha256: exactModel.sha256, bytes: exactModel.bytes }
		, typeSurfaceChanged: false, semanticChanges: 0
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} model transitions, `
		+ `${implementationAdditions.length} implementation additions and `
		+ `${integrationUpdates.length} registrations.\n`);
}
finally
{ await rm(directory, { recursive: true, force: true }); }
