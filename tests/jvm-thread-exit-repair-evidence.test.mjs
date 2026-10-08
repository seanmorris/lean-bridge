/**
 * Preserve frozen observations and reject weakened JVM cleanup acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { phpNixBoundaryHistoricalBytes } from "./helpers/php-nix-boundary-repair-history.mjs";
import { assertJvmThreadExitCi, assertJvmThreadExitExecution, jvmThreadExitRepairCommands } from "./helpers/jvm-thread-exit-repair-evidence.mjs";
import { beforeJvmThreadExitRepair, jvmThreadExitHistoricalBytes, jvmThreadExitRepairAddedPaths
	, jvmThreadExitRepairBaseline, jvmThreadExitRepairChangedPaths, jvmThreadExitRepairPath
	, jvmThreadExitRepairPrevious, reverseJvmThreadExitUpdate } from "./helpers/jvm-thread-exit-repair-history.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));
const source = async (path, expected) => phpNixBoundaryHistoricalBytes(path, await readFile(path), expected);

test("JVM cleanup repair preserves exact wasm32, PHP and JVM source histories", async () => {
	const record = await json(jvmThreadExitRepairPath);
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "jvm-thread-exit-repair");
	assert.equal(record.baselineRevision, jvmThreadExitRepairBaseline);
	assert.deepEqual(record.previous, jvmThreadExitRepairPrevious);
	const previousBytes = await readFile(record.previous.path), previous = JSON.parse(previousBytes);
	assert.equal(sha256(previousBytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...new Set([
		...Object.keys(previous.sources), ...jvmThreadExitRepairChangedPaths
		, ...jvmThreadExitRepairAddedPaths
	])].sort());
	for(const [path, hash] of Object.entries(record.sources)) assert.equal(sha256(await source(path, hash)), hash, path);
	assert.deepEqual(record.updates.map(update => update.path), jvmThreadExitRepairChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path], update.path);
		assert.equal(update.currentSha256, record.sources[update.path], update.path);
		const current = (await source(update.path, update.currentSha256)).toString();
		const prior = beforeJvmThreadExitRepair(update.path, current);
		assert.equal(sha256(prior), update.previousSha256, update.path);
		assert.equal(beforeJvmThreadExitRepair(update.path, prior), prior);
		assert.equal(beforeJvmThreadExitRepair(update.path, current, update.currentSha256), current);
		const unknown = current + "\n/* unrecorded JVM cleanup edit */\n";
		assert.equal(beforeJvmThreadExitRepair(update.path, unknown), unknown);
		assert.throws(() => reverseJvmThreadExitUpdate(unknown, update));
		assert.throws(() => reverseJvmThreadExitUpdate(current, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reverseJvmThreadExitUpdate(current, { ...update, path: "unknown.mjs" }));
		assert.throws(() => reverseJvmThreadExitUpdate(current, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
	const binary = Buffer.from([0, 255, 192, 128]);
	assert.equal(jvmThreadExitHistoricalBytes("unknown.bin", binary), binary);
	const current = (await source("docs/type-surface.v1.json", record.sources["docs/type-surface.v1.json"])).toString();
	const prior = JSON.parse(beforeJvmThreadExitRepair("docs/type-surface.v1.json", current));
	for(const evidence of prior.evidence) for(const file of evidence.files) file.sha256 = sha256(await source(file.path, record.sources[file.path]));
	assert.deepEqual(JSON.parse(current), prior);
});

test("JVM cleanup repair binds both source paths, unchanged generated adapters and failing mutants", async () => {
	await assertJvmThreadExitExecution(await json(jvmThreadExitRepairPath));
});

test("JVM cleanup receipt rejects missing waits, lost controls and substituted results", async () => {
	const original = await json(jvmThreadExitRepairPath);
	for(const mutate of [
		record => { record.scope.installedPackage = true; }
		, record => { record.scope.promotedCells = 1; }
		, record => { record.scope.productionGeneratedBytesUnchanged = false; }
		, record => { record.runs.gated.command += " --import forged.mjs"; }
		, record => { record.runs.gated.exitCode = 1; }
		, record => { record.runs.signatures.text += "\nchanged\n"; }
		, record => { delete record.reports.gated.reviewed; }
		, record => { record.reports.gated.ordinary.heldExits = 0; }
		, record => { record.reports.gated.ordinary.releasedExits = 0; }
		, record => { record.reports.gated.ordinary.live = 1; }
		, record => { record.reports.gated.ordinary.identities = 1; }
		, record => { record.reports.gated.ordinary.threadExitErrors = 1; }
		, record => { record.reports.gated.ordinary.javaChecks--; }
		, record => { record.reports.gated.ordinary.mutation.stderr = "unrelated failure"; }
		, record => { record.reports.gated.ordinary.mutantJavaProbeSha256 = record.reports.gated.ordinary.javaProbeSha256; }
		, record => { record.reports.gated.ordinary.guardSha256 = record.reports.signatures.ordinary.guardSha256; }
		, record => { record.reports.gated.ordinary.cSourceSha256 = "0".repeat(64); }
		, record => { record.reports.signatures.ordinary.javaProbeSha256 = "0".repeat(64); }
	]) {
		const changed = structuredClone(original); mutate(changed);
		await assert.rejects(() => assertJvmThreadExitExecution(changed), mutate.toString());
	}
});

test("CI requires both forced-cleanup reports, retained artifacts and propagated failure", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	assertJvmThreadExitCi(workflow);
	for(const fragment of [
		"          " + jvmThreadExitRepairCommands.gated + "\n"
		, "          test -s build/owned-jvm-thread-exit/ordinary.json\n"
		, "          test -s build/owned-jvm-thread-exit/reviewed.json\n"
		, "            build/owned-jvm-thread-exit/\n"
		, "      - owned-jvm-values\n"
		, "        if: needs.owned-jvm-values.result != 'success'\n"
	]) assert.throws(() => assertJvmThreadExitCi(workflow.replace(fragment, "")), fragment);
});
