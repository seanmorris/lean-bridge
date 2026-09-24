/**
 * Multiple original PHP-Wasm graph packages must share one runtime safely.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { checkPhpWasmGraphLoading } from "./helpers/php-wasm-graph-loading.mjs";
import { assertPhpWasmGraphLoadingEvidence } from "./helpers/php-wasm-graph-loading-receipt.mjs";

test("installed recursive and acyclic PHP-Wasm packages share initialization, loading and retirement", {
	skip: process.env.LEAN_BRIDGE_PHP_WASM_GRAPH_LOADING_TEST !== "1"
	, timeout: 900000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-php-wasm-graph-loading-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const report = await checkPhpWasmGraphLoading(root, message => { t.diagnostic(message); process.stderr.write(message + "\n"); });
	await saveLakeFile("build/recursive", "php-wasm-graph-loading.json", canonicalJson(report));
});

test("CI requires independent PHP-Wasm reproduction and installed shared-loading reports", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	for(const [flag, name] of [["REPRO", "reproduction"], ["LOADING", "loading"]])
	{
		assert.ok(workflow.includes(`          LEAN_BRIDGE_PHP_WASM_GRAPH_${flag}_TEST=1 node --test tests/php-wasm-graph-${name}.test.mjs\n`));
		assert.ok(workflow.includes(`          test -s build/recursive/php-wasm-graph-${name}.json\n`));
		assert.ok(workflow.includes(`            build/recursive/php-wasm-graph-${name}.json\n`));
	}
});

test("recursive PHP-Wasm retained evidence requires independent builds and shared runtime behavior", async () => {
	const record = JSON.parse(await readFile("docs/evidence/php-wasm-recursive-loading-20260924.json", "utf8"));
	await assertPhpWasmGraphLoadingEvidence(record);
	for(const mutate of [
		value => { value.finalAcceptance = true; }
		, value => { value.originalPackageRecordSha256 = "0".repeat(64); }
		, value => { value.reproduction.freshCompilation = false; }
		, value => { value.reproduction.rebuilt.observations[0].archives[1].sha256 = "0".repeat(64); }
		, value => { value.loading.packages.pop(); }
		, value => { value.loading.packages[0].source += "\n"; value.loading.packages[0].sourceSha256 = sha256(value.loading.packages[0].source); }
		, value => { value.loading.producersRemoved = false; }
		, value => { value.loading.composition[0].observed.snapshot[2] = 2; }
		, value => { value.loading.composition[0].retired.retirementRejections = 0; }
		, value => { value.loading.composition[0].phases[2].libraries = 9; }
		, value => { value.loading.conflicts[0].rejectedBeforeFetch = false; }
		, value => { value.loading.failures[0].handlerRestored = false; }
		, value => { value.loading.browser.executions[0].requests = []; }
		, value => { value.loading.installation.installedFiles = {}; }
		, value => { value.logs.loading.text = "No execution\n"; value.logs.loading.sha256 = sha256(value.logs.loading.text); }
	]) {
		const changed = structuredClone(record); mutate(changed);
		changed.reproductionSha256 = sha256(canonicalJson(changed.reproduction));
		changed.loadingSha256 = sha256(canonicalJson(changed.loading));
		await assert.rejects(() => assertPhpWasmGraphLoadingEvidence(changed));
	}
});
