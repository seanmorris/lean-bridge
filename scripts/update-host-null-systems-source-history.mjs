#!/usr/bin/env node
/**
 * Record every first-parent state of the systems HostNull rollout and its
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
	hostNullSystemsAddedPaths
	, hostNullSystemsChangedPaths
	, hostNullSystemsCommits
	, hostNullSystemsExternalHistoryPaths
	, hostNullSystemsHistoryAddedPaths
	, hostNullSystemsHistoryPath
	, hostNullSystemsImplementationAddedPaths
	, hostNullSystemsIntegrationPaths
	, hostNullSystemsPinRefresh
	, hostNullSystemsPredecessor
} from "../tests/helpers/host-null-systems-source-history.mjs";

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-host-null-systems-source-history.mjs");
const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const predecessor = hostNullSystemsPredecessor;
const implementation = hostNullSystemsPinRefresh;
const integrationParent = git(["rev-parse", "HEAD"]).trim();

assert.equal(spawnSync("git", ["merge-base", "--is-ancestor"
	, implementation, integrationParent]).status, 0
, "Systems HostNull implementation must be an ancestor of the integration head");
assert.deepEqual(git(["rev-list", "--reverse", "--first-parent"
	, `${predecessor}..${implementation}`]).trim().split("\n")
, hostNullSystemsCommits);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation, "--"])
, [...hostNullSystemsChangedPaths, ...hostNullSystemsExternalHistoryPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, predecessor, implementation, "--"])
, [...hostNullSystemsImplementationAddedPaths].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${integrationParent}:${hostNullSystemsHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed systems history");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...hostNullSystemsIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...hostNullSystemsHistoryAddedPaths])
, [...hostNullSystemsHistoryAddedPaths].sort());

const directory = await mkdtemp(join(tmpdir(), "lean-host-null-systems-history-"));
try
{
	const updates = [], commits = [], seenChanged = new Set();
	for(const commit of hostNullSystemsCommits)
	{
		const parent = git(["rev-parse", `${commit}^`]).trim();
		const subject = git(["show", "-s", "--format=%s", commit]).trim();
		const modified = names(["diff-tree", "--no-commit-id", "--name-only"
			, "--diff-filter=M", "-r", commit]);
		const added = names(["diff-tree", "--no-commit-id", "--name-only"
			, "--diff-filter=A", "-r", commit]);
		for(const path of modified)
		{
			if(hostNullSystemsExternalHistoryPaths.includes(path)) continue;
			assert.ok(hostNullSystemsChangedPaths.includes(path)
				, `Unregistered modified systems HostNull path ${path}`);
			seenChanged.add(path);
			updates.push({
				...await gitSourceHistoryTransition(path, parent, commit
					, { maximumEditBytes: 16 * 1024 * 1024 })
				, commit, parent
			});
		}
		for(const path of added)
			assert.ok(hostNullSystemsImplementationAddedPaths.includes(path)
				, `Unregistered added systems HostNull path ${path}`);
		commits.push({ commit, parent, subject, modified, added });
	}
	assert.deepEqual([...seenChanged].sort(), [...hostNullSystemsChangedPaths].sort());

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
	temporaryGit(["add", "--sparse", "--", ...hostNullSystemsIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit(
		["commit-tree", tree, "-p", integrationParent]
		, { input: "Authenticate systems HostNull integration\n" }
	).trim();
	const integrationUpdates = [];
	for(const path of hostNullSystemsIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, integrationParent, integrationCommit));

	const additions = [];
	for(const path of hostNullSystemsAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
			.trim(), "", path);
		const source = hostNullSystemsImplementationAddedPaths.includes(path)
			? git(["show", `${implementation}:${path}`])
			: await readFile(path);
		additions.push({ path, currentSha256: sha256(source) });
	}

	await mkdir(dirname(hostNullSystemsHistoryPath), { recursive: true });
	await writeFile(hostNullSystemsHistoryPath, canonicalJson({
		schemaVersion: 1, milestone: "host-null-systems-source-v1"
		, predecessorCommit: predecessor, implementationCommit: implementation
		, integrationParent
		, scope: "Project compiler-authenticated HostNull through typed C, C++, Rust and WIT/WASI carriers. Preserve nested Option distinctions, fields, both callable directions, invalid-representation enforcement, explicit cleanup, source-free relocated execution and exact package identities across both author routes and all 40 acceptance cells."
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
