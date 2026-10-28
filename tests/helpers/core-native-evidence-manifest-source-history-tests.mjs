/**
 * Authenticate the Core native-specialization evidence-manifest repair.
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
	beforeCoreNativeEvidenceManifestSource
	, coreNativeEvidenceManifestAddedPaths
	, coreNativeEvidenceManifestHistoryPath
	, coreNativeEvidenceManifestImplementation
	, coreNativeEvidenceManifestPaths
	, coreNativeEvidenceManifestPredecessor
	, reverseCoreNativeEvidenceManifestUpdate
} from "./core-native-evidence-manifest-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 32 * 1024 * 1024
});
const readRecord = async () => JSON.parse(await readFile(
	coreNativeEvidenceManifestHistoryPath, "utf8"));

test("native evidence manifest repair restores its exact predecessor", async () => {
	const record = await readRecord();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.predecessorCommit
		, coreNativeEvidenceManifestPredecessor);
	assert.equal(record.implementationCommit
		, coreNativeEvidenceManifestImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, coreNativeEvidenceManifestPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, coreNativeEvidenceManifestAddedPaths);
	for(const update of record.updates)
	{
		const current = git(["show"
			, `${coreNativeEvidenceManifestImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${coreNativeEvidenceManifestPredecessor}:${update.path}`]);
		assert.equal(reverseCoreNativeEvidenceManifestUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeCoreNativeEvidenceManifestSource(update.path, current
			, update.previousSha256), previous, update.path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await readFile(addition.path))
			, addition.currentSha256, addition.path);
});

test("native evidence manifest repair rejects altered content", async () => {
	const record = await readRecord(), update = record.updates[0];
	const current = git(["show"
		, `${coreNativeEvidenceManifestImplementation}:${update.path}`]);
	assert.throws(() => reverseCoreNativeEvidenceManifestUpdate(current
		, { ...update, currentSha256: "0".repeat(64) }));
	assert.equal(beforeCoreNativeEvidenceManifestSource(update.path
		, `${current}unknown\n`), `${current}unknown\n`);
});

test("native evidence manifest writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-core-native-manifest-"));
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
		"scripts/update-core-native-evidence-manifest-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.deepEqual(await readdir(root), [".git"]);
});
