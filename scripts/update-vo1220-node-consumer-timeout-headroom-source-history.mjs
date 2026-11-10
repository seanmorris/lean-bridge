#!/usr/bin/env node
/**
 * Record deterministic headroom for the complete Node consumer lane.
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
	assertVo1220NodeConsumerTimeoutHeadroom
	, vo1220NodeConsumerTimeoutHeadroomBehavior as behavior
	, vo1220NodeConsumerTimeoutHeadroomCommits as implementationCommits
	, vo1220NodeConsumerTimeoutHeadroomHistoryAdditions as historyAdditions
	, vo1220NodeConsumerTimeoutHeadroomHistoryPath as historyPath
	, vo1220NodeConsumerTimeoutHeadroomImplementation as implementation
	, vo1220NodeConsumerTimeoutHeadroomImplementationPaths as implementationPaths
	, vo1220NodeConsumerTimeoutHeadroomIntegrationPaths as integrationPaths
	, vo1220NodeConsumerTimeoutHeadroomPredecessor as predecessor
} from "../tests/helpers/vo1220-node-consumer-timeout-headroom-source-history.mjs";

const exactModelPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const blob = (commit, path) => git(["show", `${commit}:${path}`]);

assert.deepEqual(process.argv.slice(2), []);
assert.equal(existsSync(historyPath), false, "History already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation);
const revisions = git(["rev-list", "--reverse"
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

const sources = Object.fromEntries(implementationPaths.map(path => [
	path, blob(implementation, path)
]));
assert.deepEqual(assertVo1220NodeConsumerTimeoutHeadroom(sources), behavior);
const previousInventory = JSON.parse(blob(
	predecessor, "docs/type-surface.v1.json"));
const currentInventory = JSON.parse(sources["docs/type-surface.v1.json"]);
let pins = 0;
for(const evidence of currentInventory.evidence)
	for(const file of evidence.files)
		if(file.path === ".github/workflows/consumer-matrix.yml")
		{
			file.sha256
				= "b659de64e69d2b99a5472e902a80ffdd2f09f64c23288ec435910c6bcb3f58dd";
			pins += 1;
		}
assert.equal(pins, 92);
assert.deepEqual(currentInventory, previousInventory);
const exactSources = [predecessor, implementation].map(commit =>
	blob(commit, exactModelPath));
assert.equal(exactSources[0], exactSources[1]);

const updates = [];
for(const path of implementationPaths)
	updates.push(await gitSourceHistoryTransition(path, predecessor
		, implementation, { maximumEditBytes: 64 * 1024 * 1024 }));

const directory = await mkdtemp(join(tmpdir(), "lean-node-timeout-headroom-"));
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
	], { input: "Authenticate Node consumer timeout headroom\n" }).trim();
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
		, milestone: "vo1220-node-consumer-timeout-headroom-source-v1"
		, predecessorCommit: predecessor, implementationCommit: implementation
		, implementationCommits
		, integrationCommit
		, failedAttempt: {
			run: 42760217472, attempt: 1, job: 129650283484
			, name: "Node and browser npm consumers"
			, startedAt: "2026-11-10T05:27:04Z"
			, completedAt: "2026-11-10T10:57:24Z"
			, conclusion: "cancelled", timeoutMinutes: 330
			, finalStep: "Publish through the installed CLI and consume only the component"
			, completedTestFailures: 0
		}
		, rootCause: "The complete Node/browser consumer lane retained every required gate but its 330-minute bound had no runner-variance margin. The exact candidate needed 330.3 minutes and GitHub cancelled it roughly twenty seconds before the final registry step's prior observed duration."
		, repair: "Raise only the complete Node/browser lane to 420 minutes, retain every command and fail-closed support gate, update the live documentation assertion, and refresh exactly the 92 current-source citations of consumer-matrix.yml."
		, behavior, changedSupportCells: behavior.changedSupportCells
		, runtimeSemanticChanges: behavior.runtimeSemanticChanges
		, exactModelSha256: {
			before: sha256(exactSources[0]), after: sha256(exactSources[1])
		}
		, validation: {
			inventoryPins: { expected: 92, refreshed: pins, unrelatedChanges: 0 }
			, documentationContract: "passed", eslint: "passed"
			, diffCheck: "passed"
		}
		, updates, integrationUpdates
		, historyAdditions: historyAdditionRecords
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation transitions, `
		+ `${integrationUpdates.length} integration transitions and `
		+ `${historyAdditionRecords.length} history additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
