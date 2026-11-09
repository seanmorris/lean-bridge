#!/usr/bin/env node
/**
 * Record the bounded-memory Perl contract replay repair.
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
	assertVo1220PerlContractReplayMemoryBound
	, vo1220PerlContractReplayMemoryBoundBehavior as behavior
	, vo1220PerlContractReplayMemoryBoundHistoryAdditions as historyAdditions
	, vo1220PerlContractReplayMemoryBoundHistoryPath as historyPath
	, vo1220PerlContractReplayMemoryBoundImplementation as implementation
	, vo1220PerlContractReplayMemoryBoundImplementationPaths as implementationPaths
	, vo1220PerlContractReplayMemoryBoundIntegrationPaths as integrationPaths
	, vo1220PerlContractReplayMemoryBoundPredecessor as predecessor
} from "../tests/helpers/vo1220-perl-contract-replay-memory-bound-source-history.mjs";

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
assert.equal(git(["rev-parse", "HEAD^"]).trim(), predecessor);
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
assert.deepEqual(assertVo1220PerlContractReplayMemoryBound(sources)
	, { ...behavior });
const exactSources = [predecessor, implementation].map(commit =>
	blob(commit, exactModelPath));
assert.equal(exactSources[0], exactSources[1]);

const updates = [];
for(const path of implementationPaths)
	updates.push(await gitSourceHistoryTransition(path, predecessor
		, implementation, { maximumEditBytes: 64 * 1024 * 1024 }));

const directory = await mkdtemp(join(tmpdir(), "lean-perl-replay-memory-"));
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
	], { input: "Authenticate bounded Perl contract replay\n" }).trim();
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
		, milestone: "vo1220-perl-contract-replay-memory-bound-source-v1"
		, predecessorCommit: predecessor, implementationCommit: implementation
		, integrationCommit
		, discovery: {
			coreRun: 42574824120, coreAttempt: 2, coreJob: 129223217497
			, test: "tests/perl-contract-repair-evidence.test.mjs"
			, peakRssBytes: 13956288 * 1024, availableMemoryAtKillMiB: 1531
			, signal: "SIGKILL"
		}
		, rootCause: "The 2026-09 Perl receipt test asked today's aggregate history reader for an unbounded 'before' state. As hundreds of successor layers accumulated, that call overshot the receipt's immediate predecessor: contractVersion 0.107.0 was compared with 0.84.0. Node's whole-object deep assertion then tried to render the multi-megabyte mismatch, grew from about 1.4 GiB to 13.96 GiB RSS in 30 seconds, and was killed on the 16 GiB runner. The same test also reconstructed the 99 MB live history repeatedly instead of reading the immutable record's exact source epoch."
		, repair: "Read each source from the commit that introduced the immutable Perl record, keyed by path and expected SHA-256; reverse the record's exact type-surface transition rather than invoking the evolving aggregate reader; and report the first JSON difference with a bounded path/value diagnostic. Preserve every receipt hash, transition, negative mutation, product, package and support claim."
		, behavior, changedSupportCells: behavior.changedSupportCells
		, runtimeSemanticChanges: behavior.runtimeSemanticChanges
		, exactModelSha256: {
			before: sha256(exactSources[0]), after: sha256(exactSources[1])
		}
		, validation: {
			cacheIdentity: ["path", "expectedSha256"]
			, targetedReplay: {
				tests: 3, passed: 3, failed: 0
				, durationMs: 1491.753244
			}
			, hostedFailure: {
				durationMs: 681074.718222, signal: "SIGKILL"
				, peakRssBytes: 13956288 * 1024
			}
			, historicalMismatch: {
				path: "$.contractVersion", actual: "0.107.0"
				, staleExpected: "0.84.0"
			}
			, sourceEpoch: "immutable record introduction"
			, localPartition: {
				tests: 183, passed: 182, failed: 1
				, durationMs: 1322739.069698
				, failure: "sparse worktree omitted retained acceptance bytes"
				, focusedRerun: {
					tests: 1, passed: 1, failed: 0
					, durationMs: 2001.996391
					, materializedFiles: 7, materializedBytes: 19535
				}
			}
			, syntax: "passed", eslint: "passed", diffCheck: "passed"
		}
		, updates, integrationUpdates
		, historyAdditions: historyAdditionRecords
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} bounded-replay transition, `
		+ `${integrationUpdates.length} integration transitions and `
		+ `${historyAdditionRecords.length} history additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
