/**
 * Bind installed wasm32 copied callbacks to exact archives, owners and sources.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import { generateCopiedPhpZendAdapter } from "../../src/backends/php/copied-zend.mjs";
import { compileCopiedPhpModel } from "../../src/backends/php/copied-model.mjs";
import { structuredCallableReviewedIr } from "./structured-callable-fixture.mjs";
import { phpCallableSignatures } from "./php-callable-fixture.mjs";
import { phpWasmStructuredCallableConsumer } from "./php-wasm-structured-callable-fixture.mjs";
import { zendStructuredAllocationHeader, zendStructuredCallableFaultIr, zendStructuredCallableFaultProvider } from "./php-wasm-structured-callable-faults.mjs";
import { assertPhpStructuredCallableIntegration } from "./php-structured-callable-evidence.mjs";
import { phpStructuredCallableHistoryPath } from "./php-structured-callable-source-history.mjs";
import { assertPhpWasmStructuredCodegenRegression } from "./php-wasm-structured-callable-regression.mjs";
import { phpWasmStructuredCallableChangedPaths, reversePhpWasmStructuredCallableUpdate } from "./php-wasm-structured-callable-source-history.mjs";

export const phpWasmStructuredCallableExecutionPath = "docs/evidence/php-wasm-structured-callables-20260925.json";
export const phpWasmStructuredCodegenPath = "docs/evidence/php-wasm-structured-codegen-regression-20260925.json";
export const phpWasmStructuredCallableScope = {
	profiles: ["php-wasm"], paths: ["ordinary-source", "reviewed-ir"]
	, shapes: ["alias", "array", "list", "option", "record", "result", "tuple", "variant"]
	, positions: ["callback-parameter", "callback-result"]
	, recursiveCallbacks: false, ownedResourceAggregates: false
};
export const phpWasmStructuredCallableAddedPaths = [
	phpWasmStructuredCallableExecutionPath, phpWasmStructuredCodegenPath
	, "docs/evidence/php-wasm-structured-callables-20260925.md"
	, "tests/php-wasm-structured-callable-contract.test.mjs"
	, "tests/php-wasm-structured-callable-evidence.test.mjs"
	, "tests/php-wasm-structured-callables.test.mjs"
	, "tests/php-wasm-structured-callable-zend.test.mjs"
	, "tests/helpers/php-wasm-structured-callable-evidence.mjs"
	, "tests/helpers/php-wasm-structured-callable-faults.mjs"
	, "tests/helpers/php-wasm-structured-callable-fixture.mjs"
	, "tests/helpers/php-wasm-structured-callable-regression.mjs"
	, "tests/helpers/php-wasm-structured-callable-source-history.mjs"
].sort();
const hash = value => assert.match(value, /^[a-f0-9]{64}$/u);
const signatures = ir => {
	const type = ref => {
		if(ref.kind === "primitive") return ref;
		if(ref.kind === "apply") return { constructor: ref.constructor, arguments: ref.arguments.map(type) };
		const definition = ir.types.find(item => item.id === ref.id); assert.ok(definition);
		if(definition.kind === "alias") return type(definition.target);
		if(definition.kind === "record") return { record: definition.fields.map(field => ({ name: field.name, type: type(field.type) })) };
		if(definition.kind === "variant") return { variant: definition.cases.map(branch => ({ name: branch.name, fields: branch.fields.map(field => ({ name: field.name, type: type(field.type) })) })) };
		assert.equal(definition.kind, "callback");
		return { callback: { parameters: definition.callable.parameters.map(site), result: site(definition.callable.result) } };
	};
	const site = value => ({ type: type(value.type), ownership: value.ownership, lifetime: value.lifetime });
	return ir.declarations.map(declaration => ({ id: declaration.id, parameters: declaration.parameters.map(site), result: site(declaration.result) })).sort((a, b) => a.id.localeCompare(b.id));
};
const passing = (run, environment, tests) => {
	assert.equal(run.exitCode, 0);
	assert.ok(run.command.includes(environment + "=1"));
	assert.equal(sha256(run.text), run.sha256);
	assert.match(run.text, new RegExp(`# tests ${tests}\\n# suites 0\\n# pass ${tests}\\n# fail 0\\n# cancelled 0\\n# skipped 0`, "u"));
};
const arrangements = [
	["node", "embedded"], ["node", "composer"], ["chromium", "bundled"]
].flatMap(([realm, arrangement]) => ["startup", "lazy"].flatMap(loading => ["weak", "strict"].map(mode => [realm, arrangement, loading, mode])));
const installation = run => {
	assert.equal(run.profile, "php-wasm");
	for(const flag of ["sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreePath"]) assert.equal(run[flag], true, flag);
	for(const key of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256", "consumerSha256", "driverSha256"]) hash(run[key]);
	assert.match(run.browserVersion, /^\d+\.\d+\.\d+\.\d+$/u);
	assert.deepEqual(run.executions.map(item => [item.realm, item.arrangement, item.loading, item.mode]), arrangements);
	assert.ok(run.checks > 50000);
	for(const execution of run.executions)
	{
		assert.equal(execution.checks, run.checks); assert.equal(execution.libraries, 2);
		assert.equal(execution.bailoutRecovery, true);
	}
	assert.deepEqual(run.packages.map(pkg => [pkg.ecosystem, pkg.role]), [["composer", "api"], ["npm", "runtime"], ["npm", "component"]]);
	for(const pkg of run.packages)
	{
		hash(pkg.runtimeIdentity); assert.equal(pkg.artifacts.length, 1);
		const artifact = pkg.artifacts[0]; hash(artifact.sha256);
		assert.match(artifact.path, /^packages\/php-wasm\/archives\/.+\.(?:tgz|zip)$/u);
		assert.ok(Number.isSafeInteger(artifact.bytes) && artifact.bytes > 0);
	}
};

/**
 * Check public Node/Composer/browser execution and a separate synthetic fault probe.
 *
 * @param record - Original terminal logs and unedited execution observations.
 */
export const assertPhpWasmStructuredCallableExecution = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "php-wasm-structured-callable-execution");
	assert.deepEqual(record.scope, phpWasmStructuredCallableScope);
	passing(record.installed, "LEAN_BRIDGE_PHP_WASM_STRUCTURED_CALLABLE_TEST", 2);
	assert.ok(record.installed.command.includes("tests/php-wasm-structured-callables.test.mjs"));
	assert.ok(record.installed.command.includes("tests/php-wasm-structured-callable-zend.test.mjs"));
	const documented = (await readFile("docs/php.md", "utf8")).match(/### Structured callback values\n[\s\S]*?```php\n([\s\S]*?)\n```/u)?.[1];
	const publisher = (await readFile("docs/publish/php.md", "utf8")).match(/### Export structured callbacks\n[\s\S]*?```lean\n([\s\S]*?)\n```/u)?.[1];
	assert.ok(documented && publisher);
	assert.equal(record.report.schemaVersion, 1);
	assert.deepEqual(record.report.reports.map(run => run.path), phpWasmStructuredCallableScope.paths);
	for(const run of record.report.reports)
	{
		installation(run); assert.equal(run.checks, 105617);
		assert.deepEqual(run.signatures, signatures(structuredCallableReviewedIr()));
		const source = (await phpWasmStructuredCallableConsumer(run.path)).replace("require 'vendor/autoload.php';", "");
		assert.equal(run.consumerSha256, sha256(source));
		for(const flag of ["handoffRelocatedBeforeInstallation", "handoffRemovedBeforeExecution", "unchangedDeployment"]) assert.equal(run[flag], true, flag);
		assert.deepEqual(run.publisherDocumentation, { sourceSha256: sha256(publisher), compiled: true });
		assert.equal(run.documentationSha256, sha256(documented)); assert.equal(run.documentationExecutions, 12);
		assert.equal(Object.keys(run.deployment).length, 168);
		for(const [path, file] of Object.entries(run.deployment))
		{
			assert.match(path, /^(?:node_modules|vendor|bundled)\//u); hash(file.sha256);
			assert.ok(Number.isSafeInteger(file.bytes) && file.bytes >= 0);
		}
		const npm = run.packages.find(pkg => pkg.role === "component"), composer = run.packages.find(pkg => pkg.ecosystem === "composer");
		for(const prefix of [`node_modules/${npm.name}`, `vendor/${composer.name}`])
			assert.equal(run.deployment[`${prefix}/README.md`].sha256, run.readmeSha256);
		for(const execution of run.executions)
		{
			assert.equal(execution.documentationExecuted, true);
			assert.equal(execution.libraryNames.length, 2); assert.equal(new Set(execution.libraryNames).size, 2);
			for(const name of execution.libraryNames)
				assert.ok(Object.keys(run.deployment).some(path => path.endsWith("/" + name)));
		}
	}
	const faults = record.faults;
	assert.equal(faults.schemaVersion, 1); assert.equal(faults.provider, "synthetic-not-Lean");
	assert.equal(faults.unownedReplyRejected, true);
	const faultIr = zendStructuredCallableFaultIr(), files = generateCopiedPhpZendAdapter(faultIr);
	const manifest = JSON.parse(files["copied-zend-manifest.json"]), extension = files[`extension/${manifest.extension}.c`];
	const instrumented = `${zendStructuredAllocationHeader}\n${extension}`;
	const model = compileCopiedPhpModel(faultIr, { integerBits: 32, structuredCallables: true, lists: true, variants: true });
	const request = model.surface.functions.filter(fn => fn.field.startsWith("call_")).map(fn => ({ name: fn.field
		, transport: manifest.exports.find(item => item.function.endsWith("\\" + fn.field)).transport
		, to: `to${model.surface.copy(fn.declaration.parameters[0].type).index}` }));
	assert.equal(faults.bindingIrSha256, manifest.bindingIrSha256);
	assert.equal(faults.extensionSha256, sha256(extension)); assert.equal(faults.instrumentedSha256, sha256(instrumented));
	assert.equal(faults.providerSha256, sha256(zendStructuredCallableFaultProvider(faultIr)));
	assert.equal(faults.requestSha256, sha256(canonicalJson(request)));
	assert.equal(faults.unownedSourceSha256, sha256(instrumented.replaceAll("s->copy_buffers = 1;", "s->copy_buffers = 0;")));
	const probe = (await readFile("tests/php-wasm-structured-callable-zend.test.mjs", "utf8")).match(/\+ String\.raw`([\s\S]*?)`;\n\tconst host/u)?.[1];
	assert.ok(probe);
	const base = await phpWasmStructuredCallableConsumer("reviewed-ir");
	const setup = base.slice(0, base.indexOf("foreach ($cases as $shape => $values)"));
	assert.equal(faults.consumerSha256, sha256(setup.replace("require 'vendor/autoload.php';", "require '/probe/src/Api.php';") + probe));
	for(const key of ["bindingIrSha256", "consumerSha256", "extensionSha256", "instrumentedSha256", "providerSha256", "requestSha256", "unownedSourceSha256", "wasmSha256"]) hash(faults[key]);
	assert.notEqual(faults.instrumentedSha256, faults.unownedSourceSha256);
	assert.deepEqual(faults.executions.map(run => run.mode), ["weak", "strict"]);
	for(const run of faults.executions)
	{
		assert.equal(run.wordBits, 32); assert.equal(run.checks, 9545);
		assert.equal(run.allocationFailures, 640); assert.equal(run.ownedBuffers, 2709);
		assert.equal(run.wireRejections, 8); assert.equal(run.bailoutRecovery, 2);
		assert.equal(run.paths.length, 40);
		assert.deepEqual([...new Set(run.paths.map(([shape]) => shape))].sort(), record.scope.shapes);
		for(const shape of record.scope.shapes)
			assert.deepEqual(run.paths.filter(([name]) => name === shape).map(([, path]) => path).sort(), ["callback", "create", "create-call", "held-call", "twice"]);
		assert.ok(run.paths.every(([, , count]) => Number.isSafeInteger(count) && count > 0));
		assert.equal(run.paths.reduce((sum, [, , count]) => sum + count, 0), run.allocationFailures);
	}
	const regression = record.primitiveRegression;
	passing(regression, "LEAN_BRIDGE_PHP_WASM_CALLABLE_TEST", 1);
	assert.ok(regression.command.includes("tests/php-wasm-callables.test.mjs"));
	assert.deepEqual(regression.report.reports.map(run => run.path), record.scope.paths);
	const sorted = values => values.toSorted((a, b) => a.name.localeCompare(b.name));
	for(const run of regression.report.reports)
	{ installation(run); assert.deepEqual(sorted(run.signatures), sorted(phpCallableSignatures)); }
};

/**
 * Authenticate exact source edits and only the thirty-two new PHP-Wasm cells.
 *
 * @param record - Scoped inventory transition and immutable predecessor receipts.
 */
export const assertPhpWasmStructuredCallableIntegration = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "php-wasm-structured-callable-integration");
	assert.equal(record.baselineRevision, "89c43a33eb639bc8a2ca19df697ba56e9cfacae9");
	assert.deepEqual(record.scope, phpWasmStructuredCallableScope);
	assert.deepEqual(record.inventory, { previousVersion: "0.95.0", version: "0.96.0", previousInstalled: 4718, installed: 4750, total: 6562 });
	const authenticated = async (entry, path) => {
		assert.equal(entry.path, path); const bytes = await readFile(path); assert.equal(sha256(bytes), entry.sha256); return JSON.parse(bytes);
	};
	const previous = await authenticated(record.previous, phpStructuredCallableHistoryPath);
	const execution = await authenticated(record.execution, phpWasmStructuredCallableExecutionPath);
	await assertPhpWasmStructuredCallableExecution(execution);
	const codegen = await authenticated(record.codegen, phpWasmStructuredCodegenPath); assertPhpWasmStructuredCodegenRegression(codegen);
	assert.deepEqual(record.updates.map(update => update.path).sort(), phpWasmStructuredCallableChangedPaths);
	assert.deepEqual(Object.keys(record.additions).sort(), phpWasmStructuredCallableAddedPaths);
	const paths = [...new Set([...Object.keys(previous.sourceHashes), ...phpWasmStructuredCallableChangedPaths, ...phpWasmStructuredCallableAddedPaths])].sort();
	assert.deepEqual(Object.keys(record.sourceHashes).sort(), paths);
	for(const path of paths) assert.equal(sha256(await readFile(path)), record.sourceHashes[path], path);
	const restored = {};
	for(const update of record.updates)
	{
		assert.equal(update.currentSha256, record.sourceHashes[update.path]);
		restored[update.path] = reversePhpWasmStructuredCallableUpdate(await readFile(update.path, "utf8"), update);
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
	const promoted = cells.filter(cell => cell.stages.installedExecution.evidence.includes("php-wasm-structured-callables-installed"));
	assert.equal(promoted.length, 32);
	for(const cell of promoted)
	{
		for(const [key, values] of Object.entries({ profile: record.scope.profiles, shape: record.scope.shapes, path: record.scope.paths, position: record.scope.positions })) assert.ok(values.includes(cell[key]));
		assert.ok(cell.hostType && cell.conversionNote);
		for(const stage of Object.values(cell.stages)) assert.deepEqual({ state: stage.state, evidence: stage.evidence }, { state: "passed", evidence: ["php-wasm-structured-callables-installed"] });
	}
	const oldById = new Map(oldCells.map(cell => [cell.id, cell]));
	for(const cell of cells.filter(cell => !promoted.includes(cell))) assert.deepEqual(cell, oldById.get(cell.id), cell.id);
	const entry = document.evidence.find(item => item.id === "php-wasm-structured-callables-installed");
	assert.deepEqual(entry.artifacts, execution.report.reports.flatMap(run => run.packages.flatMap(pkg => pkg.artifacts.map(artifact => ({ path: `${run.path}/${artifact.path}`, sha256: artifact.sha256 })))));
	assert.ok(entry.files.some(file => file.path === phpWasmStructuredCallableExecutionPath));
	await assertPhpStructuredCallableIntegration(previous);
};
