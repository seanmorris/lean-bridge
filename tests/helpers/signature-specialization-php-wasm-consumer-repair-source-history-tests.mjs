/**
 * Authenticate the PHP-Wasm specialization consumer repair.
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
	beforeSignatureSpecializationPhpWasmConsumerRepairSource
	, reverseSignatureSpecializationPhpWasmConsumerRepairUpdate
	, signatureSpecializationPhpWasmConsumerRepairAddedPaths
	, signatureSpecializationPhpWasmConsumerRepairHistoryPath
	, signatureSpecializationPhpWasmConsumerRepairImplementation
	, signatureSpecializationPhpWasmConsumerRepairPaths
	, signatureSpecializationPhpWasmConsumerRepairPredecessor
} from "./signature-specialization-php-wasm-consumer-repair-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 32 * 1024 * 1024
});
const readRecord = async () => JSON.parse(await readFile(
	signatureSpecializationPhpWasmConsumerRepairHistoryPath, "utf8"));

test("PHP-Wasm consumer repair restores its exact helper", async () => {
	const record = await readRecord();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.predecessorCommit
		, signatureSpecializationPhpWasmConsumerRepairPredecessor);
	assert.equal(record.implementationCommit
		, signatureSpecializationPhpWasmConsumerRepairImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, signatureSpecializationPhpWasmConsumerRepairPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, signatureSpecializationPhpWasmConsumerRepairAddedPaths);
	for(const update of record.updates)
	{
		const current = git(["show"
			, `${signatureSpecializationPhpWasmConsumerRepairImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${signatureSpecializationPhpWasmConsumerRepairPredecessor}:${update.path}`]);
		assert.equal(reverseSignatureSpecializationPhpWasmConsumerRepairUpdate(
			current, update), previous);
		assert.equal(beforeSignatureSpecializationPhpWasmConsumerRepairSource(
			update.path, current, update.previousSha256), previous);
	}
	for(const addition of record.additions)
	{
		const bytes = addition.path.startsWith("tests/fixtures/")
			? git(["show"
				, `${signatureSpecializationPhpWasmConsumerRepairImplementation}:${addition.path}`])
			: await readFile(addition.path);
		assert.equal(sha256(bytes), addition.currentSha256, addition.path);
	}
});

test("PHP-Wasm consumer repair rejects altered content", async () => {
	const update = (await readRecord()).updates[0];
	const current = git(["show"
		, `${signatureSpecializationPhpWasmConsumerRepairImplementation}:${update.path}`]);
	assert.throws(() => reverseSignatureSpecializationPhpWasmConsumerRepairUpdate(
		current, { ...update, currentSha256: "0".repeat(64) }));
	assert.equal(beforeSignatureSpecializationPhpWasmConsumerRepairSource(
		update.path, `${current}unknown\n`), `${current}unknown\n`);
});

test("PHP-Wasm consumer repair writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-signature-php-wasm-repair-"));
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
		"scripts/update-signature-specialization-php-wasm-consumer-repair-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.deepEqual(await readdir(root), [".git"]);
});
