/**
 * Bind WIT structured callback claims to installed archives and owned replies.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { readTypeSurface, typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import { compileCopiedWitModel } from "../../src/backends/wit/copied-model.mjs";
import { renderWitHostSource } from "../../src/backends/wit/copied-host.mjs";
import { structuredCallableReviewedIr } from "./structured-callable-fixture.mjs";
import { witCallableSignatures } from "./wit-callable-fixture.mjs";
import { witStructuredConsumer, witStructuredSignatures } from "./wit-structured-callable-fixture.mjs";
import { witNestedAliasConsumer, witNestedAliasReviewedIr } from "./wit-structured-alias-fixture.mjs";
import { witStructuredFaultProbe } from "./wit-structured-callable-faults.mjs";
import { assertWitStructuredCodegenRegression } from "./wit-structured-callable-regression.mjs";
import { assertPhpWasmStructuredCallableIntegration } from "./php-wasm-structured-callable-evidence.mjs";
import { phpWasmStructuredCallableHistoryPath } from "./php-wasm-structured-callable-source-history.mjs";
import { witStructuredCallableChangedPaths, reverseWitStructuredCallableUpdate } from "./wit-structured-callable-source-history.mjs";

export const witStructuredCallableExecutionPath = "docs/evidence/wit-structured-callables-20260925.json";
export const witStructuredCodegenPath = "docs/evidence/wit-structured-codegen-regression-20260925.json";
export const witStructuredCallableScope = {
	profiles: ["wit-wasi"], paths: ["ordinary-source", "reviewed-ir"]
	, shapes: ["alias", "array", "list", "option", "record", "result", "tuple", "variant"]
	, positions: ["callback-parameter", "callback-result"]
	, recursiveCallbacks: false, ownedResourceAggregates: false
};
export const witStructuredCallableAddedPaths = [
	witStructuredCallableExecutionPath, witStructuredCodegenPath
	, "docs/evidence/wit-structured-callables-20260925.md"
	, "src/backends/wit/callable-result-owners.mjs"
	, "tests/fixtures/documentation/consumers/wit-wasi/structured.c"
	, "tests/fixtures/structured-callable-consumers/wit-aliases.c"
	, "tests/fixtures/structured-callable-consumers/wit-aliases.lean"
	, "tests/fixtures/structured-callable-consumers/wit-wasi.c"
	, "tests/helpers/wit-structured-alias-fixture.mjs"
	, "tests/helpers/wit-structured-callable-evidence.mjs"
	, "tests/helpers/wit-structured-callable-faults.mjs"
	, "tests/helpers/wit-structured-callable-fixture.mjs"
	, "tests/helpers/wit-structured-callable-regression.mjs"
	, "tests/helpers/wit-structured-callable-source-history.mjs"
	, "tests/native-callback-alias-contract.test.mjs"
	, "tests/wit-structured-aliases.test.mjs"
	, "tests/wit-structured-callable-contract.test.mjs"
	, "tests/wit-structured-callable-evidence.test.mjs"
	, "tests/wit-structured-callable-faults.test.mjs"
	, "tests/wit-structured-callables.test.mjs"
	, "tests/wit-structured-documentation.test.mjs"
].sort();
const hash = value => assert.match(value, /^[a-f0-9]{64}$/u);
const passing = (run, environment, tests) => {
	assert.equal(run.exitCode, 0); assert.ok(run.command.includes(environment + "=1"));
	assert.equal(sha256(run.text), run.sha256);
	assert.match(run.text, new RegExp(`# tests ${tests}\\n# suites 0\\n# pass ${tests}\\n# fail 0\\n# cancelled 0\\n# skipped 0`, "u"));
};
const reports = record => {
	assert.equal(record.schemaVersion, 1);
	assert.deepEqual(record.reports.map(run => run.path), witStructuredCallableScope.paths);
	return record.reports;
};
const packages = run => {
	assert.equal(run.packages.length, 1);
	const pkg = run.packages[0];
	assert.equal(pkg.ecosystem, "wit-wasi"); assert.equal(pkg.role, "component");
	hash(pkg.runtimeIdentity); assert.equal(pkg.artifacts.length, 1);
	const artifact = pkg.artifacts[0]; hash(artifact.sha256);
	assert.match(artifact.path, /^archives\/.+-wit-wasi\.tar\.gz$/u);
	assert.ok(Number.isSafeInteger(artifact.bytes) && artifact.bytes > 0);
	for(const key of ["bindingIrSha256", "sourceTreeSha256"]) hash(run[key]);
	assert.equal(run.sourceRemovedBeforeInstallation, true);
};
const installation = run => {
	packages(run);
	for(const flag of ["offlineInstall", "compilerFreePath"]) assert.equal(run[flag], true, flag);
	for(const key of ["modelSha256", "consumerSha256"]) hash(run[key]);
};

/**
 * Authenticate both installed source paths, executable examples and fault probes.
 *
 * @param record - Unedited terminal logs and execution observations.
 */
export const assertWitStructuredCallableExecution = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "wit-structured-callable-execution");
	assert.deepEqual(record.scope, witStructuredCallableScope);
	passing(record.installed, "LEAN_BRIDGE_WIT_STRUCTURED_CALLABLE_TEST", 11);
	passing(record.boundInterface, "LEAN_BRIDGE_WIT_STRUCTURED_CALLABLE_TEST", 1);
	assert.ok(record.boundInterface.command.includes("tests/wit-structured-callables.test.mjs"));
	for(const name of ["native-callback-alias-contract", "wit-structured-callable-contract", "wit-structured-callable-faults", "wit-structured-callables", "wit-structured-aliases", "wit-structured-documentation"])
		assert.ok(record.installed.command.includes(`tests/${name}.test.mjs`));
	const expected = witStructuredSignatures(structuredCallableReviewedIr());
	for(const run of reports(record.report))
	{
		installation(run); assert.equal(run.profile, "wit-wasi");
		assert.equal(hashBindingIr(run.bindingIr), run.bindingIrSha256);
		assert.deepEqual(witStructuredSignatures(run.bindingIr), expected);
		assert.deepEqual(run.signatures, expected);
		const model = compileCopiedWitModel(run.bindingIr, {}, { callables: true });
		assert.equal(run.consumerSha256, sha256(await witStructuredConsumer(model)));
		assert.equal(run.checks, 470573);
		const { libraries, ...result } = run.result;
		assert.deepEqual(result, { checks: 470573, calls: 3911, callbacks: 3493, rejected: 52, finalized: 401, shapes: 8 });
		assert.ok(Array.isArray(libraries) && libraries.length >= 6);
		assert.deepEqual(run.repeatedExecution, run.result);
		assert.equal(run.handoffRemovedBeforeRepeatedExecution, true);
		assert.equal(run.installedFilesUnchanged, true); hash(run.receiptSha256);
		assert.equal(Object.keys(run.libraries).length, 6);
		for(const name of ["libstructured_wasmtime.so", "libstructured.so", "libwasmtime.so", "liblean_bridge_native.so", "libleanshared.so"])
			assert.ok(run.libraries[name], name);
		for(const [name, file] of Object.entries(run.libraries))
		{
			hash(file.sha256); assert.equal(run.installedFiles[file.path]?.sha256, file.sha256);
			assert.ok(libraries.some(path => path.endsWith("/" + name)));
		}
		assert.ok(Object.keys(run.installedFiles).length > 10);
		for(const file of Object.values(run.installedFiles))
		{ hash(file.sha256); assert.ok(Number.isSafeInteger(file.bytes) && file.bytes >= 0); }
	}
	const aliasModel = compileCopiedWitModel(witNestedAliasReviewedIr(), {}, { callables: true });
	const aliasConsumer = sha256(await witNestedAliasConsumer(aliasModel));
	for(const run of reports(record.aliases))
	{
		installation(run); assert.equal(run.handoffRemovedBeforeRepeatedExecution, true);
		assert.equal(run.consumerSha256, aliasConsumer); assert.equal(run.checks, 56065);
		assert.deepEqual(run.result, { checks: 56065, callbacks: 576, finalized: 192, rejected: 192 });
	}
	const model = compileCopiedWitModel(structuredCallableReviewedIr(), {}, { callables: true });
	const faults = record.faults;
	assert.equal(faults.schemaVersion, 1);
	assert.equal(faults.sourceSha256, sha256(renderWitHostSource(model, new Uint8Array([0]))));
	assert.equal(faults.consumerSha256, sha256(await witStructuredFaultProbe(model)));
	assert.equal(faults.missingReferenceRejected, true);
	assert.equal(faults.retainedConstructionReferenceRejected, true);
	assert.deepEqual(faults.normal, { checks: 70148, successes: 464, failures: 368, injected: 176, live: 0 });
	assert.deepEqual(faults.sanitized, faults.normal);
	const publisher = (await readFile("docs/publish/wit-wasi.md", "utf8")).split("## Export structured callbacks\n")[1]?.split("## Export named copied aliases\n")[0];
	const lean = publisher?.match(/```lean\n([\s\S]*?)\n```/u)?.[1];
	const config = JSON.parse(publisher?.match(/```json\n([\s\S]*?)\n```/u)?.[1] ?? "null");
	assert.ok(lean && config);
	const source = (await readFile("docs/consume/wit-wasi.md", "utf8")).match(/```c file=wit-wasi\/structured\.c\n([\s\S]*?)\n```/u)?.[1];
	assert.ok(source);
	assert.equal(source + "\n", await readFile("tests/fixtures/documentation/consumers/wit-wasi/structured.c", "utf8"));
	for(const run of reports(record.documentation))
	{
		packages(run);
		for(const flag of ["handoffRemovedBeforeExecution", "compilerFreeExecution", "installedFilesUnchanged"]) assert.equal(run[flag], true, flag);
		assert.equal(run.publisherSourceSha256, sha256(lean + "\n"));
		assert.equal(run.configurationSha256, sha256(canonicalJson(config)));
		assert.equal(run.consumerSourceSha256, sha256(source + "\n"));
		hash(run.executableSha256); assert.equal(run.stdout, "echo\n"); assert.equal(run.repeatedExecutions, 2);
	}
	const regression = record.primitiveRegression;
	passing(regression, "LEAN_BRIDGE_WIT_CALLABLE_TEST", 1);
	assert.ok(regression.command.includes("tests/wit-callables.test.mjs"));
	const unary = { callback: { parameters: ["uint32"], result: "uint32" } };
	const primitiveSignatures = [...witCallableSignatures
		, { name: "Callables.retainCallback", parameters: [unary], result: unary }
		, { name: "Callables.makeAdder", parameters: ["uint32"], result: unary }];
	const sorted = values => values.toSorted((a, b) => a.name.localeCompare(b.name));
	for(const run of reports(regression.report))
	{ installation(run); assert.equal(run.profile, "wit-wasi"); assert.deepEqual(sorted(run.signatures), sorted(primitiveSignatures)); }
};

/**
 * Check the complete source transition and exactly thirty-two newly tested cells.
 *
 * @param record - Scoped inventory transition and immutable predecessor receipts.
 */
export const assertWitStructuredCallableIntegration = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "wit-structured-callable-integration");
	assert.equal(record.baselineRevision, "7294b0cc57153e53e118789ed83a300d43236f18");
	assert.deepEqual(record.scope, witStructuredCallableScope);
	assert.deepEqual(record.inventory, { previousVersion: "0.96.0", version: "0.97.0", previousInstalled: 4750, installed: 4782, total: 6562 });
	const authenticated = async (entry, path) => {
		assert.equal(entry.path, path); const bytes = await readFile(path);
		assert.equal(sha256(bytes), entry.sha256); return JSON.parse(bytes);
	};
	const previous = await authenticated(record.previous, phpWasmStructuredCallableHistoryPath);
	const execution = await authenticated(record.execution, witStructuredCallableExecutionPath);
	await assertWitStructuredCallableExecution(execution);
	const codegen = await authenticated(record.codegen, witStructuredCodegenPath);
	assert.equal(codegen.baselineRevision, record.baselineRevision); assertWitStructuredCodegenRegression(codegen);
	assert.deepEqual(record.updates.map(update => update.path).sort(), witStructuredCallableChangedPaths);
	assert.deepEqual(Object.keys(record.additions).sort(), witStructuredCallableAddedPaths);
	const paths = [...new Set([...Object.keys(previous.sourceHashes), ...witStructuredCallableChangedPaths, ...witStructuredCallableAddedPaths])].sort();
	assert.deepEqual(Object.keys(record.sourceHashes).sort(), paths);
	for(const path of paths) assert.equal(sha256(await readFile(path)), record.sourceHashes[path], path);
	const restored = {};
	for(const update of record.updates)
	{
		assert.equal(update.currentSha256, record.sourceHashes[update.path]);
		restored[update.path] = reverseWitStructuredCallableUpdate(await readFile(update.path, "utf8"), update);
		if(previous.sourceHashes[update.path]) assert.equal(update.previousSha256, previous.sourceHashes[update.path]);
	}
	for(const [path, digest] of Object.entries(record.additions)) assert.equal(digest, record.sourceHashes[path]);
	for(const [path, digest] of Object.entries(codegen.predecessors))
	{ assert.equal(digest, sha256(restored[path])); assert.equal(codegen.sourceHashes[path], record.sourceHashes[path]); }
	const { document, ...contracts } = await readTypeSurface(), old = JSON.parse(restored["docs/type-surface.v1.json"]);
	assert.equal(document.contractVersion, record.inventory.version); assert.equal(old.contractVersion, record.inventory.previousVersion);
	const cells = typeSurfaceCells(document, contracts), oldCells = typeSurfaceCells(old, contracts);
	const installed = values => values.filter(cell => cell.stages.installedExecution.state === "passed").length;
	assert.equal(installed(cells), record.inventory.installed); assert.equal(installed(oldCells), record.inventory.previousInstalled);
	assert.equal(cells.length, record.inventory.total);
	const promoted = cells.filter(cell => cell.stages.installedExecution.evidence.includes("wit-wasi-structured-callables-installed"));
	assert.equal(promoted.length, 32);
	for(const cell of promoted)
	{
		for(const [key, values] of Object.entries({ profile: record.scope.profiles, shape: record.scope.shapes, path: record.scope.paths, position: record.scope.positions })) assert.ok(values.includes(cell[key]));
		assert.ok(cell.hostType && cell.conversionNote);
		for(const stage of Object.values(cell.stages)) assert.deepEqual({ state: stage.state, evidence: stage.evidence }, { state: "passed", evidence: ["wit-wasi-structured-callables-installed"] });
	}
	const oldById = new Map(oldCells.map(cell => [cell.id, cell]));
	for(const cell of cells.filter(cell => !promoted.includes(cell))) assert.deepEqual(cell, oldById.get(cell.id), cell.id);
	const entry = document.evidence.find(item => item.id === "wit-wasi-structured-callables-installed");
	assert.deepEqual(entry.artifacts, execution.report.reports.flatMap(run => run.packages.flatMap(pkg => pkg.artifacts.map(artifact => ({ path: `${run.path}/${artifact.path}`, sha256: artifact.sha256 })))));
	assert.ok(entry.files.some(file => file.path === witStructuredCallableExecutionPath));
	await assertPhpWasmStructuredCallableIntegration(previous);
};
