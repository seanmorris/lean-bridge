#!/usr/bin/env node
/**
 * Record every first-parent state of the explicit HostNull JavaScript/browser
 * rollout and its newest-first central history registration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition } from "../tests/helpers/source-history-stream.mjs";
import {
	hostNullJavaScriptAddedPaths
	, hostNullJavaScriptChangedPaths
	, hostNullJavaScriptCommits
	, hostNullJavaScriptHistoryAddedPaths
	, hostNullJavaScriptHistoryPath
	, hostNullJavaScriptImplementationAddedPaths
	, hostNullJavaScriptIntegrationPaths
	, hostNullJavaScriptPinCount
	, hostNullJavaScriptPinCounts
	, hostNullJavaScriptPinRefresh
	, hostNullJavaScriptPredecessor
} from "../tests/helpers/host-null-javascript-source-history.mjs";

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-host-null-javascript-source-history.mjs");
const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const predecessor = hostNullJavaScriptPredecessor;
const implementation = hostNullJavaScriptPinRefresh;

assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "HostNull JavaScript history requires its exact pin-refresh head");
assert.deepEqual(git(["rev-list", "--reverse", "--first-parent"
	, `${predecessor}..${implementation}`]).trim().split("\n")
, hostNullJavaScriptCommits);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation, "--"])
, [...hostNullJavaScriptChangedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, predecessor, implementation, "--"])
, [...hostNullJavaScriptImplementationAddedPaths].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${hostNullJavaScriptHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed HostNull history");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...hostNullJavaScriptIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...hostNullJavaScriptHistoryAddedPaths])
, [...hostNullJavaScriptHistoryAddedPaths].sort());

const directory = await mkdtemp(join(tmpdir(), "lean-host-null-javascript-history-"));
try
{
	const updates = [], commits = [], seenChanged = new Set();
	for(const commit of hostNullJavaScriptCommits)
	{
		const parent = git(["rev-parse", `${commit}^`]).trim();
		const subject = git(["show", "-s", "--format=%s", commit]).trim();
		const modified = names(["diff-tree", "--no-commit-id", "--name-only"
			, "--diff-filter=M", "-r", commit]);
		const added = names(["diff-tree", "--no-commit-id", "--name-only"
			, "--diff-filter=A", "-r", commit]);
		for(const path of modified)
		{
			assert.ok(hostNullJavaScriptChangedPaths.includes(path)
				, `Unregistered modified HostNull path ${path}`);
			seenChanged.add(path);
			updates.push({
				...await gitSourceHistoryTransition(path, parent, commit
					, { maximumEditBytes: 16 * 1024 * 1024 })
				, commit, parent
			});
		}
		for(const path of added)
			assert.ok(hostNullJavaScriptImplementationAddedPaths.includes(path)
				, `Unregistered added HostNull path ${path}`);
		commits.push({ commit, parent, subject, modified, added });
	}
	assert.deepEqual([...seenChanged].sort()
		, [...hostNullJavaScriptChangedPaths].sort());

	// Put the current registration files in an unreachable temporary commit so
	// the same streaming transition writer authenticates their complete bytes.
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
	temporaryGit(["read-tree", implementation]);
	temporaryGit(["add", "--sparse", "--", ...hostNullJavaScriptIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const commitOptions = {
		input: "Authenticate HostNull JavaScript integration\n"
	};
	const integrationCommit = temporaryGit(["commit-tree", tree
		, "-p", implementation], commitOptions).trim();
	const integrationUpdates = [];
	for(const path of hostNullJavaScriptIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, implementation, integrationCommit));

	const additions = [];
	for(const path of hostNullJavaScriptAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
			.trim(), "", path);
		const source = hostNullJavaScriptImplementationAddedPaths.includes(path)
			? git(["show", `${implementation}:${path}`])
			: await readFile(path);
		additions.push({ path, currentSha256: sha256(source) });
	}

	assert.equal(Object.keys(hostNullJavaScriptPinCounts).length, 48);
	assert.equal(hostNullJavaScriptPinCount, 975);
	await writeFile(hostNullJavaScriptHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "host-null-javascript-source-v1"
		, predecessorCommit: predecessor
		, implementationCommit: implementation
		, reconciledTypeSurfacePointers: hostNullJavaScriptPinCount
		, scope: "Introduce an explicit generic Lean HostNull wrapper selected by exact wrapper and constructor identities, preserve that authenticated projection through ordinary-source and independently reviewed IR analysis, and lower it as direct null-or-T values without conflating HostNull with Option, omitted parameters, erased proofs or unsupported data. Compile copied, recursive, record, callback and returned-closure JavaScript/browser transport with ABI tag 38 while retaining Option and Except constructors. Package every relocated runtime dependency. Exercise source-free installed Node, strict TypeScript, browser JavaScript, React and worker consumers for both author routes and register the same test with Chromium, Firefox and WebKit in recurring Downstream CI. Retain every intermediate source state, the conflict-resolved shared-Fin callable behavior, and exactly 975 current-source pin advances across 48 paths. No installed support cell is promoted before hosted artifacts are archived and independently replayed."
		, commits, updates, integrationUpdates, additions
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${commits.length} commits, `
		+ `${updates.length} transitions, ${integrationUpdates.length} integrations, `
		+ `${additions.length} additions and ${hostNullJavaScriptPinCount} pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
