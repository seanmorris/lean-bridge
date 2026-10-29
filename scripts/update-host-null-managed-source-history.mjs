#!/usr/bin/env node
/**
 * Record every first-parent state of the .NET, Java and Kotlin HostNull rollout
 * and its newest-first central history registration.
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
	hostNullManagedAddedPaths
	, hostNullManagedChangedPaths
	, hostNullManagedCommits
	, hostNullManagedExternalHistoryPaths
	, hostNullManagedHistoryAddedPaths
	, hostNullManagedHistoryPath
	, hostNullManagedImplementationAddedPaths
	, hostNullManagedIntegrationPaths
	, hostNullManagedPinRefresh
	, hostNullManagedPredecessor
} from "../tests/helpers/host-null-managed-source-history.mjs";

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-host-null-managed-source-history.mjs");
const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const predecessor = hostNullManagedPredecessor;
const implementation = hostNullManagedPinRefresh;
const integrationParent = git(["rev-parse", "HEAD"]).trim();

assert.equal(spawnSync("git", ["merge-base", "--is-ancestor"
	, implementation, integrationParent]).status, 0
, "Managed HostNull implementation must be an ancestor of the integration head");
assert.deepEqual(git(["rev-list", "--reverse", "--first-parent"
	, `${predecessor}..${implementation}`]).trim().split("\n")
, hostNullManagedCommits);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation, "--"])
, [...hostNullManagedChangedPaths, ...hostNullManagedExternalHistoryPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, predecessor, implementation, "--"])
, [...hostNullManagedImplementationAddedPaths].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${integrationParent}:${hostNullManagedHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed managed history");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...hostNullManagedIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...hostNullManagedHistoryAddedPaths])
, [...hostNullManagedHistoryAddedPaths].sort());

const directory = await mkdtemp(join(tmpdir(), "lean-host-null-managed-history-"));
try
{
	const updates = [], commits = [], seenChanged = new Set();
	for(const commit of hostNullManagedCommits)
	{
		const parent = git(["rev-parse", `${commit}^`]).trim();
		const subject = git(["show", "-s", "--format=%s", commit]).trim();
		const modified = names(["diff-tree", "--no-commit-id", "--name-only"
			, "--diff-filter=M", "-r", commit]);
		const added = names(["diff-tree", "--no-commit-id", "--name-only"
			, "--diff-filter=A", "-r", commit]);
		for(const path of modified)
		{
			if(hostNullManagedExternalHistoryPaths.includes(path)) continue;
			assert.ok(hostNullManagedChangedPaths.includes(path)
				, `Unregistered modified managed HostNull path ${path}`);
			seenChanged.add(path);
			updates.push({
				...await gitSourceHistoryTransition(path, parent, commit
					, { maximumEditBytes: 16 * 1024 * 1024 })
				, commit, parent
			});
		}
		for(const path of added)
			assert.ok(hostNullManagedImplementationAddedPaths.includes(path)
				, `Unregistered added managed HostNull path ${path}`);
		commits.push({ commit, parent, subject, modified, added });
	}
	assert.deepEqual([...seenChanged].sort(), [...hostNullManagedChangedPaths].sort());

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
	temporaryGit(["add", "--sparse", "--", ...hostNullManagedIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit(
		["commit-tree", tree, "-p", integrationParent]
		, { input: "Authenticate managed HostNull integration\n" }
	).trim();
	const integrationUpdates = [];
	for(const path of hostNullManagedIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, integrationParent, integrationCommit));

	const additions = [];
	for(const path of hostNullManagedAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
			.trim(), "", path);
		const source = hostNullManagedImplementationAddedPaths.includes(path)
			? git(["show", `${implementation}:${path}`])
			: await readFile(path);
		additions.push({ path, currentSha256: sha256(source) });
	}

	await mkdir(dirname(hostNullManagedHistoryPath), { recursive: true });
	await writeFile(hostNullManagedHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "host-null-managed-source-v1"
		, predecessorCommit: predecessor
		, implementationCommit: implementation
		, integrationParent
		, scope: "Project explicit HostNull through direct nullable .NET carriers, boxed nullable Java carriers and Kotlin nullable carriers without collapsing HostNull (Option T) into Option (HostNull T). Preserve the exact three-state copied-value, record, callback and returned-closure contracts, reject direct nested HostNull, and register every managed source test as closed. The combined HostNull type-surface lineage layer exclusively authenticates the 244-pin inventory transition."
		, commits, updates, integrationUpdates, additions
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${commits.length} commits, `
		+ `${updates.length} source transitions, ${integrationUpdates.length} integrations, `
		+ `${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
