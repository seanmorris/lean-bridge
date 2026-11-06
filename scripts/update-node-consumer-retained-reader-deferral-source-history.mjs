#!/usr/bin/env node
/**
 * Record the Node consumer lane's retained-reader deferral.
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
	assertNodeConsumerRetainedReaderDeferral
	, nodeConsumerRetainedReaderDeferralFamilies as families
	, nodeConsumerRetainedReaderDeferralHistoryAdditions as historyAdditions
	, nodeConsumerRetainedReaderDeferralHistoryPath as historyPath
	, nodeConsumerRetainedReaderDeferralImplementation as implementation
	, nodeConsumerRetainedReaderDeferralImplementationAdditions
	as implementationAdditions
	, nodeConsumerRetainedReaderDeferralImplementationPaths
	as implementationPaths
	, nodeConsumerRetainedReaderDeferralIntegrationPaths
	as integrationPaths
	, nodeConsumerRetainedReaderDeferralPredecessor as predecessor
} from "../tests/helpers/node-consumer-retained-reader-deferral-source-history.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";

const exactModelPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
const inventoryPath = "docs/type-surface.v1.json";
const browserTestPath = "tests/generic-records-browser.test.mjs";
const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-node-consumer-retained-reader-deferral-source-history.mjs");
assert.equal(existsSync(historyPath), false, "History already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation);
assert.equal(git(["rev-parse", "HEAD^"]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation, "--"]), [...implementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, predecessor, implementation, "--"]), [...implementationAdditions].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...integrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...historyAdditions]), [...historyAdditions].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${historyPath}`], { stdio: "ignore" }).status, 0);

const sources = Object.fromEntries([
	...implementationPaths, ...implementationAdditions
].map(path => [path, git(["show", `${implementation}:${path}`])]));
const behavior = assertNodeConsumerRetainedReaderDeferral(sources);
assert.deepEqual(behavior, {
	deferredLoaders: 7, retainedFamilies: 7, extractedTests: 1
	, staticRetainedReaders: 0, changedSupportCells: 0
	, runtimeSemanticChanges: 0
});
const currentSourcePin = {
	path: browserTestPath, count: 1
	, previous: sha256(git(["show", `${predecessor}:${browserTestPath}`]))
	, current: sha256(sources[browserTestPath])
};
const beforeInventory = git(["show", `${implementation}:${inventoryPath}`]);
const afterInventory = await readFile(inventoryPath, "utf8");
assert.equal(beforeInventory.split(currentSourcePin.previous).length - 1
	, currentSourcePin.count);
assert.equal(afterInventory.split(currentSourcePin.current).length - 1
	, currentSourcePin.count);
assert.equal(afterInventory.includes(currentSourcePin.previous), false);
assert.equal(afterInventory.replaceAll(
	currentSourcePin.current, currentSourcePin.previous), beforeInventory);

const updates = [];
for(const path of implementationPaths)
	updates.push(await gitSourceHistoryTransition(path, predecessor
		, implementation, { maximumEditBytes: 64 * 1024 * 1024 }));
const addedSources = implementationAdditions.map(path => ({
	path, sha256: sha256(sources[path])
}));
const exactSources = [predecessor, implementation].map(commit =>
	git(["show", `${commit}:${exactModelPath}`]));
assert.equal(new Set(exactSources.map(source => sha256(source))).size, 1);
const exact = JSON.parse(exactSources[0]);

const directory = await mkdtemp(join(tmpdir()
	, "lean-node-consumer-retained-reader-deferral-history-"));
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
	temporaryGit(["read-tree", implementation]);
	temporaryGit(["add", "--sparse", "--", ...integrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", implementation
	], { input: "Authenticate Node consumer retained-reader deferral\n" })
		.trim();
	const integrationUpdates = [];
	for(const path of integrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(path
			, implementation, integrationCommit
			, { maximumEditBytes: 64 * 1024 * 1024 }));
	const additions = [];
	for(const path of historyAdditions)
		additions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(historyPath, canonicalJson({
		schemaVersion: 1
		, milestone: "node-consumer-retained-reader-deferral-v1"
		, predecessorCommit: predecessor, implementationCommit: implementation
		, integrationCommit
		, failedRun: {
			workflow: 42177405137, job: 127767402756
			, headSha: "aa3297a61bfdb1bcb7a0c56b6efd9eaebf04e0f1"
			, jobName: "Node and browser npm consumers"
			, step: "Compile locked and dependency-free projects and install relocated npm releases offline"
		}
		, failure: "fourteen retained-evidence tests of tests/generic-records.test.mjs failed with ENOENT under the metadata-only consumer sparse checkout"
		, missingFamilies: families
		, rootCause: "The sparse Node and browser npm job defers retained contracts, but tests/helpers/reviewed-fin-wasm-installed-tests.mjs imported the original npm archive, promotion and host evidence suites eagerly, and tests/generic-records-browser.test.mjs imported the browser archive, its history layers and promotion suite eagerly. Both chains open retained docs/evidence families the metadata-only checkout never materializes, so the lane failed before its current-behavior tests, and the browser archive reader would have failed one step later."
		, repair: "Register the archived-identity, original-archive and promotion suites of the reviewed Fin npm boundary and the browser archive, history and promotion suites through registerRetainedContractTests, extract the archived structural identity test into its own retained module so the current contract suite stays eager, and prove in tests/retained-contract-tests.test.mjs that the node-consumers static import closure reaches no retained-evidence reader while every loader stays registered. No workflow, evidence archive, support cell or product source changes."
		, behavior
		, currentSourcePin
		, exactModel: {
			sha256: sha256(exactSources[0])
			, bytes: Buffer.byteLength(exactSources[0])
			, cells: exact.model.length, stageEntries: exact.stageEntries
		}
		, changedSupportCells: 0, runtimeSemanticChanges: 0
		, updates, implementationAdditions: addedSources
		, integrationUpdates, historyAdditions: additions
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation transitions, `
		+ `${addedSources.length} implementation addition and `
		+ `${integrationUpdates.length} integration transitions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
