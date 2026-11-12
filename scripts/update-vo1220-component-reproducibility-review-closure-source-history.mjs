#!/usr/bin/env node
/**
 * Record the final component reproducibility review closure.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { auditCurrentSourcePins }
	from "../tests/helpers/current-source-pin-preflight.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";
import {
	vo1220ComponentReproducibilityReviewClosureAddedPaths
	, vo1220ComponentReproducibilityReviewClosureHistoryPath
	, vo1220ComponentReproducibilityReviewClosureImplementation
	, vo1220ComponentReproducibilityReviewClosureImplementationPaths
	, vo1220ComponentReproducibilityReviewClosureIntegrationPaths
	, vo1220ComponentReproducibilityReviewClosurePredecessor
} from "../tests/helpers/vo1220-component-reproducibility-review-closure-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-vo1220-component-reproducibility-review-closure-source-history.mjs");
assert.equal(existsSync(
	vo1220ComponentReproducibilityReviewClosureHistoryPath), false);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, vo1220ComponentReproducibilityReviewClosureImplementation);
assert.equal(git(["rev-parse", "HEAD^"]).trim()
	, vo1220ComponentReproducibilityReviewClosurePredecessor);
assert.deepEqual(names(["diff", "--name-only"
	, vo1220ComponentReproducibilityReviewClosurePredecessor
	, vo1220ComponentReproducibilityReviewClosureImplementation])
, [...vo1220ComponentReproducibilityReviewClosureImplementationPaths].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...vo1220ComponentReproducibilityReviewClosureIntegrationPaths])
, [...vo1220ComponentReproducibilityReviewClosureIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...vo1220ComponentReproducibilityReviewClosureAddedPaths])
, [...vo1220ComponentReproducibilityReviewClosureAddedPaths].sort());

const inventory = JSON.parse(await readFile("docs/type-surface.v1.json", "utf8"));
const cited = new Set(inventory.evidence.flatMap(item =>
	item.files.map(file => file.path)));
assert.deepEqual(vo1220ComponentReproducibilityReviewClosureImplementationPaths
	.filter(path => cited.has(path)), []);
const liveAudit = await auditCurrentSourcePins(inventory);
assert.deepEqual(liveAudit, {
	cohort: 2661, occurrences: 16326, findings: []
});

const updates = [];
for(const path of vo1220ComponentReproducibilityReviewClosureImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, vo1220ComponentReproducibilityReviewClosurePredecessor
		, vo1220ComponentReproducibilityReviewClosureImplementation
		, { maximumEditBytes: 64 * 1024 * 1024 }));
const directory = await mkdtemp(join(tmpdir(), "lean-component-repro-review-"));
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
			encoding: "utf8", maxBuffer: 512 * 1024 * 1024
			, env: environment, ...options
		}
	);
	temporaryGit(["read-tree"
		, vo1220ComponentReproducibilityReviewClosureImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...vo1220ComponentReproducibilityReviewClosureIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p"
		, vo1220ComponentReproducibilityReviewClosureImplementation
	], { input: "Authenticate component reproducibility review closure\n" }).trim();
	const integrationUpdates = [];
	for(const path of vo1220ComponentReproducibilityReviewClosureIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(path
			, vo1220ComponentReproducibilityReviewClosureImplementation
			, integrationCommit, { maximumEditBytes: 64 * 1024 * 1024 }));
	const additions = [];
	for(const path of vo1220ComponentReproducibilityReviewClosureAddedPaths)
		additions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(vo1220ComponentReproducibilityReviewClosureHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "vo1220-component-reproducibility-review-closure-v1"
			, predecessorCommit: vo1220ComponentReproducibilityReviewClosurePredecessor
			, implementationCommit: vo1220ComponentReproducibilityReviewClosureImplementation
			, integrationCommit
			, review: {
				pullRequest: 10
				, commit: vo1220ComponentReproducibilityReviewClosurePredecessor
				, findings: [
					{ comment: 4555380448, severity: "high" }
					, { comment: 4555380527, severity: "medium" }
				]
			}
			, rootCause: "The local reproducibility clones inherited an upstream alternate-object dependency, while one component-engine test asserted a universal-release output policy that the component engine does not request."
			, scope: "Dissociate both local reproducibility clones; prove each remains connected after the originating repository and borrowed object store are deleted; retain the builder-image bounded-output assertions; remove only the two invalid component-run assertions; change no release artifact, support observation, proof, package contract, public citation or immutable prior receipt."
			, cloneFlags: ["--local", "--dissociate", "--no-checkout"]
			, independentAfterSourceRemoval: true
			, removedInvalidAssertions: 2
			, refreshedPins: 0
			, liveSourcePaths: liveAudit.cohort
			, liveSourceOccurrences: liveAudit.occurrences
			, remainingMismatches: 0
			, updates, integrationUpdates, additions
		}), { flag: "wx" });
	process.stdout.write(
		"Recorded independent component clones and exact test-policy scope.\n");
}
finally
{ await rm(directory, { recursive: true, force: true }); }
