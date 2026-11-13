#!/usr/bin/env node
/**
 * Record the PHP-Wasm failure-metadata contract repair.
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
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";
import {
	vo1220PhpWasmFailureMetadataContractAddedPaths
	, vo1220PhpWasmFailureMetadataContractHistoryPath
	, vo1220PhpWasmFailureMetadataContractImplementation
	, vo1220PhpWasmFailureMetadataContractImplementationPaths
	, vo1220PhpWasmFailureMetadataContractIntegrationPaths
	, vo1220PhpWasmFailureMetadataContractPredecessor
} from "../tests/helpers/vo1220-php-wasm-failure-metadata-contract-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-vo1220-php-wasm-failure-metadata-contract-source-history.mjs");
assert.equal(existsSync(
	vo1220PhpWasmFailureMetadataContractHistoryPath), false);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, vo1220PhpWasmFailureMetadataContractImplementation);
assert.equal(git(["rev-parse", "HEAD^"]).trim()
	, vo1220PhpWasmFailureMetadataContractPredecessor);
assert.deepEqual(names(["diff", "--name-only"
	, vo1220PhpWasmFailureMetadataContractPredecessor
	, vo1220PhpWasmFailureMetadataContractImplementation])
, [...vo1220PhpWasmFailureMetadataContractImplementationPaths].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...vo1220PhpWasmFailureMetadataContractIntegrationPaths])
, [...vo1220PhpWasmFailureMetadataContractIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...vo1220PhpWasmFailureMetadataContractAddedPaths])
, [...vo1220PhpWasmFailureMetadataContractAddedPaths].sort());

const updates = [];
for(const path of vo1220PhpWasmFailureMetadataContractImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, vo1220PhpWasmFailureMetadataContractPredecessor
		, vo1220PhpWasmFailureMetadataContractImplementation
		, { maximumEditBytes: 64 * 1024 * 1024 }));

const directory = await mkdtemp(join(
	tmpdir(), "lean-php-wasm-failure-metadata-contract-"));
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
		, vo1220PhpWasmFailureMetadataContractImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...vo1220PhpWasmFailureMetadataContractIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p"
		, vo1220PhpWasmFailureMetadataContractImplementation
	], { input: "Authenticate PHP-Wasm failure-metadata contract repair\n" })
		.trim();
	const integrationUpdates = [];
	for(const path of vo1220PhpWasmFailureMetadataContractIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(path
			, vo1220PhpWasmFailureMetadataContractImplementation
			, integrationCommit, { maximumEditBytes: 64 * 1024 * 1024 }));
	const additions = [];
	for(const path of vo1220PhpWasmFailureMetadataContractAddedPaths)
		additions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(
		vo1220PhpWasmFailureMetadataContractHistoryPath, canonicalJson({
			schemaVersion: 1
			, milestone: "vo1220-php-wasm-failure-metadata-contract-v1"
			, predecessorCommit:
				vo1220PhpWasmFailureMetadataContractPredecessor
			, implementationCommit:
				vo1220PhpWasmFailureMetadataContractImplementation
			, integrationCommit
			, hostedFailure: {
				run: 43346955036, job: 131635980048
				, workflow: "Core quality contract"
				, jobName: "Contract shard 3/12"
				, failingTest:
					"recursive PHP-Wasm diagnostics retain original files and code or signal"
				, failure: "Expected values to be strictly deep-equal"
			}
			, rootCause: "The bounded process runner correctly added outputPolicy, observed byte counts, and truncation flags to build-command-failed details. The retained PHP-Wasm failure diagnostic used an exact deep-equality assertion for the older six-field shape, so Core rejected the additional truthful metadata even though both exit-code and signal capture behavior remained correct."
			, repair: "Require the complete current failure detail shape for both retained exit-code and signal probes: fail policy, empty output, zero observed bytes, and false truncation flags. Preserve exact equality so future field drift remains visible."
			, semantics: {
				runtimeChanges: 0, testContractRepairs: 1
				, typeSurfaceChanges: 0, supportCellChanges: 0
			}
			, validation: {
				directHelper: { tests: 8, passed: 8, failed: 0 }
				, generatedRegistration: {
					tests: 9, passed: 8, failed: 0, skipped: 1
				}
				, partitionRegistration: {
					tests: 14, passed: 14, failed: 0
				}
				, exactHistory: { tests: 5, passed: 5, failed: 0 }
				, repairHistory: { tests: 4, passed: 4, failed: 0 }
				, scopedLint: "passed"
			}
			, updates, integrationUpdates, additions
		}), { flag: "wx" });
	process.stdout.write(
		"Recorded exact PHP-Wasm failure-metadata contract repair.\n");
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
