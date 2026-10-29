#!/usr/bin/env node
/**
 * Record the focused dependent-signature archive and exact-attempt binding.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	dependentSignatureFocusedArchiveChangedPaths as changedPaths
	, dependentSignatureFocusedArchiveCommits as commits
	, dependentSignatureFocusedArchiveHistoryAdditions as historyAdditions
	, dependentSignatureFocusedArchiveHistoryPath as historyPath
	, dependentSignatureFocusedArchiveImplementation as implementation
	, dependentSignatureFocusedArchiveImplementationAdditions as implementationAdditions
	, dependentSignatureFocusedArchiveIntegrationPaths as integrationPaths
	, dependentSignatureFocusedArchivePredecessor as predecessor
} from "../tests/helpers/dependent-signature-focused-archive-source-history.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-dependent-signature-focused-archive-source-history.mjs");
assert.equal(existsSync(historyPath), false, `${historyPath} already exists`);
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation);
assert.equal(git(["rev-parse", `${commits[0]}^`]).trim(), predecessor);
assert.deepEqual(git(["rev-list", "--reverse", "--first-parent"
	, `${predecessor}..${implementation}`]).trim().split("\n"), commits);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation, "--"]), [...changedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, predecessor, implementation, "--"]), [...implementationAdditions].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${historyPath}`], { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...integrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...historyAdditions]), [...historyAdditions].sort());

const updates = [], recordedCommits = [];
for(const commit of commits)
{
	const parent = git(["rev-parse", `${commit}^`]).trim();
	const subject = git(["show", "-s", "--format=%s", commit]).trim();
	const modified = names(["diff-tree", "--no-commit-id", "--name-only"
		, "--diff-filter=M", "-r", commit]);
	for(const path of modified)
	{
		assert.ok(changedPaths.includes(path), path);
		updates.push({
			...await gitSourceHistoryTransition(
				path, parent, commit, { maximumEditBytes: 16 * 1024 * 1024 })
			, commit, parent
		});
	}
	recordedCommits.push({ commit, parent, subject, modified });
}
assert.deepEqual([...new Set(updates.map(update => update.path))].sort()
	, [...changedPaths].sort());
const implementationSources = implementationAdditions.map(path => ({
	path, sha256: sha256(git(["show", `${implementation}:${path}`]))
}));

const directory = await mkdtemp(join(
	tmpdir(), "lean-dependent-signature-focused-archive-"));
try
{
	const environment = {
		...process.env, GIT_INDEX_FILE: join(directory, "index")
		, GIT_AUTHOR_NAME: "Lean Bridge history writer"
		, GIT_AUTHOR_EMAIL: "history@example.invalid"
		, GIT_COMMITTER_NAME: "Lean Bridge history writer"
		, GIT_COMMITTER_EMAIL: "history@example.invalid"
		, GIT_AUTHOR_DATE: "2000-01-01T00:00:00Z"
		, GIT_COMMITTER_DATE: "2000-01-01T00:00:00Z"
	};
	const temporaryGit = (arguments_, options = {}) => execFileSync(
		"git", arguments_, {
			encoding: "utf8", maxBuffer: 64 * 1024 * 1024
			, env: environment, ...options
		}
	);
	temporaryGit(["read-tree", implementation]);
	temporaryGit(["add", "--sparse", "--", ...integrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", implementation
	], { input: "Authenticate focused dependent-signature archive\n" }).trim();
	const integrationUpdates = [];
	for(const path of integrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, implementation, integrationCommit
			, { maximumEditBytes: 16 * 1024 * 1024 }));
	const additions = [];
	for(const path of historyAdditions)
		additions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(historyPath, canonicalJson({
		schemaVersion: 1
		, milestone: "dependent-signature-focused-archive-source-v1"
		, predecessorCommit: predecessor, implementationCommit: implementation
		, scope: "Replace the obsolete failed consumer-matrix binding with the exact focused dependent-signature run: eleven producer artifacts, one same-run receipt, forty-four canonical checker summaries, seventeen profiles and thirty-four promotable cells. Select only jobs from the exact successful run attempt and retain complete original ZIP, API, log and source identities."
		, commits: recordedCommits, updates
		, implementationAdditions: implementationSources
		, integrationUpdates, historyAdditions: additions
		, producerArtifacts: 11, receiptArtifacts: 1, reports: 44
		, profiles: 17, cells: 34, currentSourcePaths: []
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} archive transitions, `
		+ `${implementationSources.length} additions, `
		+ `${integrationUpdates.length} registrations and 0 live pins.\n`);
}
finally
{ await rm(directory, { recursive: true, force: true }); }
