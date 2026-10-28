/**
 * Authenticate the hosted-signature producer-binding transition.
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
	beforeSignatureSpecializationHostedProducerBindingSource
	, reverseSignatureSpecializationHostedProducerBindingUpdate
	, signatureSpecializationHostedProducerBindingAddedPaths
	, signatureSpecializationHostedProducerBindingHistoryPath
	, signatureSpecializationHostedProducerBindingImplementation
	, signatureSpecializationHostedProducerBindingPaths
	, signatureSpecializationHostedProducerBindingPredecessor
} from "./signature-specialization-hosted-producer-binding-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const readRecord = async () => JSON.parse(await readFile(
	signatureSpecializationHostedProducerBindingHistoryPath, "utf8"));

test("hosted-signature producer bindings restore their exact predecessor", async () => {
	const record = await readRecord();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.predecessorCommit
		, signatureSpecializationHostedProducerBindingPredecessor);
	assert.equal(record.implementationCommit
		, signatureSpecializationHostedProducerBindingImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, signatureSpecializationHostedProducerBindingPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, signatureSpecializationHostedProducerBindingAddedPaths);
	for(const update of record.updates)
	{
		const current = git(["show"
			, `${signatureSpecializationHostedProducerBindingImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${signatureSpecializationHostedProducerBindingPredecessor}:${update.path}`]);
		assert.equal(reverseSignatureSpecializationHostedProducerBindingUpdate(
			current, update), previous, update.path);
		assert.equal(beforeSignatureSpecializationHostedProducerBindingSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await readFile(addition.path))
			, addition.currentSha256, addition.path);
});

test("hosted-signature producer bindings reject altered transitions", async () => {
	const update = (await readRecord()).updates[0];
	const current = git(["show"
		, `${signatureSpecializationHostedProducerBindingImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseSignatureSpecializationHostedProducerBindingUpdate(
			current, forged));
});

test("hosted-signature producer-binding writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-signature-hosted-producer-binding-"));
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
		"scripts/update-signature-specialization-hosted-producer-binding-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.deepEqual(await readdir(root), [".git"]);
});
