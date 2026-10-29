#!/usr/bin/env node
/**
 * Record installed managed HostNull acceptance and final downstream pins.
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
	hostNullDownstreamAddedPaths
	, hostNullDownstreamChangedPaths
	, hostNullDownstreamCommits
	, hostNullDownstreamExternalHistoryPaths
	, hostNullDownstreamHistoryAddedPaths
	, hostNullDownstreamHistoryPath
	, hostNullDownstreamImplementationAddedPaths
	, hostNullDownstreamIntegrationPaths
	, hostNullDownstreamPinCount
	, hostNullDownstreamPinCounts
	, hostNullDownstreamPinRefresh
	, hostNullDownstreamPredecessor
} from "../tests/helpers/host-null-downstream-source-history.mjs";

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-host-null-downstream-source-history.mjs");
const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n").filter(Boolean).sort();
const predecessor = hostNullDownstreamPredecessor;
const implementation = hostNullDownstreamPinRefresh;
const integrationParent = git(["rev-parse", "HEAD"]).trim();

assert.equal(spawnSync("git", ["merge-base", "--is-ancestor"
	, implementation, integrationParent]).status, 0
, "Downstream HostNull implementation must be an ancestor of the integration head");
assert.deepEqual(git(["rev-list", "--reverse", "--first-parent"
	, `${predecessor}..${implementation}`]).trim().split("\n")
, hostNullDownstreamCommits);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation, "--"])
, [...hostNullDownstreamChangedPaths
	, ...hostNullDownstreamExternalHistoryPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, predecessor, implementation, "--"])
, [...hostNullDownstreamImplementationAddedPaths].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${integrationParent}:${hostNullDownstreamHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed downstream history");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...hostNullDownstreamIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...hostNullDownstreamHistoryAddedPaths])
, [...hostNullDownstreamHistoryAddedPaths].sort());

const directory = await mkdtemp(join(tmpdir(), "lean-host-null-downstream-history-"));
try
{
	const updates = [], commits = [], seenChanged = new Set();
	for(const commit of hostNullDownstreamCommits)
	{
		const parent = git(["rev-parse", `${commit}^`]).trim();
		const subject = git(["show", "-s", "--format=%s", commit]).trim();
		const modified = names(["diff-tree", "--no-commit-id", "--name-only"
			, "--diff-filter=M", "-r", commit]);
		const added = names(["diff-tree", "--no-commit-id", "--name-only"
			, "--diff-filter=A", "-r", commit]);
		for(const path of modified)
		{
			if(hostNullDownstreamExternalHistoryPaths.includes(path)) continue;
			assert.ok(hostNullDownstreamChangedPaths.includes(path)
				, `Unregistered modified downstream HostNull path ${path}`);
			seenChanged.add(path);
			updates.push({
				...await gitSourceHistoryTransition(path, parent, commit
					, { maximumEditBytes: 16 * 1024 * 1024 })
				, commit, parent
			});
		}
		for(const path of added)
			assert.ok(hostNullDownstreamImplementationAddedPaths.includes(path)
				, `Unregistered added downstream HostNull path ${path}`);
		commits.push({ commit, parent, subject, modified, added });
	}
	assert.deepEqual([...seenChanged].sort()
		, [...hostNullDownstreamChangedPaths].sort());

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
	const temporaryGit = (arguments_, options = {}) => execFileSync("git", arguments_, {
		encoding: "utf8", maxBuffer: 512 * 1024 * 1024
		, env: environment, ...options
	});
	temporaryGit(["read-tree", integrationParent]);
	temporaryGit(["add", "--sparse", "--", ...hostNullDownstreamIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit(
		["commit-tree", tree, "-p", integrationParent]
		, { input: "Authenticate downstream HostNull integration\n" }
	).trim();
	const integrationUpdates = [];
	for(const path of hostNullDownstreamIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, integrationParent, integrationCommit));

	const additions = [];
	for(const path of hostNullDownstreamAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
			.trim(), "", path);
		const source = hostNullDownstreamImplementationAddedPaths.includes(path)
			? git(["show", `${implementation}:${path}`])
			: await readFile(path);
		additions.push({ path, currentSha256: sha256(source) });
	}

	assert.equal(Object.values(hostNullDownstreamPinCounts)
		.reduce((sum, count) => sum + count, 0), hostNullDownstreamPinCount);
	await mkdir(dirname(hostNullDownstreamHistoryPath), { recursive: true });
	await writeFile(hostNullDownstreamHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "host-null-downstream-source-v1"
		, predecessorCommit: predecessor
		, implementationCommit: implementation
		, integrationParent
		, externalTypeSurfacePointers: hostNullDownstreamPinCount
		, scope: "Run source-free relocated NuGet and Maven HostNull packages through exact .NET, Java and Kotlin consumers for ordinary and independently reviewed author routes. Preserve 22 observations per language across direct values, nested option states, records, callbacks and returned closures. Register both managed groups in recurring Downstream CI. The combined HostNull type-surface lineage layer exclusively authenticates the exact 579-pointer reconciliation across PHP/native documentation, validation and workflow paths."
		, commits, updates, integrationUpdates, additions
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${commits.length} commits, `
		+ `${updates.length} source transitions, ${integrationUpdates.length} integrations, `
		+ `${additions.length} additions and ${hostNullDownstreamPinCount} pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
