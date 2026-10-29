#!/usr/bin/env node
/**
 * Record every first-parent state of the generated-output control repair and
 * its newest-first central history registration.
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
	generatedOutputControlRepairAddedPaths
	, generatedOutputControlRepairChangedPaths
	, generatedOutputControlRepairCommits
	, generatedOutputControlRepairExternalHistoryPaths
	, generatedOutputControlRepairHistoryAddedPaths
	, generatedOutputControlRepairHistoryPath
	, generatedOutputControlRepairImplementationAddedPaths
	, generatedOutputControlRepairIntegrationPaths
	, generatedOutputControlRepairPinCount
	, generatedOutputControlRepairPinRefresh
	, generatedOutputControlRepairPredecessor
} from "../tests/helpers/generated-output-control-repair-source-history.mjs";

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-generated-output-control-repair-source-history.mjs");
const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n").filter(Boolean).sort();
const predecessor = generatedOutputControlRepairPredecessor;
const implementation = generatedOutputControlRepairPinRefresh;
const integrationParent = git(["rev-parse", "HEAD"]).trim();

assert.equal(spawnSync("git", ["merge-base", "--is-ancestor"
	, implementation, integrationParent]).status, 0);
assert.deepEqual(git(["rev-list", "--reverse", "--first-parent"
	, `${predecessor}..${implementation}`]).trim().split("\n")
, generatedOutputControlRepairCommits);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation, "--"])
, [...generatedOutputControlRepairChangedPaths
	, ...generatedOutputControlRepairExternalHistoryPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, predecessor, implementation, "--"])
, [...generatedOutputControlRepairImplementationAddedPaths].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${integrationParent}:${generatedOutputControlRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed generated-output history");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M", "--"])
	, [...generatedOutputControlRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...generatedOutputControlRepairHistoryAddedPaths])
, [...generatedOutputControlRepairHistoryAddedPaths].sort());

const directory = await mkdtemp(join(tmpdir(), "lean-generated-output-control-history-"));
try
{
	const updates = [], commits = [], seenChanged = new Set();
	for(const commit of generatedOutputControlRepairCommits)
	{
		const parent = git(["rev-parse", `${commit}^`]).trim();
		const subject = git(["show", "-s", "--format=%s", commit]).trim();
		const modified = names(["diff-tree", "--no-commit-id", "--name-only"
			, "--diff-filter=M", "-r", commit]);
		const added = names(["diff-tree", "--no-commit-id", "--name-only"
			, "--diff-filter=A", "-r", commit]);
		for(const path of modified)
		{
			if(generatedOutputControlRepairExternalHistoryPaths.includes(path)) continue;
			assert.ok(generatedOutputControlRepairChangedPaths.includes(path)
				, `Unregistered modified generated-output path ${path}`);
			seenChanged.add(path);
			updates.push({
				...await gitSourceHistoryTransition(path, parent, commit
					, { maximumEditBytes: 16 * 1024 * 1024 })
				, commit, parent
			});
		}
		for(const path of added)
			assert.ok(generatedOutputControlRepairImplementationAddedPaths.includes(path)
				, `Unregistered added generated-output path ${path}`);
		commits.push({ commit, parent, subject, modified, added });
	}
	assert.deepEqual([...seenChanged].sort()
		, [...generatedOutputControlRepairChangedPaths].sort());

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
		, ...generatedOutputControlRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit(
		["commit-tree", tree, "-p", integrationParent]
		, { input: "Authenticate generated-output control repair integration\n" }
	).trim();
	const integrationUpdates = [];
	for(const path of generatedOutputControlRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, integrationParent, integrationCommit));

	const additions = [];
	for(const path of generatedOutputControlRepairAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
			.trim(), "", path);
		const source = generatedOutputControlRepairImplementationAddedPaths.includes(path)
			? git(["show", `${implementation}:${path}`])
			: await readFile(path);
		additions.push({ path, currentSha256: sha256(source) });
	}

	await mkdir(dirname(generatedOutputControlRepairHistoryPath), { recursive: true });
	await writeFile(generatedOutputControlRepairHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "generated-output-control-repair-source-v1"
		, predecessorCommit: predecessor
		, implementationCommit: implementation
		, integrationParent
		, externalTypeSurfacePointers: generatedOutputControlRepairPinCount
		, scope: "Remove the stray Perl XS argument-read tab without weakening exact bound checks. Reconstruct the copied-native private local namespace only inside authenticated lb_call_* bodies before older closure evidence. Reconstruct only the .NET and JVM generated README HostNull prose while existing producer-pinned generators continue to authenticate carrier code. Refresh exactly 17 live source pointers. The adjacent streamed lineage layer exclusively authenticates the large inventory transition."
		, commits, updates, integrationUpdates, additions
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${commits.length} commits, `
		+ `${updates.length} source transitions, ${integrationUpdates.length} integrations, `
		+ `${additions.length} additions and ${generatedOutputControlRepairPinCount} pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
