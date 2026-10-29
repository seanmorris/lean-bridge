#!/usr/bin/env node
/**
 * Record the exact generated-output repair type-surface transition and its
 * newest-first registration.
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
	generatedOutputControlRepairTypeSurfaceAddedPaths
	, generatedOutputControlRepairTypeSurfaceAnchorSha256
	, generatedOutputControlRepairTypeSurfaceHistoryPath
	, generatedOutputControlRepairTypeSurfaceIntegrationPaths
	, generatedOutputControlRepairTypeSurfacePath
	, generatedOutputControlRepairTypeSurfacePinCount
	, generatedOutputControlRepairTypeSurfacePinDefinition
	, generatedOutputControlRepairTypeSurfacePinRefresh
	, generatedOutputControlRepairTypeSurfacePredecessor
	, generatedOutputControlRepairTypeSurfaceTargetSha256
} from "../tests/helpers/generated-output-control-repair-type-surface-lineage-source-history.mjs";

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-generated-output-control-repair-type-surface-lineage-source-history.mjs");
const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n").filter(Boolean).sort();
const integrationParent = git(["rev-parse", "HEAD"]).trim();
assert.equal(integrationParent, generatedOutputControlRepairTypeSurfacePredecessor);
assert.equal(spawnSync("git", ["merge-base", "--is-ancestor"
	, generatedOutputControlRepairTypeSurfacePinRefresh
	, integrationParent]).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M", "--"])
	, [...generatedOutputControlRepairTypeSurfaceIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...generatedOutputControlRepairTypeSurfaceAddedPaths])
, [...generatedOutputControlRepairTypeSurfaceAddedPaths].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${integrationParent}:${generatedOutputControlRepairTypeSurfaceHistoryPath}`]
, { stdio: "ignore" }).status, 0);

const update = {
	...await gitSourceHistoryTransition(generatedOutputControlRepairTypeSurfacePath
		, generatedOutputControlRepairTypeSurfacePinDefinition
		, generatedOutputControlRepairTypeSurfacePinRefresh
		, { maximumEditBytes: 16 * 1024 * 1024 })
	, commit: generatedOutputControlRepairTypeSurfacePinRefresh
	, parent: generatedOutputControlRepairTypeSurfacePinDefinition
};
assert.equal(update.previousSha256
	, generatedOutputControlRepairTypeSurfaceAnchorSha256);
assert.equal(update.currentSha256
	, generatedOutputControlRepairTypeSurfaceTargetSha256);
const digestPattern = /[0-9a-f]{64}/gu;
let pins = 0;
for(const edit of update.edits)
{
	assert.equal(edit.current.replace(digestPattern, "")
		, edit.previous.replace(digestPattern, ""));
	pins += edit.current.match(digestPattern).length;
}
assert.equal(pins, generatedOutputControlRepairTypeSurfacePinCount);

const directory = await mkdtemp(join(tmpdir(), "lean-generated-output-type-surface-"));
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
		, ...generatedOutputControlRepairTypeSurfaceIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit(
		["commit-tree", tree, "-p", integrationParent]
		, { input: "Authenticate generated-output type-surface integration\n" }
	).trim();
	const integrationUpdates = [];
	for(const path of generatedOutputControlRepairTypeSurfaceIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, integrationParent, integrationCommit));
	const additions = [];
	for(const path of generatedOutputControlRepairTypeSurfaceAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", integrationParent, "--", path])
			.trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await mkdir(dirname(generatedOutputControlRepairTypeSurfaceHistoryPath)
		, { recursive: true });
	await writeFile(generatedOutputControlRepairTypeSurfaceHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "generated-output-control-repair-type-surface-lineage-source-v1"
		, predecessorCommit: integrationParent
		, anchorSha256: generatedOutputControlRepairTypeSurfaceAnchorSha256
		, targetSha256: generatedOutputControlRepairTypeSurfaceTargetSha256
		, scope: "Authenticate exactly 17 live type-surface pointer changes: 15 Perl generator references spanning the recorded scripting HostNull projection and whitespace correction, plus two JVM structured-regression reader references. Preserve every other inventory byte and register the streamed transition newest-first above the generated-output product-history layer."
		, updates: [update], integrationUpdates, additions
	}), { flag: "wx" });
	process.stdout.write(`Recorded one type-surface transition, `
		+ `${integrationUpdates.length} integrations and ${pins} pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
