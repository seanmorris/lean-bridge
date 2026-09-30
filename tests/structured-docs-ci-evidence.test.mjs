/**
 * Preserve the historical source chain and require the repaired installed gate.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { classifyRepositoryTest } from "../src/adoption/test-profiles.mjs";
import { assertStructuredDocsCiExecution } from "./helpers/structured-docs-ci-evidence.mjs";
import { structuredDocsCiPath, structuredDocsCiBaseline, structuredDocsCiPrevious
	, structuredDocsCiChangedPaths, structuredDocsCiAddedPaths
	, beforeStructuredDocsCi, reverseStructuredDocsCiUpdate } from "./helpers/structured-docs-ci-history.mjs";

const read = async () => JSON.parse(await readFile(structuredDocsCiPath, "utf8"));

test("structured documentation repair preserves exact predecessor source identities", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "structured-docs-ci-repair");
	assert.equal(record.planNode, 1219); assert.equal(record.baselineRevision, structuredDocsCiBaseline);
	assert.deepEqual(record.previous, structuredDocsCiPrevious);
	const bytes = await readFile(record.previous.path), previous = JSON.parse(bytes);
	assert.equal(sha256(bytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...Object.keys(previous.sources), ...structuredDocsCiAddedPaths].sort());
	for(const [path, hash] of Object.entries(record.sources)) assert.equal(sha256(await readFile(path)), hash, path);
	assert.deepEqual(record.updates.map(update => update.path), structuredDocsCiChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path]);
		assert.equal(update.currentSha256, record.sources[update.path]);
		const source = await readFile(update.path, "utf8"), prior = beforeStructuredDocsCi(update.path, source);
		assert.equal(sha256(prior), update.previousSha256);
		assert.equal(beforeStructuredDocsCi(update.path, prior), prior);
		assert.equal(beforeStructuredDocsCi(update.path, source, update.currentSha256), source);
		const unknown = source + "\n/* unrecorded change */\n";
		assert.equal(beforeStructuredDocsCi(update.path, unknown), unknown);
		assert.throws(() => reverseStructuredDocsCiUpdate(unknown, update));
		for(const changed of [{ ...update, path: "unrelated.mjs" }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseStructuredDocsCiUpdate(source, changed));
	}
	const path = "docs/type-surface.v1.json", current = await readFile(path, "utf8");
	const prior = JSON.parse(beforeStructuredDocsCi(path, current));
	for(const evidence of prior.evidence) for(const file of evidence.files) file.sha256 = sha256(await readFile(file.path));
	assert.deepEqual(JSON.parse(current), prior);
	for(const name of ["component-structured-callable-documentation", "structured-docs-ci-evidence"])
		assert.equal(classifyRepositoryTest(`tests/${name}.test.mjs`), "contract");
});

test("structured documentation repair requires installed Node, TypeScript and three-browser execution", async () => {
	await assertStructuredDocsCiExecution(await read());
});

test("structured documentation repair rejects omitted execution and invented coverage", async () => {
	const record = await read();
	for(const mutate of [
		value => { value.acceptance = "pending"; }
		, value => { value.scope.runtimeChanges = true; }
		, value => { value.scope.installedSupportPromotions = 1; }
		, value => { value.run.exitCode = 1; }
		, value => { value.run.text += "unrecorded"; }
		, value => { value.run.text = value.run.text.replace("# skipped 0", "# skipped 1"); value.run.sha256 = sha256(value.run.text); }
		, value => { value.report.runs.pop(); }
		, value => { value.report.runs[0].documentation.executions = 0; }
		, value => { value.report.runs[1].documentation.sourceSha256 = "0".repeat(64); }
		, value => { value.report.runs[0].documentation.stdout = "not run"; }
		, value => { value.report.runs[1].documentation.installedPublicApi = false; }
		, value => { value.report.runs[0].typescript.executed = false; }
		, value => { value.report.runs[1].sourceRemovedBeforeInstallation = false; }
		, value => { value.report.runs[0].browsers.pop(); }
		, value => { delete value.report.runs[1].browsers[0].result.worker; }
		, value => { value.report.runs[0].browsers[2].result.react.checks--; }
		, value => { value.report.runs[0].consumerSha256 = "0".repeat(64); }
		, value => { value.report.runs[1].receipt.runtime.sha256 = "0".repeat(64); }
	]) {
		const changed = structuredClone(record); mutate(changed);
		await assert.rejects(() => assertStructuredDocsCiExecution(changed), undefined, mutate.toString());
	}
});
