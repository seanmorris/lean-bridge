/**
 * Authenticate the nominal Subtype entry-measurement sources and repaired current-source pointers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { sha256 } from "./source-history-digest.mjs";
import { beforeNominalSubtypeEntryMeasurementSource, nominalSubtypeEntryMeasurementChangedPaths, nominalSubtypeEntryMeasurementHistoryPath, nominalSubtypeEntryMeasurementImplementation, nominalSubtypeEntryMeasurementPredecessor, reverseNominalSubtypeEntryMeasurementUpdate } from "./nominal-subtype-entry-measurement-source-history.mjs";

const original = path => execFileSync("git", ["show", `${nominalSubtypeEntryMeasurementPredecessor}:${path}`], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });

test("nominal Subtype entry measurement history restores every changed source and pointer", async () => {
	const record = JSON.parse(await readFile(nominalSubtypeEntryMeasurementHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.milestone, "nominal-subtype-entry-measurement-source-v1");
	assert.equal(record.predecessorCommit, nominalSubtypeEntryMeasurementPredecessor);
	assert.equal(record.implementationCommit, nominalSubtypeEntryMeasurementImplementation);
	assert.deepEqual(record.updates.map(item => item.path), nominalSubtypeEntryMeasurementChangedPaths);
	for(const update of record.updates)
	{
		const current = await readFile(update.path, "utf8");
		const previous = reverseNominalSubtypeEntryMeasurementUpdate(current, update);
		assert.equal(previous, original(update.path));
		assert.equal(beforeNominalSubtypeEntryMeasurementSource(update.path, current), previous);
		assert.equal(beforeNominalSubtypeEntryMeasurementSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeNominalSubtypeEntryMeasurementSource(update.path, current + "unknown"), current + "unknown");
	}
	for(const addition of record.additions)
		assert.equal(sha256(await readFile(addition.path)), addition.currentSha256, addition.path);
	for(const pin of record.pinUpdates)
	{
		const current = await readFile(pin.containerPath, "utf8");
		assert.equal(sha256(current), pin.containerCurrentSha256);
		assert.equal(current.split(pin.currentSha256).length - 1, pin.count);
		const previous = current.replaceAll(pin.currentSha256, pin.previousSha256);
		assert.equal(sha256(previous), pin.containerPreviousSha256);
	}
});

test("nominal Subtype entry history writer refuses an unrelated checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-entry-history-guard-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-nominal-subtype-entry-measurement-source-history.mjs")]
		, { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
