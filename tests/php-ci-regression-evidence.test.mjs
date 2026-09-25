/**
 * Retain the PHP failures and successful repairs without rewriting old receipts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertPhpCiExecution, assertPhpCiIntegration, phpCiExecutionPath } from "./helpers/php-ci-regression-evidence.mjs";
import { beforePhpCiRegression, phpCiHistoryPath, reversePhpCiUpdate } from "./helpers/php-ci-regression-source-history.mjs";
import { beforePythonRecursiveCallables } from "./helpers/python-recursive-callable-source-history.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

test("PHP CI repairs bind failing and corrected runs while preserving every support cell", async () => {
	await assertPhpCiIntegration(await json(phpCiHistoryPath));
});

test("PHP CI repair evidence rejects missing failures, callbacks, cleanup and browsers", async () => {
	const original = await json(phpCiExecutionPath);
	await assertPhpCiExecution(original);
	for(const change of [
		record => { record.php.before.text = record.php.before.text.replaceAll("Deprecated:", "omitted:"); record.php.before.sha256 = sha256(record.php.before.text); }
		, record => { record.php.report.reports.pop(); }
		, record => { record.php.report.reports[0].faults.clears--; }
		, record => { record.php.report.reports[0].faults.sourceSha256 = "0".repeat(64); }
		, record => { record.php.probe85.text = record.php.probe85.text.replace('"faults":8080', '"faults":0'); record.php.probe85.sha256 = sha256(record.php.probe85.text); }
		, record => { record.fast.php85.exitCode = 1; }
		, record => { record.wasm.before.exitCode = 0; }
		, record => { record.wasm.installed.text = record.wasm.installed.text.replaceAll("Chromium", "omitted"); record.wasm.installed.sha256 = sha256(record.wasm.installed.text); }
		, record => { record.wasm.report.packages.pop(); }
		, record => { record.wasm.report.sourceHashes["src/release/php-wasm-copied-package.mjs"] = "0".repeat(64); }
	]) {
		const altered = structuredClone(original); change(altered);
		await assert.rejects(() => assertPhpCiExecution(altered));
	}
});

test("PHP CI source transitions reject unknown bytes and predecessor substitutions", async () => {
	for(const update of (await json(phpCiHistoryPath)).updates)
	{
		const source = beforePythonRecursiveCallables(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reversePhpCiUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforePhpCiRegression(update.path, source)), update.previousSha256);
		assert.equal(beforePhpCiRegression(update.path, source, update.currentSha256), source);
		const unrelated = source + "\n/* unrelated */\n";
		assert.equal(beforePhpCiRegression(update.path, unrelated), unrelated);
		assert.throws(() => reversePhpCiUpdate(unrelated, update));
		assert.throws(() => reversePhpCiUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
