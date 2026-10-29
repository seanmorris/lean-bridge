#!/usr/bin/env node
/**
 * Record the exact scripting HostNull type-surface transition and registration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition } from "../tests/helpers/source-history-stream.mjs";
import {
	hostNullScriptingTypeSurfaceAddedPaths
	, hostNullScriptingTypeSurfaceAnchorSha256
	, hostNullScriptingTypeSurfaceHistoryPath
	, hostNullScriptingTypeSurfaceIntegrationPaths
	, hostNullScriptingTypeSurfacePath
	, hostNullScriptingTypeSurfacePinCount
	, hostNullScriptingTypeSurfacePinDefinition
	, hostNullScriptingTypeSurfacePinRefresh
	, hostNullScriptingTypeSurfacePredecessor
	, hostNullScriptingTypeSurfaceTargetSha256
} from "../tests/helpers/host-null-scripting-type-surface-lineage-source-history.mjs";

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-host-null-scripting-type-surface-lineage-source-history.mjs");
const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n").filter(Boolean).sort();
const integrationParent = git(["rev-parse", "HEAD"]).trim();
assert.equal(integrationParent, hostNullScriptingTypeSurfacePredecessor);
assert.equal(spawnSync("git", ["merge-base", "--is-ancestor"
	, hostNullScriptingTypeSurfacePinRefresh, integrationParent]).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M", "--"])
	, [...hostNullScriptingTypeSurfaceIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...hostNullScriptingTypeSurfaceAddedPaths])
, [...hostNullScriptingTypeSurfaceAddedPaths].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${integrationParent}:${hostNullScriptingTypeSurfaceHistoryPath}`]
, { stdio: "ignore" }).status, 0);

const update = {
	...await gitSourceHistoryTransition(hostNullScriptingTypeSurfacePath
		, hostNullScriptingTypeSurfacePinDefinition
		, hostNullScriptingTypeSurfacePinRefresh
		, { maximumEditBytes: 16 * 1024 * 1024 })
	, commit: hostNullScriptingTypeSurfacePinRefresh
	, parent: hostNullScriptingTypeSurfacePinDefinition
};
assert.equal(update.previousSha256, hostNullScriptingTypeSurfaceAnchorSha256);
assert.equal(update.currentSha256, hostNullScriptingTypeSurfaceTargetSha256);
const digestPattern = /[0-9a-f]{64}/gu;
let pins = 0;
for(const edit of update.edits)
{
	assert.equal(edit.current.replace(digestPattern, "")
		, edit.previous.replace(digestPattern, ""));
	pins += edit.current.match(digestPattern).length;
}
assert.equal(pins, hostNullScriptingTypeSurfacePinCount);

const directory = await mkdtemp(join(tmpdir(), "lean-host-null-scripting-type-surface-"));
try
{
	const temporaryIndex = join(directory, "index");
	const environment = {
		...process.env, GIT_INDEX_FILE: temporaryIndex
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
	temporaryGit(["read-tree", integrationParent]);
	temporaryGit(["add", "--sparse", "--"
		, ...hostNullScriptingTypeSurfaceIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit(
		["commit-tree", tree, "-p", integrationParent]
		, { input: "Authenticate scripting HostNull type-surface integration\n" }
	).trim();
	const integrationUpdates = [];
	for(const path of hostNullScriptingTypeSurfaceIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, integrationParent, integrationCommit));
	const additions = [];
	for(const path of hostNullScriptingTypeSurfaceAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", integrationParent, "--", path])
			.trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await mkdir(dirname(hostNullScriptingTypeSurfaceHistoryPath), { recursive: true });
	await writeFile(hostNullScriptingTypeSurfaceHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "host-null-scripting-type-surface-lineage-source-v1"
		, predecessorCommit: integrationParent
		, anchorSha256: hostNullScriptingTypeSurfaceAnchorSha256
		, targetSha256: hostNullScriptingTypeSurfaceTargetSha256
		, scope: "Authenticate the exact 115 live type-surface pointer changes for the scripting HostNull workflow and closed profile sources. Preserve every support state, observation, evidence identity and product byte; register the transition newest-first above the scripting product-history layer."
		, updates: [update], integrationUpdates, additions
	}), { flag: "wx" });
	process.stdout.write(`Recorded one type-surface transition, `
		+ `${integrationUpdates.length} integrations and ${pins} pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
