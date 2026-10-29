#!/usr/bin/env node
/**
 * Record the exact systems HostNull type-surface transition and registration.
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
	hostNullSystemsTypeSurfaceAddedPaths
	, hostNullSystemsTypeSurfaceAnchorSha256
	, hostNullSystemsTypeSurfaceHistoryPath
	, hostNullSystemsTypeSurfaceIntegrationPaths
	, hostNullSystemsTypeSurfacePath
	, hostNullSystemsTypeSurfacePinCount
	, hostNullSystemsTypeSurfacePinDefinition
	, hostNullSystemsTypeSurfacePinRefresh
	, hostNullSystemsTypeSurfacePredecessor
	, hostNullSystemsTypeSurfaceTargetSha256
} from "../tests/helpers/host-null-systems-type-surface-lineage-source-history.mjs";

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-host-null-systems-type-surface-lineage-source-history.mjs");
const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n").filter(Boolean).sort();
const integrationParent = git(["rev-parse", "HEAD"]).trim();
assert.equal(integrationParent, hostNullSystemsTypeSurfacePredecessor);
assert.equal(spawnSync("git", ["merge-base", "--is-ancestor"
	, hostNullSystemsTypeSurfacePinRefresh, integrationParent]).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M", "--"])
	, [...hostNullSystemsTypeSurfaceIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...hostNullSystemsTypeSurfaceAddedPaths])
, [...hostNullSystemsTypeSurfaceAddedPaths].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${integrationParent}:${hostNullSystemsTypeSurfaceHistoryPath}`]
, { stdio: "ignore" }).status, 0);

const update = {
	...await gitSourceHistoryTransition(hostNullSystemsTypeSurfacePath
		, hostNullSystemsTypeSurfacePinDefinition
		, hostNullSystemsTypeSurfacePinRefresh
		, { maximumEditBytes: 16 * 1024 * 1024 })
	, commit: hostNullSystemsTypeSurfacePinRefresh
	, parent: hostNullSystemsTypeSurfacePinDefinition
};
assert.equal(update.previousSha256, hostNullSystemsTypeSurfaceAnchorSha256);
assert.equal(update.currentSha256, hostNullSystemsTypeSurfaceTargetSha256);
const digestPattern = /[0-9a-f]{64}/gu;
let pins = 0;
for(const edit of update.edits)
{
	assert.equal(edit.current.replace(digestPattern, "")
		, edit.previous.replace(digestPattern, ""));
	pins += edit.current.match(digestPattern).length;
}
assert.equal(pins, hostNullSystemsTypeSurfacePinCount);

const directory = await mkdtemp(join(tmpdir(), "lean-host-null-systems-type-surface-"));
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
		, ...hostNullSystemsTypeSurfaceIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit(
		["commit-tree", tree, "-p", integrationParent]
		, { input: "Authenticate systems HostNull type-surface integration\n" }
	).trim();
	const integrationUpdates = [];
	for(const path of hostNullSystemsTypeSurfaceIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, integrationParent, integrationCommit));
	const additions = [];
	for(const path of hostNullSystemsTypeSurfaceAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", integrationParent, "--", path])
			.trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await mkdir(dirname(hostNullSystemsTypeSurfaceHistoryPath), { recursive: true });
	await writeFile(hostNullSystemsTypeSurfaceHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "host-null-systems-type-surface-lineage-source-v1"
		, predecessorCommit: integrationParent
		, anchorSha256: hostNullSystemsTypeSurfaceAnchorSha256
		, targetSha256: hostNullSystemsTypeSurfaceTargetSha256
		, scope: "Authenticate the exact 308 live type-surface pointer changes for the systems HostNull workflow and closed profile sources without changing any support claim, observation or product byte."
		, updates: [update], integrationUpdates, additions
	}), { flag: "wx" });
	process.stdout.write(`Recorded one type-surface transition, `
		+ `${integrationUpdates.length} integrations and ${pins} pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
