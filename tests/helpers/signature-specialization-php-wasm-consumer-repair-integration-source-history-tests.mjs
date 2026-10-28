/**
 * Authenticate integration of the PHP-Wasm consumer repair.
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
	beforeSignatureSpecializationPhpWasmConsumerRepairIntegrationSource
	, reverseSignatureSpecializationPhpWasmConsumerRepairIntegrationUpdate
	, signatureSpecializationPhpWasmConsumerRepairIntegrationAddedPaths
	, signatureSpecializationPhpWasmConsumerRepairIntegrationBase
	, signatureSpecializationPhpWasmConsumerRepairIntegrationHistoryPath
	, signatureSpecializationPhpWasmConsumerRepairIntegrationImplementation
	, signatureSpecializationPhpWasmConsumerRepairIntegrationPaths
} from "./signature-specialization-php-wasm-consumer-repair-integration-source-history.mjs";
import { signatureSpecializationPhpWasmConsumerRepairHistoryPath } from "./signature-specialization-php-wasm-consumer-repair-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 32 * 1024 * 1024
});
const readRecord = async () => JSON.parse(await readFile(
	signatureSpecializationPhpWasmConsumerRepairIntegrationHistoryPath
	, "utf8"));

test("PHP-Wasm consumer repair integration restores exact sources", async () => {
	const record = await readRecord();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.baseCommit
		, signatureSpecializationPhpWasmConsumerRepairIntegrationBase);
	assert.equal(record.implementationCommit
		, signatureSpecializationPhpWasmConsumerRepairIntegrationImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, signatureSpecializationPhpWasmConsumerRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, signatureSpecializationPhpWasmConsumerRepairIntegrationAddedPaths);
	assert.deepEqual(record.baseHistory, {
		path: signatureSpecializationPhpWasmConsumerRepairHistoryPath
		, sha256: sha256(await readFile(
			signatureSpecializationPhpWasmConsumerRepairHistoryPath))
	});
	for(const update of record.updates)
	{
		const current = git(["show"
			, `${signatureSpecializationPhpWasmConsumerRepairIntegrationImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${signatureSpecializationPhpWasmConsumerRepairIntegrationBase}:${update.path}`]);
		assert.equal(
			reverseSignatureSpecializationPhpWasmConsumerRepairIntegrationUpdate(
				current, update), previous);
		assert.equal(
			beforeSignatureSpecializationPhpWasmConsumerRepairIntegrationSource(
				update.path, current, update.previousSha256), previous);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await readFile(addition.path))
			, addition.currentSha256, addition.path);
});

test("PHP-Wasm consumer integration rejects altered content", async () => {
	const update = (await readRecord()).updates[0];
	const current = git(["show"
		, `${signatureSpecializationPhpWasmConsumerRepairIntegrationImplementation}:${update.path}`]);
	assert.throws(() =>
		reverseSignatureSpecializationPhpWasmConsumerRepairIntegrationUpdate(
			current, { ...update, currentSha256: "0".repeat(64) }));
	assert.equal(
		beforeSignatureSpecializationPhpWasmConsumerRepairIntegrationSource(
			update.path, `${current}unknown\n`), `${current}unknown\n`);
});

test("PHP-Wasm consumer integration writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-signature-php-wasm-int-"));
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
		"scripts/update-signature-specialization-php-wasm-consumer-repair-integration-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.deepEqual(await readdir(root), [".git"]);
});
