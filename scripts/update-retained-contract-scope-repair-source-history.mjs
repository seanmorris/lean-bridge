#!/usr/bin/env node
/**
 * Record the retained-contract scope and JVM observation repair.
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
	assertRetainedContractScopeRepair
	, retainedContractScopeRepairHistoryAdditions as historyAdditions
	, retainedContractScopeRepairHistoryPath as historyPath
	, retainedContractScopeRepairImplementation as implementation
	, retainedContractScopeRepairImplementationAdditions as implementationAdditions
	, retainedContractScopeRepairImplementationPaths as implementationPaths
	, retainedContractScopeRepairIntegrationPaths as integrationPaths
	, retainedContractScopeRepairPredecessor as predecessor
} from "../tests/helpers/retained-contract-scope-repair-source-history.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-retained-contract-scope-repair-source-history.mjs");
assert.equal(existsSync(historyPath), false
	, "Retained-contract scope repair history already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation);
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), predecessor);
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

const allImplementationPaths = [...implementationPaths, ...implementationAdditions];
const sources = Object.fromEntries(allImplementationPaths.map(path => [
	path, git(["show", `${implementation}:${path}`])
]));
assert.deepEqual(assertRetainedContractScopeRepair(sources), {
	deferredConsumerJobs: 6, retainedEntrypoints: 2
	, currentJvmRows: 12047, historicalJvmRows: 12046
	, changedSupportCells: 0, runtimeSemanticChanges: 0
});
const updates = [];
for(const path of implementationPaths)
	updates.push(await gitSourceHistoryTransition(path, predecessor
		, implementation, { maximumEditBytes: 64 * 1024 * 1024 }));
const addedSources = implementationAdditions.map(path => ({
	path, sha256: sha256(git(["show", `${implementation}:${path}`]))
}));
const exactModelPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
const exactModels = [predecessor, implementation].map(commit =>
	git(["show", `${commit}:${exactModelPath}`]));
assert.equal(new Set(exactModels.map(source => sha256(source))).size, 1);
const exact = JSON.parse(exactModels[0]);

const directory = await mkdtemp(join(tmpdir()
	, "lean-retained-contract-scope-history-"));
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
	], { input: "Authenticate retained-contract scope repair\n" }).trim();
	const integrationUpdates = [];
	for(const path of integrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(path
			, implementation, integrationCommit
			, { maximumEditBytes: 64 * 1024 * 1024 }));
	const additions = [];
	for(const path of historyAdditions)
	{
		assert.notEqual(existsSync(path), false, path);
		additions.push({ path, sha256: sha256(await readFile(path)) });
	}
	await writeFile(historyPath, canonicalJson({
		schemaVersion: 1
		, milestone: "retained-contract-scope-repair-source-v1"
		, predecessorCommit: predecessor, implementationCommit: implementation
		, integrationCommit
		, discovery: {
			runs: [41385913296, 41385913333]
			, focusedRuns: [
				41385981731, 41385983629, 41385985528
				, 41385987097, 41385988921, 41385990821
			]
			, observed: "530/530 focused promoted cells passed while sparse broad lanes failed retained-history contracts outside their checkout closure"
		}
		, rootCause: "Sparse installed-consumer jobs executed exact history and retained-evidence suites imported for Core, so missing historical inputs and stale historical expectations could fail a current-behavior lane. The JVM pending-exit archive also preceded one current public Option-null entry and was being parsed against the later 12,047-row model."
		, repair: "Defer only retained history/evidence module registration in sparse consumer jobs, require it explicitly in Core, keep current behavior tests active, bind the pending-exit archive to its immutable 12,046-row model, preserve the current 12,047-row model, and update the generated-C assertion to the current adapter boundary."
		, behavior: {
			deferredConsumerJobs: 6, retainedEntrypoints: 2
			, currentJvmRows: 12047, historicalJvmRows: 12046
		}
		, exactModel: {
			sha256: sha256(exactModels[0])
			, bytes: Buffer.byteLength(exactModels[0])
			, cells: exact.model.length, stageEntries: exact.stageEntries
		}
		, changedSupportCells: 0, runtimeSemanticChanges: 0
		, updates, implementationAdditions: addedSources
		, integrationUpdates, historyAdditions: additions
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation transitions, `
		+ `${addedSources.length} implementation additions and `
		+ `${integrationUpdates.length} integration transitions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
