/**
 * Authenticate integration of hosted-signature producer bindings.
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
	beforeSignatureSpecializationHostedProducerBindingIntegrationSource
	, reverseSignatureSpecializationHostedProducerBindingIntegrationUpdate
	, signatureSpecializationHostedProducerBindingIntegrationAddedPaths
	, signatureSpecializationHostedProducerBindingIntegrationBase
	, signatureSpecializationHostedProducerBindingIntegrationHistoryPath
	, signatureSpecializationHostedProducerBindingIntegrationImplementation
	, signatureSpecializationHostedProducerBindingIntegrationPaths
} from "./signature-specialization-hosted-producer-binding-integration-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const readRecord = async () => JSON.parse(await readFile(
	signatureSpecializationHostedProducerBindingIntegrationHistoryPath, "utf8"));

test("hosted-signature producer-binding integration restores its base", async () => {
	const record = await readRecord();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.baseCommit
		, signatureSpecializationHostedProducerBindingIntegrationBase);
	assert.equal(record.implementationCommit
		, signatureSpecializationHostedProducerBindingIntegrationImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, signatureSpecializationHostedProducerBindingIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, signatureSpecializationHostedProducerBindingIntegrationAddedPaths);
	for(const update of record.updates)
	{
		const current = git(["show"
			, `${signatureSpecializationHostedProducerBindingIntegrationImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${signatureSpecializationHostedProducerBindingIntegrationBase}:${update.path}`]);
		assert.equal(
			reverseSignatureSpecializationHostedProducerBindingIntegrationUpdate(
				current, update), previous, update.path);
		assert.equal(
			beforeSignatureSpecializationHostedProducerBindingIntegrationSource(
				update.path, current, update.previousSha256)
			, previous, update.path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await readFile(addition.path))
			, addition.currentSha256, addition.path);
});

test("hosted-signature producer-binding integration rejects forgery", async () => {
	const update = (await readRecord()).updates[0];
	const current = git(["show"
		, `${signatureSpecializationHostedProducerBindingIntegrationImplementation}:${update.path}`]);
	assert.throws(() =>
		reverseSignatureSpecializationHostedProducerBindingIntegrationUpdate(
			current, { ...update, currentSha256: "0".repeat(64) }));
});

test("hosted-signature producer-binding integration writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-signature-hosted-producer-binding-integration-"));
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
		"scripts/update-signature-specialization-hosted-producer-binding-integration-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.deepEqual(await readdir(root), [".git"]);
});
