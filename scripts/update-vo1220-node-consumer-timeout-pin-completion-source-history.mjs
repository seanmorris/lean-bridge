#!/usr/bin/env node
/**
 * Record the live documentation-pin completion after timeout epoch isolation.
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
	assertVo1220NodeConsumerTimeoutPinCompletion
	, vo1220NodeConsumerTimeoutPinCompletionBehavior as behavior
	, vo1220NodeConsumerTimeoutPinCompletionCommits as implementationCommits
	, vo1220NodeConsumerTimeoutPinCompletionCurrentSha256 as currentSha256
	, vo1220NodeConsumerTimeoutPinCompletionHistoryAdditions as historyAdditions
	, vo1220NodeConsumerTimeoutPinCompletionHistoryPath as historyPath
	, vo1220NodeConsumerTimeoutPinCompletionImplementation as implementation
	, vo1220NodeConsumerTimeoutPinCompletionImplementationPaths as implementationPaths
	, vo1220NodeConsumerTimeoutPinCompletionIntegrationPaths as integrationPaths
	, vo1220NodeConsumerTimeoutPinCompletionPredecessor as predecessor
	, vo1220NodeConsumerTimeoutPinCompletionPreviousSha256 as previousSha256
} from "../tests/helpers/vo1220-node-consumer-timeout-pin-completion-source-history.mjs";

const exactModelPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
const inventoryPath = "docs/type-surface.v1.json";
const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const blob = (commit, path) => git(["show", `${commit}:${path}`]);

assert.deepEqual(process.argv.slice(2), []);
assert.equal(existsSync(historyPath), false, "History already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation);
const revisions = git(["rev-list", "--reverse", "--first-parent"
	, `${predecessor}..${implementation}`]).trim().split("\n");
assert.deepEqual(revisions, implementationCommits);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...implementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation]), [...implementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=ADRCT"
	, predecessor, implementation]), []);
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...historyAdditions]), [...historyAdditions].sort());

const source = blob(implementation, inventoryPath);
assert.deepEqual(assertVo1220NodeConsumerTimeoutPinCompletion({
	[inventoryPath]: source
}), behavior);
const previous = JSON.parse(blob(predecessor, inventoryPath));
const current = JSON.parse(source);
let pins = 0;
for(const evidence of current.evidence)
	for(const file of evidence.files)
		if(file.path === "tests/documentation.test.mjs")
		{
			assert.equal(file.sha256, currentSha256);
			file.sha256 = previousSha256;
			pins++;
		}
assert.equal(pins, behavior.refreshedPins);
assert.deepEqual(current, previous);
const exactSources = [predecessor, implementation].map(commit =>
	blob(commit, exactModelPath));
assert.equal(exactSources[0], exactSources[1]);

const updates = [];
for(const path of implementationPaths)
	updates.push(await gitSourceHistoryTransition(path, predecessor
		, implementation, { maximumEditBytes: 64 * 1024 * 1024 }));

const directory = await mkdtemp(join(tmpdir(), "lean-node-timeout-pin-"));
try
{
	assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
		, "--", ...integrationPaths]), [...integrationPaths].sort());
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
	temporaryGit(["read-tree", implementation]);
	temporaryGit(["add", "--sparse", "--", ...integrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", implementation
	], { input: "Authenticate Node consumer timeout pin completion\n" }).trim();
	const integrationUpdates = [];
	for(const path of integrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(path
			, implementation, integrationCommit
			, { maximumEditBytes: 64 * 1024 * 1024 }));
	const historyAdditionRecords = [];
	for(const path of historyAdditions)
		historyAdditionRecords.push({
			path, sha256: sha256(await readFile(path))
		});
	await writeFile(historyPath, canonicalJson({
		schemaVersion: 1
		, milestone: "vo1220-node-consumer-timeout-pin-completion-source-v1"
		, predecessorCommit: predecessor, implementationCommit: implementation
		, implementationCommits, integrationCommit
		, rootCause: "The live-vs-historical timeout assertion changed documentation.test.mjs after consumer-matrix.yml pins were refreshed, leaving 25 current-source citations at the preceding documentation digest."
		, repair: "Refresh only the 25 existing documentation.test.mjs current-source citations. Preserve every support cell, immutable archive, exact #1220 model, product source and runtime behavior."
		, behavior, changedSupportCells: behavior.changedSupportCells
		, runtimeSemanticChanges: behavior.runtimeSemanticChanges
		, exactModelSha256: {
			before: sha256(exactSources[0]), after: sha256(exactSources[1])
		}
		, validation: {
			currentSourcePreflight: { paths: 2661, occurrences: 16326
				, findings: 0 }
			, inventoryPins: { expected: 25, refreshed: pins
				, unrelatedChanges: 0 }
			, documentationContract: "passed", diffCheck: "passed"
		}
		, updates, integrationUpdates
		, historyAdditions: historyAdditionRecords
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation transition, `
		+ `${integrationUpdates.length} integration transitions and `
		+ `${historyAdditionRecords.length} history additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
