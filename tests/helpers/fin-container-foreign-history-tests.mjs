/**
 * Authenticate measured container CI while preserving prior execution evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { classifyRepositoryTest } from "../../src/adoption/test-profiles.mjs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { finHostedPromotionChangedPaths } from "./fin-native-hosted-promotion-history.mjs";
import { finZeroCiChangedPaths } from "./fin-record-zero-ci-history.mjs";
import { beforeFinRecordOmissionSource, finRecordOmissionChangedPaths } from "./fin-record-review-omission-history.mjs";
import { beforeFinForeignSource, finForeignChangedPaths, finForeignHistoryPath, finForeignPredecessor, reverseFinForeignUpdate } from "./fin-container-foreign-history.mjs";

test("foreign-carrier integration authenticates every transition and refuses unrecorded edits", async () => {
	const history = JSON.parse(await readFile(finForeignHistoryPath, "utf8"));
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone, "fin-container-foreign-v1");
	assert.equal(history.predecessorCommit, finForeignPredecessor);
	assert.deepEqual(history.updates.map(update => update.path), finForeignChangedPaths);
	for(const update of history.updates)
	{
		const current = beforeFinRecordOmissionSource(update.path, await readFile(update.path, "utf8")), previous = reverseFinForeignUpdate(current, update);
		assert.equal(beforeFinForeignSource(update.path, current), previous);
		assert.equal(beforeFinForeignSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeFinForeignSource(update.path, previous), previous);
		assert.equal(beforeFinRefinementSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeFinRefinementSource(update.path, current), beforeFinRefinementSource(update.path, previous));
		const changed = current + "\n// unknown edit\n";
		assert.equal(beforeFinForeignSource(update.path, changed), changed);
		assert.throws(() => reverseFinForeignUpdate(changed, update));
		for(const mutation of [
			{ previousSha256: "0".repeat(64) }, { currentSha256: "0".repeat(64) }
			, { path: "unknown.mjs" }, { edits: [] }
			, { edits: [...update.edits, update.edits[0]] }
			, { edits: [{ ...update.edits[0], start: -1 }] }
			, { edits: [{ ...update.edits[0], current: "unrecorded" }] }
		]) assert.throws(() => reverseFinForeignUpdate(current, { ...update, ...mutation }));
	}
	const buffer = Buffer.from("unregistered bytes");
	assert.equal(beforeFinForeignSource(finForeignChangedPaths[0], buffer), buffer);
	assert.equal(beforeFinForeignSource("unknown.mjs", "unregistered bytes"), "unregistered bytes");
});

test("foreign-carrier integration refreshes exact source pins without changing support claims or old ledgers", async () => {
	const history = JSON.parse(await readFile(finForeignHistoryPath, "utf8"));
	const path = "docs/type-surface.v1.json", source = beforeFinRecordOmissionSource(path, await readFile(path, "utf8"));
	const current = JSON.parse(source), previous = JSON.parse(beforeFinForeignSource(path, source));
	const expected = structuredClone(previous); let refreshed = 0;
	for(const entry of expected.evidence) for(const file of entry.files)
	{
		const update = history.updates.find(item => item.path === file.path && item.previousSha256 === file.sha256);
		if(update)
		{ file.sha256 = update.currentSha256; refreshed++; }
	}
	assert.equal(refreshed, 186);
	assert.deepEqual(current, expected);
	assert.deepEqual(current.observations, previous.observations);
	const digests = new Map();
	for(const file of current.evidence.flatMap(entry => entry.files))
	{
		if(!digests.has(file.path))
		{
			const bytes = await readFile(file.path);
			const source = [...finZeroCiChangedPaths, ...finHostedPromotionChangedPaths, ...finRecordOmissionChangedPaths].includes(file.path) ? beforeFinRecordOmissionSource(file.path, bytes.toString("utf8")) : bytes;
			digests.set(file.path, sha256(source));
		}
		assert.equal(digests.get(file.path), file.sha256, file.path);
	}
	for(const [path, digest] of [
		["docs/evidence/fin-container-edge-ci-source-history-20261010.json", "df5b0fcaef151ea18c128b4d5d9acfbdc6f250caad88d4613b6c526308b1f42c"]
		, ["docs/evidence/fin-container-edge-integration-source-history-20261010.json", "a9fa371246d50339037ad0c1ded08f5d3c83b7802817dd93980e1669cc27a4b1"]
		, ["docs/evidence/native-fin-diagnostic-ci-source-history-20261010.json", "77d1716708d41789f6dced955d6764d3ca2c86c88a1f2eea8b8df356e1dea8c6"]
		, ["docs/evidence/native-fin-diagnostic-source-history-20261010.json", "2bc3b1217601bb0eb0c19b9f1496d00ab5df831e3a1bd1881a4429b28fd210ab"]
	]) assert.equal(sha256(await readFile(path)), digest, path);
});

test("foreign source and report tests have explicit repository profiles", () => {
	assert.equal(classifyRepositoryTest("tests/fin-container-foreign-carriers.test.mjs"), "component");
	assert.equal(classifyRepositoryTest("tests/fin-container-foreign-report.test.mjs"), "contract");
});

test("foreign-carrier integration history writer refuses an unrelated HEAD before writing", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-fin-edge-integration-history-guard-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: directory, stdio: "pipe", env });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated revision"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-fin-container-foreign-history.mjs")], { cwd: directory, encoding: "utf8", env });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /Native foreign carrier history is draft-only/u);
	assert.deepEqual(await readdir(directory), [".git"]);
});
