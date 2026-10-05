/**
 * Reject incomplete closure-lifetime evidence and unrelated source rewrites.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertClosureThreadCodegen, assertClosureThreadExecution, assertClosureThreadIntegration, closureThreadCodegenPath, closureThreadExecutionPath } from "./helpers/closure-thread-evidence.mjs";
import { beforeClosureThreadLifetime, closureThreadHistoryPath, reverseClosureThreadUpdate } from "./helpers/closure-thread-source-history.mjs";
import { beforePhpCiRegression } from "./helpers/php-ci-regression-source-history.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

test("closure lifetime repair retains every existing type cell and predecessor receipt", async () => {
	await assertClosureThreadIntegration(await json(closureThreadHistoryPath));
});

test("closure lifetime evidence requires both source paths, widths and failure controls", async () => {
	const original = await json(closureThreadExecutionPath);
	await assertClosureThreadExecution(original);
	for(const change of [
		record => { record.baseline.reports.pop(); }
		, record => { record.fixed.reports.pop(); }
		, record => { record.baseline.reports[0].observed.wordAccepted = 0; }
		, record => { record.fixed.reports[0].observed.stringRejected--; }
		, record => { record.fixed.reports[0].observed.identities++; }
		, record => { record.fixed.reports[0].headersAndArchivesRemoved = false; }
		, record => { record.fixed.reports[0].repeatedExecutions--; }
		, record => { record.fixed.reports[0].packages[0].artifacts[0].bytes = 0; }
		, record => { record.fixed.reports[0].consumerSha256 = "0".repeat(64); }
		, record => { delete record.structured.reports.cpp; }
		, record => { record.structured.reports.c[0].checks--; }
		, record => { record.structured.reports.cpp[0].result.allocationFailures--; }
		, record => { record.installed.text = record.installed.text.replace('"replacements":32', '"replacements":0'); record.installed.sha256 = sha256(record.installed.text); }
		, record => { record.installed.text = record.installed.text.replace("# skipped 0", "# skipped 1"); record.installed.sha256 = sha256(record.installed.text); }
	]) {
		const altered = structuredClone(original); change(altered);
		await assert.rejects(() => assertClosureThreadExecution(altered));
	}
	const codegen = await json(closureThreadCodegenPath); assertClosureThreadCodegen(codegen);
	for(const change of [
		record => { record.rows.pop(); }
		, record => { record.syntheticModels = false; }
		, record => { record.installedAcceptance = true; }
		, record => { record.rows[0].previous.sha256 = "0".repeat(64); }
		, record => { record.rows[0].current.bytes++; }
	]) {
		const altered = structuredClone(codegen); change(altered);
		assert.throws(() => assertClosureThreadCodegen(altered));
	}
});

test("closure lifetime source history rejects unknown edits and predecessor identities", async () => {
	const record = await json(closureThreadHistoryPath);
	for(const update of record.updates)
	{
		const source = beforePhpCiRegression(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseClosureThreadUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeClosureThreadLifetime(update.path, source)), update.previousSha256);
		assert.equal(beforeClosureThreadLifetime(update.path, source, update.currentSha256), source);
		const altered = source + "\n/* unrelated */\n";
		assert.equal(beforeClosureThreadLifetime(update.path, altered), altered);
		assert.throws(() => reverseClosureThreadUpdate(altered, update));
		assert.throws(() => reverseClosureThreadUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
