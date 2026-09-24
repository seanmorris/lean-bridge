/**
 * Bind installed structured C++ callables to source, packages and exact cells.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import { boostIdentity } from "../../src/backends/cpp/boost.mjs";
import { structuredCallableExports } from "./structured-callable-fixture.mjs";
import { cppCallableSignatures } from "./cpp-callable-fixture.mjs";
import { parseStructuredCppResult } from "./cpp-structured-callable-install.mjs";
import { assertCppStructuredCodegenRegression } from "./cpp-structured-callable-regression.mjs";
import { cStructuredCallableHistoryPath } from "./c-structured-callable-source-history.mjs";
import { assertCStructuredCallableIntegration } from "./c-structured-callable-evidence.mjs";
import { cppStructuredCallableChangedPaths, reverseCppStructuredCallableUpdate } from "./cpp-structured-callable-source-history.mjs";

export const cppStructuredCallableExecutionPath = "docs/evidence/cpp-structured-callables-20260924.json";
export const cppStructuredCodegenPath = "docs/evidence/cpp-structured-codegen-regression-20260924.json";
export const cppStructuredCallableAddedPaths = [
	cppStructuredCallableExecutionPath, cppStructuredCodegenPath
	, "docs/evidence/cpp-structured-callables-20260924.md"
	, "tests/cpp-structured-callable-contract.test.mjs"
	, "tests/cpp-structured-callable-evidence.test.mjs"
	, "tests/cpp-structured-callables.test.mjs"
	, "tests/fixtures/structured-callable-consumers/cpp.cpp"
	, "tests/helpers/cpp-structured-callable-install.mjs"
	, "tests/helpers/cpp-structured-callable-regression.mjs"
	, "tests/helpers/cpp-structured-callable-evidence.mjs"
	, "tests/helpers/cpp-structured-callable-source-history.mjs"
].sort();
export const cppStructuredCallableScope = {
	profiles: ["cpp"], paths: ["ordinary-source", "reviewed-ir"]
	, shapes: ["alias", "array", "list", "option", "record", "result", "tuple", "variant"]
	, positions: ["callback-parameter", "callback-result"]
	, recursiveCallbacks: false, ownedResourceAggregates: false
};
const hash = value => assert.match(value, /^[a-f0-9]{64}$/u);
const passing = (run, file, flag) => {
	assert.ok(run.command.includes(file)); assert.equal(run.exitCode, 0);
	assert.ok(run.command.includes(`${flag}=1`));
	assert.doesNotMatch(run.command, /--test-name-pattern/u);
	assert.equal(sha256(run.text), run.sha256);
	assert.match(run.text, /# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n/u);
};

/**
 * Require installed runs, all eight shapes, fault injection and compiler checks.
 *
 * @param record - Captured structured/primitive reports and terminal TAP logs.
 */
export const assertCppStructuredCallableExecution = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "cpp-structured-callable-execution");
	assert.deepEqual(record.scope, cppStructuredCallableScope);
	passing(record.installed, "tests/cpp-structured-callables.test.mjs", "LEAN_BRIDGE_CPP_STRUCTURED_CALLABLE_TEST");
	passing(record.primitiveRegression, "tests/cpp-callables.test.mjs", "LEAN_BRIDGE_CPP_CALLABLE_TEST");
	assert.deepEqual(record.reports.map(run => run.path), cppStructuredCallableScope.paths);
	assert.deepEqual(record.primitiveReports.map(run => run.path), cppStructuredCallableScope.paths);
	const consumerHash = sha256(await readFile("tests/fixtures/structured-callable-consumers/cpp.cpp"));
	for(const run of record.reports)
	{
		assert.equal(run.profile, "cpp"); assert.equal(run.checks, 9366);
		assert.equal(run.consumerSha256, consumerHash);
		for(const key of ["offlineInstall", "compilerFreePath", "sourceRemovedBeforeInstallation", "relocatedBeforeInstallation"]) assert.equal(run[key], true);
		assert.deepEqual(run.signatures.map(fn => fn.id).sort(), structuredCallableExports().map(name => `lean:${name}`).sort());
		assert.deepEqual(run.signatures, record.reports[0].signatures);
		for(const key of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256"]) hash(run[key]);
		const result = parseStructuredCppResult(JSON.stringify(run.result));
		assert.equal(result.checks, run.checks); assert.equal(result.allocationFailures, 5956);
		assert.deepEqual(result, record.reports[0].result);
		assert.equal(run.packages.length, 1);
		const pkg = run.packages[0]; assert.equal(pkg.target, "cpp"); assert.equal(pkg.role, "component");
		hash(pkg.runtimeIdentity); assert.equal(pkg.runtimeIdentity, record.reports[0].packages[0].runtimeIdentity);
		assert.equal(pkg.artifacts.length, 1); hash(pkg.artifacts[0].sha256); assert.ok(pkg.artifacts[0].bytes > 0);
		const safety = run.safety;
		assert.deepEqual(safety.boost, boostIdentity); assert.equal(safety.boostFiles, 199);
		assert.deepEqual(safety.sanitizers, ["address", "leak", "undefined"]);
		for(const key of ["sourceFreeExecution", "compilerFreeExecution", "archivesRemoved"]) assert.equal(safety[key], true);
		hash(safety.executableSha256);
		assert.deepEqual(safety.rejected.map(item => item.name), ["argument", "callback-argument", "callback-result", "borrowed-result", "option-null", "closure-argument", "closure-copy"]);
		for(const rejected of safety.rejected)
		{
			hash(rejected.sourceSha256);
			assert.ok(rejected.diagnostics > 0);
		}
		assert.equal(safety.startupLeakBaseline.bytes, 128); assert.equal(safety.startupLeakBaseline.allocations, 12);
		assert.equal(safety.startupLeakBaseline.unchangedAfterConversions, true);
		assert.match(safety.startupLeakBaseline.report, /__gmp_default_allocate/u);
	}
	for(const run of record.primitiveReports)
	{
		assert.equal(run.profile, "cpp"); assert.equal(run.checks, 23896);
		assert.equal(run.sourceRemovedBeforeInstallation, true);
		assert.equal(run.safety.sourceFreeChecks, run.checks);
		const sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
		assert.deepEqual(sort(run.signatures), sort(cppCallableSignatures));
	}
};

/**
 * Authenticate current sources without rewriting the preceding C acceptance.
 *
 * @param record - Current implementation, inventory delta and original receipts.
 */
export const assertCppStructuredCallableIntegration = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "cpp-structured-callable-integration");
	assert.equal(record.baselineRevision, "9e6eb510535a6907c37d63f89ecbe0ac66927c32");
	assert.deepEqual(record.scope, cppStructuredCallableScope);
	assert.deepEqual(record.inventory, { previousVersion: "0.86.0", version: "0.87.0", previousInstalled: 4250, installed: 4282, total: 6562 });
	assert.equal(record.previous.path, cStructuredCallableHistoryPath);
	const oldBytes = await readFile(record.previous.path); assert.equal(sha256(oldBytes), record.previous.sha256);
	const previous = JSON.parse(oldBytes);
	assert.equal(record.execution.path, cppStructuredCallableExecutionPath);
	const bytes = await readFile(record.execution.path); assert.equal(sha256(bytes), record.execution.sha256);
	const execution = JSON.parse(bytes); await assertCppStructuredCallableExecution(execution);
	assert.equal(record.codegen.path, cppStructuredCodegenPath);
	const codegenBytes = await readFile(record.codegen.path); assert.equal(sha256(codegenBytes), record.codegen.sha256);
	const codegen = JSON.parse(codegenBytes); assertCppStructuredCodegenRegression(codegen);
	assert.deepEqual(record.updates.map(update => update.path).sort(), cppStructuredCallableChangedPaths);
	assert.deepEqual(Object.keys(record.additions).sort(), cppStructuredCallableAddedPaths);
	const paths = [...new Set([...Object.keys(previous.sourceHashes), ...cppStructuredCallableChangedPaths, ...cppStructuredCallableAddedPaths])].sort();
	assert.deepEqual(Object.keys(record.sourceHashes).sort(), paths);
	for(const path of paths) assert.equal(sha256(await readFile(path)), record.sourceHashes[path], path);
	const restored = {};
	for(const update of record.updates)
	{
		assert.equal(update.currentSha256, record.sourceHashes[update.path]);
		restored[update.path] = reverseCppStructuredCallableUpdate(await readFile(update.path, "utf8"), update);
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
	const promoted = cells.filter(cell => cell.stages.installedExecution.evidence.includes("cpp-structured-callables-installed"));
	assert.equal(promoted.length, 32);
	for(const cell of promoted)
	{
		assert.equal(cell.profile, "cpp"); assert.ok(cppStructuredCallableScope.shapes.includes(cell.shape));
		assert.ok(cppStructuredCallableScope.paths.includes(cell.path)); assert.ok(cppStructuredCallableScope.positions.includes(cell.position));
		assert.ok(cell.hostType && cell.conversionNote);
		for(const stage of Object.values(cell.stages)) assert.deepEqual({ state: stage.state, evidence: stage.evidence }, { state: "passed", evidence: ["cpp-structured-callables-installed"] });
	}
	const oldById = new Map(oldCells.map(cell => [cell.id, cell]));
	for(const cell of cells.filter(cell => !promoted.includes(cell))) assert.deepEqual(cell, oldById.get(cell.id), cell.id);
	const entry = document.evidence.find(item => item.id === "cpp-structured-callables-installed");
	assert.deepEqual(entry.artifacts, execution.reports.flatMap(run => run.packages.flatMap(pkg => pkg.artifacts.map(artifact => ({ path: `cpp/${run.path}/${artifact.path}`, sha256: artifact.sha256 })))));
	assert.ok(entry.files.some(file => file.path === cppStructuredCallableExecutionPath));
	await assertCStructuredCallableIntegration(previous);
};
