#!/usr/bin/env node
/**
 * Record the Fin host/JVM exit-receipt layering repair.
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
	assertVo1220FinExitReceiptLayeringRepair
	, vo1220FinExitReceiptLayeringRepairBehavior as behavior
	, vo1220FinExitReceiptLayeringRepairHistoryAdditions as historyAdditions
	, vo1220FinExitReceiptLayeringRepairHistoryPath as historyPath
	, vo1220FinExitReceiptLayeringRepairImplementation as implementation
	, vo1220FinExitReceiptLayeringRepairImplementationPaths as implementationPaths
	, vo1220FinExitReceiptLayeringRepairIntegrationPaths as integrationPaths
	, vo1220FinExitReceiptLayeringRepairPredecessor as predecessor
} from "../tests/helpers/vo1220-fin-exit-receipt-layering-repair-source-history.mjs";

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
assert.equal(git(["rev-parse", "HEAD^"]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...implementationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...historyAdditions]), [...historyAdditions].sort());

const sources = Object.fromEntries(implementationPaths.map(path => [
	path, blob(implementation, path)
]));
assert.deepEqual(assertVo1220FinExitReceiptLayeringRepair(sources)
	, { ...behavior });
const exactSources = [predecessor, implementation].map(commit =>
	blob(commit, exactModelPath));
assert.equal(exactSources[0], exactSources[1]);
const exact = JSON.parse(exactSources[0]);
const inventorySources = [predecessor, implementation].map(commit =>
	blob(commit, inventoryPath));
assert.equal(inventorySources[0], inventorySources[1]);
assert.equal(await readFile(inventoryPath, "utf8"), inventorySources[1]);

const updates = [];
for(const path of implementationPaths)
	updates.push(await gitSourceHistoryTransition(path, predecessor
		, implementation, { maximumEditBytes: 64 * 1024 * 1024 }));

const directory = await mkdtemp(join(tmpdir(), "lean-fin-exit-layering-"));
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
	], { input: "Authenticate Fin exit-receipt layering\n" }).trim();
	const integrationUpdates = [];
	for(const path of integrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(path
			, implementation, integrationCommit
			, { maximumEditBytes: 64 * 1024 * 1024 }));
	const historyAdditionRecords = [];
	for(const path of historyAdditions)
		historyAdditionRecords.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(historyPath, canonicalJson({
		schemaVersion: 1
		, milestone: "vo1220-fin-exit-receipt-layering-repair-source-v1"
		, predecessorCommit: predecessor, implementationCommit: implementation
		, integrationCommit
		, discovery: {
			downstreamRun: 42522948040, job: 128864267149
			, profile: "jvm", failedTests: 1
			, failedAssertion: "a host process-exit receipt is required"
		}
		, rootCause: "The JVM-specialized edge observer correctly authenticated jvmExit, then delegated to the shared edge assertion after that assertion had acquired an unconditional ordinary-host processExit requirement. JVM manifests intentionally retain one jvmExit receipt for the extracted process and do not manufacture a duplicate ordinary-host receipt."
		, repair: "Make the shared edge assertion select one closed host or JVM exit observer, default ordinary callers to host, require JVM callers to select jvm explicitly, and reject every unknown or unchecked mode. Preserve independent receipt validation, archive bytes, runtime behavior and support claims."
		, behavior, changedSupportCells: behavior.changedSupportCells
		, runtimeSemanticChanges: behavior.runtimeSemanticChanges
		, exactModel: {
			sha256: sha256(exactSources[0]), bytes: Buffer.byteLength(exactSources[0])
			, cells: exact.model.length, stageEntries: exact.stageEntries
		}
		, currentSourcePins: []
		, inventorySha256: {
			before: sha256(inventorySources[0]), after: sha256(inventorySources[1])
		}
		, validation: {
			jvmPendingExitArchive: { tests: 2, pass: 2, fail: 0 }
			, finContainerEdgeJvmWait: { tests: 10, pass: 10, fail: 0 }
			, focusedEslint: "passed", checkedJavaScriptTypecheck: "passed"
		}
		, updates, integrationUpdates
		, historyAdditions: historyAdditionRecords
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation transitions and `
		+ `${integrationUpdates.length} integration transitions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
