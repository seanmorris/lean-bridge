/**
 * Preserve old receipts while proving the measured wasm32 and graph additions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { assertPhpWasmSharedRegressionEvidence, assertPhpWasmSharedSourceTransition, beforePhpWasmSharedVerification } from "./helpers/php-wasm-shared-regression-receipt.mjs";
import { phpWasmPreGraphSources } from "./helpers/php-wasm-legacy-comparison.mjs";

const recordPath = "docs/evidence/php-wasm-shared-regressions-20260924.json";

test("the existing PHP-Wasm CI gate requires and retains its shared regression report", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	assert.ok(workflow.includes('LEAN_BRIDGE_PHP_WASM_ORDINARY_TEST: "1"'));
	assert.ok(workflow.includes('LEAN_BRIDGE_PHP_WASM_BROWSER_TEST: "1"'));
	assert.ok(workflow.includes("          node --test tests/php-wasm-ordinary.test.mjs\n          test -s build/recursive/php-wasm-shared-regressions.json\n"));
	assert.ok(workflow.includes("            build/recursive/php-wasm-shared-regressions.json\n"));
});

test("PHP-Wasm shared regressions retain original sources, package bytes and installed browser checks", async () => {
	const record = JSON.parse(await readFile(recordPath));
	await assertPhpWasmSharedRegressionEvidence(record);
	const { sources } = await phpWasmPreGraphSources();
	for(const [path, item] of Object.entries(sources))
	{
		const source = await readFile(path, "utf8");
		assert.equal(await assertPhpWasmSharedSourceTransition(path, source, item.sha256), true);
		await assert.rejects(assertPhpWasmSharedSourceTransition(path, source + "\n", item.sha256));
		assert.equal(await assertPhpWasmSharedSourceTransition(path, source, "0".repeat(64)), false);
	}
	assert.equal(await assertPhpWasmSharedSourceTransition("src/build/native-project.mjs", "changed", "0".repeat(64)), false);
	for(const [path, hash] of Object.entries(record.verifierPredecessors))
	{
		const source = await readFile(path, "utf8"), previous = beforePhpWasmSharedVerification(path, source);
		assert.equal(sha256(previous), hash);
		assert.equal(await assertPhpWasmSharedSourceTransition(path, source, hash), true);
		assert.equal(await assertPhpWasmSharedSourceTransition(path, source + "\n", hash), false);
		assert.equal(beforePhpWasmSharedVerification(path, previous), previous);
	}
});

test("PHP-Wasm shared regression evidence rejects omitted sources and weakened package comparisons", async () => {
	const record = JSON.parse(await readFile(recordPath));
	const mutations = [
		value => delete value.report.sourceHashes["src/build/php-wasm-copied-artifacts.mjs"]
		, value => value.report.packages.pop()
		, value => value.report.native[0].outputs.pop()
		, value => { value.report.packages[0].previousReaderAccepted = false; }
		, value => { value.report.packages[0].exports = 1; }
		, value => { value.report.packages[0].current.archives[2].sha256 = "0".repeat(64); }
		, value => { value.report.packages[0].current.files["composer/src/Api.php"].sha256 = "0".repeat(64); }
		, value => { value.report.packages[0].changedFiles["runtime/package/index.mjs"].current += "\n"; }
		, value => { value.verifierPredecessors["tests/php-wasm-ordinary.test.mjs"] = "0".repeat(64); }
		, value => { value.executionLog.text = value.executionLog.text.replace(/Chromium/g, "omitted"); value.executionLog.sha256 = sha256(value.executionLog.text); }
	];
	for(const mutate of mutations)
	{
		const changed = structuredClone(record); mutate(changed);
		changed.reportSha256 = sha256(canonicalJson(changed.report));
		await assert.rejects(assertPhpWasmSharedRegressionEvidence(changed));
	}
});
