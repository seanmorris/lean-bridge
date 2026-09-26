/**
 * Bind recursive WIT support to original packages and reversible source history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import { assertWitRecursiveCallablePackages } from "./wit-recursive-callable-receipt.mjs";
import { assertWitRecursiveNativeProbes, assertWitRecursiveFaultProbes } from "./wit-recursive-callable-probes.mjs";
import { assertWitStructuredCallableExecution, witStructuredCallableExecutionPath } from "./wit-structured-callable-evidence.mjs";
import { assertPhpWasmRecursiveCallableIntegration } from "./php-wasm-recursive-callable-evidence.mjs";
import { phpWasmRecursiveCallableHistoryPath } from "./php-wasm-recursive-callable-source-history.mjs";
import { witRecursiveCallableChangedPaths, reverseWitRecursiveCallableUpdate } from "./wit-recursive-callable-source-history.mjs";

export const witRecursiveCallableBaseline = "7daacb859a45f3c90ba8739bd9396fa5d970813d";
export const witRecursiveCallableExecutionPath = "docs/evidence/wit-recursive-callables-20260926.json";
export const witRecursiveCallableScope = {
	profiles: ["wit-wasi"], paths: ["ordinary-source", "reviewed-ir"]
	, shapes: ["alias", "array", "list", "option", "record", "recursive", "result", "tuple", "variant"]
	, positions: ["callback-parameter", "callback-result"]
	, recursiveCallbacks: true, ownedResourceAggregates: false
};
export const witRecursiveCallableAddedPaths = [
	witRecursiveCallableExecutionPath
	, "docs/evidence/wit-recursive-callables-20260926.md"
	, ...["host", "model", "package", "session", "typed"].map(name => `src/backends/wit/callable-graph-${name}.mjs`)
	, "tests/fixtures/documentation/consumers/wit-wasi/recursive-callables.c"
	, ...["native", "typed"].map(name => `tests/fixtures/structured-callable-consumers/wit-recursive-${name}.c`)
	, ...["docs", "faults", "malformed", "mixed", "packages", "values", "receipt", "probes", "evidence", "source-history"].map(name => `tests/helpers/wit-recursive-callable-${name}.mjs`)
	, ...["model", "host", "native", "faults", "package", "evidence"].map(name => `tests/wit-recursive-callable-${name}.test.mjs`)
].sort();
export const witRecursiveCallableProjectionPaths = [
	...witRecursiveCallableAddedPaths.filter(path => path.startsWith("src/"))
	, ...witRecursiveCallableChangedPaths.filter(path => path.startsWith("src/") && path !== "src/adoption/test-profiles.mjs")
].sort();
export const witRecursiveCallableRegressionCommand = "LEAN_BRIDGE_WIT_GRAPH_INSTALLED_TEST=1 LEAN_BRIDGE_WIT_STRUCTURED_CALLABLE_TEST=1 node --test --test-concurrency=1 --test-name-pattern='source-free installation|preserve eight shapes|callback-only nested aliases|documentation execute' tests/wit-copied-graph-package.test.mjs tests/wit-structured-callables.test.mjs tests/wit-structured-aliases.test.mjs tests/wit-structured-documentation.test.mjs";
const authenticated = async (entry, path) => {
	assert.equal(entry.path, path); const bytes = await readFile(path);
	assert.equal(sha256(bytes), entry.sha256); return JSON.parse(bytes);
};
const passing = (run, command, count) => {
	assert.equal(run.exitCode, 0); assert.equal(run.command, command); assert.equal(sha256(run.text), run.sha256);
	for(const [name, value] of Object.entries({ tests: count, pass: count, fail: 0, cancelled: 0, skipped: 0 }))
		assert.match(run.text, new RegExp("^# " + name + " " + value + "$", "mu"));
};
const copiedRegression = async report => {
	assert.equal(report.schemaVersion, 1); assert.equal(report.compiledLean, true); assert.equal(report.installedPackage, true);
	assert.deepEqual(report.observations.map(run => run.reviewed), [false, true]);
	for(const run of report.observations)
	{
		assert.equal(run.exports, 18); assert.equal(run.checkedSourceUnchanged, true);
		assert.equal(run.deterministicReassembly, true); assert.equal(run.compilerFreeReassembly, true);
		assert.equal(run.rejectsRegeneratedSourceDrift, 8);
		const { installed, package: pkg } = run;
		assert.equal(pkg.artifacts[0].sha256, installed.archiveSha256);
		for(const flag of ["sourceFreeInstallation", "compilerFreeExecution", "sourceAndHandoffRemovedBeforeExecution", "publicHeadersOnly", "offline", "nodelete"])
			assert.equal(installed[flag], true, flag);
		assert.equal(installed.repeatExecutions, 2); assert.equal(installed.observations.length, 2);
		assert.deepEqual(installed.observations[0], installed.observations[1]);
		const { loadedLibraries, ...values } = installed.observations[0].values;
		assert.ok(loadedLibraries.length >= 6);
		assert.deepEqual(values, { calls: 33, checks: 73, compiledLean: true, exports: 18, independentResult: true, rejections: 11, scalarTypes: 19, trapRecovery: true });
		assert.deepEqual(installed.observations[0].lifetime, { notPreloaded: true, resultAfterClose: true, cleanupAfterDlclose: true });
		assert.deepEqual(installed.faults, { limit: { limitRecoverable: true, twoSessionsUsable: true }, malformed: { runtimeRetired: true, twoSessionsRejected: true } });
		for(const [name, fixture] of [["consumer", "wit-installed"], ["lifetime", "wit-library-lifetime"], ["fault", "wit-result-fault"], ["result-fault.so", "wit-result-fault"]])
			assert.equal(installed.probes[name].sourceSha256, sha256(await readFile(`tests/fixtures/recursive-consumers/${fixture}.c`)));
		assert.deepEqual(installed.libraries, Object.fromEntries(Object.entries(installed.packageReceipt.files).filter(([path]) => /^lib\/[^/]+\.so(?:\.\d+)*$/u.test(path))));
		assert.equal(Object.keys(installed.libraries).length, 6);
		assert.equal(installed.packageReceipt.files["native-wit-adapter.json"].sha256, sha256(canonicalJson(installed.compiled)));
	}
};

/**
 * Require original execution logs, reconstructible packages and fresh regressions.
 *
 * @param record - Frozen observations and exact production source identities.
 */
export const assertWitRecursiveCallableExecution = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "wit-recursive-callable-execution");
	assert.equal(record.baselineRevision, witRecursiveCallableBaseline); assert.deepEqual(record.scope, witRecursiveCallableScope);
	passing(record.generated, "npm run test:wit-recursive-generated", 10);
	passing(record.installed, "npm run test:wit-recursive-packages", 3);
	passing(record.regressions, witRecursiveCallableRegressionCommand, 4);
	assert.deepEqual(Object.keys(record.projectionSources).sort(), witRecursiveCallableProjectionPaths);
	for(const [path, digest] of Object.entries(record.projectionSources)) assert.equal(sha256(await readFile(path)), digest, path);
	assert.deepEqual(Object.keys(record.generated.reports).sort(), ["faults", "native"]);
	assertWitRecursiveFaultProbes(record.generated.reports.faults);
	await assertWitRecursiveNativeProbes(record.generated.reports.native);
	assert.deepEqual(Object.keys(record.installed.reports).sort(), ["mixed", "recursive"]);
	for(const [name, mixed] of [["recursive", false], ["mixed", true]]) await assertWitRecursiveCallablePackages(record.installed.reports[name], mixed);
	await copiedRegression(record.regressions.copied);
	const previous = await authenticated(record.previousStructured, witStructuredCallableExecutionPath);
	await assertWitStructuredCallableExecution({ ...previous
		, report: record.regressions.structured
		, aliases: record.regressions.aliases
		, documentation: record.regressions.documentation });
};

/**
 * Promote exactly four WIT recursive callback cells and retain all older evidence.
 *
 * @param record - Immutable execution reference and whole-file source transitions.
 */
export const assertWitRecursiveCallableIntegration = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "wit-recursive-callable-integration");
	assert.equal(record.baselineRevision, witRecursiveCallableBaseline); assert.deepEqual(record.scope, witRecursiveCallableScope);
	assert.deepEqual(record.inventory, { previousVersion: "0.106.0", version: "0.107.0", previousInstalled: 4826, installed: 4830, total: 6562 });
	const previous = await authenticated(record.previous, phpWasmRecursiveCallableHistoryPath);
	const execution = await authenticated(record.execution, witRecursiveCallableExecutionPath);
	await assertWitRecursiveCallableExecution(execution);
	assert.deepEqual(record.updates.map(update => update.path).sort(), witRecursiveCallableChangedPaths);
	assert.deepEqual(Object.keys(record.additions).sort(), witRecursiveCallableAddedPaths);
	const paths = [...new Set([...Object.keys(previous.sourceHashes), ...witRecursiveCallableChangedPaths, ...witRecursiveCallableAddedPaths])].sort();
	assert.deepEqual(Object.keys(record.sourceHashes).sort(), paths);
	for(const path of paths) assert.equal(sha256(await readFile(path)), record.sourceHashes[path], path);
	const restored = {};
	for(const update of record.updates)
	{
		assert.equal(update.currentSha256, record.sourceHashes[update.path]);
		if(previous.sourceHashes[update.path]) assert.equal(update.previousSha256, previous.sourceHashes[update.path]);
		restored[update.path] = reverseWitRecursiveCallableUpdate(await readFile(update.path, "utf8"), update);
	}
	for(const [path, digest] of Object.entries(record.additions)) assert.equal(digest, record.sourceHashes[path]);
	const { document, ...contracts } = await readTypeSurface(), old = JSON.parse(restored["docs/type-surface.v1.json"]);
	assert.equal(document.contractVersion, "0.107.0"); assert.equal(old.contractVersion, "0.106.0");
	const cells = typeSurfaceCells(document, contracts), oldCells = typeSurfaceCells(old, contracts);
	const count = values => values.filter(cell => cell.stages.installedExecution.state === "passed").length;
	assert.equal(count(cells), 4830); assert.equal(count(oldCells), 4826); assert.equal(cells.length, 6562);
	const id = "wit-wasi-recursive-callables-installed";
	const promoted = cells.filter(cell => cell.stages.installedExecution.evidence.includes(id));
	assert.equal(promoted.length, 4);
	for(const cell of promoted)
	{
		assert.equal(cell.profile, "wit-wasi"); assert.equal(cell.shape, "recursive");
		assert.ok(witRecursiveCallableScope.paths.includes(cell.path)); assert.ok(witRecursiveCallableScope.positions.includes(cell.position));
		assert.ok(cell.hostType && cell.conversionNote);
		for(const stage of Object.values(cell.stages)) assert.deepEqual({ state: stage.state, evidence: stage.evidence }, { state: "passed", evidence: [id] });
	}
	const oldById = new Map(oldCells.map(cell => [cell.id, cell]));
	for(const cell of cells.filter(cell => !promoted.includes(cell))) assert.deepEqual(cell, oldById.get(cell.id), cell.id);
	const recursive = cells.filter(cell => cell.shape === "recursive");
	assert.equal(count(recursive), 170); assert.equal(new Set(recursive.map(cell => cell.profile)).size, 17);
	const entry = document.evidence.find(item => item.id === id);
	assert.deepEqual(entry.artifacts, Object.entries(execution.installed.reports).flatMap(([kind, report]) => report.observations.flatMap(run => run.package.artifacts.map(artifact => ({ path: `wit-wasi/${kind}/${run.reviewed ? "reviewed-ir" : "ordinary-source"}/${artifact.path}`, sha256: artifact.sha256 })))));
	assert.ok(entry.files.some(file => file.path === witRecursiveCallableExecutionPath));
	await assertPhpWasmRecursiveCallableIntegration(previous);
};
