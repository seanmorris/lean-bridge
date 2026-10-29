#!/usr/bin/env node
/**
 * Record the npm runtime module-graph closure repair and its live-pin refresh.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	dependentCheckedRecordPromotionCurrentSourcePaths
} from "../tests/helpers/dependent-checked-record-promotion.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";
import {
	npmRuntimeModuleGraphClosureCommits
	, npmRuntimeModuleGraphClosureHistoryAdditions
	, npmRuntimeModuleGraphClosureHistoryPath
	, npmRuntimeModuleGraphClosureImplementation
	, npmRuntimeModuleGraphClosureImplementationAdditions
	, npmRuntimeModuleGraphClosureImplementationPaths
	, npmRuntimeModuleGraphClosureIntegrationPaths
	, npmRuntimeModuleGraphClosurePackagePath
	, npmRuntimeModuleGraphClosurePredecessor
	, npmRuntimeModuleGraphClosureSourceCommit
} from "../tests/helpers/npm-runtime-module-graph-closure-source-history.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-npm-runtime-module-graph-closure-source-history.mjs");
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, npmRuntimeModuleGraphClosureImplementation);
assert.deepEqual(git(["rev-list", "--reverse"
	, `${npmRuntimeModuleGraphClosurePredecessor}`
		+ `..${npmRuntimeModuleGraphClosureImplementation}`]).trim().split("\n")
, [...npmRuntimeModuleGraphClosureCommits]);
assert.equal(npmRuntimeModuleGraphClosureCommits[0]
	, npmRuntimeModuleGraphClosureSourceCommit);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, npmRuntimeModuleGraphClosurePredecessor
	, npmRuntimeModuleGraphClosureImplementation, "--"])
, [...npmRuntimeModuleGraphClosureImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, npmRuntimeModuleGraphClosurePredecessor
	, npmRuntimeModuleGraphClosureImplementation, "--"])
, [...npmRuntimeModuleGraphClosureImplementationAdditions].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${npmRuntimeModuleGraphClosureImplementation}`
		+ `:${npmRuntimeModuleGraphClosureHistoryPath}`]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...npmRuntimeModuleGraphClosureIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...npmRuntimeModuleGraphClosureHistoryAdditions])
, [...npmRuntimeModuleGraphClosureHistoryAdditions].sort());

const updates = [];
for(const path of npmRuntimeModuleGraphClosureImplementationPaths)
	updates.push(await gitSourceHistoryTransition(
		path, npmRuntimeModuleGraphClosurePredecessor
		, npmRuntimeModuleGraphClosureImplementation
		, { maximumEditBytes: 32 * 1024 * 1024 }
	));
const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
const changedPaths = [...new Set([
	...npmRuntimeModuleGraphClosureImplementationPaths
	, ...npmRuntimeModuleGraphClosureImplementationAdditions
])].sort();
const currentSourcePaths = dependentCheckedRecordPromotionCurrentSourcePaths(
	inventory, changedPaths).sort();
assert.deepEqual(currentSourcePaths
	, [npmRuntimeModuleGraphClosurePackagePath]);
const packagePrevious = sha256(git(["show"
	, `${npmRuntimeModuleGraphClosurePredecessor}`
		+ `:${npmRuntimeModuleGraphClosurePackagePath}`]));
const packageCurrent = sha256(git(["show"
	, `${npmRuntimeModuleGraphClosureImplementation}`
		+ `:${npmRuntimeModuleGraphClosurePackagePath}`]));
const inventoryUpdate = updates.find(update => update.path === inventoryPath);
assert.equal(inventoryUpdate.edits.length, 16);
for(const edit of inventoryUpdate.edits)
{
	assert.equal(edit.previous.trim(), `"sha256": "${packagePrevious}"`);
	assert.equal(edit.current.trim(), `"sha256": "${packageCurrent}"`);
}

const directory = await mkdtemp(join(
	tmpdir(), "lean-npm-runtime-module-graph-closure-"));
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
	temporaryGit(["read-tree", npmRuntimeModuleGraphClosureImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...npmRuntimeModuleGraphClosureIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", npmRuntimeModuleGraphClosureImplementation
	], { input: "Authenticate npm runtime module closure\n" }).trim();
	const integrationUpdates = [];
	for(const path of npmRuntimeModuleGraphClosureIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, npmRuntimeModuleGraphClosureImplementation
			, integrationCommit, { maximumEditBytes: 32 * 1024 * 1024 }
		));
	const implementationAdditions = [];
	for(const path of npmRuntimeModuleGraphClosureImplementationAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, npmRuntimeModuleGraphClosurePredecessor, "--", path]).trim(), ""
		, path);
		implementationAdditions.push({ path
			, sha256: sha256(git(["show"
				, `${npmRuntimeModuleGraphClosureImplementation}:${path}`])) });
	}
	const historyAdditions = [];
	for(const path of npmRuntimeModuleGraphClosureHistoryAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, npmRuntimeModuleGraphClosureImplementation, "--", path]).trim(), ""
		, path);
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	}
	await writeFile(npmRuntimeModuleGraphClosureHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "npm-runtime-module-graph-closure-source-v1"
		, predecessorCommit: npmRuntimeModuleGraphClosurePredecessor
		, sourceCommit: npmRuntimeModuleGraphClosureSourceCommit
		, implementationCommit: npmRuntimeModuleGraphClosureImplementation
		, scope: "Close the shared npm runtime package after the optional-parameter branch reintroduced Binding IR default values and three shipped runtime modules began importing their validator. Restore internal/binding-ir/default-value.mjs, require the assembled runtime's complete relative ES-module graph to resolve, and restore the installed-package assertion. Refresh exactly the 16 live citations of component-npm-package.mjs. Preserve every support state, observation, retained artifact and public package contract."
		, updates, integrationUpdates, implementationAdditions
		, historyAdditions, currentSourcePaths, refreshedPins: 16
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation transitions, `
		+ `${integrationUpdates.length} registrations and 16 live pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
