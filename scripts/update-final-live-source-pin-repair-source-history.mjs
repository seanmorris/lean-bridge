#!/usr/bin/env node
/**
 * Record the final exact-candidate live-source pin repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { typeSurfaceEvidenceFiles }
	from "../src/adoption/type-surface-evidence-receipt.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";
import {
	finalLiveSourcePinRepairHistoryAdditions
	, finalLiveSourcePinRepairHistoryPath
	, finalLiveSourcePinRepairImplementation
	, finalLiveSourcePinRepairImplementationPaths
	, finalLiveSourcePinRepairIntegrationPaths
	, finalLiveSourcePinRepairPredecessor
} from "../tests/helpers/final-live-source-pin-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-final-live-source-pin-repair-source-history.mjs");
assert.equal(existsSync(finalLiveSourcePinRepairHistoryPath), false
	, `${finalLiveSourcePinRepairHistoryPath} already exists`);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, finalLiveSourcePinRepairImplementation);
assert.equal(git(["rev-parse"
	, `${finalLiveSourcePinRepairImplementation}^`]).trim()
, finalLiveSourcePinRepairPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, finalLiveSourcePinRepairPredecessor
	, finalLiveSourcePinRepairImplementation, "--"])
, [...finalLiveSourcePinRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, finalLiveSourcePinRepairPredecessor
	, finalLiveSourcePinRepairImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${finalLiveSourcePinRepairImplementation}:${
		finalLiveSourcePinRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...finalLiveSourcePinRepairIntegrationPaths])
, [...finalLiveSourcePinRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...finalLiveSourcePinRepairHistoryAdditions])
, [...finalLiveSourcePinRepairHistoryAdditions].sort());

const inventoryPath = finalLiveSourcePinRepairImplementationPaths[0];
const beforeText = git(["show"
	, `${finalLiveSourcePinRepairPredecessor}:${inventoryPath}`]);
const afterText = git(["show"
	, `${finalLiveSourcePinRepairImplementation}:${inventoryPath}`]);
const before = JSON.parse(beforeText), after = JSON.parse(afterText);
const paths = [
	".github/workflows/consumer-matrix.yml"
	, ".github/workflows/perl-consumer.yml"
	, "tests/documentation.test.mjs"
	, "tests/helpers/checked-record-promotion-tests.mjs"
];
const pinTransitions = [];
let restored = afterText;
for(const path of paths)
{
	const previous = [...new Set(before.evidence.flatMap(evidence => evidence.files)
		.filter(file => file.path === path).map(file => file.sha256))];
	const current = [...new Set(after.evidence.flatMap(evidence => evidence.files)
		.filter(file => file.path === path).map(file => file.sha256))];
	assert.equal(previous.length, 1, path);
	assert.equal(current.length, 1, path);
	const count = after.evidence.flatMap(evidence => evidence.files)
		.filter(file => file.path === path).length;
	assert.equal(sha256(await readFile(path)), current[0], path);
	assert.equal(restored.split(current[0]).length - 1, count, path);
	restored = restored.replaceAll(current[0], previous[0]);
	pinTransitions.push({
		path, count, previousSha256: previous[0], currentSha256: current[0]
	});
}
assert.equal(restored, beforeText);
assert.deepEqual(pinTransitions.map(item => item.count), [92, 13, 25, 6]);
assert.deepEqual(after.profiles, before.profiles);
assert.deepEqual(after.observations, before.observations);
const files = typeSurfaceEvidenceFiles(after).filter(file =>
	!file.path.startsWith("docs/evidence/"));
const mismatches = [], missing = [];
for(let offset = 0; offset < files.length; offset += 16)
{
	const batch = files.slice(offset, offset + 16);
	const actual = await Promise.all(batch.map(async file => {
		try
		{
			return createHash("sha256").update(
				await readFile(file.path)).digest("hex");
		}
		catch(error)
		{ missing.push({ path: file.path, code: error.code }); return null; }
	}));
	for(const [index, file] of batch.entries())
		if(actual[index] !== null && actual[index] !== file.sha256)
			mismatches.push({ path: file.path, actual: actual[index]
				, expected: file.sha256 });
}
assert.equal(files.length, 2661);
assert.deepEqual(missing, []);
assert.deepEqual(mismatches, []);

const exactModelPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
const exactModel = git(["show"
	, `${finalLiveSourcePinRepairImplementation}:${exactModelPath}`]);
assert.equal(sha256(exactModel)
	, "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f");
assert.equal(Buffer.byteLength(exactModel), 16916757);
const exact = JSON.parse(exactModel);
assert.equal(exact.model.length, 1054);
assert.equal(exact.stageEntries, 5270);

const updates = [];
for(const path of finalLiveSourcePinRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, finalLiveSourcePinRepairPredecessor
		, finalLiveSourcePinRepairImplementation
		, { maximumEditBytes: 256 * 1024 * 1024 }));
const directory = await mkdtemp(join(tmpdir(), "lean-final-live-pin-repair-"));
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
	temporaryGit(["read-tree", finalLiveSourcePinRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...finalLiveSourcePinRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", finalLiveSourcePinRepairImplementation
	], { input: "Authenticate final live-source pin repair\n" }).trim();
	const integrationUpdates = [];
	for(const path of finalLiveSourcePinRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, finalLiveSourcePinRepairImplementation, integrationCommit
			, { maximumEditBytes: 64 * 1024 * 1024 }
		));
	const historyAdditions = [];
	for(const path of finalLiveSourcePinRepairHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(finalLiveSourcePinRepairHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "final-live-source-pin-repair-source-v1"
		, predecessorCommit: finalLiveSourcePinRepairPredecessor
		, implementationCommit: finalLiveSourcePinRepairImplementation
		, discovery: {
			candidate: finalLiveSourcePinRepairPredecessor
			, gate: "all current live-source pins match in one complete pass"
			, stalePaths: paths.length
			, stalePins: pinTransitions.reduce(
				(sum, item) => sum + item.count, 0)
			, missingPaths: 0
		}
		, pinTransitions
		, exactModel: {
			sha256: sha256(exactModel), bytes: Buffer.byteLength(exactModel)
			, cells: exact.model.length, stageEntries: exact.stageEntries
		}
		, changedSupportCells: 0, runtimeSemanticChanges: 0
		, updates, integrationUpdates, historyAdditions
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation transition, `
		+ `${integrationUpdates.length} registrations and 136 refreshed pins.\n`);
}
finally
{ await rm(directory, { recursive: true, force: true }); }
