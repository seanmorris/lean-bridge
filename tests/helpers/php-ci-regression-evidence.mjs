/**
 * Authenticate the PHP regression repairs without changing type support claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import { assertClosureThreadIntegration } from "./closure-thread-evidence.mjs";
import { closureThreadHistoryPath } from "./closure-thread-source-history.mjs";
import { assertPhpStructuredCallableExecution, phpStructuredCallableExecutionPath } from "./php-structured-callable-evidence.mjs";
import { assertPhpWasmLegacyPackageComparison, phpWasmPreGraphSources } from "./php-wasm-legacy-comparison.mjs";
import { phpCiChangedPaths, reversePhpCiUpdate } from "./php-ci-regression-source-history.mjs";

export const phpCiBaseline = "f61063252acf464ba4306885ddbf141b29bbdf73";
export const phpCiExecutionPath = "docs/evidence/php-ci-regressions-20260925.json";
export const phpCiAddedPaths = [
	phpCiExecutionPath, "docs/evidence/php-ci-regressions-20260925.md"
	, "tests/php-ci-regressions.test.mjs"
	, "tests/php-ci-regression-evidence.test.mjs"
	, "tests/helpers/php-ci-regression-evidence.mjs"
	, "tests/helpers/php-ci-regression-source-history.mjs"
].sort();

const authenticated = async (entry, path) => {
	assert.equal(entry.path, path); const bytes = await readFile(path);
	assert.equal(sha256(bytes), entry.sha256); return JSON.parse(bytes);
};
const log = (run, counts) => {
	assert.equal(sha256(run.text), run.sha256);
	for(const [name, count] of Object.entries(counts))
		assert.match(run.text, new RegExp(`^# ${name} ${count}$`, "mu"));
};
const passed = (run, count) => {
	assert.equal(run.exitCode, 0);
	log(run, { tests: count, pass: count, fail: 0, cancelled: 0, skipped: 0 });
};

/**
 * Check original failure observations, installed repairs and browser execution.
 *
 * @param record - Terminal logs and original installed-package reports.
 */
export const assertPhpCiExecution = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "php-ci-regression-execution");
	assert.equal(record.baselineRevision, phpCiBaseline);
	assert.deepEqual(record.ci, { run: 36127768373
		, revision: "136e4942ed32bd923cb721eb80aa038cfaa07f74"
		, passedJobs: 16
		, failedJobs: ["Native PHP and PHP-Wasm", "Publish consumer support summary"] });
	const old = await authenticated(record.previousNativeExecution, phpStructuredCallableExecutionPath);
	assert.equal(record.wasm.before.exitCode, 1);
	log(record.wasm.before, { tests: 5, pass: 4, fail: 1, cancelled: 0, skipped: 0 });
	assert.match(record.wasm.before.text, /assertPhpWasmLegacyPackageComparison/u);
	assert.match(record.wasm.before.text, /bytes: 26603/u);
	assert.match(record.wasm.before.text, /bytes: 25280/u);
	assert.equal(record.php.before.exitCode, 1);
	log(record.php.before, { tests: 1, pass: 0, fail: 1, cancelled: 0, skipped: 0 });
	assert.match(record.php.before.text, /Deprecated: Calling FFI::cast\(\) statically is deprecated/u);
	for(const run of [record.fast.default, record.fast.php85]) passed(run, 3);
	assert.ok(record.fast.php85.command.includes("php-8.5.10-ffi/bin/php"));
	passed(record.php.installed, 1); passed(record.php.probe85, 1);
	assert.equal(sha256(record.php.probe85.script), record.php.probe85.scriptSha256);
	assert.match(record.php.probe85.script, /php-8\.5\.10-ffi\/bin\/php/u);
	assert.doesNotMatch(record.php.probe85.text, /Deprecated:|Warning:|Notice:/u);
	const probeResults = [...record.php.probe85.text.matchAll(/PROBE_STDOUT_BEGIN\n([^\n]+)\n/gu)].map(match => JSON.parse(match[1]));
	assert.equal(probeResults.length, 2);
	for(const observed of probeResults)
	{
		assert.equal(observed.checks, 174479); assert.equal(observed.faults, 8080);
		assert.equal(observed.clears, 8144); assert.equal(observed.closes, 9274);
		assert.equal(observed.malformed, 15); assert.equal(observed.conversionMethods, 64);
	}
	assert.deepEqual(probeResults[0], probeResults[1]);
	assert.ok(record.php.installed.command.includes("LEAN_BRIDGE_PHP_STRUCTURED_CALLABLE_TEST=1"));
	await assertPhpStructuredCallableExecution({ ...old, installed: record.php.installed, report: record.php.report }
		, { probeSource: await readFile("tests/fixtures/structured-callable-consumers/php-faults.php", "utf8") });
	passed(record.wasm.installed, 5);
	for(const flag of ["LEAN_BRIDGE_PHP_WASM_ORDINARY_TEST=1", "LEAN_BRIDGE_PHP_WASM_BROWSER_TEST=1"])
		assert.ok(record.wasm.installed.command.includes(flag));
	for(const loading of ["startup", "lazy"]) for(const mode of ["weak", "strict"])
		assert.match(record.wasm.installed.text, new RegExp(`Chromium [^\\n]+ ${loading}/${mode}: 88 exports, 20 requests, one runtime and two extensions fetched once`, "u"));
	const report = record.wasm.report;
	assert.equal(report.kind, "php-wasm-pre-graph-comparison"); assert.equal(report.compiledLean, true);
	assert.equal(record.wasm.reportSha256, sha256(canonicalJson(report)));
	assert.deepEqual(report.packages.map(run => run.name), ["Willow", "Aspen"]);
	const { sources } = await phpWasmPreGraphSources();
	for(const run of report.packages) await assertPhpWasmLegacyPackageComparison(run, sources);
	const packagePath = "src/release/php-wasm-copied-package.mjs";
	assert.equal(report.sourceHashes[packagePath], sha256(await readFile(packagePath)));
	assert.equal(report.sourceHashes["tests/helpers/php-wasm-legacy-comparison.mjs"], sha256(await readFile("tests/helpers/php-wasm-legacy-comparison.mjs")));
};

/**
 * Authenticate each source change and preserve the complete previous inventory.
 *
 * @param record - Exact transitions linked to immutable predecessor receipts.
 */
export const assertPhpCiIntegration = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "php-ci-regression-integration"); assert.equal(record.baselineRevision, phpCiBaseline);
	const previous = await authenticated(record.previous, closureThreadHistoryPath);
	const execution = await authenticated(record.execution, phpCiExecutionPath);
	await assertPhpCiExecution(execution);
	assert.deepEqual(record.updates.map(update => update.path).sort(), phpCiChangedPaths);
	assert.deepEqual(Object.keys(record.additions).sort(), phpCiAddedPaths);
	const paths = [...new Set([...Object.keys(previous.sourceHashes), ...phpCiChangedPaths, ...phpCiAddedPaths])].sort();
	assert.deepEqual(Object.keys(record.sourceHashes).sort(), paths);
	for(const path of paths) assert.equal(sha256(await readFile(path)), record.sourceHashes[path], path);
	const restored = {};
	for(const update of record.updates)
	{
		assert.equal(update.currentSha256, record.sourceHashes[update.path]);
		assert.equal(update.previousSha256, previous.sourceHashes[update.path]);
		restored[update.path] = reversePhpCiUpdate(await readFile(update.path, "utf8"), update);
	}
	for(const [path, hash] of Object.entries(record.additions)) assert.equal(hash, record.sourceHashes[path]);
	const { document, ...contracts } = await readTypeSurface(), old = JSON.parse(restored["docs/type-surface.v1.json"]);
	assert.equal(old.contractVersion, "0.98.1"); assert.equal(document.contractVersion, "0.98.2");
	const cells = typeSurfaceCells(document, contracts);
	assert.deepEqual(cells, typeSurfaceCells(old, contracts)); assert.equal(cells.length, 6562);
	assert.equal(cells.filter(cell => cell.stages.installedExecution.state === "passed").length, 4790);
	assert.deepEqual(record.updates.filter(update => update.path.startsWith("src/")).map(update => update.path), ["src/adoption/test-profiles.mjs"]);
	await assertClosureThreadIntegration(previous);
};
