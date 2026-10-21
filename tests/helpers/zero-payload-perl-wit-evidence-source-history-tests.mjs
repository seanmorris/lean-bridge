/**
 * Authenticate the hosted Perl and WIT evidence-verifier history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import {
	beforeZeroPayloadPerlWitEvidenceSource
	, reverseZeroPayloadPerlWitEvidenceUpdate
	, zeroPayloadPerlWitEvidenceChangedPaths
	, zeroPayloadPerlWitEvidenceHistoryPath
	, zeroPayloadPerlWitEvidenceImplementation
	, zeroPayloadPerlWitEvidenceIntegrationPaths
	, zeroPayloadPerlWitEvidencePredecessor
} from "./zero-payload-perl-wit-evidence-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const sourceAt = (revision, path) => execFileSync("git", ["show"
	, `${revision}:${path}`], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("zero-payload Perl/WIT evidence history restores every source", async () => {
	const record = JSON.parse(await readFile(
		zeroPayloadPerlWitEvidenceHistoryPath, "utf8"
	));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "zero-payload-perl-wit-evidence-source-v1");
	assert.equal(record.predecessorCommit
		, zeroPayloadPerlWitEvidencePredecessor);
	assert.equal(record.implementationCommit
		, zeroPayloadPerlWitEvidenceImplementation);
	assert.ok(record.reconciledTypeSurfacePointers > 0);
	assert.deepEqual(record.updates.map(item => item.path)
		, zeroPayloadPerlWitEvidenceChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, zeroPayloadPerlWitEvidenceIntegrationPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeZeroPayloadPerlWitEvidenceSource
		);
		assert.equal(sha256(current), update.currentSha256, update.path);
		const previous = reverseZeroPayloadPerlWitEvidenceUpdate(current, update);
		assert.equal(previous, sourceAt(
			zeroPayloadPerlWitEvidencePredecessor, update.path
		));
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeZeroPayloadPerlWitEvidenceSource
		);
		const previous = sourceAt(
			zeroPayloadPerlWitEvidenceImplementation, update.path
		);
		assert.equal(reverseZeroPayloadPerlWitEvidenceUpdate(
			current, update), previous);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256
		)), addition.currentSha256, addition.path);
});

test("zero-payload Perl/WIT evidence history rejects altered transitions", async () => {
	const record = JSON.parse(await readFile(
		zeroPayloadPerlWitEvidenceHistoryPath, "utf8"
	));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256, beforeZeroPayloadPerlWitEvidenceSource
	);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseZeroPayloadPerlWitEvidenceUpdate(current, update));
	update.currentSha256 = sha256(current);
	update.path = "src/not-recorded.mjs";
	assert.throws(() => reverseZeroPayloadPerlWitEvidenceUpdate(current, update));
});

test("zero-payload Perl/WIT evidence writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-zero-payload-perl-wit-evidence-guard-"
	));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args
		, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-zero-payload-perl-wit-evidence-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
