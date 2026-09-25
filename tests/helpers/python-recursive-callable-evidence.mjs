/**
 * Bind recursive Python support to original installed wheels and exact sources.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import { assertPhpCiIntegration } from "./php-ci-regression-evidence.mjs";
import { phpCiHistoryPath } from "./php-ci-regression-source-history.mjs";
import { assertPythonStructuredCallableExecution, pythonStructuredCallableExecutionPath } from "./python-structured-callable-evidence.mjs";
import { assertPythonRecursiveFaults, pythonRecursiveConsumerNames } from "./python-recursive-callable-install.mjs";
import { pythonRecursiveCallableDocumentation } from "./python-recursive-callable-docs.mjs";
import { pythonRecursiveCallableChangedPaths, reversePythonRecursiveCallableUpdate } from "./python-recursive-callable-source-history.mjs";
import { beforeRustRecursiveCallables } from "./rust-recursive-callable-source-history.mjs";

const priorSource = async path => beforeRustRecursiveCallables(path, await readFile(path, "utf8"));

export const pythonRecursiveCallableBaseline = "53ccb05a9ad93cebf37c17a5b4ea2415275ee287";
export const pythonRecursiveCallableExecutionPath = "docs/evidence/python-recursive-callables-20260925.json";
export const pythonRecursiveCallableAddedPaths = [
	pythonRecursiveCallableExecutionPath
	, "docs/evidence/python-recursive-callables-20260925.md"
	, "src/backends/python/callable-graph-model.mjs"
	, "src/backends/python/callable-graph-conversions.mjs"
	, "src/backends/python/callable-graph-package.mjs"
	, ...["python-recursive", "python-recursive-faults", "python-recursive-invalid"
		, "python-recursive-lifetimes", "python-recursive-poison"
		, "python-recursive-typed"]
		.map(name => `tests/fixtures/structured-callable-consumers/${name}.py`)
	, "tests/helpers/python-recursive-callable-docs.mjs"
	, "tests/helpers/python-recursive-callable-install.mjs"
	, "tests/helpers/python-recursive-callable-evidence.mjs"
	, "tests/helpers/python-recursive-callable-source-history.mjs"
	, "tests/python-recursive-callable-contract.test.mjs"
	, "tests/python-recursive-callable-evidence.test.mjs"
	, "tests/python-recursive-callables.test.mjs"
].sort();
export const pythonRecursiveCallableScope = {
	profiles: ["python"], paths: ["ordinary-source", "reviewed-ir"]
	, shapes: ["alias", "array", "list", "option", "record", "recursive", "result", "tuple", "variant"]
	, positions: ["callback-parameter", "callback-result"]
	, recursiveCallbacks: true, ownedResourceAggregates: false
};
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const authenticated = async (entry, path) => {
	assert.equal(entry.path, path); const bytes = await readFile(path);
	assert.equal(sha256(bytes), entry.sha256); return JSON.parse(bytes);
};
const passing = (run, count) => {
	assert.equal(run.exitCode, 0); assert.equal(sha256(run.text), run.sha256);
	assert.doesNotMatch(run.command, /--test-name-pattern/u);
	for(const [name, value] of Object.entries({ tests: count, pass: count, fail: 0, cancelled: 0, skipped: 0 }))
		assert.match(run.text, new RegExp(`^# ${name} ${value}$`, "mu"));
};

/**
 * Require every interpreter, callable shape, typed example and failure boundary.
 *
 * @param record - Original terminal logs and installed-package reports.
 */
export const assertPythonRecursiveCallableExecution = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "python-recursive-callable-execution");
	assert.equal(record.baselineRevision, pythonRecursiveCallableBaseline);
	assert.deepEqual(record.scope, pythonRecursiveCallableScope);
	passing(record.installed, 1); passing(record.contract, 3); passing(record.regressions.installed, 2);
	assert.ok(record.installed.command.includes("LEAN_BRIDGE_PYTHON_RECURSIVE_CALLABLE_TEST=1"));
	assert.ok(record.installed.command.includes("tests/python-recursive-callables.test.mjs"));
	assert.ok(record.contract.command.includes("tests/python-recursive-callable-contract.test.mjs"));
	for(const [flag, file] of [["CALLABLE", "callables"], ["STRUCTURED_CALLABLE", "structured-callables"]])
	{
		assert.ok(record.regressions.installed.command.includes(`LEAN_BRIDGE_PYTHON_${flag}_TEST=1`));
		assert.ok(record.regressions.installed.command.includes(`tests/python-${file}.test.mjs`));
	}
	const old = await authenticated(record.previousPythonExecution, pythonStructuredCallableExecutionPath);
	await assertPythonStructuredCallableExecution({ ...old
		, reports: record.regressions.structured.reports
		, primitiveReports: record.regressions.primitive.reports });
	assert.deepEqual(record.reports.map(run => run.path), pythonRecursiveCallableScope.paths);
	const documentation = await pythonRecursiveCallableDocumentation();
	const sources = Object.fromEntries(await Promise.all(pythonRecursiveConsumerNames.map(async name =>
		[`${name}.py`, await readFile(`tests/fixtures/structured-callable-consumers/${name}.py`, "utf8")])));
	const hashes = Object.fromEntries(Object.entries(sources).map(([name, source]) => [name, sha256(source)]));
	const invalid = sources["python-recursive-invalid.py"].split("\n").map(line => line.trim());
	for(const run of record.reports)
	{
		assert.equal(run.profile, "python"); assert.equal(run.exports, 33); assert.equal(run.signatures, 18);
		assert.equal(run.sourceRemovedBeforeInstallation, true); assert.equal(run.relocatedBeforeInstallation, true);
		assert.match(run.checkerVersion, /^mypy 2\.3\.1\b/u);
		for(const key of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256"]) digest(run[key]);
		assert.deepEqual(run.publisher, { compiled: true, sourceSha256: sha256(documentation.author) });
		assert.equal(run.packages.length, 1);
		const pkg = run.packages[0]; assert.equal(pkg.target, "pypi"); assert.equal(pkg.ecosystem, "pypi");
		assert.equal(pkg.role, "component"); assert.equal(pkg.runtimeDelivery, "embedded");
		digest(pkg.runtimeIdentity); assert.equal(pkg.runtimeIdentity, record.reports[0].packages[0].runtimeIdentity);
		assert.equal(pkg.artifacts.length, 1);
		for(const artifact of pkg.artifacts)
		{ digest(artifact.sha256); assert.ok(artifact.bytes > 0); assert.match(artifact.path, /\.whl$/u); }
		assert.deepEqual(run.installations.map(item => item.name), ["3.11-minimum", "3.11-current", "3.12-standard"]);
		for(const installation of run.installations)
		{
			assert.ok(installation.python.startsWith(installation.name.slice(0, 4) + "."));
			assert.equal(installation.dependency?.version ?? null, installation.name === "3.12-standard" ? null : installation.name === "3.11-minimum" ? "4.6.0" : "4.16.0");
			assert.deepEqual(installation.sourceHashes, hashes);
			assert.deepEqual(installation.public, { checks: 925, calls: 720, rejected: 508 });
			assert.deepEqual(installation.acyclic, record.regressions.structured.reports[0].installations[0].public);
			assertPythonRecursiveFaults(installation.faults);
			assert.deepEqual({ ...installation.faults, shapes: undefined }, { checks: 86131, faults: 9984, clears: 4616, closes: 21032, identities: 0, malformed: 29, shapes: undefined });
			assert.deepEqual(installation.faults, record.reports[0].installations[0].faults);
			const lifetime = installation.lifetimes;
			assert.deepEqual({ ...lifetime, recycledThreadIds: undefined }, {
				creatorExitRejections: 16, recycledThreadIds: undefined
				, capacity: 4096, overflowRejected: true, replacementUsable: true
				, finalizationReleased: true, identities: 0 });
			assert.ok(Number.isSafeInteger(lifetime.recycledThreadIds) && lifetime.recycledThreadIds >= 0 && lifetime.recycledThreadIds <= 16);
			for(const flag of ["resolvedOffline", "offlineInstall", "compilerFreeExecution", "relocatedInstallation", "producerHandoffRemoved", "repeatExecution", "installedFilesUnchanged", "malformedOutputRetiresRuntime", "isolatedInMemoryFaultProbe"])
				assert.equal(installation[flag], true, flag);
			assert.deepEqual(installation.documentation, { sourceSha256: sha256(documentation.consumer), checked: true, executed: true });
			digest(installation.installedReceiptSha256); assert.equal(Object.keys(installation.installedFiles).length, 31);
			assert.ok(Object.keys(installation.installedFiles).some(path => path.endsWith("/detail/structured-callable-borrows.h")));
			for(const file of Object.values(installation.installedFiles))
			{ digest(file.sha256); assert.ok(Number.isSafeInteger(file.bytes) && file.bytes >= 0); }
			const typing = installation.typing;
			assert.equal(typing.checked, true); assert.equal(typing.executed, true);
			assert.equal(typing.memoryLimitMiB, 1024); assert.equal(typing.timeoutSeconds, 30);
			assert.equal(typing.sourceSha256, hashes["python-recursive-invalid.py"]);
			assert.deepEqual(typing.rejected.map(item => item.line), [5, 10, 11, 12, 14, 15, 20, 22, 24]);
			for(const rejected of typing.rejected)
			{ assert.equal(rejected.statement, invalid[rejected.line - 1]); assert.ok(Number.isSafeInteger(rejected.errors) && rejected.errors > 0); }
			assert.equal(typing.rejected.reduce((count, item) => count + item.errors, 0), 10);
		}
	}
};

/**
 * Add four Python recursive callback cells and authenticate unchanged history.
 *
 * @param record - Reversible source transitions and immutable execution receipt.
 */
export const assertPythonRecursiveCallableIntegration = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "python-recursive-callable-integration");
	assert.equal(record.baselineRevision, pythonRecursiveCallableBaseline);
	assert.deepEqual(record.scope, pythonRecursiveCallableScope);
	assert.deepEqual(record.inventory, { previousVersion: "0.98.2", version: "0.99.0", previousInstalled: 4790, installed: 4794, total: 6562 });
	const previous = await authenticated(record.previous, phpCiHistoryPath);
	const execution = await authenticated(record.execution, pythonRecursiveCallableExecutionPath);
	await assertPythonRecursiveCallableExecution(execution);
	assert.deepEqual(record.updates.map(update => update.path).sort(), pythonRecursiveCallableChangedPaths);
	assert.deepEqual(Object.keys(record.additions).sort(), pythonRecursiveCallableAddedPaths);
	const paths = [...new Set([...Object.keys(previous.sourceHashes), ...pythonRecursiveCallableChangedPaths, ...pythonRecursiveCallableAddedPaths])].sort();
	assert.deepEqual(Object.keys(record.sourceHashes).sort(), paths);
	for(const path of paths) assert.equal(sha256(await priorSource(path)), record.sourceHashes[path], path);
	const restored = {};
	for(const update of record.updates)
	{
		assert.equal(update.currentSha256, record.sourceHashes[update.path]);
		if(previous.sourceHashes[update.path]) assert.equal(update.previousSha256, previous.sourceHashes[update.path]);
		restored[update.path] = reversePythonRecursiveCallableUpdate(await priorSource(update.path), update);
	}
	for(const [path, hash] of Object.entries(record.additions)) assert.equal(hash, record.sourceHashes[path]);
	const { document: current, ...contracts } = await readTypeSurface(); assert.ok(current.contractVersion);
	const document = JSON.parse(await priorSource("docs/type-surface.v1.json")), old = JSON.parse(restored["docs/type-surface.v1.json"]);
	assert.equal(document.contractVersion, "0.99.0"); assert.equal(old.contractVersion, "0.98.2");
	const cells = typeSurfaceCells(document, contracts), oldCells = typeSurfaceCells(old, contracts);
	const count = values => values.filter(cell => cell.stages.installedExecution.state === "passed").length;
	assert.equal(count(cells), 4794); assert.equal(count(oldCells), 4790); assert.equal(cells.length, 6562);
	const promoted = cells.filter(cell => cell.stages.installedExecution.evidence.includes("python-recursive-callables-installed"));
	assert.equal(promoted.length, 4);
	for(const cell of promoted)
	{
		assert.equal(cell.profile, "python"); assert.equal(cell.shape, "recursive");
		assert.ok(record.scope.paths.includes(cell.path)); assert.ok(record.scope.positions.includes(cell.position));
		assert.ok(cell.hostType && cell.conversionNote);
		for(const stage of Object.values(cell.stages))
			assert.deepEqual({ state: stage.state, evidence: stage.evidence }, { state: "passed", evidence: ["python-recursive-callables-installed"] });
	}
	const oldById = new Map(oldCells.map(cell => [cell.id, cell]));
	for(const cell of cells.filter(cell => !promoted.includes(cell))) assert.deepEqual(cell, oldById.get(cell.id), cell.id);
	const entry = document.evidence.find(item => item.id === "python-recursive-callables-installed");
	assert.deepEqual(entry.artifacts, execution.reports.flatMap(run => run.packages.flatMap(pkg => pkg.artifacts.map(artifact => ({ path: `python/${run.path}/${artifact.path}`, sha256: artifact.sha256 })))));
	assert.ok(entry.files.some(file => file.path === pythonRecursiveCallableExecutionPath));
	await assertPhpCiIntegration(previous);
};
