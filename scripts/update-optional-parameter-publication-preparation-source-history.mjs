#!/usr/bin/env node
/**
 * Record the optional-parameter publication preparation.
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
	optionalParameterPublicationPreparationHistoryAdditions
	, optionalParameterPublicationPreparationHistoryPath
	, optionalParameterPublicationPreparationImplementation
	, optionalParameterPublicationPreparationImplementationAdditions
	, optionalParameterPublicationPreparationImplementationPaths
	, optionalParameterPublicationPreparationIntegrationPaths
	, optionalParameterPublicationPreparationPredecessor
} from "../tests/helpers/optional-parameter-publication-preparation-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []);
assert.equal(existsSync(optionalParameterPublicationPreparationHistoryPath), false
	, "Optional publication preparation history already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, optionalParameterPublicationPreparationImplementation);
assert.equal(git(["rev-parse"
	, `${optionalParameterPublicationPreparationImplementation}^`]).trim()
, optionalParameterPublicationPreparationPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, optionalParameterPublicationPreparationPredecessor
	, optionalParameterPublicationPreparationImplementation, "--"])
, [...optionalParameterPublicationPreparationImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, optionalParameterPublicationPreparationPredecessor
	, optionalParameterPublicationPreparationImplementation, "--"])
, [...optionalParameterPublicationPreparationImplementationAdditions].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${optionalParameterPublicationPreparationImplementation}:`
		+ optionalParameterPublicationPreparationHistoryPath]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...optionalParameterPublicationPreparationIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...optionalParameterPublicationPreparationHistoryAdditions])
, [...optionalParameterPublicationPreparationHistoryAdditions].sort());

const updates = [];
for(const path of optionalParameterPublicationPreparationImplementationPaths)
	updates.push(await gitSourceHistoryTransition(
		path, optionalParameterPublicationPreparationPredecessor
		, optionalParameterPublicationPreparationImplementation
		, { maximumEditBytes: 32 * 1024 * 1024 }));
const implementationAdditions
	= optionalParameterPublicationPreparationImplementationAdditions.map(path => ({
		path
		, sha256: sha256(git(["show"
			, `${optionalParameterPublicationPreparationImplementation}:${path}`]))
	}));
const directory = await mkdtemp(join(tmpdir(), "lean-optional-publication-"));
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
		"git", arguments_, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024
			, env: environment, ...options });
	temporaryGit(["read-tree", optionalParameterPublicationPreparationImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...optionalParameterPublicationPreparationIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit(["commit-tree", tree, "-p"
		, optionalParameterPublicationPreparationImplementation]
	, { input: "Authenticate optional parameter publication preparation\n" })
		.trim();
	const integrationUpdates = [];
	for(const path of optionalParameterPublicationPreparationIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, optionalParameterPublicationPreparationImplementation
			, integrationCommit, { maximumEditBytes: 32 * 1024 * 1024 }));
	const historyAdditions = [];
	for(const path of optionalParameterPublicationPreparationHistoryAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, optionalParameterPublicationPreparationImplementation, "--", path])
			.trim(), "");
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	}
	await writeFile(optionalParameterPublicationPreparationHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "optional-parameter-publication-preparation-source-v1"
			, predecessorCommit: optionalParameterPublicationPreparationPredecessor
			, implementationCommit:
				optionalParameterPublicationPreparationImplementation
			, scope: "Prepare fail-closed atomic publication of exactly 34 optional-parameter signature cells and their evidence-gated author documentation without publishing support before hosted archive replay."
			, updates, implementationAdditions, integrationUpdates
			, historyAdditions, currentSourcePaths: [], refreshedPins: 0
		}), { flag: "wx" });
	process.stdout.write("Recorded optional publication preparation.\n");
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
