/**
 * Bind recursive Rust support to original installed crates and exact sources.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import { compileCallableRustGraphPackageModel } from "../../src/backends/rust/callable-graph-model.mjs";
import { assertPythonRecursiveCallableIntegration } from "./python-recursive-callable-evidence.mjs";
import { pythonRecursiveCallableHistoryPath } from "./python-recursive-callable-source-history.mjs";
import { assertRustStructuredCallableExecution, rustStructuredCallableExecutionPath } from "./rust-structured-callable-evidence.mjs";
import { rustRecursiveCallableDocumentation } from "./rust-recursive-callable-docs.mjs";
import { nativeRecursiveCallableReviewedIr } from "./native-recursive-callable-fixture.mjs";
import { rustRecursiveOwnershipTests, rustRecursivePoisonTests } from "./rust-recursive-callable-probes.mjs";
import { rustRecursiveCallableChangedPaths, reverseRustRecursiveCallableUpdate } from "./rust-recursive-callable-source-history.mjs";

export const rustRecursiveCallableBaseline = "172baa67067a549454fb79449d205f939474e58b";
export const rustRecursiveCallableExecutionPath = "docs/evidence/rust-recursive-callables-20260925.json";
export const rustRecursiveCallableAddedPaths = [
	rustRecursiveCallableExecutionPath
	, "docs/evidence/rust-recursive-callables-20260925.md"
	, "src/backends/rust/callable-graph-model.mjs"
	, "src/backends/rust/callable-graph-conversions.mjs"
	, "src/backends/rust/callable-graph-package.mjs"
	, "tests/fixtures/structured-callable-consumers/rust-recursive.rs"
	, "tests/fixtures/structured-callable-consumers/rust-recursive-faults.rs"
	, "tests/helpers/rust-recursive-callable-docs.mjs"
	, "tests/helpers/rust-recursive-callable-install.mjs"
	, "tests/helpers/rust-recursive-callable-probes.mjs"
	, "tests/helpers/rust-recursive-callable-evidence.mjs"
	, "tests/helpers/rust-recursive-callable-source-history.mjs"
	, "tests/rust-recursive-callable-contract.test.mjs"
	, "tests/rust-recursive-callable-evidence.test.mjs"
	, "tests/rust-recursive-callables.test.mjs"
].sort();
export const rustRecursiveCallableScope = {
	profiles: ["rust"], paths: ["ordinary-source", "reviewed-ir"]
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
 * Require installed paths, linker isolation, failure checks and exact examples.
 *
 * @param record - Original terminal logs and installed-package reports.
 */
export const assertRustRecursiveCallableExecution = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "rust-recursive-callable-execution");
	assert.equal(record.baselineRevision, rustRecursiveCallableBaseline);
	assert.deepEqual(record.scope, rustRecursiveCallableScope);
	passing(record.installed, 1); passing(record.contract, 3); passing(record.regressions.installed, 2);
	assert.ok(record.installed.command.includes("LEAN_BRIDGE_RUST_RECURSIVE_CALLABLE_TEST=1"));
	assert.ok(record.installed.command.includes("tests/rust-recursive-callables.test.mjs"));
	assert.ok(record.contract.command.includes("tests/rust-recursive-callable-contract.test.mjs"));
	for(const [flag, file] of [["CALLABLE", "callables"], ["STRUCTURED_CALLABLE", "structured-callables"]])
	{
		assert.ok(record.regressions.installed.command.includes(`LEAN_BRIDGE_RUST_${flag}_TEST=1`));
		assert.ok(record.regressions.installed.command.includes(`tests/rust-${file}.test.mjs`));
	}
	const old = await authenticated(record.previousRustExecution, rustStructuredCallableExecutionPath);
	await assertRustStructuredCallableExecution({ ...old
		, reports: record.regressions.structured.reports
		, primitiveReports: record.regressions.primitive.reports });
	assert.deepEqual(record.reports.map(run => run.path), rustRecursiveCallableScope.paths);
	const documentation = await rustRecursiveCallableDocumentation();
	const consumerHash = sha256(await readFile("tests/fixtures/structured-callable-consumers/rust-recursive.rs"));
	const faultHash = sha256(await readFile("tests/fixtures/structured-callable-consumers/rust-recursive-faults.rs"));
	const ir = nativeRecursiveCallableReviewedIr();
	// Both installed paths retain compiler order, including reviewed contracts.
	// Private callback indices therefore follow type IDs, not fixture insertion.
	ir.types.sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
	const projection = compileCallableRustGraphPackageModel(ir);
	const ownershipHash = sha256(rustRecursiveOwnershipTests(projection)), poisonHash = sha256(rustRecursivePoisonTests(projection));
	for(const run of record.reports)
	{
		assert.equal(run.profile, "rust"); assert.equal(run.exports, 33); assert.equal(run.signatures, 18);
		for(const key of ["sourceRemovedBeforeInstallation", "relocatedBeforeInstallation", "sourcesAndArchivesRemovedBeforeExecution"])
			assert.equal(run[key], true, key);
		for(const key of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256", "executableSha256"]) digest(run[key]);
		assert.deepEqual(run.publisher, { compiled: true, sourceSha256: sha256(documentation.author) });
		assert.equal(run.packages.length, 1);
		const pkg = run.packages[0]; assert.equal(pkg.target, "cargo"); assert.equal(pkg.ecosystem, "cargo");
		assert.equal(pkg.role, "component"); assert.equal(pkg.runtimeDelivery, "embedded");
		digest(pkg.runtimeIdentity); assert.equal(pkg.runtimeIdentity, record.reports[0].packages[0].runtimeIdentity);
		assert.equal(pkg.artifacts.length, 1);
		for(const artifact of pkg.artifacts)
		{ digest(artifact.sha256); assert.ok(artifact.bytes > 0); assert.match(artifact.path, /\.crate$/u); }
		const installation = run.installation;
		assert.equal(installation.checks, 2349); assert.equal(installation.consumerSha256, consumerHash);
		assert.match(installation.rustcVersion, /^rustc 1\.90\.0 /u);
		assert.match(installation.cargoVersion, /^cargo 1\.90\.0 /u);
		for(const key of ["offlineInstall", "compilerFreePath", "emptyCargoHome", "linkOnly"])
			assert.equal(installation[key], true, key);
		digest(installation.linkerSha256);
		assert.deepEqual(installation.rejectedLinkInputs, ["-c", "-S", "-E", "-xc", "-fsyntax-only", "input.c", "input.cpp", "input.s", "@arguments"]);
		const dependencies = run.dependencies;
		digest(dependencies.sha256); digest(dependencies.lockSha256);
		assert.equal(dependencies.packages.length, 14);
		for(const dependency of dependencies.packages)
		{ digest(dependency.checksum); digest(dependency.manifestSha256); assert.ok(dependency.files > 0); }
		assert.equal(installation.verifiedDependencyFiles, dependencies.packages.reduce((count, pkg) => count + pkg.files, 0));
		const safety = run.safety;
		assert.deepEqual(safety.documentation, { sourceSha256: sha256(documentation.consumer), compiled: true, executed: true });
		assert.equal(safety.faultSourceSha256, faultHash); assert.equal(safety.faultTests, 1); assert.equal(safety.ownershipTests, 9);
		assert.deepEqual(safety.faults, Object.entries({ array: 90, list: 90, option: 16, result: 70, tuple: 94, record: 160, variant: 112, alias: 160, recursive: 134 })
			.map(([shape, failures]) => ({ shape, cases: 5, failures })));
		assert.equal(safety.faults.reduce((total, item) => total + item.failures, 0), 926);
		for(const key of ["malformedOutputRetiresRuntime", "missingCallbackOwnerRejected", "missingRetirementRejected", "installedFilesUnchanged"])
			assert.equal(safety[key], true, key);
		for(const key of ["ownershipSourceSha256", "poisonSourceSha256", "installedReceiptSha256"]) digest(safety[key]);
		assert.equal(safety.ownershipSourceSha256, ownershipHash); assert.equal(safety.poisonSourceSha256, poisonHash);
		assert.equal(Object.keys(safety.installedFiles).length, 26);
		for(const path of ["src/lib.rs", "src/__runtime.rs", "Cargo.lock", "lean-bridge/native-rust.json"])
			assert.ok(safety.installedFiles[path]);
		for(const file of Object.values(safety.installedFiles))
		{ digest(file.sha256); assert.ok(Number.isSafeInteger(file.bytes) && file.bytes >= 0); }
		assert.deepEqual(safety.rejected.map(item => item.name), ["argument", "callback-argument", "callback-result", "borrowed-result", "recursive-child", "closure-argument", "closure-result", "send", "sync", "clone", "async", "moved"]);
		assert.deepEqual(safety.rejected.map(item => item.code), ["E0308", "E0631", "E0308", "E0308", "E0308", "E0308", "E0308", "E0277", "E0277", "E0599", "E0308", "E0382"]);
		for(const rejected of safety.rejected)
		{ digest(rejected.sourceSha256); assert.ok(Number.isSafeInteger(rejected.diagnostics) && rejected.diagnostics > 0); }
	}
};

/**
 * Add four Rust recursive callback cells and authenticate unchanged history.
 *
 * @param record - Reversible source transitions and immutable execution receipt.
 */
export const assertRustRecursiveCallableIntegration = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "rust-recursive-callable-integration");
	assert.equal(record.baselineRevision, rustRecursiveCallableBaseline);
	assert.deepEqual(record.scope, rustRecursiveCallableScope);
	assert.deepEqual(record.inventory, { previousVersion: "0.99.0", version: "0.100.0", previousInstalled: 4794, installed: 4798, total: 6562 });
	const previous = await authenticated(record.previous, pythonRecursiveCallableHistoryPath);
	const execution = await authenticated(record.execution, rustRecursiveCallableExecutionPath);
	await assertRustRecursiveCallableExecution(execution);
	assert.deepEqual(record.updates.map(update => update.path).sort(), rustRecursiveCallableChangedPaths);
	assert.deepEqual(Object.keys(record.additions).sort(), rustRecursiveCallableAddedPaths);
	const paths = [...new Set([...Object.keys(previous.sourceHashes), ...rustRecursiveCallableChangedPaths, ...rustRecursiveCallableAddedPaths])].sort();
	assert.deepEqual(Object.keys(record.sourceHashes).sort(), paths);
	for(const path of paths) assert.equal(sha256(await readFile(path)), record.sourceHashes[path], path);
	const restored = {};
	for(const update of record.updates)
	{
		assert.equal(update.currentSha256, record.sourceHashes[update.path]);
		if(previous.sourceHashes[update.path]) assert.equal(update.previousSha256, previous.sourceHashes[update.path]);
		restored[update.path] = reverseRustRecursiveCallableUpdate(await readFile(update.path, "utf8"), update);
	}
	for(const [path, hash] of Object.entries(record.additions)) assert.equal(hash, record.sourceHashes[path]);
	const { document, ...contracts } = await readTypeSurface(), old = JSON.parse(restored["docs/type-surface.v1.json"]);
	assert.equal(document.contractVersion, "0.100.0"); assert.equal(old.contractVersion, "0.99.0");
	const cells = typeSurfaceCells(document, contracts), oldCells = typeSurfaceCells(old, contracts);
	const count = values => values.filter(cell => cell.stages.installedExecution.state === "passed").length;
	assert.equal(count(cells), 4798); assert.equal(count(oldCells), 4794); assert.equal(cells.length, 6562);
	const promoted = cells.filter(cell => cell.stages.installedExecution.evidence.includes("rust-recursive-callables-installed"));
	assert.equal(promoted.length, 4);
	for(const cell of promoted)
	{
		assert.equal(cell.profile, "rust"); assert.equal(cell.shape, "recursive");
		assert.ok(record.scope.paths.includes(cell.path)); assert.ok(record.scope.positions.includes(cell.position));
		assert.ok(cell.hostType && cell.conversionNote);
		for(const stage of Object.values(cell.stages))
			assert.deepEqual({ state: stage.state, evidence: stage.evidence }, { state: "passed", evidence: ["rust-recursive-callables-installed"] });
	}
	const oldById = new Map(oldCells.map(cell => [cell.id, cell]));
	for(const cell of cells.filter(cell => !promoted.includes(cell))) assert.deepEqual(cell, oldById.get(cell.id), cell.id);
	const entry = document.evidence.find(item => item.id === "rust-recursive-callables-installed");
	assert.deepEqual(entry.artifacts, execution.reports.flatMap(run => run.packages.flatMap(pkg => pkg.artifacts.map(artifact => ({ path: `rust/${run.path}/${artifact.path}`, sha256: artifact.sha256 })))));
	assert.ok(entry.files.some(file => file.path === rustRecursiveCallableExecutionPath));
	await assertPythonRecursiveCallableIntegration(previous);
};
