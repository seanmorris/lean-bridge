/**
 * Bind installed structured Python callables to exact sources, wheels and cells.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import { structuredCallableExports } from "./structured-callable-fixture.mjs";
import { pythonCallableSignatures } from "./python-callable-fixture.mjs";
import { assertPythonStructuredCodegenRegression } from "./python-structured-callable-regression.mjs";
import { assertPythonStructuredFaults, pythonStructuredInvalidCalls } from "./python-structured-callable-install.mjs";
import { rustStructuredCallableHistoryPath } from "./rust-structured-callable-source-history.mjs";
import { assertRustStructuredCallableIntegration } from "./rust-structured-callable-evidence.mjs";
import { pythonStructuredCallableChangedPaths, reversePythonStructuredCallableUpdate } from "./python-structured-callable-source-history.mjs";
import { beforeRubyStructuredCallables } from "./ruby-structured-callable-source-history.mjs";

const priorSource = async path => beforeRubyStructuredCallables(path, await readFile(path, "utf8"));

export const pythonStructuredCallableExecutionPath = "docs/evidence/python-structured-callables-20260924.json";
export const pythonStructuredCodegenPath = "docs/evidence/python-structured-codegen-regression-20260924.json";
export const pythonStructuredCallableAddedPaths = [
	pythonStructuredCallableExecutionPath, pythonStructuredCodegenPath
	, "docs/evidence/python-structured-callables-20260924.md"
	, "tests/python-structured-callable-contract.test.mjs"
	, "tests/python-structured-callable-evidence.test.mjs"
	, "tests/python-structured-callables.test.mjs"
	, "tests/fixtures/structured-callable-consumers/python.py"
	, "tests/fixtures/structured-callable-consumers/python-values.py"
	, "tests/fixtures/structured-callable-consumers/python-typed.py"
	, "tests/fixtures/structured-callable-consumers/python-faults.py"
	, "tests/helpers/python-structured-callable-install.mjs"
	, "tests/helpers/python-structured-callable-regression.mjs"
	, "tests/helpers/python-structured-callable-evidence.mjs"
	, "tests/helpers/python-structured-callable-source-history.mjs"
].sort();
export const pythonStructuredCallableScope = {
	profiles: ["python"], paths: ["ordinary-source", "reviewed-ir"]
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
	assert.ok(run.text.includes("# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n"));
};

/**
 * Require installed runs on both paths and Python branches, with full cleanup.
 *
 * @param record - Captured reports and terminal unfiltered TAP logs.
 */
export const assertPythonStructuredCallableExecution = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "python-structured-callable-execution");
	assert.deepEqual(record.scope, pythonStructuredCallableScope);
	passing(record.installed, "tests/python-structured-callables.test.mjs", "LEAN_BRIDGE_PYTHON_STRUCTURED_CALLABLE_TEST");
	passing(record.primitiveRegression, "tests/python-callables.test.mjs", "LEAN_BRIDGE_PYTHON_CALLABLE_TEST");
	assert.deepEqual(record.reports.map(run => run.path), pythonStructuredCallableScope.paths);
	assert.deepEqual(record.primitiveReports.map(run => run.path), pythonStructuredCallableScope.paths);
	const sourceHashes = Object.fromEntries(await Promise.all(["python", "python-values", "python-typed", "python-faults"].map(async name => [
		`${name}.py`
		, sha256(await readFile(`tests/fixtures/structured-callable-consumers/${name}.py`))
	])));
	const guide = await readFile("docs/consume/python.md", "utf8");
	const documented = guide.match(/### Structured callback values\n[\s\S]*?```python\n([\s\S]*?)\n```/u)?.[1];
	assert.ok(documented);
	for(const run of record.reports)
	{
		assert.equal(run.profile, "python");
		for(const key of ["sourceRemovedBeforeInstallation", "relocatedBeforeInstallation"]) assert.equal(run[key], true);
		assert.match(run.checkerVersion, /^mypy 2\.3\.1\b/u);
		assert.deepEqual(run.signatures.map(fn => fn.id).sort(), structuredCallableExports().map(name => `lean:${name}`).sort());
		assert.deepEqual(run.signatures, record.reports[0].signatures);
		for(const key of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256"]) hash(run[key]);
		assert.equal(run.packages.length, 1);
		const pkg = run.packages[0]; assert.equal(pkg.target, "pypi"); assert.equal(pkg.role, "component");
		assert.equal(pkg.runtimeDelivery, "embedded");
		hash(pkg.runtimeIdentity); assert.equal(pkg.runtimeIdentity, record.reports[0].packages[0].runtimeIdentity);
		assert.equal(pkg.artifacts.length, 1); hash(pkg.artifacts[0].sha256); assert.ok(pkg.artifacts[0].bytes > 0);
		assert.match(pkg.artifacts[0].path, /\.whl$/u);
		assert.deepEqual(run.installations.map(item => item.name), ["3.11", "3.12"]);
		for(const installation of run.installations)
		{
			assert.ok(installation.python.startsWith(installation.name + "."));
			assert.deepEqual(installation.sourceHashes, sourceHashes);
			assert.deepEqual(installation.public, record.reports[0].installations[0].public);
			assert.equal(installation.public.checks, 32236);
			assert.equal(installation.public.calls, 1536); assert.equal(installation.public.rejected, 367);
			assert.deepEqual(installation.public.shapes.toSorted(), pythonStructuredCallableScope.shapes);
			assertPythonStructuredFaults(installation.faults);
			assert.equal(installation.faults.faults, 5488);
			assert.equal(installation.faults.checks, 47491);
			assert.equal(installation.faults.malformed, 23);
			assert.deepEqual(installation.faults, record.reports[0].installations[0].faults);
			for(const key of ["resolvedOffline", "offlineInstall", "compilerFreeExecution", "relocatedInstallation", "producerHandoffRemoved", "repeatExecution", "installedFilesUnchanged", "isolatedInMemoryFaultProbe"]) assert.equal(installation[key], true);
			assert.deepEqual(installation.documentation, { sourceSha256: sha256(documented), checked: true, executed: true });
			hash(installation.installedReceiptSha256);
			assert.ok(Object.keys(installation.installedFiles).length > 10);
			for(const file of Object.values(installation.installedFiles))
			{
				hash(file.sha256); assert.ok(file.bytes >= 0);
			}
			const types = installation.strictTypecheck;
			assert.equal(types.checked, true); assert.equal(types.executed, true);
			assert.equal(types.memoryLimitMiB, 1024); assert.equal(types.timeoutSeconds, 30);
			assert.deepEqual(types.rejected.map(item => item.name), Object.keys(pythonStructuredInvalidCalls));
			for(const rejected of types.rejected)
			{
				assert.equal(rejected.sourceSha256, sha256(`import lean_structured as api\n${pythonStructuredInvalidCalls[rejected.name]}\n`));
				assert.ok(Number.isSafeInteger(rejected.errors) && rejected.errors > 0);
			}
		}
	}
	for(const run of record.primitiveReports)
	{
		assert.equal(run.profile, "python"); assert.equal(run.checks, 49937);
		for(const key of ["sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreePath"]) assert.equal(run[key], true);
		assert.equal(run.consumerSha256, sha256(await readFile("tests/fixtures/callable-consumers/python.py")));
		const sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
		assert.deepEqual(sort(run.signatures), sort(pythonCallableSignatures));
	}
};

/**
 * Authenticate every source edit and exactly thirty-two new installed cells.
 *
 * @param record - Frozen predecessor, literal edits and current inventory.
 */
export const assertPythonStructuredCallableIntegration = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "python-structured-callable-integration");
	assert.equal(record.baselineRevision, "8f17be5ad5262670b8853d96736f19333fdebe39");
	assert.deepEqual(record.scope, pythonStructuredCallableScope);
	assert.deepEqual(record.inventory, { previousVersion: "0.88.0", version: "0.89.0", previousInstalled: 4314, installed: 4346, total: 6562 });
	assert.equal(record.previous.path, rustStructuredCallableHistoryPath);
	const oldBytes = await readFile(record.previous.path); assert.equal(sha256(oldBytes), record.previous.sha256);
	const previous = JSON.parse(oldBytes);
	assert.equal(record.execution.path, pythonStructuredCallableExecutionPath);
	const bytes = await readFile(record.execution.path); assert.equal(sha256(bytes), record.execution.sha256);
	const execution = JSON.parse(bytes); await assertPythonStructuredCallableExecution(execution);
	assert.equal(record.codegen.path, pythonStructuredCodegenPath);
	const codegenBytes = await readFile(record.codegen.path); assert.equal(sha256(codegenBytes), record.codegen.sha256);
	const codegen = JSON.parse(codegenBytes); assertPythonStructuredCodegenRegression(codegen);
	assert.deepEqual(record.updates.map(update => update.path).sort(), pythonStructuredCallableChangedPaths);
	assert.deepEqual(Object.keys(record.additions).sort(), pythonStructuredCallableAddedPaths);
	const paths = [...new Set([...Object.keys(previous.sourceHashes), ...pythonStructuredCallableChangedPaths, ...pythonStructuredCallableAddedPaths])].sort();
	assert.deepEqual(Object.keys(record.sourceHashes).sort(), paths);
	for(const path of paths) assert.equal(sha256(await priorSource(path)), record.sourceHashes[path], path);
	const restored = {};
	for(const update of record.updates)
	{
		assert.equal(update.currentSha256, record.sourceHashes[update.path]);
		restored[update.path] = reversePythonStructuredCallableUpdate(await priorSource(update.path), update);
		if(previous.sourceHashes[update.path]) assert.equal(update.previousSha256, previous.sourceHashes[update.path]);
	}
	for(const [path, expected] of Object.entries(record.additions)) assert.equal(expected, record.sourceHashes[path]);
	for(const [path, expected] of Object.entries(codegen.predecessors))
	{
		assert.equal(expected, sha256(restored[path]));
		assert.equal(codegen.sourceHashes[path], record.sourceHashes[path]);
	}
	const { document: current, ...contracts } = await readTypeSurface(); void current;
	const document = JSON.parse(await priorSource("docs/type-surface.v1.json"));
	const oldDocument = JSON.parse(restored["docs/type-surface.v1.json"]);
	assert.equal(document.contractVersion, record.inventory.version); assert.equal(oldDocument.contractVersion, record.inventory.previousVersion);
	const cells = typeSurfaceCells(document, contracts), oldCells = typeSurfaceCells(oldDocument, contracts);
	const installed = values => values.filter(cell => cell.stages.installedExecution.state === "passed");
	assert.equal(installed(cells).length, record.inventory.installed); assert.equal(installed(oldCells).length, record.inventory.previousInstalled);
	assert.equal(cells.length, record.inventory.total);
	const promoted = cells.filter(cell => cell.stages.installedExecution.evidence.includes("python-structured-callables-installed"));
	assert.equal(promoted.length, 32);
	for(const cell of promoted)
	{
		assert.equal(cell.profile, "python"); assert.ok(pythonStructuredCallableScope.shapes.includes(cell.shape));
		assert.ok(pythonStructuredCallableScope.paths.includes(cell.path)); assert.ok(pythonStructuredCallableScope.positions.includes(cell.position));
		assert.ok(cell.hostType && cell.conversionNote);
		for(const stage of Object.values(cell.stages)) assert.deepEqual({ state: stage.state, evidence: stage.evidence }, { state: "passed", evidence: ["python-structured-callables-installed"] });
	}
	const oldById = new Map(oldCells.map(cell => [cell.id, cell]));
	for(const cell of cells.filter(cell => !promoted.includes(cell))) assert.deepEqual(cell, oldById.get(cell.id), cell.id);
	const entry = document.evidence.find(item => item.id === "python-structured-callables-installed");
	assert.deepEqual(entry.artifacts, execution.reports.flatMap(run => run.packages.flatMap(pkg => pkg.artifacts.map(artifact => ({ path: `python/${run.path}/${artifact.path}`, sha256: artifact.sha256 })))));
	assert.ok(entry.files.some(file => file.path === pythonStructuredCallableExecutionPath));
	await assertRustStructuredCallableIntegration(previous);
};
