/**
 * Authenticate the installed C callable slice without promoting other hosts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import { structuredCallableExports } from "./structured-callable-fixture.mjs";
import { structuredCallableCConsumer, structuredCallableCFaultConsumer } from "./structured-callable-c-consumer.mjs";
import { witAcceptancePath } from "./wit-acceptance-source-history.mjs";
import { assertWitRecursiveAcceptance } from "./wit-recursive-acceptance.mjs";
import { cStructuredCallableChangedPaths, reverseCStructuredCallableUpdate } from "./c-structured-callable-source-history.mjs";

export const cStructuredCallableExecutionPath = "docs/evidence/c-structured-callables-20260924.json";
export const cStructuredCallableAddedPaths = [
	cStructuredCallableExecutionPath
	, "docs/evidence/c-structured-callables-20260924.md"
	, "tests/c-structured-callable-contract.test.mjs"
	, "tests/c-structured-callable-evidence.test.mjs"
	, "tests/c-structured-callables.test.mjs"
	, "tests/fixtures/onboarding/structured-callables/Structured.lean"
	, "tests/fixtures/onboarding/structured-callables/lakefile.toml"
	, "tests/fixtures/onboarding/structured-callables/lean-toolchain"
	, "tests/fixtures/onboarding/structured-callables/package.json"
	, "tests/helpers/c-structured-callable-evidence.mjs"
	, "tests/helpers/c-structured-callable-faults.mjs"
	, "tests/helpers/c-structured-callable-source-history.mjs"
	, "tests/helpers/structured-callable-c-consumer.mjs"
	, "tests/helpers/structured-callable-fixture.mjs"
].sort();
const scope = {
	profiles: ["c"], paths: ["ordinary-source", "reviewed-ir"]
	, shapes: ["alias", "array", "list", "option", "record", "result", "tuple", "variant"]
	, positions: ["callback-parameter", "callback-result"]
	, recursiveCallbacks: false, ownedResourceAggregates: false
};
const hash = value => assert.match(value, /^[a-f0-9]{64}$/u);
const passing = (run, file) => {
	assert.ok(run.command.includes(file)); assert.equal(run.exitCode, 0);
	assert.doesNotMatch(run.command, /--test-name-pattern/u);
	assert.equal(sha256(run.text), run.sha256);
	assert.match(run.text, /# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n/u);
};

/**
 * Require real source-free executions, all payloads and fault/lifetime coverage.
 *
 * @param record - Both installed source paths and captured terminal logs.
 */
export const assertCStructuredCallableExecution = record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "c-structured-callable-execution");
	assert.deepEqual(record.scope, scope);
	passing(record.installed, "tests/c-structured-callables.test.mjs");
	assert.ok(record.installed.command.includes("LEAN_BRIDGE_C_STRUCTURED_CALLABLE_TEST=1"));
	passing(record.primitiveRegression, "tests/c-callables.test.mjs");
	assert.ok(record.primitiveRegression.command.includes("LEAN_BRIDGE_C_CALLABLE_TEST=1"));
	assert.deepEqual(record.reports.map(run => run.path), scope.paths);
	for(const run of record.reports)
	{
		assert.equal(run.profile, "c"); assert.equal(run.checks, 5999);
		assert.equal(run.consumerSha256, sha256(structuredCallableCConsumer()));
		for(const key of ["offlineInstall", "compilerFreePath", "sourceRemovedBeforeInstallation", "relocatedBeforeInstallation"]) assert.equal(run[key], true);
		assert.deepEqual(run.signatures.map(fn => fn.id).sort(), structuredCallableExports().map(name => `lean:${name}`).sort());
		assert.deepEqual(run.signatures, record.reports[0].signatures);
		for(const name of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256"]) hash(run[name]);
		assert.equal(run.packages.length, 1);
		const pkg = run.packages[0]; assert.equal(pkg.target, "c"); assert.equal(pkg.role, "component");
		hash(pkg.runtimeIdentity); assert.equal(pkg.runtimeIdentity, record.reports[0].packages[0].runtimeIdentity);
		assert.equal(pkg.artifacts.length, 1); hash(pkg.artifacts[0].sha256); assert.ok(pkg.artifacts[0].bytes > 0);
		const faults = run.allocationFailures;
		assert.equal(faults.checks, 112193);
		assert.deepEqual(faults.layers, ["native", "gmp"]);
		assert.deepEqual(faults.sanitizers, ["address", "leak", "undefined"]);
		assert.equal(faults.trackedLiveAllocationsAfterEveryFailure, 0);
		assert.equal(faults.consumerSha256, sha256(structuredCallableCFaultConsumer()));
		hash(faults.executableSha256);
		assert.deepEqual(faults.sources.map(source => source.name), ["native", "structured", "facade"]);
		for(const source of faults.sources)
		{ hash(source.sourceSha256); hash(source.instrumentedSha256); }
		assert.equal(faults.startupLeakBaseline.bytes, 128); assert.equal(faults.startupLeakBaseline.allocations, 12);
		assert.equal(faults.startupLeakBaseline.unchangedAfterConversions, true);
		assert.match(faults.startupLeakBaseline.report, /__gmp_default_allocate/u);
	}
};

/**
 * Bind current source, unchanged historical receipts and exactly 32 new cells.
 *
 * @param record - Recorded implementation changes and acceptance index.
 */
export const assertCStructuredCallableIntegration = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "c-structured-callable-integration");
	assert.equal(record.baselineRevision, "ef6ff9ff0e03a659ffe1e9d12b821453399bff9d");
	assert.deepEqual(record.scope, scope);
	assert.deepEqual(record.inventory, { previousVersion: "0.85.0", version: "0.86.0", previousInstalled: 4218, installed: 4250, total: 6562 });
	assert.equal(record.previous.path, witAcceptancePath);
	const previousBytes = await readFile(witAcceptancePath); assert.equal(sha256(previousBytes), record.previous.sha256);
	const previous = JSON.parse(previousBytes);
	assert.equal(record.execution.path, cStructuredCallableExecutionPath);
	const bytes = await readFile(record.execution.path); assert.equal(sha256(bytes), record.execution.sha256);
	const execution = JSON.parse(bytes); assertCStructuredCallableExecution(execution);
	assert.deepEqual(record.updates.map(update => update.path).sort(), cStructuredCallableChangedPaths);
	assert.deepEqual(Object.keys(record.additions).sort(), cStructuredCallableAddedPaths);
	const paths = [...new Set([...Object.keys(previous.sourceHashes), ...cStructuredCallableChangedPaths, ...cStructuredCallableAddedPaths])].sort();
	assert.deepEqual(Object.keys(record.sourceHashes).sort(), paths);
	for(const path of paths) assert.equal(sha256(await readFile(path)), record.sourceHashes[path], path);
	const restored = {};
	for(const update of record.updates)
	{
		assert.equal(update.currentSha256, record.sourceHashes[update.path]);
		restored[update.path] = reverseCStructuredCallableUpdate(await readFile(update.path, "utf8"), update);
		if(previous.sourceHashes[update.path]) assert.equal(update.previousSha256, previous.sourceHashes[update.path]);
	}
	for(const [path, expected] of Object.entries(record.additions)) assert.equal(expected, record.sourceHashes[path]);
	const { document, ...contracts } = await readTypeSurface();
	const oldDocument = JSON.parse(restored["docs/type-surface.v1.json"]);
	assert.equal(document.contractVersion, record.inventory.version); assert.equal(oldDocument.contractVersion, record.inventory.previousVersion);
	const cells = typeSurfaceCells(document, contracts), oldCells = typeSurfaceCells(oldDocument, contracts);
	const installed = values => values.filter(cell => cell.stages.installedExecution.state === "passed");
	assert.equal(installed(cells).length, record.inventory.installed); assert.equal(installed(oldCells).length, record.inventory.previousInstalled);
	assert.equal(cells.length, record.inventory.total);
	const promoted = cells.filter(cell => cell.stages.installedExecution.evidence.includes("c-structured-callables-installed"));
	assert.equal(promoted.length, 32);
	for(const cell of promoted)
	{
		assert.equal(cell.profile, "c"); assert.ok(scope.shapes.includes(cell.shape));
		assert.ok(scope.paths.includes(cell.path)); assert.ok(scope.positions.includes(cell.position));
		assert.ok(cell.hostType && cell.conversionNote);
		for(const stage of Object.values(cell.stages)) assert.deepEqual({ state: stage.state, evidence: stage.evidence }, { state: "passed", evidence: ["c-structured-callables-installed"] });
	}
	const oldById = new Map(oldCells.map(cell => [cell.id, cell]));
	for(const cell of cells.filter(cell => !promoted.includes(cell))) assert.deepEqual(cell, oldById.get(cell.id), cell.id);
	const entry = document.evidence.find(item => item.id === "c-structured-callables-installed");
	assert.deepEqual(entry.artifacts, execution.reports.flatMap(run => run.packages.flatMap(pkg => pkg.artifacts.map(artifact => ({ path: `c/${run.path}/${artifact.path}`, sha256: artifact.sha256 })))));
	assert.ok(entry.files.some(file => file.path === cStructuredCallableExecutionPath));
	await assertWitRecursiveAcceptance(previous);
};
