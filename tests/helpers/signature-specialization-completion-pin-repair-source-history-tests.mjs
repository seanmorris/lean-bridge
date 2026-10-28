/**
 * Authenticate the exact signature-completion promotion test-pin repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
	authenticateSourceHistoryReverse, gitSourceBytes
} from "./source-history-stream.mjs";
import {
	reverseSignatureSpecializationCompletionPinRepairUpdate
	, signatureSpecializationCompletionPinRepairAddedPaths
	, signatureSpecializationCompletionPinRepairChangedPaths
	, signatureSpecializationCompletionPinRepairHistoryPath
	, signatureSpecializationCompletionPinRepairImplementation
	, signatureSpecializationCompletionPinRepairPin
	, signatureSpecializationCompletionPinRepairPredecessor
} from "./signature-specialization-completion-pin-repair-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const readRecord = async () => JSON.parse(await readFile(
	signatureSpecializationCompletionPinRepairHistoryPath, "utf8"
));

test("signature completion pin repair records one claim-neutral transition", async () => {
	const record = await readRecord();
	assert.deepEqual(Object.keys(record).sort(), [
		"additions", "implementationCommit", "milestone"
		, "pin", "predecessorCommit", "schemaVersion", "scope", "updates"
	].sort());
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "signature-specialization-completion-pin-repair-source-v1");
	assert.equal(record.predecessorCommit
		, signatureSpecializationCompletionPinRepairPredecessor);
	assert.equal(record.implementationCommit
		, signatureSpecializationCompletionPinRepairImplementation);
	assert.deepEqual(record.pin, signatureSpecializationCompletionPinRepairPin);
	assert.deepEqual(record.updates.map(item => item.path)
		, signatureSpecializationCompletionPinRepairChangedPaths);
	assert.equal(record.updates[0].edits.length, 1);
	assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
		signatureSpecializationCompletionPinRepairImplementation
		, record.updates[0].path), record.updates[0]), true);
});

test("signature completion pin repair changes only its named digest", async () => {
	const update = (await readRecord()).updates[0];
	const previous = git(["show"
		, `${signatureSpecializationCompletionPinRepairPredecessor}:${update.path}`]);
	const current = git(["show"
		, `${signatureSpecializationCompletionPinRepairImplementation}:${update.path}`]);
	const restored = reverseSignatureSpecializationCompletionPinRepairUpdate(
		current, update);
	assert.equal(restored, previous);
	assert.ok(update.edits[0].previous.includes(
		signatureSpecializationCompletionPinRepairPin.previousSha256));
	assert.ok(update.edits[0].current.includes(
		signatureSpecializationCompletionPinRepairPin.currentSha256));
	assert.equal(sha256(await readFile(
		signatureSpecializationCompletionPinRepairPin.path))
		, signatureSpecializationCompletionPinRepairPin.currentSha256);
});

test("signature completion pin repair additions restore exactly", async () => {
	const record = await readRecord();
	assert.deepEqual(record.additions.map(item => item.path)
		, signatureSpecializationCompletionPinRepairAddedPaths);
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("signature completion pin repair rejects altered transitions", async () => {
	const update = (await readRecord()).updates[0];
	const current = git(["show"
		, `${signatureSpecializationCompletionPinRepairImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseSignatureSpecializationCompletionPinRepairUpdate(current, forged));
});

test("signature completion pin repair writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-signature-completion-pin-history-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const localGit = arguments_ => execFileSync("git", arguments_, {
		cwd: root, env: environment, stdio: "pipe"
	});
	localGit(["init", "--quiet"]);
	localGit(["-c", "user.name=Test", "-c"
		, "user.email=test@example.invalid", "-c", "commit.gpgsign=false"
		, "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-signature-specialization-completion-pin-repair-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
