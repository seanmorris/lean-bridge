/**
 * Bind recursive Ruby support to original installed gems and exact sources.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import { assertRustRecursiveCallableIntegration } from "./rust-recursive-callable-evidence.mjs";
import { rustRecursiveCallableHistoryPath } from "./rust-recursive-callable-source-history.mjs";
import { assertRubyStructuredCallableExecution, rubyStructuredCallableExecutionPath } from "./ruby-structured-callable-evidence.mjs";
import { assertRubyRecursiveFaults, rubyRecursiveConsumerSources } from "./ruby-recursive-callable-install.mjs";
import { rubyRecursiveCallableDocumentation } from "./ruby-recursive-callable-docs.mjs";
import { rubyRecursiveCallableChangedPaths, reverseRubyRecursiveCallableUpdate } from "./ruby-recursive-callable-source-history.mjs";
import { beforePerlRecursiveCallables } from "./perl-recursive-callable-source-history.mjs";

const priorSource = async path => beforePerlRecursiveCallables(path, await readFile(path, "utf8"));

export const rubyRecursiveCallableBaseline = "8dcaf9b69beb73b756743e36c075f58c2bc82f86";
export const rubyRecursiveCallableExecutionPath = "docs/evidence/ruby-recursive-callables-20260925.json";
export const rubyRecursiveCallableAddedPaths = [
	rubyRecursiveCallableExecutionPath
	, "docs/evidence/ruby-recursive-callables-20260925.md"
	, "src/backends/ruby/callable-graph-model.mjs"
	, "src/backends/ruby/callable-graph-conversions.mjs"
	, "src/backends/ruby/callable-graph-package.mjs"
	, ...["ruby-recursive", "ruby-recursive-faults", "ruby-recursive-lifetimes", "ruby-recursive-ownership", "ruby-recursive-poison"].map(name => `tests/fixtures/structured-callable-consumers/${name}.rb`)
	, "tests/helpers/ruby-recursive-callable-docs.mjs"
	, "tests/helpers/ruby-recursive-callable-install.mjs"
	, "tests/helpers/ruby-recursive-callable-evidence.mjs"
	, "tests/helpers/ruby-recursive-callable-source-history.mjs"
	, "tests/ruby-recursive-callable-contract.test.mjs"
	, "tests/ruby-recursive-callable-evidence.test.mjs"
	, "tests/ruby-recursive-callables.test.mjs"
].sort();
export const rubyRecursiveCallableScope = {
	profiles: ["ruby"], paths: ["ordinary-source", "reviewed-ir"]
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
 * Require original packages, public values, failure recovery and exact examples.
 *
 * @param record - Terminal logs and original installed-package reports.
 */
export const assertRubyRecursiveCallableExecution = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "ruby-recursive-callable-execution");
	assert.equal(record.baselineRevision, rubyRecursiveCallableBaseline);
	assert.deepEqual(record.scope, rubyRecursiveCallableScope);
	passing(record.installed, 1); passing(record.contract, 4); passing(record.regressions.installed, 2);
	assert.ok(record.installed.command.includes("LEAN_BRIDGE_RUBY_RECURSIVE_CALLABLE_TEST=1"));
	assert.ok(record.installed.command.includes("tests/ruby-recursive-callables.test.mjs"));
	assert.ok(record.contract.command.includes("tests/ruby-recursive-callable-contract.test.mjs"));
	for(const [flag, file] of [["CALLABLE", "callables"], ["STRUCTURED_CALLABLE", "structured-callables"]])
	{
		assert.ok(record.regressions.installed.command.includes(`LEAN_BRIDGE_RUBY_${flag}_TEST=1`));
		assert.ok(record.regressions.installed.command.includes(`tests/ruby-${file}.test.mjs`));
	}
	const old = await authenticated(record.previousRubyExecution, rubyStructuredCallableExecutionPath);
	await assertRubyStructuredCallableExecution({ ...old, reports: record.regressions.structured.reports, primitiveReports: record.regressions.primitive.reports });
	assert.deepEqual(record.reports.map(run => run.path), rubyRecursiveCallableScope.paths);
	const documentation = await rubyRecursiveCallableDocumentation();
	const sourceHashes = Object.fromEntries(Object.entries(await rubyRecursiveConsumerSources()).map(([name, source]) => [name, sha256(source)]));
	for(const run of record.reports)
	{
		assert.equal(run.profile, "ruby"); assert.equal(run.exports, 33); assert.equal(run.signatures, 18);
		for(const key of ["sourceRemovedBeforeInstallation", "relocatedBeforeInstallation"]) assert.equal(run[key], true, key);
		for(const key of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256"]) digest(run[key]);
		assert.deepEqual(run.publisher, { compiled: true, sourceSha256: sha256(documentation.author) });
		assert.equal(run.packages.length, 1);
		const pkg = run.packages[0]; assert.equal(pkg.target, "rubygems"); assert.equal(pkg.ecosystem, "rubygems");
		assert.equal(pkg.role, "component"); assert.equal(pkg.runtimeDelivery, "embedded");
		digest(pkg.runtimeIdentity); assert.equal(pkg.runtimeIdentity, record.reports[0].packages[0].runtimeIdentity);
		assert.equal(pkg.artifacts.length, 1);
		for(const artifact of pkg.artifacts)
		{ digest(artifact.sha256); assert.ok(artifact.bytes > 0); assert.match(artifact.path, /\.gem$/u); }
		const installation = run.installation;
		assert.deepEqual(installation.public, { checks: 379 });
		assert.deepEqual(installation.acyclic, record.regressions.structured.reports[0].installation.public);
		assert.match(installation.ruby, /^ruby 3\.3\.12 .*\[x86_64-linux\]$/u);
		digest(installation.rubySha256); assert.deepEqual(installation.sourceHashes, sourceHashes);
		for(const key of ["offlineInstall", "compilerFreeExecution", "relocatedInstallation", "producerHandoffRemoved", "gemCacheRemoved", "repeatExecution", "installedFilesUnchanged", "isolatedInMemoryFaultProbe", "malformedOutputRetiresRuntime"])
			assert.equal(installation[key], true, key);
		assert.deepEqual(installation.documentation, { sourceSha256: sha256(documentation.consumer), executed: true });
		assertRubyRecursiveFaults(installation.faults);
		assert.deepEqual({ ...installation.faults, shapes: undefined }, { checks: 84939, faults: 9958, clears: 4518, closes: 20952, conversion_methods: 60, identities: 0, shapes: undefined });
		assert.deepEqual(installation.faults, record.reports[0].installation.faults);
		assert.equal(installation.ownershipChecks, 9);
		assert.deepEqual(installation.counterfactuals, [
			{ name: "ownership", rejected: true, marker: "9 Callback owners released before native copying" }
			, { name: "poison", rejected: true, marker: "Retired runtime reentered" }
		]);
		const lifetime = installation.lifetimes;
		assert.deepEqual({ ...lifetime, recycled_thread_ids: undefined }, {
			creator_exit_rejections: 16, recycled_thread_ids: undefined
			, capacity: 4096, overflow_rejected: true, replacement_usable: true
			, finalization_released: true, identities: 0 });
		assert.ok(Number.isSafeInteger(lifetime.recycled_thread_ids) && lifetime.recycled_thread_ids >= 0 && lifetime.recycled_thread_ids <= 16);
		digest(installation.installedReceiptSha256);
		assert.equal(Object.keys(installation.installedFiles).length, 28);
		for(const path of ["lib/lean_bridge/structured.rb", "lib/lean_bridge/structured/native.rb", "lean-bridge/include/detail/structured-callable-borrows.h"])
			assert.ok(installation.installedFiles[path]);
		for(const file of Object.values(installation.installedFiles))
		{ digest(file.sha256); assert.ok(Number.isSafeInteger(file.bytes) && file.bytes >= 0); }
	}
};

/**
 * Add four Ruby recursive callback cells and authenticate unchanged history.
 *
 * @param record - Reversible source transitions and immutable execution receipt.
 */
export const assertRubyRecursiveCallableIntegration = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "ruby-recursive-callable-integration");
	assert.equal(record.baselineRevision, rubyRecursiveCallableBaseline);
	assert.deepEqual(record.scope, rubyRecursiveCallableScope);
	assert.deepEqual(record.inventory, { previousVersion: "0.100.0", version: "0.101.0", previousInstalled: 4798, installed: 4802, total: 6562 });
	const previous = await authenticated(record.previous, rustRecursiveCallableHistoryPath);
	const execution = await authenticated(record.execution, rubyRecursiveCallableExecutionPath);
	await assertRubyRecursiveCallableExecution(execution);
	assert.deepEqual(record.updates.map(update => update.path).sort(), rubyRecursiveCallableChangedPaths);
	assert.deepEqual(Object.keys(record.additions).sort(), rubyRecursiveCallableAddedPaths);
	const paths = [...new Set([...Object.keys(previous.sourceHashes), ...rubyRecursiveCallableChangedPaths, ...rubyRecursiveCallableAddedPaths])].sort();
	assert.deepEqual(Object.keys(record.sourceHashes).sort(), paths);
	for(const path of paths) assert.equal(sha256(await priorSource(path)), record.sourceHashes[path], path);
	const restored = {};
	for(const update of record.updates)
	{
		assert.equal(update.currentSha256, record.sourceHashes[update.path]);
		if(previous.sourceHashes[update.path]) assert.equal(update.previousSha256, previous.sourceHashes[update.path]);
		restored[update.path] = reverseRubyRecursiveCallableUpdate(await priorSource(update.path), update);
	}
	for(const [path, hash] of Object.entries(record.additions)) assert.equal(hash, record.sourceHashes[path]);
	const { document: current, ...contracts } = await readTypeSurface(); void current;
	const document = JSON.parse(await priorSource("docs/type-surface.v1.json")), old = JSON.parse(restored["docs/type-surface.v1.json"]);
	assert.equal(document.contractVersion, "0.101.0"); assert.equal(old.contractVersion, "0.100.0");
	const cells = typeSurfaceCells(document, contracts), oldCells = typeSurfaceCells(old, contracts);
	const count = values => values.filter(cell => cell.stages.installedExecution.state === "passed").length;
	assert.equal(count(cells), 4802); assert.equal(count(oldCells), 4798); assert.equal(cells.length, 6562);
	const promoted = cells.filter(cell => cell.stages.installedExecution.evidence.includes("ruby-recursive-callables-installed"));
	assert.equal(promoted.length, 4);
	for(const cell of promoted)
	{
		assert.equal(cell.profile, "ruby"); assert.equal(cell.shape, "recursive");
		assert.ok(record.scope.paths.includes(cell.path)); assert.ok(record.scope.positions.includes(cell.position));
		assert.ok(cell.hostType && cell.conversionNote);
		for(const stage of Object.values(cell.stages))
			assert.deepEqual({ state: stage.state, evidence: stage.evidence }, { state: "passed", evidence: ["ruby-recursive-callables-installed"] });
	}
	const oldById = new Map(oldCells.map(cell => [cell.id, cell]));
	for(const cell of cells.filter(cell => !promoted.includes(cell))) assert.deepEqual(cell, oldById.get(cell.id), cell.id);
	const entry = document.evidence.find(item => item.id === "ruby-recursive-callables-installed");
	assert.deepEqual(entry.artifacts, execution.reports.flatMap(run => run.packages.flatMap(pkg => pkg.artifacts.map(artifact => ({ path: `ruby/${run.path}/${artifact.path}`, sha256: artifact.sha256 })))));
	assert.ok(entry.files.some(file => file.path === rubyRecursiveCallableExecutionPath));
	await assertRustRecursiveCallableIntegration(previous);
};
