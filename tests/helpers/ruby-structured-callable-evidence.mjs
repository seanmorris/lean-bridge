/**
 * Bind installed structured Ruby callables to exact sources, gems and cells.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import { structuredCallableExports } from "./structured-callable-fixture.mjs";
import { rubyCallableSignatures } from "./ruby-callable-fixture.mjs";
import { assertRubyStructuredCodegenRegression } from "./ruby-structured-callable-regression.mjs";
import { assertRubyStructuredFaults } from "./ruby-structured-callable-install.mjs";
import { pythonStructuredCallableHistoryPath } from "./python-structured-callable-source-history.mjs";
import { assertPythonStructuredCallableIntegration } from "./python-structured-callable-evidence.mjs";
import { rubyStructuredCallableChangedPaths, reverseRubyStructuredCallableUpdate } from "./ruby-structured-callable-source-history.mjs";

export const rubyStructuredCallableExecutionPath = "docs/evidence/ruby-structured-callables-20260924.json";
export const rubyStructuredCodegenPath = "docs/evidence/ruby-structured-codegen-regression-20260924.json";
export const rubyStructuredCallableAddedPaths = [
	rubyStructuredCallableExecutionPath, rubyStructuredCodegenPath
	, "docs/evidence/ruby-structured-callables-20260924.md"
	, "tests/ruby-structured-callable-contract.test.mjs"
	, "tests/ruby-structured-callable-evidence.test.mjs"
	, "tests/ruby-structured-callables.test.mjs"
	, "tests/fixtures/structured-callable-consumers/ruby.rb"
	, "tests/fixtures/structured-callable-consumers/ruby-values.rb"
	, "tests/fixtures/structured-callable-consumers/ruby-faults.rb"
	, "tests/helpers/ruby-structured-callable-install.mjs"
	, "tests/helpers/ruby-structured-callable-regression.mjs"
	, "tests/helpers/ruby-structured-callable-evidence.mjs"
	, "tests/helpers/ruby-structured-callable-source-history.mjs"
].sort();
export const rubyStructuredCallableScope = {
	profiles: ["ruby"], paths: ["ordinary-source", "reviewed-ir"]
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
 * Require original gems on both paths with failure recovery and complete cleanup.
 *
 * @param record - Captured reports and terminal unfiltered TAP logs.
 */
export const assertRubyStructuredCallableExecution = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "ruby-structured-callable-execution");
	assert.deepEqual(record.scope, rubyStructuredCallableScope);
	passing(record.installed, "tests/ruby-structured-callables.test.mjs", "LEAN_BRIDGE_RUBY_STRUCTURED_CALLABLE_TEST");
	passing(record.primitiveRegression, "tests/ruby-callables.test.mjs", "LEAN_BRIDGE_RUBY_CALLABLE_TEST");
	assert.deepEqual(record.reports.map(run => run.path), rubyStructuredCallableScope.paths);
	assert.deepEqual(record.primitiveReports.map(run => run.path), rubyStructuredCallableScope.paths);
	const sourceHashes = Object.fromEntries(await Promise.all(["ruby", "ruby-values", "ruby-faults"].map(async name => [
		`${name}.rb`
		, sha256(await readFile(`tests/fixtures/structured-callable-consumers/${name}.rb`))
	])));
	const guide = await readFile("docs/consume/ruby.md", "utf8");
	const documented = guide.match(/### Structured callback values\n[\s\S]*?```ruby\n([\s\S]*?)\n```/u)?.[1];
	assert.ok(documented);
	for(const run of record.reports)
	{
		assert.equal(run.profile, "ruby");
		for(const key of ["sourceRemovedBeforeInstallation", "relocatedBeforeInstallation"]) assert.equal(run[key], true);
		assert.deepEqual(run.signatures.map(fn => fn.id).sort(), structuredCallableExports().map(name => `lean:${name}`).sort());
		assert.deepEqual(run.signatures, record.reports[0].signatures);
		for(const key of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256"]) hash(run[key]);
		assert.equal(run.packages.length, 1);
		const pkg = run.packages[0]; assert.equal(pkg.target, "rubygems"); assert.equal(pkg.role, "component");
		assert.equal(pkg.runtimeDelivery, "embedded");
		hash(pkg.runtimeIdentity); assert.equal(pkg.runtimeIdentity, record.reports[0].packages[0].runtimeIdentity);
		assert.equal(pkg.artifacts.length, 1); hash(pkg.artifacts[0].sha256); assert.ok(pkg.artifacts[0].bytes > 0);
		assert.match(pkg.artifacts[0].path, /\.gem$/u);
		const installation = run.installation;
		assert.match(installation.ruby, /^ruby 3\.3\.12 .*\[x86_64-linux\]$/u);
		hash(installation.rubySha256); assert.deepEqual(installation.sourceHashes, sourceHashes);
		assert.deepEqual(installation.public, record.reports[0].installation.public);
		assert.equal(installation.public.checks, 51335);
		assert.equal(installation.public.calls, 1536); assert.equal(installation.public.rejected, 457);
		assert.deepEqual(installation.public.shapes.toSorted(), rubyStructuredCallableScope.shapes);
		assertRubyStructuredFaults(installation.faults);
		assert.equal(installation.faults.faults, 8224); assert.equal(installation.faults.checks, 63242);
		assert.equal(installation.faults.malformed, 15);
		assert.deepEqual(installation.faults, record.reports[0].installation.faults);
		for(const key of ["offlineInstall", "compilerFreeExecution", "relocatedInstallation", "producerHandoffRemoved", "gemCacheRemoved", "repeatExecution", "installedFilesUnchanged", "isolatedInMemoryFaultProbe"]) assert.equal(installation[key], true);
		assert.deepEqual(installation.documentation, { sourceSha256: sha256(documented), executed: true });
		hash(installation.installedReceiptSha256);
		assert.ok(Object.keys(installation.installedFiles).length > 10);
		for(const file of Object.values(installation.installedFiles))
		{
			hash(file.sha256); assert.ok(file.bytes >= 0);
		}
	}
	for(const run of record.primitiveReports)
	{
		assert.equal(run.profile, "ruby"); assert.equal(run.checks, 50912);
		for(const key of ["sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreePath"]) assert.equal(run[key], true);
		assert.equal(run.consumerSha256, sha256(await readFile("tests/fixtures/callable-consumers/ruby.rb")));
		const sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
		assert.deepEqual(sort(run.signatures), sort(rubyCallableSignatures));
	}
};

/**
 * Authenticate every source edit and exactly thirty-two new installed cells.
 *
 * @param record - Frozen predecessor, literal edits and current inventory.
 */
export const assertRubyStructuredCallableIntegration = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "ruby-structured-callable-integration");
	assert.equal(record.baselineRevision, "cbb6fecce821a9a9fef3c06ab93b9c46786c9323");
	assert.deepEqual(record.scope, rubyStructuredCallableScope);
	assert.deepEqual(record.inventory, { previousVersion: "0.89.0", version: "0.90.0", previousInstalled: 4346, installed: 4378, total: 6562 });
	assert.equal(record.previous.path, pythonStructuredCallableHistoryPath);
	const oldBytes = await readFile(record.previous.path); assert.equal(sha256(oldBytes), record.previous.sha256);
	const previous = JSON.parse(oldBytes);
	assert.equal(record.execution.path, rubyStructuredCallableExecutionPath);
	const bytes = await readFile(record.execution.path); assert.equal(sha256(bytes), record.execution.sha256);
	const execution = JSON.parse(bytes); await assertRubyStructuredCallableExecution(execution);
	assert.equal(record.codegen.path, rubyStructuredCodegenPath);
	const codegenBytes = await readFile(record.codegen.path); assert.equal(sha256(codegenBytes), record.codegen.sha256);
	const codegen = JSON.parse(codegenBytes); assertRubyStructuredCodegenRegression(codegen);
	assert.deepEqual(record.updates.map(update => update.path).sort(), rubyStructuredCallableChangedPaths);
	assert.deepEqual(Object.keys(record.additions).sort(), rubyStructuredCallableAddedPaths);
	const paths = [...new Set([...Object.keys(previous.sourceHashes), ...rubyStructuredCallableChangedPaths, ...rubyStructuredCallableAddedPaths])].sort();
	assert.deepEqual(Object.keys(record.sourceHashes).sort(), paths);
	for(const path of paths) assert.equal(sha256(await readFile(path)), record.sourceHashes[path], path);
	const restored = {};
	for(const update of record.updates)
	{
		assert.equal(update.currentSha256, record.sourceHashes[update.path]);
		restored[update.path] = reverseRubyStructuredCallableUpdate(await readFile(update.path, "utf8"), update);
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
	const promoted = cells.filter(cell => cell.stages.installedExecution.evidence.includes("ruby-structured-callables-installed"));
	assert.equal(promoted.length, 32);
	for(const cell of promoted)
	{
		assert.equal(cell.profile, "ruby"); assert.ok(rubyStructuredCallableScope.shapes.includes(cell.shape));
		assert.ok(rubyStructuredCallableScope.paths.includes(cell.path)); assert.ok(rubyStructuredCallableScope.positions.includes(cell.position));
		assert.ok(cell.hostType && cell.conversionNote);
		for(const stage of Object.values(cell.stages)) assert.deepEqual({ state: stage.state, evidence: stage.evidence }, { state: "passed", evidence: ["ruby-structured-callables-installed"] });
	}
	const oldById = new Map(oldCells.map(cell => [cell.id, cell]));
	for(const cell of cells.filter(cell => !promoted.includes(cell))) assert.deepEqual(cell, oldById.get(cell.id), cell.id);
	const entry = document.evidence.find(item => item.id === "ruby-structured-callables-installed");
	assert.deepEqual(entry.artifacts, execution.reports.flatMap(run => run.packages.flatMap(pkg => pkg.artifacts.map(artifact => ({ path: `ruby/${run.path}/${artifact.path}`, sha256: artifact.sha256 })))));
	assert.ok(entry.files.some(file => file.path === rubyStructuredCallableExecutionPath));
	await assertPythonStructuredCallableIntegration(previous);
};
