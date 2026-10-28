#!/usr/bin/env node
/**
 * Record every first-parent dependent-signature transition and the final pin
 * and history-hub integration without collapsing intermediate source states.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition } from "../tests/helpers/source-history-stream.mjs";
import {
	dependentSignatureCompletionAddedPaths
	, dependentSignatureCompletionChangedPaths
	, dependentSignatureCompletionCommits
	, dependentSignatureCompletionHistoryAddedPaths
	, dependentSignatureCompletionHistoryPath
	, dependentSignatureCompletionImplementation
	, dependentSignatureCompletionImplementationAddedPaths
	, dependentSignatureCompletionIntegrationPaths
	, dependentSignatureCompletionPredecessor
} from "../tests/helpers/dependent-signature-completion-source-history.mjs";

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-dependent-signature-completion-source-history.mjs");
const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const predecessor = dependentSignatureCompletionPredecessor;
const implementation = dependentSignatureCompletionImplementation;
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Dependent-signature history requires its exact implementation head");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, dependentSignatureCompletionHistoryPath]).trim(), ""
, "Never rewrite committed dependent-signature history");
assert.deepEqual(git(["rev-list", "--reverse", "--first-parent"
	, `${predecessor}..${implementation}`]).trim().split("\n")
, dependentSignatureCompletionCommits);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...dependentSignatureCompletionIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...dependentSignatureCompletionHistoryAddedPaths])
, [...dependentSignatureCompletionHistoryAddedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, predecessor, implementation, "--"])
, [...dependentSignatureCompletionImplementationAddedPaths].sort());

const directory = await mkdtemp(join(
	tmpdir(), "lean-dependent-signature-completion-history-"
));

try
{
	const updates = [], commits = [], seenChanged = new Set();
	for(const commit of dependentSignatureCompletionCommits)
	{
		const parent = git(["rev-parse", `${commit}^`]).trim();
		const subject = git(["show", "-s", "--format=%s", commit]).trim();
		const modified = names(["diff-tree", "--no-commit-id", "--name-only"
			, "--diff-filter=M", "-r", commit]);
		for(const path of modified)
		{
			assert.ok(dependentSignatureCompletionChangedPaths.includes(path)
				, `Unregistered modified path ${path}`);
			seenChanged.add(path);
			updates.push({
				...await gitSourceHistoryTransition(path, parent, commit)
				, commit, parent
			});
		}
		commits.push({ commit, parent, subject, modified });
	}
	assert.deepEqual([...seenChanged].sort()
		, [...dependentSignatureCompletionChangedPaths].sort());

	// Put the current integration files in an unreachable temporary Git commit.
	// The stream history helper can then authenticate the 98 MiB inventory
	// without ever materializing either complete endpoint in JavaScript.
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
		"git", arguments_
		, {
			encoding: "utf8", maxBuffer: 512 * 1024 * 1024
			, env: environment, ...options
		}
	);
	temporaryGit(["read-tree", implementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...dependentSignatureCompletionIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit(["commit-tree", tree
		, "-p", implementation], {
		input: "Authenticate dependent-signature integration\n"}
	).trim();
	const integrationUpdates = [];
	for(const path of dependentSignatureCompletionIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, implementation, integrationCommit));

	const additions = [];
	for(const path of dependentSignatureCompletionAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
			.trim(), "", path);
		const source = dependentSignatureCompletionImplementationAddedPaths
			.includes(path) ? git(["show", `${implementation}:${path}`])
			: await readFile(path);
		additions.push({ path, currentSha256: sha256(source) });
	}

	const pinDiff = git(["diff", "--no-ext-diff", "--no-color"
		, "--unified=0", implementation, "--", "docs/type-surface.v1.json"]);
	const previousPins = [...pinDiff.matchAll(
		/^-\s*"sha256": "([a-f0-9]{64})"[,]?$/gmu
	)].map(match => match[1]);
	const currentPins = [...pinDiff.matchAll(
		/^\+\s*"sha256": "([a-f0-9]{64})"[,]?$/gmu
	)].map(match => match[1]);
	assert.equal(previousPins.length, currentPins.length);
	assert.ok(previousPins.every((digest, index) =>
		digest !== currentPins[index]));
	const unexpected = pinDiff.split("\n").filter(line =>
		/^[+-]/u.test(line) && !/^(?:---|\+\+\+)/u.test(line)
		&& !/^[+-]\s*"sha256": "[a-f0-9]{64}"[,]?$/u.test(line));
	assert.deepEqual(unexpected, []
		, "Dependent-signature integration may refresh only SHA-256 pins");
	const reconciledTypeSurfacePointers = currentPins.length;
	assert.ok(reconciledTypeSurfacePointers > 0
		, "Dependent-signature completion must reconcile current-source pins");

	await writeFile(dependentSignatureCompletionHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "dependent-signature-completion-source-v1"
			, predecessorCommit: predecessor
			, implementationCommit: implementation
			, reconciledTypeSurfacePointers
			, scope: "Admit direct Fin dependencies only on an exact earlier explicit Nat; preserve that relation through independently reviewed metadata and checked lowering; reject malformed or altered dependencies before dispatch; and register source-free ordinary and reviewed installed consumers for all seventeen profiles. Retain every first-parent source transition, including repeated harness and workflow edits, while changing no installed support claim before hosted observations are archived and promoted."
			, commits, updates, integrationUpdates, additions
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${commits.length} commits, `
		+ `${updates.length} transitions, ${integrationUpdates.length} integrations, `
		+ `${additions.length} additions and `
		+ `${reconciledTypeSurfacePointers} source-pin advances.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
