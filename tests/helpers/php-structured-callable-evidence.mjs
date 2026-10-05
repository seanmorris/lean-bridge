/**
 * Bind native PHP copied callback coverage to installed archives and exact sources.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import { structuredCallableReviewedIr } from "./structured-callable-fixture.mjs";
import { phpCallableSignatures, phpCallableConsumer, phpCallableRequest } from "./php-callable-fixture.mjs";
import { phpIsolationFlags } from "./type-corpus-php.mjs";
import { validateBrickMathInstall } from "./brick-math.mjs";
import { assertPhpStructuredCodegenRegression } from "./php-structured-callable-regression.mjs";
import { assertNpmStructuredCallableIntegration } from "./npm-structured-callable-evidence.mjs";
import { npmStructuredCallableHistoryPath } from "./npm-structured-callable-source-history.mjs";
import { phpStructuredCallableChangedPaths, reversePhpStructuredCallableUpdate } from "./php-structured-callable-source-history.mjs";
import { beforePhpWasmStructuredCallables } from "./php-wasm-structured-callable-source-history.mjs";

export const phpStructuredCallableExecutionPath = "docs/evidence/php-structured-callables-20260925.json";
export const phpStructuredCodegenPath = "docs/evidence/php-structured-codegen-regression-20260925.json";
export const phpStructuredCallableScope = {
	profiles: ["php-native"], paths: ["ordinary-source", "reviewed-ir"]
	, shapes: ["alias", "array", "list", "option", "record", "result", "tuple", "variant"]
	, positions: ["callback-parameter", "callback-result"]
	, recursiveCallbacks: false, ownedResourceAggregates: false
};
export const phpStructuredCallableAddedPaths = [
	phpStructuredCallableExecutionPath, phpStructuredCodegenPath
	, "docs/evidence/php-structured-callables-20260925.md"
	, "tests/php-structured-callable-contract.test.mjs"
	, "tests/php-structured-callable-evidence.test.mjs"
	, "tests/php-structured-callables.test.mjs"
	, "tests/fixtures/structured-callable-consumers/php.php"
	, "tests/fixtures/structured-callable-consumers/php-faults.php"
	, "tests/helpers/php-structured-callable-evidence.mjs"
	, "tests/helpers/php-structured-callable-faults.mjs"
	, "tests/helpers/php-structured-callable-regression.mjs"
	, "tests/helpers/php-structured-callable-source-history.mjs"
].sort();
const hash = value => assert.match(value, /^[a-f0-9]{64}$/u);
const shapes = ["array", "list", "option", "result", "tuple", "record", "variant", "alias"];
const priorSource = async path => beforePhpWasmStructuredCallables(path, await readFile(path, "utf8"));
const signatures = ir => {
	const type = ref => {
		if(ref.kind === "primitive") return ref;
		if(ref.kind === "apply") return { constructor: ref.constructor, arguments: ref.arguments.map(type) };
		const definition = ir.types.find(item => item.id === ref.id); assert.ok(definition, ref.id);
		if(definition.kind === "alias") return type(definition.target);
		if(definition.kind === "record") return { record: definition.fields.map(field => ({ name: field.name, type: type(field.type) })) };
		if(definition.kind === "variant") return { variant: definition.cases.map(branch => ({ name: branch.name, fields: branch.fields.map(field => ({ name: field.name, type: type(field.type) })) })) };
		assert.equal(definition.kind, "callback");
		return { callback: { parameters: definition.callable.parameters.map(site), result: site(definition.callable.result) } };
	};
	const site = value => ({ type: type(value.type), ownership: value.ownership, lifetime: value.lifetime });
	return ir.declarations.map(declaration => ({ id: declaration.id, parameters: declaration.parameters.map(site), result: site(declaration.result) })).sort((a, b) => a.id.localeCompare(b.id));
};
const passing = (run, name, flag) => {
	assert.equal(run.exitCode, 0); assert.equal(sha256(run.text), run.sha256);
	assert.ok(run.command.includes(`tests/${name}.test.mjs`)); assert.ok(run.command.includes(`${flag}=1`));
	assert.doesNotMatch(run.command, /--test-name-pattern/u);
	assert.match(run.text, /# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n/u);
};
const installed = (run, installation, name) => {
	assert.equal(run.profile, "php-native"); assert.equal(run.sourceRemovedBeforeInstallation, true);
	for(const field of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256"]) hash(run[field]);
	const { php } = installation;
	for(const flag of phpIsolationFlags) assert.equal(php[flag], true, flag);
	const receipt = php.packageReceipt, prefix = `vendor/${name}/`;
	assert.equal(receipt.kind, "lean-bridge-ordinary-php-package"); assert.equal(receipt.ecosystem, "composer");
	assert.equal(receipt.name, name); assert.equal(receipt.version, "1.0.0");
	assert.equal(receipt.glibcMinimumVersion, "2.38"); assert.equal(receipt.bindingIrSha256, run.bindingIrSha256);
	assert.equal(receipt.sourceIdentity.sourceTreeSha256, run.sourceTreeSha256);
	assert.equal(php.packageReceiptSha256, sha256(canonicalJson(receipt)));
	assert.equal(php.deployment[prefix + "lean-bridge/package-receipt.json"].sha256, php.packageReceiptSha256);
	for(const [path, file] of Object.entries(receipt.files))
	{
		hash(file.sha256); assert.ok(Number.isSafeInteger(file.bytes) && file.bytes >= 0);
		assert.deepEqual(php.deployment[prefix + path], file);
	}
	assert.equal(run.packages.length, 1); const pkg = run.packages[0];
	assert.equal(pkg.name, name); assert.equal(pkg.version, receipt.version); assert.equal(pkg.runtimeIdentity, receipt.runtimeIdentity);
	assert.equal(pkg.artifacts.length, 1); assert.equal(pkg.artifacts[0].sha256, php.archiveSha256);
	assert.match(pkg.artifacts[0].path, /^archives\/.+\.zip$/u); assert.ok(pkg.artifacts[0].bytes > 0);
	assert.deepEqual(php.executions.map(item => item.mode), ["weak", "strict"]);
	assert.deepEqual(installation.observation, php.executions[0].observation);
	validateBrickMathInstall(php, php.deployment);
	for(const { mode, observation } of php.executions)
	{
		assert.equal(observation.hostVersion, php.version);
		assert.equal(php.deployment[mode + ".php"].sha256, php.consumerSources[mode]);
		const libraries = Object.entries(observation.libraries); assert.equal(libraries.length, 4);
		for(const [path, digest] of libraries)
		{
			assert.ok(path.includes("/php-native/relocated/" + prefix));
			const relative = path.split("/php-native/relocated/" + prefix)[1];
			assert.match(relative, /^native\/linux-x64\/lib.+\.so$/u);
			assert.equal(digest, receipt.files[relative].sha256);
		}
	}
};

/**
 * Require both source paths and lexical modes, complete fault paths and documentation.
 *
 * @param record - Unchanged execution observations and terminal test logs.
 * @param options - Explicit source context for a newly executed fault probe.
 * @param options.probeSource - Current measured probe, or historical source by default.
 */
export const assertPhpStructuredCallableExecution = async (record, { probeSource } = {}) => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "php-structured-callable-execution"); assert.deepEqual(record.scope, phpStructuredCallableScope);
	passing(record.installed, "php-structured-callables", "LEAN_BRIDGE_PHP_STRUCTURED_CALLABLE_TEST");
	assert.equal(record.report.schemaVersion, 1);
	assert.deepEqual(record.report.reports.map(run => run.path), phpStructuredCallableScope.paths);
	const source = await readFile("tests/fixtures/structured-callable-consumers/php.php", "utf8");
	const probe = probeSource ?? await priorSource("tests/fixtures/structured-callable-consumers/php-faults.php");
	assert.equal(typeof probe, "string");
	const documented = (await readFile("docs/php.md", "utf8")).match(/### Structured callback values\n[\s\S]*?```php\n([\s\S]*?)\n```/u)?.[1];
	const publisher = (await readFile("docs/publish/php.md", "utf8")).match(/### Export structured callbacks\n[\s\S]*?```lean\n([\s\S]*?)\n```/u)?.[1];
	assert.ok(documented && publisher);
	for(const run of record.report.reports)
	{
		installed(run, run.installation, "lean-bridge-structured/api");
		assert.deepEqual(run.signatures, signatures(structuredCallableReviewedIr()));
		assert.equal(run.consumerSourceSha256, sha256(source));
		for(const flag of ["relocatedBeforeInstallation", "handoffRemovedBeforeExecution", "publicCallsUninstrumented"]) assert.equal(run[flag], true, flag);
		assert.deepEqual(run.publisherDocumentation, { sourceSha256: sha256(publisher), compiled: true });
		for(const { mode, observation } of run.installation.php.executions)
		{
			assert.equal(observation.checks, 104399); assert.equal(observation.calls, 2803); assert.equal(observation.rejected, 625);
			assert.deepEqual(observation.shapes, shapes);
			const text = source.replace("declare(strict_types=0);", `declare(strict_types=${mode === "strict" ? 1 : 0});`)
				.replace("const PARAMETER_PREFIX = 'arg';", `const PARAMETER_PREFIX = '${run.path === "reviewed-ir" ? "value" : "arg"}';`);
			assert.equal(run.installation.php.consumerSources[mode], sha256(text));
		}
		const faults = run.faults;
		assert.equal(faults.checks, 174479); assert.equal(faults.faults, 8080); assert.equal(faults.malformed, 15);
		assert.equal(faults.clears, 8144); assert.equal(faults.closes, 9274); assert.equal(faults.conversionMethods, 64);
		assert.equal(faults.sourceSha256, sha256(probe)); hash(faults.requestSha256);
		for(const flag of ["inMemoryProbeOnly", "separateProcess", "compilerFree", "unchangedDeployment", "publicConsumersRepeatedAfterProbe"]) assert.equal(faults[flag], true, flag);
		assert.deepEqual(faults.documentation, { sourceSha256: sha256(documented), executions: 2, installedPublicApi: true });
		assert.deepEqual(faults.shapes.map(item => item.shape), shapes);
		for(const shape of faults.shapes)
		{
			assert.deepEqual(Object.keys(shape.paths).sort(), ["callback", "create", "create-call", "held-call", "repeated"]);
			for(const count of Object.values(shape.paths)) assert.ok(Number.isSafeInteger(count) && count > 0);
			assert.equal(shape.faults, 2 * Object.values(shape.paths).reduce((sum, count) => sum + count, 0));
		}
		assert.equal(faults.faults, faults.shapes.reduce((sum, shape) => sum + shape.faults, 0));
		assert.deepEqual(faults, record.report.reports[0].faults);
	}
	const regression = record.primitiveRegression;
	passing(regression, "php-callables", "LEAN_BRIDGE_PHP_CALLABLE_TEST");
	assert.deepEqual(regression.report.reports.map(run => run.path), phpStructuredCallableScope.paths);
	for(const run of regression.report.reports)
	{
		installed(run, run, "lean-bridge-callables/api");
		const ordered = values => values.toSorted((a, b) => a.name.localeCompare(b.name));
		assert.deepEqual(ordered(run.signatures), ordered(phpCallableSignatures));
		assert.equal(run.php.requestSha256, sha256(phpCallableRequest(run.path)));
		for(const { mode, observation } of run.php.executions)
		{
			assert.equal(observation.checks, 51686); assert.equal(observation.fork, true);
			assert.equal(run.php.consumerSources[mode], sha256(phpCallableConsumer(mode, run.path)));
		}
	}
};

/**
 * Authenticate source history and promote only the thirty-two native PHP cells.
 *
 * @param record - Original receipts, byte transitions and scoped type inventory.
 */
export const assertPhpStructuredCallableIntegration = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "php-structured-callable-integration");
	assert.equal(record.baselineRevision, "073ccdf8eb399e419bdafd233f40d9c55273ebb0");
	assert.deepEqual(record.scope, phpStructuredCallableScope);
	assert.deepEqual(record.inventory, { previousVersion: "0.94.0", version: "0.95.0", previousInstalled: 4686, installed: 4718, total: 6562 });
	const authenticated = async (entry, path) => {
		assert.equal(entry.path, path); const bytes = await readFile(path); assert.equal(sha256(bytes), entry.sha256); return JSON.parse(bytes);
	};
	const previous = await authenticated(record.previous, npmStructuredCallableHistoryPath);
	const execution = await authenticated(record.execution, phpStructuredCallableExecutionPath);
	await assertPhpStructuredCallableExecution(execution);
	const codegen = await authenticated(record.codegen, phpStructuredCodegenPath); assertPhpStructuredCodegenRegression(codegen);
	assert.deepEqual(record.updates.map(update => update.path).sort(), phpStructuredCallableChangedPaths);
	assert.deepEqual(Object.keys(record.additions).sort(), phpStructuredCallableAddedPaths);
	const paths = [...new Set([...Object.keys(previous.sourceHashes), ...phpStructuredCallableChangedPaths, ...phpStructuredCallableAddedPaths])].sort();
	assert.deepEqual(Object.keys(record.sourceHashes).sort(), paths);
	for(const path of paths) assert.equal(sha256(await priorSource(path)), record.sourceHashes[path], path);
	const restored = {};
	for(const update of record.updates)
	{
		assert.equal(update.currentSha256, record.sourceHashes[update.path]);
		restored[update.path] = reversePhpStructuredCallableUpdate(await priorSource(update.path), update);
		if(previous.sourceHashes[update.path]) assert.equal(update.previousSha256, previous.sourceHashes[update.path]);
	}
	for(const [path, digest] of Object.entries(record.additions)) assert.equal(digest, record.sourceHashes[path]);
	for(const [path, digest] of Object.entries(codegen.predecessors))
	{ assert.equal(digest, sha256(restored[path])); assert.equal(codegen.sourceHashes[path], record.sourceHashes[path]); }
	const { document, ...contracts } = { ...await readTypeSurface()
		, document: JSON.parse(await priorSource("docs/type-surface.v1.json")) };
	const old = JSON.parse(restored["docs/type-surface.v1.json"]);
	assert.equal(document.contractVersion, record.inventory.version); assert.equal(old.contractVersion, record.inventory.previousVersion);
	const cells = typeSurfaceCells(document, contracts), oldCells = typeSurfaceCells(old, contracts);
	const installedCount = values => values.filter(cell => cell.stages.installedExecution.state === "passed").length;
	assert.equal(installedCount(cells), record.inventory.installed); assert.equal(installedCount(oldCells), record.inventory.previousInstalled);
	assert.equal(cells.length, record.inventory.total);
	const promoted = cells.filter(cell => cell.stages.installedExecution.evidence.includes("php-native-structured-callables-installed"));
	assert.equal(promoted.length, 32);
	for(const cell of promoted)
	{
		for(const [key, values] of Object.entries({ profile: record.scope.profiles, shape: record.scope.shapes, path: record.scope.paths, position: record.scope.positions })) assert.ok(values.includes(cell[key]));
		assert.ok(cell.hostType && cell.conversionNote);
		for(const stage of Object.values(cell.stages)) assert.deepEqual({ state: stage.state, evidence: stage.evidence }, { state: "passed", evidence: ["php-native-structured-callables-installed"] });
	}
	const oldById = new Map(oldCells.map(cell => [cell.id, cell]));
	for(const cell of cells.filter(cell => !promoted.includes(cell))) assert.deepEqual(cell, oldById.get(cell.id), cell.id);
	const entry = document.evidence.find(item => item.id === "php-native-structured-callables-installed");
	assert.deepEqual(entry.artifacts, execution.report.reports.flatMap(run => run.packages.flatMap(pkg => pkg.artifacts.map(artifact => ({ path: `${run.path}/${artifact.path}`, sha256: artifact.sha256 })))));
	assert.ok(entry.files.some(file => file.path === phpStructuredCallableExecutionPath));
	await assertNpmStructuredCallableIntegration(previous);
};
