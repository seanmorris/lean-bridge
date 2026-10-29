#!/usr/bin/env node
/**
 * Record every first-parent state of the scripting HostNull rollout and its
 * newest-first central history registration.
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
	hostNullScriptingAddedPaths
	, hostNullScriptingChangedPaths
	, hostNullScriptingCommits
	, hostNullScriptingExternalHistoryPaths
	, hostNullScriptingHistoryAddedPaths
	, hostNullScriptingHistoryPath
	, hostNullScriptingImplementationAddedPaths
	, hostNullScriptingIntegrationPaths
	, hostNullScriptingPinCount
	, hostNullScriptingPinCounts
	, hostNullScriptingPinRefresh
	, hostNullScriptingPredecessor
} from "../tests/helpers/host-null-scripting-source-history.mjs";

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-host-null-scripting-source-history.mjs");
const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n").filter(Boolean).sort();
const predecessor = hostNullScriptingPredecessor;
const implementation = hostNullScriptingPinRefresh;
const integrationParent = git(["rev-parse", "HEAD"]).trim();

assert.equal(spawnSync("git", ["merge-base", "--is-ancestor"
	, implementation, integrationParent]).status, 0
, "Scripting HostNull implementation must be an ancestor of the integration head");
assert.deepEqual(git(["rev-list", "--reverse", "--first-parent"
	, `${predecessor}..${implementation}`]).trim().split("\n")
, hostNullScriptingCommits);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation, "--"])
, [...hostNullScriptingChangedPaths, ...hostNullScriptingExternalHistoryPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, predecessor, implementation, "--"])
, [...hostNullScriptingImplementationAddedPaths].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${integrationParent}:${hostNullScriptingHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed scripting history");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...hostNullScriptingIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...hostNullScriptingHistoryAddedPaths])
, [...hostNullScriptingHistoryAddedPaths].sort());

const directory = await mkdtemp(join(tmpdir(), "lean-host-null-scripting-history-"));
try
{
	const updates = [], commits = [], seenChanged = new Set();
	for(const commit of hostNullScriptingCommits)
	{
		const parent = git(["rev-parse", `${commit}^`]).trim();
		const subject = git(["show", "-s", "--format=%s", commit]).trim();
		const modified = names(["diff-tree", "--no-commit-id", "--name-only"
			, "--diff-filter=M", "-r", commit]);
		const added = names(["diff-tree", "--no-commit-id", "--name-only"
			, "--diff-filter=A", "-r", commit]);
		for(const path of modified)
		{
			if(hostNullScriptingExternalHistoryPaths.includes(path)) continue;
			assert.ok(hostNullScriptingChangedPaths.includes(path)
				, `Unregistered modified scripting HostNull path ${path}`);
			seenChanged.add(path);
			updates.push({
				...await gitSourceHistoryTransition(path, parent, commit
					, { maximumEditBytes: 16 * 1024 * 1024 })
				, commit, parent
			});
		}
		for(const path of added)
			assert.ok(hostNullScriptingImplementationAddedPaths.includes(path)
				, `Unregistered added scripting HostNull path ${path}`);
		commits.push({ commit, parent, subject, modified, added });
	}
	assert.deepEqual([...seenChanged].sort(), [...hostNullScriptingChangedPaths].sort());

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
	temporaryGit(["add", "--sparse", "--", ...hostNullScriptingIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit(
		["commit-tree", tree, "-p", integrationParent]
		, { input: "Authenticate scripting HostNull integration\n" }
	).trim();
	const integrationUpdates = [];
	for(const path of hostNullScriptingIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, integrationParent, integrationCommit));

	const additions = [];
	for(const path of hostNullScriptingAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
			.trim(), "", path);
		const source = hostNullScriptingImplementationAddedPaths.includes(path)
			? git(["show", `${implementation}:${path}`])
			: await readFile(path);
		additions.push({ path, currentSha256: sha256(source) });
	}

	assert.equal(Object.values(hostNullScriptingPinCounts)
		.reduce((sum, count) => sum + count, 0), hostNullScriptingPinCount);
	await mkdir(dirname(hostNullScriptingHistoryPath), { recursive: true });
	await writeFile(hostNullScriptingHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "host-null-scripting-source-v1"
		, predecessorCommit: predecessor
		, implementationCommit: implementation
		, integrationParent
		, externalTypeSurfacePointers: hostNullScriptingPinCount
		, scope: "Project explicit HostNull through Perl undef, Python None and Ruby nil without collapsing HostNull (Option T) into Option (HostNull T). Run ordinary and independently reviewed CPAN, PyPI and RubyGems packages after producer removal, offline installation, handoff removal and whole-installation relocation. Preserve 432 direct, nested, record, callback, closure, invalid-value and identity checks under an independent retained-report verifier and one recurring pinned scripting lane. The adjacent scripting type-surface lineage layer exclusively authenticates the exact 115-pointer inventory transition."
		, commits, updates, integrationUpdates, additions
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${commits.length} commits, `
		+ `${updates.length} source transitions, ${integrationUpdates.length} integrations, `
		+ `${additions.length} additions and ${hostNullScriptingPinCount} pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
