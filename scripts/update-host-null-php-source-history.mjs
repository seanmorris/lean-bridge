#!/usr/bin/env node
/**
 * Record the complete native PHP and PHP-Wasm HostNull source history.
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
	hostNullPhpAddedPaths
	, hostNullPhpChangedPaths
	, hostNullPhpCommits
	, hostNullPhpExternalHistoryPaths
	, hostNullPhpHistoryAddedPaths
	, hostNullPhpHistoryPath
	, hostNullPhpImplementation
	, hostNullPhpImplementationAddedPaths
	, hostNullPhpIntegrationPaths
	, hostNullPhpPredecessor
	, hostNullPhpTransitionPaths
} from "../tests/helpers/host-null-php-source-history.mjs";

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-host-null-php-source-history.mjs");
const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n").filter(Boolean).sort();
const predecessor = hostNullPhpPredecessor;
const implementation = hostNullPhpImplementation;
const integrationParent = git(["rev-parse", "HEAD"]).trim();

assert.equal(spawnSync("git", ["merge-base", "--is-ancestor"
	, implementation, integrationParent]).status, 0
, "PHP HostNull implementation must be an ancestor of the integration head");
assert.deepEqual(git(["rev-list", "--reverse", "--first-parent"
	, `${predecessor}..${implementation}`]).trim().split("\n"), hostNullPhpCommits);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation, "--"])
, [...hostNullPhpChangedPaths, ...hostNullPhpExternalHistoryPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, predecessor, implementation, "--"])
, [...hostNullPhpImplementationAddedPaths].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${integrationParent}:${hostNullPhpHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed PHP HostNull history");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...hostNullPhpIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...hostNullPhpHistoryAddedPaths]), [...hostNullPhpHistoryAddedPaths].sort());

const directory = await mkdtemp(join(tmpdir(), "lean-host-null-php-history-"));
try
{
	const updates = [], commits = [], seenChanged = new Set();
	for(const commit of hostNullPhpCommits)
	{
		const parent = git(["rev-parse", `${commit}^`]).trim();
		const subject = git(["show", "-s", "--format=%s", commit]).trim();
		const modified = names(["diff-tree", "--no-commit-id", "--name-only"
			, "--diff-filter=M", "-r", commit]);
		const added = names(["diff-tree", "--no-commit-id", "--name-only"
			, "--diff-filter=A", "-r", commit]);
		for(const path of modified)
		{
			if(hostNullPhpExternalHistoryPaths.includes(path)) continue;
			assert.ok(hostNullPhpTransitionPaths.includes(path)
				, `Unregistered modified PHP HostNull path ${path}`);
			seenChanged.add(path);
			updates.push({
				...await gitSourceHistoryTransition(path, parent, commit
					, { maximumEditBytes: 16 * 1024 * 1024 })
				, commit, parent
			});
		}
		for(const path of added)
			assert.ok(hostNullPhpImplementationAddedPaths.includes(path)
				, `Unregistered added PHP HostNull path ${path}`);
		commits.push({ commit, parent, subject, modified, added });
	}
	assert.deepEqual([...seenChanged].sort(), [...hostNullPhpTransitionPaths].sort());

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
	temporaryGit(["add", "--sparse", "--", ...hostNullPhpIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit(
		["commit-tree", tree, "-p", integrationParent]
		, { input: "Authenticate PHP HostNull integration\n" }
	).trim();
	const integrationUpdates = [];
	for(const path of hostNullPhpIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, integrationParent, integrationCommit));

	const additions = [];
	for(const path of hostNullPhpAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
			.trim(), "", path);
		const source = hostNullPhpImplementationAddedPaths.includes(path)
			? git(["show", `${implementation}:${path}`])
			: await readFile(path);
		additions.push({ path, currentSha256: sha256(source) });
	}

	await mkdir(dirname(hostNullPhpHistoryPath), { recursive: true });
	await writeFile(hostNullPhpHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "host-null-php-source-v1"
		, predecessorCommit: predecessor
		, implementationCommit: implementation
		, integrationParent
		, scope: "Lower explicit HostNull through native PHP and PHP-Wasm copied values, records, callbacks and returned closures while preserving the distinction between HostNull (Option T) and Option (HostNull T). Exercise source-free installed packages through ordinary and independently reviewed routes, retain exact reports, define hosted archive and promotion policy, and document the boundary without promoting support before independent hosted replay. The dedicated partition-gap ledger owns the six partition-11 transitions."
		, commits, updates, integrationUpdates, additions
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${commits.length} commits, `
		+ `${updates.length} source transitions, ${integrationUpdates.length} integrations `
		+ `and ${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
