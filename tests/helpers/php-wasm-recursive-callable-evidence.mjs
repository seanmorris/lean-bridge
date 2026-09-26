/**
 * Bind recursive PHP-Wasm acceptance to installed bytes and reversible history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import { assertPhpWasmRecursiveProbes } from "./php-wasm-recursive-callable-probes.mjs";
import { assertPhpWasmRecursivePackages } from "./php-wasm-recursive-callable-receipt.mjs";
import { assertPhpWasmGraphPackageEvidence } from "./php-wasm-graph-receipt.mjs";
import { assertPhpWasmStructuredCallableExecution, phpWasmStructuredCallableExecutionPath } from "./php-wasm-structured-callable-evidence.mjs";
import { assertPhpRecursiveCallableIntegration } from "./php-recursive-callable-evidence.mjs";
import { phpRecursiveCallableHistoryPath } from "./php-recursive-callable-source-history.mjs";
import { phpWasmRecursiveCallableChangedPaths, reversePhpWasmRecursiveCallableUpdate } from "./php-wasm-recursive-callable-source-history.mjs";

export const phpWasmRecursiveCallableBaseline = "0af020b28bc69bb97f678a814b7b567eac13c559";
export const phpWasmRecursiveCallableExecutionPath = "docs/evidence/php-wasm-recursive-callables-20260926.json";
export const phpWasmRecursiveCopiedExecutionPath = "docs/evidence/php-wasm-recursive-packages-20260924.json";
export const phpWasmRecursiveCallableScope = {
	profiles: ["php-wasm"], paths: ["ordinary-source", "reviewed-ir"]
	, shapes: ["alias", "array", "list", "option", "record", "recursive", "result", "tuple", "variant"]
	, positions: ["callback-parameter", "callback-result"]
	, recursiveCallbacks: true, ownedResourceAggregates: false
};
export const phpWasmRecursiveCallableAddedPaths = [
	phpWasmRecursiveCallableExecutionPath
	, "docs/evidence/php-wasm-recursive-callables-20260926.md"
	, ...["", "-model", "-php", "-runtime", "-calls"].map(suffix => `src/backends/php/callable-graph-zend${suffix}.mjs`)
	, ...["bailouts", "construction", "generated", "malformed", "ownership", "replies", "wrapper"].map(name => `tests/fixtures/structured-callable-consumers/php-wasm-recursive-${name}.php`)
	, "tests/fixtures/structured-callable-consumers/php-wasm-recursive-host.mjs"
	, ...["fixture", "generated", "hosts", "malformed", "ownership", "packages", "replies", "probes", "receipt", "evidence", "source-history"].map(name => `tests/helpers/php-wasm-recursive-callable-${name}.mjs`)
	, ...["contract", "generated", "packages", "wrappers", "evidence"].map(name => `tests/php-wasm-recursive-callable-${name}.test.mjs`)
].sort();
export const phpWasmRecursiveCallableProjectionPaths = [
	...phpWasmRecursiveCallableAddedPaths.filter(path => path.startsWith("src/"))
	, ...phpWasmRecursiveCallableChangedPaths.filter(path => path.startsWith("src/") && path !== "src/adoption/test-profiles.mjs")
].sort();
const authenticated = async (entry, path) => {
	assert.equal(entry.path, path); const bytes = await readFile(path);
	assert.equal(sha256(bytes), entry.sha256); return JSON.parse(bytes);
};
const passing = (run, command, count) => {
	assert.equal(run.exitCode, 0); assert.equal(run.command, command); assert.equal(sha256(run.text), run.sha256);
	for(const [name, value] of Object.entries({ tests: count, pass: count, fail: 0, cancelled: 0, skipped: 0 }))
		assert.match(run.text, new RegExp("^# " + name + " " + value + "$", "mu"));
};

/**
 * Require original package executions, instrumented probes and fresh regressions.
 *
 * @param record - Frozen logs, reports and exact source identities.
 */
export const assertPhpWasmRecursiveCallableExecution = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "php-wasm-recursive-callable-execution");
	assert.equal(record.baselineRevision, phpWasmRecursiveCallableBaseline); assert.deepEqual(record.scope, phpWasmRecursiveCallableScope);
	passing(record.generated, "npm run test:php-wasm-recursive-generated", 10);
	passing(record.installed, "npm run test:php-wasm-recursive-packages", 2);
	passing(record.regressions, "LEAN_BRIDGE_PHP_WASM_GRAPH_PACKAGE_TEST=1 LEAN_BRIDGE_PHP_WASM_STRUCTURED_CALLABLE_TEST=1 node --test --test-concurrency=1 --test-name-pattern='offline installation|preserve eight copied shapes' tests/php-wasm-graph-package.test.mjs tests/php-wasm-structured-callables.test.mjs", 2);
	assert.deepEqual(Object.keys(record.projectionSources).sort(), phpWasmRecursiveCallableProjectionPaths);
	for(const [path, digest] of Object.entries(record.projectionSources)) assert.equal(sha256(await readFile(path)), digest, path);
	await assertPhpWasmRecursiveProbes(record.generated.report);
	assert.deepEqual(Object.keys(record.installed.reports).sort(), ["mixed", "recursive"]);
	for(const [kind, mixed] of [["recursive", false], ["mixed", true]])
	{
		const report = record.installed.reports[kind];
		assert.equal(report.runtimeIdentity, record.generated.report.runtimeIdentity);
		await assertPhpWasmRecursivePackages(report, mixed);
	}
	const copied = await authenticated(record.previousCopied, phpWasmRecursiveCopiedExecutionPath);
	const structured = await authenticated(record.previousStructured, phpWasmStructuredCallableExecutionPath);
	await assertPhpWasmGraphPackageEvidence({ ...copied, report: record.regressions.copied, reportSha256: sha256(canonicalJson(record.regressions.copied)) });
	await assertPhpWasmStructuredCallableExecution({ ...structured, report: record.regressions.structured });
};

/**
 * Promote only four PHP-Wasm recursive callback cells and recheck all predecessors.
 *
 * @param record - Exact source transitions and immutable execution reference.
 */
export const assertPhpWasmRecursiveCallableIntegration = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "php-wasm-recursive-callable-integration");
	assert.equal(record.baselineRevision, phpWasmRecursiveCallableBaseline); assert.deepEqual(record.scope, phpWasmRecursiveCallableScope);
	assert.deepEqual(record.inventory, { previousVersion: "0.105.0", version: "0.106.0", previousInstalled: 4822, installed: 4826, total: 6562 });
	const previous = await authenticated(record.previous, phpRecursiveCallableHistoryPath);
	const execution = await authenticated(record.execution, phpWasmRecursiveCallableExecutionPath);
	await assertPhpWasmRecursiveCallableExecution(execution);
	assert.deepEqual(record.updates.map(update => update.path).sort(), phpWasmRecursiveCallableChangedPaths);
	assert.deepEqual(Object.keys(record.additions).sort(), phpWasmRecursiveCallableAddedPaths);
	const paths = [...new Set([...Object.keys(previous.sourceHashes), ...phpWasmRecursiveCallableChangedPaths, ...phpWasmRecursiveCallableAddedPaths])].sort();
	assert.deepEqual(Object.keys(record.sourceHashes).sort(), paths);
	for(const path of paths) assert.equal(sha256(await readFile(path)), record.sourceHashes[path], path);
	const restored = {};
	for(const update of record.updates)
	{
		assert.equal(update.currentSha256, record.sourceHashes[update.path]);
		if(previous.sourceHashes[update.path]) assert.equal(update.previousSha256, previous.sourceHashes[update.path]);
		restored[update.path] = reversePhpWasmRecursiveCallableUpdate(await readFile(update.path, "utf8"), update);
	}
	for(const [path, digest] of Object.entries(record.additions)) assert.equal(digest, record.sourceHashes[path]);
	const { document, ...contracts } = await readTypeSurface(), old = JSON.parse(restored["docs/type-surface.v1.json"]);
	assert.equal(document.contractVersion, "0.106.0"); assert.equal(old.contractVersion, "0.105.0");
	const cells = typeSurfaceCells(document, contracts), oldCells = typeSurfaceCells(old, contracts);
	const count = values => values.filter(cell => cell.stages.installedExecution.state === "passed").length;
	assert.equal(count(cells), 4826); assert.equal(count(oldCells), 4822); assert.equal(cells.length, 6562);
	const id = "php-wasm-recursive-callables-installed";
	const promoted = cells.filter(cell => cell.stages.installedExecution.evidence.includes(id));
	assert.equal(promoted.length, 4);
	for(const cell of promoted)
	{
		assert.equal(cell.profile, "php-wasm"); assert.equal(cell.shape, "recursive");
		assert.ok(phpWasmRecursiveCallableScope.paths.includes(cell.path)); assert.ok(phpWasmRecursiveCallableScope.positions.includes(cell.position));
		assert.ok(cell.hostType && cell.conversionNote);
		for(const stage of Object.values(cell.stages)) assert.deepEqual({ state: stage.state, evidence: stage.evidence }, { state: "passed", evidence: [id] });
	}
	const oldById = new Map(oldCells.map(cell => [cell.id, cell]));
	for(const cell of cells.filter(cell => !promoted.includes(cell))) assert.deepEqual(cell, oldById.get(cell.id), cell.id);
	const entry = document.evidence.find(item => item.id === id);
	assert.deepEqual(entry.artifacts, Object.entries(execution.installed.reports).flatMap(([kind, report]) => report.observations.flatMap(run => run.archives.map(archive => ({ path: "php-wasm/" + kind + "/" + run.path + "/" + archive.archive, sha256: archive.sha256 })))));
	assert.ok(entry.files.some(file => file.path === phpWasmRecursiveCallableExecutionPath));
	await assertPhpRecursiveCallableIntegration(previous);
};
