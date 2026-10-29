#!/usr/bin/env node
/**
 * Record the exact optional promotion-reader live-pin repair.
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
	optionalParameterPromotionIoPinRepairHistoryAdditions as historyAdditions
	, optionalParameterPromotionIoPinRepairHistoryPath as historyPath
	, optionalParameterPromotionIoPinRepairImplementation as implementation
	, optionalParameterPromotionIoPinRepairImplementationAdditions as implementationAdditions
	, optionalParameterPromotionIoPinRepairImplementationPaths as implementationPaths
	, optionalParameterPromotionIoPinRepairIntegrationPaths as integrationPaths
	, optionalParameterPromotionIoPinRepairPredecessor as predecessor
} from "../tests/helpers/optional-parameter-promotion-io-pin-repair-source-history.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-optional-parameter-promotion-io-pin-repair-source-history.mjs");
assert.equal(existsSync(historyPath), false, `${historyPath} already exists`);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, git(["rev-parse", implementation]).trim());
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation, "--"]), [...implementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, predecessor, implementation, "--"]), [...implementationAdditions].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${historyPath}`], { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...integrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...historyAdditions]), [...historyAdditions].sort());

const updates = [];
for(const path of implementationPaths)
	updates.push(await gitSourceHistoryTransition(path, predecessor
		, implementation, { maximumEditBytes: 128 * 1024 * 1024 }));
const implementationSources = implementationAdditions.map(path => ({
	path, sha256: sha256(git(["show", `${implementation}:${path}`]))
}));
const directory = await mkdtemp(join(
	tmpdir(), "lean-optional-promotion-io-pin-history-"));
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
			encoding: "utf8", maxBuffer: 256 * 1024 * 1024
			, env: environment, ...options
		}
	);
	temporaryGit(["read-tree", implementation]);
	temporaryGit(["add", "--sparse", "--", ...integrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", implementation
	], { input: "Authenticate optional promotion reader pins\n" }).trim();
	const integrationUpdates = [];
	for(const path of integrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, implementation, integrationCommit
			, { maximumEditBytes: 16 * 1024 * 1024 }));
	const additions = [];
	for(const path of historyAdditions)
		additions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(historyPath, canonicalJson({
		schemaVersion: 1
		, milestone: "optional-parameter-promotion-io-pin-repair-v1"
		, predecessorCommit: predecessor
		, implementationCommit: git([
			"rev-parse"
			, implementation
		]).trim()
		, scope: "Refresh exactly thirty-three stale live source pins for the bounded type-surface promotion reader after optional-parameter publication changed that reader. Preserve all evidence identities, commands, scopes, archives, observations, support states and every unrelated byte; restore the unique path/digest contract consumed by exact-head Core."
		, updates, implementationAdditions: implementationSources
		, integrationUpdates, historyAdditions: additions
		, refreshedPins: 33, refreshedPaths: 1
		, currentSourcePaths: []
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} pin-repair transitions, `
		+ `${implementationSources.length} additions, `
		+ `${integrationUpdates.length} registrations and 0 live pins.\n`);
}
finally
{ await rm(directory, { recursive: true, force: true }); }
