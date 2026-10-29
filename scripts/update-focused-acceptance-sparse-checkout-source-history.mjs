#!/usr/bin/env node
/**
 * Record focused producer sparse checkouts and standalone history preservation.
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
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";
import {
	focusedAcceptanceSparseCheckoutHistoryAdditions
	, focusedAcceptanceSparseCheckoutHistoryPath
	, focusedAcceptanceSparseCheckoutImplementation
	, focusedAcceptanceSparseCheckoutImplementationPaths
	, focusedAcceptanceSparseCheckoutIntegrationPaths
	, focusedAcceptanceSparseCheckoutPredecessor
} from "../tests/helpers/focused-acceptance-sparse-checkout-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-focused-acceptance-sparse-checkout-source-history.mjs");
assert.equal(existsSync(focusedAcceptanceSparseCheckoutHistoryPath), false
	, `${focusedAcceptanceSparseCheckoutHistoryPath} already exists`);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, focusedAcceptanceSparseCheckoutImplementation);
assert.equal(git(["rev-parse"
	, `${focusedAcceptanceSparseCheckoutImplementation}^`]).trim()
, focusedAcceptanceSparseCheckoutPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, focusedAcceptanceSparseCheckoutPredecessor
	, focusedAcceptanceSparseCheckoutImplementation, "--"])
, [...focusedAcceptanceSparseCheckoutImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, focusedAcceptanceSparseCheckoutPredecessor
	, focusedAcceptanceSparseCheckoutImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${focusedAcceptanceSparseCheckoutImplementation}`
		+ `:${focusedAcceptanceSparseCheckoutHistoryPath}`]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...focusedAcceptanceSparseCheckoutIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...focusedAcceptanceSparseCheckoutHistoryAdditions])
, [...focusedAcceptanceSparseCheckoutHistoryAdditions].sort());

const updates = [];
for(const path of focusedAcceptanceSparseCheckoutImplementationPaths)
	updates.push(await gitSourceHistoryTransition(
		path, focusedAcceptanceSparseCheckoutPredecessor
		, focusedAcceptanceSparseCheckoutImplementation
		, { maximumEditBytes: 16 * 1024 * 1024 }));

const directory = await mkdtemp(join(
	tmpdir(), "lean-focused-acceptance-sparse-checkout-"));
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
	temporaryGit(["read-tree", focusedAcceptanceSparseCheckoutImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...focusedAcceptanceSparseCheckoutIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", focusedAcceptanceSparseCheckoutImplementation
	], { input: "Authenticate focused acceptance sparse checkouts\n" }).trim();
	const integrationUpdates = [];
	for(const path of focusedAcceptanceSparseCheckoutIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, focusedAcceptanceSparseCheckoutImplementation, integrationCommit
			, { maximumEditBytes: 16 * 1024 * 1024 }));
	const historyAdditions = [];
	for(const path of focusedAcceptanceSparseCheckoutHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(focusedAcceptanceSparseCheckoutHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "focused-acceptance-sparse-checkout-source-v1"
		, predecessorCommit: focusedAcceptanceSparseCheckoutPredecessor
		, implementationCommit: focusedAcceptanceSparseCheckoutImplementation
		, scope: "Exclude the retained hosted-evidence corpus from ten focused optional-parameter, proof-erasure and HostNull producer checkouts. Preserve full source and evidence history for every standalone scheduled workflow."
		, updates, integrationUpdates, historyAdditions
		, workflowCount: 5, focusedProducerCount: 10
		, focusedFetchDepth: 1, standaloneFetchDepth: 0
		, excludedPattern: "!/docs/evidence/"
		, sparseCheckoutConeMode: false, currentSourcePaths: []
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} focused transitions, `
		+ `${integrationUpdates.length} registrations and 0 live pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
