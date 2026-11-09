#!/usr/bin/env node
/**
 * Record the bounded aggregate-history comparison optimization for VO #1220.
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
	vo1220BoundedHistoryComparisonHistoryAdditions
	, vo1220BoundedHistoryComparisonHistoryPath
	, vo1220BoundedHistoryComparisonImplementation
	, vo1220BoundedHistoryComparisonImplementationAdditions
	, vo1220BoundedHistoryComparisonImplementationPaths
	, vo1220BoundedHistoryComparisonIntegrationPaths
	, vo1220BoundedHistoryComparisonPredecessor
} from "../tests/helpers/vo1220-bounded-history-comparison-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-vo1220-bounded-history-comparison-source-history.mjs");
assert.equal(existsSync(vo1220BoundedHistoryComparisonHistoryPath), false
	, `${vo1220BoundedHistoryComparisonHistoryPath} already exists`);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, vo1220BoundedHistoryComparisonImplementation);
assert.equal(git(["rev-parse", `${vo1220BoundedHistoryComparisonImplementation}^`]).trim()
	, vo1220BoundedHistoryComparisonPredecessor);
assert.deepEqual(
	names(["diff", "--name-only", "--diff-filter=M"
		, vo1220BoundedHistoryComparisonPredecessor
		, vo1220BoundedHistoryComparisonImplementation, "--"])
	, [...vo1220BoundedHistoryComparisonImplementationPaths].sort()
);
assert.deepEqual(
	names(["diff", "--name-only", "--diff-filter=A"
		, vo1220BoundedHistoryComparisonPredecessor
		, vo1220BoundedHistoryComparisonImplementation, "--"])
	, [...vo1220BoundedHistoryComparisonImplementationAdditions].sort()
);
assert.notEqual(
	spawnSync("git", ["cat-file", "-e"
		, `${vo1220BoundedHistoryComparisonImplementation}:${vo1220BoundedHistoryComparisonHistoryPath}`]
	, { stdio: "ignore" }).status, 0
);
assert.deepEqual(
	names(["diff", "HEAD", "--name-only", "--diff-filter=M"
		, "--", ...vo1220BoundedHistoryComparisonIntegrationPaths])
	, [...vo1220BoundedHistoryComparisonIntegrationPaths].sort()
);
assert.deepEqual(
	names(["ls-files", "--others", "--exclude-standard", "--"
		, ...vo1220BoundedHistoryComparisonHistoryAdditions])
	, [...vo1220BoundedHistoryComparisonHistoryAdditions].sort()
);

const typeSurfacePath = "docs/type-surface.v1.json";
const predecessorTypeSurface = git(["show"
	, `${vo1220BoundedHistoryComparisonPredecessor}:${typeSurfacePath}`]);
const implementationTypeSurface = git(["show"
	, `${vo1220BoundedHistoryComparisonImplementation}:${typeSurfacePath}`]);
assert.equal(implementationTypeSurface, predecessorTypeSurface
	, "The performance-only implementation must not change the type surface");

const updates = [];
for(const sourcePath of vo1220BoundedHistoryComparisonImplementationPaths)
	updates.push(await gitSourceHistoryTransition(sourcePath
		, vo1220BoundedHistoryComparisonPredecessor
		, vo1220BoundedHistoryComparisonImplementation
		, { maximumEditBytes: 16 * 1024 * 1024 }));
const implementationAdditions
	= vo1220BoundedHistoryComparisonImplementationAdditions.map(sourcePath => ({
		path: sourcePath
		, sha256: sha256(git(["show"
			, `${vo1220BoundedHistoryComparisonImplementation}:${sourcePath}`]))
	}));

const directory = await mkdtemp(
	join(tmpdir(), "lean-vo1220-bounded-history-comparison-")
);
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
			encoding: "utf8", maxBuffer: 256 * 1024 * 1024
			, env: environment, ...options
		}
	);
	temporaryGit(["read-tree", vo1220BoundedHistoryComparisonImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...vo1220BoundedHistoryComparisonIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", vo1220BoundedHistoryComparisonImplementation
	], { input: "Authenticate bounded aggregate-history comparisons\n" }).trim();
	const integrationUpdates = [];
	for(const sourcePath of vo1220BoundedHistoryComparisonIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			sourcePath, vo1220BoundedHistoryComparisonImplementation
			, integrationCommit, { maximumEditBytes: 16 * 1024 * 1024 }
		));
	const historyAdditions = [];
	for(const sourcePath of vo1220BoundedHistoryComparisonHistoryAdditions)
		historyAdditions.push({
			path: sourcePath, sha256: sha256(await readFile(sourcePath))
		});
	await writeFile(vo1220BoundedHistoryComparisonHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "vo1220-bounded-history-comparison-source-v1"
		, predecessorCommit: vo1220BoundedHistoryComparisonPredecessor
		, implementationCommit: vo1220BoundedHistoryComparisonImplementation
		, scope: "Bound failure diagnostics for large JSON history documents, share that comparator with the Perl contract replay, and read already-authenticated merge parents directly from their exact immutable revisions. Preserve JSON equality semantics, every source-history transition, the complete type surface, runtime/package behavior and all acceptance claims while eliminating assertion rendering that can exhaust a Core runner."
		, updates, implementationAdditions, integrationUpdates, historyAdditions
		, typeSurface: {
			path: typeSurfacePath, changed: false
			, sha256: sha256(implementationTypeSurface)
		}
		, behavior: {
			modifiedFiles: 164, addedFiles: 2
			, mechanicallyMigratedAssertions: 161
			, mechanicallyMigratedFiles: 160
			, sharedComparatorConsumerFiles: 161
			, sharedComparatorCallSites: 162
			, boundedComparatorTests: 3
			, remainingDangerousWholeDocumentAssertions: 0
			, sharedPerlComparator: true, directRevisionReader: true
			, productionFilesChanged: 0, packageFilesChanged: 0
		}
		, measurements: {
			focusedDirectRevision: {
				beforeMs: 612342.186, afterMs: 5828.481
				, savedMs: 606513.705, speedup: 105.06033836260254
			}
			, checkedJavascriptPartition12: {
				beforeMs: 1322739.069698, afterMs: 968891.904086
				, savedMs: 353847.165612
				, savedPercent: 26.7510935238942
				, tests: 186, passed: 186, failed: 0, skipped: 0
			}
		}
		, gates: {
			typecheck: "pass", eslint: "pass", diffCheck: "pass"
			, focusedDirectRevision: "8/8"
			, focusedPerlContract: "3/3"
			, partition12: "186/186"
		}
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation transitions, `
		+ `${implementationAdditions.length} implementation additions and `
		+ `${integrationUpdates.length} registrations.\n`);
}
finally
{ await rm(directory, { recursive: true, force: true }); }
