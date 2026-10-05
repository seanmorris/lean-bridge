/**
 * Bind the lifetime repair to installed failures, corrected packages and sources.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import { generateNativePrimitiveC } from "../../src/backends/c/native-primitives.mjs";
import { closureThreadConsumer } from "./closure-thread-fixture.mjs";
import { beforeClosureThreadRegistry, closureThreadRegistryProbe } from "./closure-thread-registry.mjs";
import { witStructuredNativeModels, witStructuredNativeReceipt } from "./wit-structured-callable-regression.mjs";
import { assertNativeRecursiveCallableIntegration } from "./native-recursive-callable-evidence.mjs";
import { nativeRecursiveCallableHistoryPath } from "./native-recursive-callable-source-history.mjs";
import { closureThreadChangedPaths, reverseClosureThreadUpdate } from "./closure-thread-source-history.mjs";
import { beforePhpCiRegression } from "./php-ci-regression-source-history.mjs";

const priorSource = async path => beforePhpCiRegression(path, await readFile(path, "utf8"));

export const closureThreadBaseline = "2273d357fc959cf88bf7b0e1aea70e908ba1ba4d";
export const closureThreadExecutionPath = "docs/evidence/closure-thread-lifetime-20260925.json";
export const closureThreadCodegenPath = "docs/evidence/closure-thread-codegen-20260925.json";
export const closureThreadAddedPaths = [
	closureThreadExecutionPath, closureThreadCodegenPath
	, "docs/evidence/closure-thread-lifetime-20260925.md"
	, "tests/closure-thread-contract.test.mjs"
	, "tests/closure-thread-installed.test.mjs"
	, "tests/closure-thread-evidence.test.mjs"
	, "tests/helpers/closure-thread-fixture.mjs"
	, "tests/helpers/closure-thread-registry.mjs"
	, "tests/helpers/closure-thread-source-history.mjs"
	, "tests/helpers/closure-thread-evidence.mjs"
].sort();
const paths = ["ordinary-source", "reviewed-ir"];
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const passing = (run, tests) => {
	assert.equal(run.exitCode, 0); assert.equal(sha256(run.text), run.sha256);
	assert.match(run.text, new RegExp(`# tests ${tests}\\n# suites 0\\n# pass ${tests}\\n# fail 0\\n# cancelled 0\\n# skipped 0`, "u"));
};

/**
 * Compare original and repaired native generators for both token widths.
 *
 * @param record - Complete output hashes from the independently loaded baseline.
 */
export const assertClosureThreadCodegen = record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.baselineRevision, closureThreadBaseline);
	assert.equal(record.syntheticModels, true); assert.equal(record.installedAcceptance, false);
	const models = witStructuredNativeModels();
	assert.deepEqual(record.rows.map(row => [row.pointerBits, row.name]), [32, 64].flatMap(bits => Object.keys(models).map(name => [bits, name])));
	for(const row of record.rows)
	{
		const model = { ...models[row.name], pointerBits: row.pointerBits };
		assert.equal(row.modelSha256, sha256(canonicalJson(model)));
		const source = generateNativePrimitiveC(model, witStructuredNativeReceipt);
		assert.deepEqual(row.current, { bytes: Buffer.byteLength(source), sha256: sha256(source) });
		const previous = beforeClosureThreadRegistry(source);
		assert.deepEqual(row.previous, { bytes: Buffer.byteLength(previous), sha256: sha256(previous) });
		assert.equal(row.changed, source !== previous);
	}
};

/**
 * Authenticate observed rejection, reference cleanup and installed regressions.
 *
 * @param record - Captured terminal test logs and original package observations.
 */
export const assertClosureThreadExecution = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "closure-thread-lifetime-execution");
	passing(record.installed, 4); passing(record.structured, 2);
	assert.ok(record.installed.command.includes("LEAN_BRIDGE_C_CLOSURE_THREAD_TEST=1"));
	for(const profile of ["C", "CPP"])
		assert.ok(record.structured.command.includes(`LEAN_BRIDGE_${profile}_STRUCTURED_CALLABLE_TEST=1`));
	const consumerHash = sha256(closureThreadConsumer());
	for(const [label, bundle] of [["baseline", record.baseline], ["fixed", record.fixed]])
	{
		assert.deepEqual(bundle.reports.map(run => run.path), paths); digest(bundle.generatorSha256);
		for(const run of bundle.reports)
		{
			assert.equal(run.consumerSha256, consumerHash); digest(run.executableSha256);
			assert.deepEqual(run.observed, { checks: 204, identities: 0
				, wordAccepted: label === "baseline" ? 16 : 0
				, stringAccepted: label === "baseline" ? 16 : 0
				, wordRejected: label === "fixed" ? 16 : 0
				, stringRejected: label === "fixed" ? 16 : 0 });
			for(const flag of ["sourceRemovedBeforeInstallation", "relocatedBeforeInstallation", "headersAndArchivesRemoved", "compilerFreeExecution"])
				assert.equal(run[flag], true, flag);
			if(label === "fixed") assert.equal(run.repeatedExecutions, 2);
			assert.equal(run.packages.length, 1);
			const pkg = run.packages[0]; assert.equal(pkg.target, "c"); assert.equal(pkg.role, "component");
			assert.equal(pkg.artifacts.length, 1); digest(pkg.artifacts[0].sha256);
			assert.ok(pkg.artifacts[0].bytes > 0); digest(pkg.runtimeIdentity);
			for(const key of ["bindingIrSha256", "sourceTreeSha256"]) digest(run[key]);
		}
	}
	assert.notEqual(record.baseline.generatorSha256, record.fixed.generatorSha256);
	assert.equal(record.fixed.generatorSha256, sha256(await readFile("src/backends/c/native-callables.mjs")));
	const registries = record.installed.text.split("\n").filter(line => line.startsWith('# {"pointerBits"')).map(line => JSON.parse(line.slice(2)));
	assert.deepEqual(registries.map(row => row.pointerBits), [32, 64]);
	for(const row of registries)
	{
		assert.equal(row.sourceSha256, sha256(closureThreadRegistryProbe(row.pointerBits)));
		assert.deepEqual(row.observations, [false, true].map(sanitized => ({ sanitized
			, checks: 8469, replacements: 32, released: 4130
			, objects: 0, identities: 0 })));
		assert.deepEqual(row.rejected, ["thread-binding", "serial-exhaustion"]);
	}
	for(const [profile, reports] of Object.entries(record.structured.reports))
	{
		assert.ok(["c", "cpp"].includes(profile)); assert.deepEqual(reports.map(run => run.path), paths);
		for(const run of reports)
		{
			assert.equal(run.profile, profile); assert.equal(run.checks, profile === "c" ? 5999 : 9366);
			for(const flag of ["compilerFreePath", "offlineInstall", "sourceRemovedBeforeInstallation", "relocatedBeforeInstallation"])
				assert.equal(run[flag], true, flag);
			for(const key of ["bindingIrSha256", "modelSha256", "consumerSha256", "receiptSha256", "sourceTreeSha256"]) digest(run[key]);
			if(profile === "cpp") assert.equal(run.result.allocationFailures, 5956);
		}
	}
	assert.deepEqual(Object.keys(record.structured.reports), ["c", "cpp"]);
};

/**
 * Keep every type cell unchanged while authenticating the source-only repair.
 *
 * @param record - Exact source transition, original receipts and new evidence.
 */
export const assertClosureThreadIntegration = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "closure-thread-lifetime-integration");
	assert.equal(record.baselineRevision, closureThreadBaseline);
	const authenticated = async (entry, path) => {
		assert.equal(entry.path, path); const bytes = await readFile(path);
		assert.equal(sha256(bytes), entry.sha256); return JSON.parse(bytes);
	};
	const previous = await authenticated(record.previous, nativeRecursiveCallableHistoryPath);
	const execution = await authenticated(record.execution, closureThreadExecutionPath);
	const codegen = await authenticated(record.codegen, closureThreadCodegenPath);
	await assertClosureThreadExecution(execution); assertClosureThreadCodegen(codegen);
	assert.equal(codegen.previousSourceSha256, execution.baseline.generatorSha256);
	assert.equal(codegen.currentSourceSha256, execution.fixed.generatorSha256);
	assert.deepEqual(record.updates.map(update => update.path).sort(), closureThreadChangedPaths);
	assert.deepEqual(Object.keys(record.additions).sort(), closureThreadAddedPaths);
	const sources = [...new Set([...Object.keys(previous.sourceHashes), ...closureThreadChangedPaths, ...closureThreadAddedPaths])].sort();
	assert.deepEqual(Object.keys(record.sourceHashes).sort(), sources);
	for(const path of sources) assert.equal(sha256(await priorSource(path)), record.sourceHashes[path], path);
	const restored = {};
	for(const update of record.updates)
	{
		assert.equal(update.currentSha256, record.sourceHashes[update.path]);
		restored[update.path] = reverseClosureThreadUpdate(await priorSource(update.path), update);
		if(previous.sourceHashes[update.path]) assert.equal(update.previousSha256, previous.sourceHashes[update.path]);
	}
	assert.equal(sha256(restored["src/backends/c/native-callables.mjs"]), execution.baseline.generatorSha256);
	for(const [path, hash] of Object.entries(record.additions)) assert.equal(hash, record.sourceHashes[path]);
	const contracts = await readTypeSurface(), old = JSON.parse(restored["docs/type-surface.v1.json"]);
	const document = JSON.parse(await priorSource("docs/type-surface.v1.json"));
	assert.equal(old.contractVersion, "0.98.0"); assert.equal(document.contractVersion, "0.98.1");
	const cells = typeSurfaceCells(document, contracts);
	assert.deepEqual(cells, typeSurfaceCells(old, contracts)); assert.equal(cells.length, 6562);
	assert.equal(cells.filter(cell => cell.stages.installedExecution.state === "passed").length, 4790);
	await assertNativeRecursiveCallableIntegration(previous);
};
