/**
 * Bind installed structured Rust callables to exact sources, archives and cells.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import { structuredCallableExports } from "./structured-callable-fixture.mjs";
import { rustCallableSignatures } from "./rust-callable-fixture.mjs";
import { assertRustStructuredCodegenRegression } from "./rust-structured-callable-regression.mjs";
import { cppStructuredCallableHistoryPath } from "./cpp-structured-callable-source-history.mjs";
import { assertCppStructuredCallableIntegration } from "./cpp-structured-callable-evidence.mjs";
import { rustStructuredCallableChangedPaths, reverseRustStructuredCallableUpdate } from "./rust-structured-callable-source-history.mjs";

export const rustStructuredCallableExecutionPath = "docs/evidence/rust-structured-callables-20260924.json";
export const rustStructuredCodegenPath = "docs/evidence/rust-structured-codegen-regression-20260924.json";
export const rustStructuredCallableAddedPaths = [
	rustStructuredCallableExecutionPath, rustStructuredCodegenPath
	, "docs/evidence/rust-structured-callables-20260924.md"
	, "tests/rust-structured-callable-contract.test.mjs"
	, "tests/rust-structured-callable-evidence.test.mjs"
	, "tests/rust-structured-callables.test.mjs"
	, "tests/fixtures/structured-callable-consumers/rust.rs"
	, "tests/fixtures/structured-callable-consumers/rust-faults.rs"
	, "tests/helpers/rust-structured-callable-install.mjs"
	, "tests/helpers/rust-structured-callable-ownership.mjs"
	, "tests/helpers/rust-structured-callable-regression.mjs"
	, "tests/helpers/rust-structured-callable-evidence.mjs"
	, "tests/helpers/rust-structured-callable-source-history.mjs"
].sort();
export const rustStructuredCallableScope = {
	profiles: ["rust"], paths: ["ordinary-source", "reviewed-ir"]
	, shapes: ["alias", "array", "list", "option", "record", "result", "tuple", "variant"]
	, positions: ["callback-parameter", "callback-result"]
	, recursiveCallbacks: false, ownedResourceAggregates: false
};
const hash = value => assert.match(value, /^[a-f0-9]{64}$/u);
const passing = (run, file, flag, tests = 1) => {
	assert.ok(run.command.includes(file)); assert.equal(run.exitCode, 0);
	if(flag) assert.ok(run.command.includes(`${flag}=1`));
	assert.doesNotMatch(run.command, /--test-name-pattern/u);
	assert.equal(sha256(run.text), run.sha256);
	assert.ok(run.text.includes(`# tests ${tests}\n# suites 0\n# pass ${tests}\n# fail 0\n# cancelled 0\n# skipped 0\n`));
};

/**
 * Require both installed paths, direct ownership checks and primitive regressions.
 *
 * @param record - Captured reports and terminal unfiltered TAP runs.
 */
export const assertRustStructuredCallableExecution = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "rust-structured-callable-execution");
	assert.deepEqual(record.scope, rustStructuredCallableScope);
	passing(record.installed, "tests/rust-structured-callables.test.mjs", "LEAN_BRIDGE_RUST_STRUCTURED_CALLABLE_TEST");
	passing(record.primitiveRegression, "tests/rust-callables.test.mjs", "LEAN_BRIDGE_RUST_CALLABLE_TEST");
	passing(record.ownershipRegression, "tests/rust-structured-callable-contract.test.mjs", "LEAN_BRIDGE_RUST_STRUCTURED_CALLABLE_TEST", 9);
	assert.ok(record.ownershipRegression.text.includes("Rust nested callback results keep their owners until native copying finishes"));
	assert.deepEqual(record.reports.map(run => run.path), rustStructuredCallableScope.paths);
	assert.deepEqual(record.primitiveReports.map(run => run.path), rustStructuredCallableScope.paths);
	const consumerHash = sha256(await readFile("tests/fixtures/structured-callable-consumers/rust.rs"));
	const faultHash = sha256(await readFile("tests/fixtures/structured-callable-consumers/rust-faults.rs"));
	const guide = await readFile("docs/consume/rust.md", "utf8");
	const documented = guide.match(/### Structured callback values\n[\s\S]*?```rust\n([\s\S]*?)```/u)?.[1];
	assert.ok(documented);
	for(const run of record.reports)
	{
		assert.equal(run.profile, "rust"); assert.equal(run.checks, 1970);
		assert.equal(run.consumerSha256, consumerHash);
		for(const key of ["offlineInstall", "compilerFreePath", "sourceRemovedBeforeInstallation", "relocatedBeforeInstallation"]) assert.equal(run[key], true);
		assert.deepEqual(run.signatures.map(fn => fn.id).sort(), structuredCallableExports().map(name => `lean:${name}`).sort());
		assert.deepEqual(run.signatures, record.reports[0].signatures);
		for(const key of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256"]) hash(run[key]);
		assert.equal(run.packages.length, 1);
		const pkg = run.packages[0]; assert.equal(pkg.target, "cargo"); assert.equal(pkg.role, "component");
		assert.equal(pkg.runtimeDelivery, "embedded");
		hash(pkg.runtimeIdentity); assert.equal(pkg.runtimeIdentity, record.reports[0].packages[0].runtimeIdentity);
		assert.equal(pkg.artifacts.length, 1); hash(pkg.artifacts[0].sha256); assert.ok(pkg.artifacts[0].bytes > 0);
		const safety = run.safety;
		assert.equal(safety.sourceFreeChecks, run.checks);
		assert.equal(safety.sourcesAndArchivesRemovedBeforeExecution, true);
		hash(safety.executableSha256); assert.equal(safety.faultSourceSha256, faultHash);
		assert.equal(safety.documentedSourceSha256, sha256(documented)); assert.equal(safety.documentedExampleExecuted, true);
		assert.equal(safety.faultTests, 1);
		assert.deepEqual(safety.faults, Object.entries({ array: 162, list: 172, option: 42, result: 122, tuple: 150, record: 302, variant: 196, alias: 302 })
			.map(([shape, failures]) => ({ shape, cases: 5, failures })));
		assert.equal(safety.faults.reduce((total, item) => total + item.failures, 0), 1448);
		assert.deepEqual(safety.rejected.map(item => item.name), ["argument", "callback-argument", "callback-result", "borrowed-result", "nested-option", "closure-argument", "send", "sync", "clone", "async", "moved"]);
		for(const rejected of safety.rejected)
		{
			hash(rejected.sourceSha256); assert.ok(rejected.diagnostics > 0); assert.match(rejected.code, /^E\d{4}$/u);
		}
	}
	for(const run of record.primitiveReports)
	{
		assert.equal(run.profile, "rust"); assert.equal(run.checks, 35890);
		assert.equal(run.sourceRemovedBeforeInstallation, true);
		assert.equal(run.safety.sourceFreeChecks, run.checks);
		const sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
		assert.deepEqual(sort(run.signatures), sort(rustCallableSignatures));
	}
};

/**
 * Authenticate current sources and exactly thirty-two new installed cells.
 *
 * @param record - Frozen predecessor, literal edits and current inventory.
 */
export const assertRustStructuredCallableIntegration = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "rust-structured-callable-integration");
	assert.equal(record.baselineRevision, "646aceda428705779adc34a2b96a0c0dcd7356b5");
	assert.deepEqual(record.scope, rustStructuredCallableScope);
	assert.deepEqual(record.inventory, { previousVersion: "0.87.0", version: "0.88.0", previousInstalled: 4282, installed: 4314, total: 6562 });
	assert.equal(record.previous.path, cppStructuredCallableHistoryPath);
	const oldBytes = await readFile(record.previous.path); assert.equal(sha256(oldBytes), record.previous.sha256);
	const previous = JSON.parse(oldBytes);
	assert.equal(record.execution.path, rustStructuredCallableExecutionPath);
	const bytes = await readFile(record.execution.path); assert.equal(sha256(bytes), record.execution.sha256);
	const execution = JSON.parse(bytes); await assertRustStructuredCallableExecution(execution);
	assert.equal(record.codegen.path, rustStructuredCodegenPath);
	const codegenBytes = await readFile(record.codegen.path); assert.equal(sha256(codegenBytes), record.codegen.sha256);
	const codegen = JSON.parse(codegenBytes); assertRustStructuredCodegenRegression(codegen);
	assert.deepEqual(record.updates.map(update => update.path).sort(), rustStructuredCallableChangedPaths);
	assert.deepEqual(Object.keys(record.additions).sort(), rustStructuredCallableAddedPaths);
	const paths = [...new Set([...Object.keys(previous.sourceHashes), ...rustStructuredCallableChangedPaths, ...rustStructuredCallableAddedPaths])].sort();
	assert.deepEqual(Object.keys(record.sourceHashes).sort(), paths);
	for(const path of paths) assert.equal(sha256(await readFile(path)), record.sourceHashes[path], path);
	const restored = {};
	for(const update of record.updates)
	{
		assert.equal(update.currentSha256, record.sourceHashes[update.path]);
		restored[update.path] = reverseRustStructuredCallableUpdate(await readFile(update.path, "utf8"), update);
		if(previous.sourceHashes[update.path]) assert.equal(update.previousSha256, previous.sourceHashes[update.path]);
	}
	for(const [path, expected] of Object.entries(record.additions)) assert.equal(expected, record.sourceHashes[path]);
	for(const [path, expected] of Object.entries(codegen.predecessors))
	{
		assert.equal(expected, sha256(restored[path]));
		assert.equal(codegen.sourceHashes[path], record.sourceHashes[path]);
	}
	const { document, ...contracts } = await readTypeSurface();
	const oldDocument = JSON.parse(restored["docs/type-surface.v1.json"]);
	assert.equal(document.contractVersion, record.inventory.version); assert.equal(oldDocument.contractVersion, record.inventory.previousVersion);
	const cells = typeSurfaceCells(document, contracts), oldCells = typeSurfaceCells(oldDocument, contracts);
	const installed = values => values.filter(cell => cell.stages.installedExecution.state === "passed");
	assert.equal(installed(cells).length, record.inventory.installed); assert.equal(installed(oldCells).length, record.inventory.previousInstalled);
	assert.equal(cells.length, record.inventory.total);
	const promoted = cells.filter(cell => cell.stages.installedExecution.evidence.includes("rust-structured-callables-installed"));
	assert.equal(promoted.length, 32);
	for(const cell of promoted)
	{
		assert.equal(cell.profile, "rust"); assert.ok(rustStructuredCallableScope.shapes.includes(cell.shape));
		assert.ok(rustStructuredCallableScope.paths.includes(cell.path)); assert.ok(rustStructuredCallableScope.positions.includes(cell.position));
		assert.ok(cell.hostType && cell.conversionNote);
		for(const stage of Object.values(cell.stages)) assert.deepEqual({ state: stage.state, evidence: stage.evidence }, { state: "passed", evidence: ["rust-structured-callables-installed"] });
	}
	const oldById = new Map(oldCells.map(cell => [cell.id, cell]));
	for(const cell of cells.filter(cell => !promoted.includes(cell))) assert.deepEqual(cell, oldById.get(cell.id), cell.id);
	const entry = document.evidence.find(item => item.id === "rust-structured-callables-installed");
	assert.deepEqual(entry.artifacts, execution.reports.flatMap(run => run.packages.flatMap(pkg => pkg.artifacts.map(artifact => ({ path: `rust/${run.path}/${artifact.path}`, sha256: artifact.sha256 })))));
	assert.ok(entry.files.some(file => file.path === rustStructuredCallableExecutionPath));
	await assertCppStructuredCallableIntegration(previous);
};
