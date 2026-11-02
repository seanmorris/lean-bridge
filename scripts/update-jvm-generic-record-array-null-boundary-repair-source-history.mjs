#!/usr/bin/env node
/**
 * Record the JVM generic-record Array null-boundary repair.
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
	assertJvmGenericRecordArrayNullBoundaryRepair
	, jvmGenericRecordArrayNullBoundaryRepairHistoryAdditions
	, jvmGenericRecordArrayNullBoundaryRepairHistoryPath
	, jvmGenericRecordArrayNullBoundaryRepairImplementation
	, jvmGenericRecordArrayNullBoundaryRepairImplementationPaths
	, jvmGenericRecordArrayNullBoundaryRepairIntegrationPaths
	, jvmGenericRecordArrayNullBoundaryRepairPredecessor
} from "../tests/helpers/jvm-generic-record-array-null-boundary-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-jvm-generic-record-array-null-boundary-repair-source-history.mjs");
assert.equal(existsSync(jvmGenericRecordArrayNullBoundaryRepairHistoryPath)
	, false, "JVM Array null-boundary repair history already exists");
const head = git(["rev-parse", "HEAD"]).trim();
const parent = git(["rev-parse"
	, `${jvmGenericRecordArrayNullBoundaryRepairImplementation}^`]).trim();
assert.equal(head, jvmGenericRecordArrayNullBoundaryRepairImplementation);
assert.equal(parent, jvmGenericRecordArrayNullBoundaryRepairPredecessor);
const implementationPaths = names(["diff", "--name-only"
	, jvmGenericRecordArrayNullBoundaryRepairPredecessor
	, jvmGenericRecordArrayNullBoundaryRepairImplementation, "--"]);
const integrationPaths = names(["diff", "HEAD", "--name-only"
	, "--diff-filter=M", "--"
	, ...jvmGenericRecordArrayNullBoundaryRepairIntegrationPaths]);
const additionPaths = names(["ls-files", "--others", "--exclude-standard"
	, "--", ...jvmGenericRecordArrayNullBoundaryRepairHistoryAdditions]);
assert.deepEqual(implementationPaths
	, [...jvmGenericRecordArrayNullBoundaryRepairImplementationPaths].sort());
assert.deepEqual(integrationPaths
	, [...jvmGenericRecordArrayNullBoundaryRepairIntegrationPaths].sort());
assert.deepEqual(additionPaths
	, [...jvmGenericRecordArrayNullBoundaryRepairHistoryAdditions].sort());
const existingHistory = spawnSync("git", ["cat-file", "-e"
	, `${jvmGenericRecordArrayNullBoundaryRepairImplementation}:${
		jvmGenericRecordArrayNullBoundaryRepairHistoryPath}`]
, { stdio: "ignore" });
assert.notEqual(existingHistory.status, 0);

const implementationSources = Object.fromEntries(
	jvmGenericRecordArrayNullBoundaryRepairImplementationPaths.map(path => [
		path
		, git(["show"
			, `${jvmGenericRecordArrayNullBoundaryRepairImplementation}:${path}`])
	])
);
assert.deepEqual(assertJvmGenericRecordArrayNullBoundaryRepair(
	implementationSources), {
	javaArrayChecks: 1071, changedSupportCells: 0, runtimeSemanticChanges: 0
	}
);

const exactModelPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
const exactModels = [
	jvmGenericRecordArrayNullBoundaryRepairPredecessor
	, jvmGenericRecordArrayNullBoundaryRepairImplementation
].map(commit => git(["show", `${commit}:${exactModelPath}`]));
assert.equal(new Set(exactModels.map(source => sha256(source))).size, 1);
assert.equal(sha256(exactModels[0])
	, "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f");
assert.equal(Buffer.byteLength(exactModels[0]), 16916757);
const exact = JSON.parse(exactModels[0]);
assert.equal(exact.model.length, 1054);
assert.equal(exact.stageEntries, 5270);

const updates = [];
for(const path of jvmGenericRecordArrayNullBoundaryRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, jvmGenericRecordArrayNullBoundaryRepairPredecessor
		, jvmGenericRecordArrayNullBoundaryRepairImplementation
		, { maximumEditBytes: 64 * 1024 * 1024 }));

const directory = await mkdtemp(join(
	tmpdir(), "lean-jvm-array-null-boundary-history-"));
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
		, jvmGenericRecordArrayNullBoundaryRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...jvmGenericRecordArrayNullBoundaryRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p"
		, jvmGenericRecordArrayNullBoundaryRepairImplementation
	], { input: "Authenticate JVM Array null-boundary repair\n" }).trim();
	const integrationUpdates = [];
	for(const path of jvmGenericRecordArrayNullBoundaryRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(path
			, jvmGenericRecordArrayNullBoundaryRepairImplementation
			, integrationCommit
			, { maximumEditBytes: 64 * 1024 * 1024 }));
	const historyAdditions = [];
	for(const path of jvmGenericRecordArrayNullBoundaryRepairHistoryAdditions)
	{
		const existing = spawnSync("git", ["cat-file", "-e"
			, `${jvmGenericRecordArrayNullBoundaryRepairImplementation}:${path}`]
		, { stdio: "ignore" });
		assert.notEqual(existing.status, 0, path);
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	}
	await writeFile(jvmGenericRecordArrayNullBoundaryRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "jvm-generic-record-array-null-boundary-repair-source-v1"
			, predecessorCommit:
				jvmGenericRecordArrayNullBoundaryRepairPredecessor
			, implementationCommit:
				jvmGenericRecordArrayNullBoundaryRepairImplementation
			, integrationCommit
			, discovery: {
				run: 41372695232, job: 125053723860
				, lane: "Managed consumer (jvm)"
				, observed: "NatBox rejected a null required field before the Array rejection harness began"
			}
			, rootCause: "The Java Array consumer constructed NatBox(null, count) while preparing a broken row, before entering the exception harness. Generated required reference fields now reject null in their public record constructor, so the expected boundary fired correctly but escaped the test."
			, repair: "Construct the invalid NatBox inside the rejection harness at each selected position, prove the failed assignment leaves the caller array unchanged, then run valid rowTotal and rowBoxSum recovery calls. Keep the null-record Array converter checks and the exact 1,071-check Java observation unchanged."
			, exactModel: {
				sha256: sha256(exactModels[0])
				, bytes: Buffer.byteLength(exactModels[0])
				, cells: exact.model.length, stageEntries: exact.stageEntries
			}
			, changedSupportCells: 0, runtimeSemanticChanges: 0
			, livePinRefreshes: 0
			, validation: {
				installedPackageReplay: "12/12 tests passed from two independent Lean author roots"
				, javaChecks: 2105, kotlinChecks: 2067
				, sourceFreeConsumers: ["java", "kotlin"]
			}
			, updates, integrationUpdates, historyAdditions
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration transitions for the `
		+ "JVM Array null-boundary repair.\n");
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
