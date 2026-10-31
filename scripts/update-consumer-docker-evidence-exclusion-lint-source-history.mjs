#!/usr/bin/env node
/**
 * Record the Docker evidence-exclusion lint repair.
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
	consumerDockerEvidenceExclusionLintHistoryAdditions
	, consumerDockerEvidenceExclusionLintHistoryPath
	, consumerDockerEvidenceExclusionLintImplementation
	, consumerDockerEvidenceExclusionLintImplementationPaths
	, consumerDockerEvidenceExclusionLintIntegrationPaths
	, consumerDockerEvidenceExclusionLintPredecessor
} from "../tests/helpers/consumer-docker-evidence-exclusion-lint-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8"
	, maxBuffer: 512 * 1024 * 1024
	, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-consumer-docker-evidence-exclusion-lint-source-history.mjs");
assert.equal(existsSync(consumerDockerEvidenceExclusionLintHistoryPath), false
	, consumerDockerEvidenceExclusionLintHistoryPath + " already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, consumerDockerEvidenceExclusionLintImplementation);
assert.equal(git(["rev-parse"
	, consumerDockerEvidenceExclusionLintImplementation + "^"]).trim()
, consumerDockerEvidenceExclusionLintPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, consumerDockerEvidenceExclusionLintPredecessor
	, consumerDockerEvidenceExclusionLintImplementation, "--"])
, [...consumerDockerEvidenceExclusionLintImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, consumerDockerEvidenceExclusionLintPredecessor
	, consumerDockerEvidenceExclusionLintImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, consumerDockerEvidenceExclusionLintImplementation + ":"
		+ consumerDockerEvidenceExclusionLintHistoryPath]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...consumerDockerEvidenceExclusionLintIntegrationPaths])
, [...consumerDockerEvidenceExclusionLintIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...consumerDockerEvidenceExclusionLintHistoryAdditions])
, [...consumerDockerEvidenceExclusionLintHistoryAdditions].sort());
assert.equal(git(["show"
	, consumerDockerEvidenceExclusionLintPredecessor
		+ ":docs/type-surface.v1.json"]), git(["show"
	, consumerDockerEvidenceExclusionLintImplementation
		+ ":docs/type-surface.v1.json"]));

const updates = [];
for(const path of consumerDockerEvidenceExclusionLintImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, consumerDockerEvidenceExclusionLintPredecessor
		, consumerDockerEvidenceExclusionLintImplementation
		, { maximumEditBytes: 128 * 1024 * 1024 }));
const directory = await mkdtemp(join(
	tmpdir(), "lean-consumer-docker-evidence-exclusion-lint-"));
try
{
	const environment = {
		...process.env
		, GIT_INDEX_FILE: join(directory, "index")
		, GIT_AUTHOR_NAME: "Lean Bridge history writer"
		, GIT_AUTHOR_EMAIL: "history@example.invalid"
		, GIT_COMMITTER_NAME: "Lean Bridge history writer"
		, GIT_COMMITTER_EMAIL: "history@example.invalid"
		, GIT_AUTHOR_DATE: "2000-01-01T00:00:00Z"
		, GIT_COMMITTER_DATE: "2000-01-01T00:00:00Z"
	};
	const temporaryGit = (arguments_, options = {}) => execFileSync(
		"git", arguments_, {
			encoding: "utf8"
			, maxBuffer: 512 * 1024 * 1024
			, env: environment
			, ...options
		}
	);
	temporaryGit(["read-tree"
		, consumerDockerEvidenceExclusionLintImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...consumerDockerEvidenceExclusionLintIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p"
		, consumerDockerEvidenceExclusionLintImplementation
	], { input: "Authenticate Docker evidence-exclusion lint repair\n" })
		.trim();
	const integrationUpdates = [];
	for(const path of consumerDockerEvidenceExclusionLintIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, consumerDockerEvidenceExclusionLintImplementation
			, integrationCommit, { maximumEditBytes: 128 * 1024 * 1024 }
		));
	const historyAdditions = [];
	for(const path of consumerDockerEvidenceExclusionLintHistoryAdditions)
		historyAdditions.push({
			path
			, sha256: sha256(await readFile(path))
		});
	await writeFile(consumerDockerEvidenceExclusionLintHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "consumer-docker-evidence-exclusion-lint-source-v1"
			, predecessorCommit:
				consumerDockerEvidenceExclusionLintPredecessor
			, implementationCommit:
				consumerDockerEvidenceExclusionLintImplementation
			, failedRun: {
				workflow: 41203403878
				, job: 124543662392
				, aggregateJob: 124544716647
			}
			, failure: {
				step: "Run static quality contract"
				, completedAt: "2026-10-31T13:03:10Z"
				, rule: "sm-no-saccade-style/leading-comma-lists"
				, errors: 6
				, locations: [
					"scripts/update-consumer-docker-evidence-exclusion-source-history.mjs:93"
					, "tests/docker-consumer-ci.test.mjs:192"
					, "tests/helpers/consumer-docker-evidence-exclusion-source-history-tests.mjs:92"
				]
			}
			, scope: "Repair exactly three multiline leading-comma layouts reported by the exact-head static quality job. Preserve every executable token, Docker source-closure behavior, type-surface byte, support claim and archived evidence record. Register the exact reversible transition and retain the failed run."
			, semanticChanges: 0
			, typeSurfaceChanges: 0
			, updates
			, integrationUpdates
			, historyAdditions
		}), { flag: "wx" });
	process.stdout.write("Recorded " + updates.length
		+ " lint transitions and " + integrationUpdates.length
		+ " integration transitions.\n");
}
finally
{ await rm(directory, { recursive: true, force: true }); }
