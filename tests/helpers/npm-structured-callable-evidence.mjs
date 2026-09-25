/**
 * Authenticate installed npm callback coverage without borrowing probe coverage
 * or modifying the preceding language receipts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import { assertPerlStructuredCallableIntegration } from "./perl-structured-callable-evidence.mjs";
import { perlStructuredCallableHistoryPath } from "./perl-structured-callable-source-history.mjs";
import { npmStructuredCallableChangedPaths, reverseNpmStructuredCallableUpdate } from "./npm-structured-callable-source-history.mjs";
import { beforePhpStructuredCallables } from "./php-structured-callable-source-history.mjs";

const priorSource = async path => beforePhpStructuredCallables(path, await readFile(path, "utf8"));

export const npmStructuredCallableExecutionPath = "docs/evidence/npm-structured-callables-20260925.json";
export const npmStructuredCallableScope = {
	profiles: ["node-javascript", "node-typescript", "browser-javascript", "browser-react", "browser-worker"]
	, paths: ["ordinary-source", "reviewed-ir"]
	, shapes: ["alias", "array", "list", "option", "record", "recursive", "result", "tuple", "variant"]
	, positions: ["callback-parameter", "callback-result"]
	, recursiveCallbacks: true, ownedResourceAggregates: false
};
export const npmStructuredCallableAddedPaths = [
	"docs/evidence/npm-structured-callables-20260925.json"
	, "docs/evidence/npm-structured-callables-20260925.md"
	, "src/abi/component-structured-callables.mjs"
	, "src/build/component-structured-callable-adapters.mjs"
	, "src/build/component-structured-callable-defaults.mjs"
	, "src/build/component-structured-callable-lean.mjs"
	, "src/release/component-structured-callable-runtime.mjs"
	, "tests/component-structured-callable-abi.test.mjs"
	, "tests/component-structured-callable-contract.test.mjs"
	, "tests/component-structured-callable-defaults.test.mjs"
	, "tests/component-structured-callable-evidence.test.mjs"
	, "tests/component-structured-callable-lean.test.mjs"
	, "tests/component-structured-callable-wasm.test.mjs"
	, "tests/component-structured-callables.test.mjs"
	, "tests/fixtures/structured-callable-consumers/Npm.lean"
	, "tests/fixtures/structured-callable-consumers/npm-dispatch-probe.c"
	, "tests/fixtures/structured-callable-consumers/npm.mjs"
	, "tests/helpers/npm-structured-callable-evidence.mjs"
	, "tests/helpers/npm-structured-callable-fixture.mjs"
	, "tests/helpers/npm-structured-callable-install-fixture.mjs"
	, "tests/helpers/npm-structured-callable-source-history.mjs"
	, "tests/helpers/npm-structured-callable-wasm.mjs"
].sort();
const hash = value => assert.match(value, /^[a-f0-9]{64}$/u);
const passing = (run, file) => {
	assert.equal(run.exitCode, 0); assert.equal(sha256(run.text), run.sha256);
	assert.ok(run.command.includes(file)); assert.doesNotMatch(run.command, /--test-name-pattern/u);
	assert.match(run.text, /# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n/u);
};
const publicResult = result => assert.deepEqual(result, {
	checks: 133120, rejections: 53, shapes: 9
	, primitive: { checks: 8084, primitives: 19, wordBits: 32 }
});
const browserContexts = (run, verify) => {
	assert.deepEqual(run.browsers.map(browser => browser.engine), ["chromium", "firefox", "webkit"]);
	for(const browser of run.browsers)
	{
		assert.match(browser.version, /^\d+/u);
		assert.deepEqual(Object.keys(browser.result).sort(), ["page", "react", "worker"]);
		for(const result of Object.values(browser.result)) verify(result);
	}
};
const receipt = run => {
	assert.equal(run.offlineInstall, true); assert.equal(run.compilerFreePath, true);
	assert.deepEqual(run.typescript, { strict: true, executed: true });
	assert.equal(run.sourceRelocatedBeforeInstallation, true);
	hash(run.sourceSha256); hash(run.consumerSha256);
	const r = run.receipt;
	assert.equal(r.kind, "lean-bridge-component-package-receipt");
	for(const field of ["bindingIrSha256", "componentArtifactSha256", "componentBundleSha256", "componentIdentitySha256", "provenanceSha256", "runtimeRequirementSha256"]) hash(r[field]);
	for(const artifact of [r.package, r.runtime])
	{ hash(artifact.sha256); assert.match(artifact.archive, /^[^/]+\.tgz$/u); }
	assert.equal(r.policies.runtimeBinaryInComponent, false); assert.equal(r.policies.runtimeShared, true);
};

/**
 * Check both source paths, all five consumers, three browsers and original APIs.
 *
 * @param record - Immutable installed, regression and isolated-probe observations.
 */
export const assertNpmStructuredCallableExecution = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "npm-structured-callable-execution");
	assert.deepEqual(record.scope, npmStructuredCallableScope);
	passing(record.installed, "tests/component-structured-callables.test.mjs");
	assert.deepEqual(record.report.runs.map(run => run.path), npmStructuredCallableScope.paths);
	const consumer = (await Promise.all(["callable-consumers/npm.mjs", "structured-callable-consumers/npm.mjs"].map(path => readFile(`tests/fixtures/${path}`, "utf8")))).join("\n");
	const source = `${await readFile("tests/fixtures/onboarding/structured-callables/Structured.lean", "utf8")}\n${await readFile("tests/fixtures/structured-callable-consumers/Npm.lean", "utf8")}`;
	const documented = (await readFile("docs/javascript-typescript.md", "utf8")).split("### Structured callbacks\n")[1].split("### Type conversions\n")[0].match(/```js\n([\s\S]*?)```/u)[1];
	for(const run of record.report.runs)
	{
		receipt(run); publicResult(run.result); browserContexts(run, publicResult);
		for(const flag of ["sourceRemovedBeforeInstallation", "producerBuildsRemovedBeforeInstallation", "packagesRelocatedBeforeInstallation"]) assert.equal(run[flag], true, flag);
		assert.equal(run.consumerSha256, sha256(consumer)); assert.equal(run.sourceSha256, sha256(source));
		assert.equal(run.receipt.component.name, "structured");
		assert.deepEqual(run.documentation, { path: "docs/javascript-typescript.md"
			, sourceSha256: sha256(documented), stdout: "copied\n2\nleaf\n", stderr: ""
			, executions: 2, installedPublicApi: true });
	}
	const [ordinary, reviewed] = record.report.runs;
	assert.equal(ordinary.receipt.componentArtifactSha256, reviewed.receipt.componentArtifactSha256);
	assert.equal(ordinary.receipt.runtime.sha256, reviewed.receipt.runtime.sha256);
	assert.notEqual(ordinary.receipt.bindingIrSha256, reviewed.receipt.bindingIrSha256);
	assert.deepEqual(record.regressions.map(run => run.family), ["callables", "recursive"]);
	for(const regression of record.regressions)
	{
		passing(regression, `tests/component-${regression.family}.test.mjs`);
		assert.deepEqual(regression.report.runs.map(run => run.path), npmStructuredCallableScope.paths);
		for(const run of regression.report.runs)
		{
			receipt(run);
			assert.equal(run.receipt.runtime.sha256, ordinary.receipt.runtime.sha256);
			const verify = result => {
				if(regression.family === "callables") assert.deepEqual(result, { checks: 8084, primitives: 19, wordBits: 32 });
				else
				{ assert.equal(result.primitives, 19); assert.ok(result.checks > 1000); assert.ok(result.rejections > 30); }
			};
			verify(run.result); browserContexts(run, verify);
		}
	}
	passing(record.transport, "tests/component-structured-callable-wasm.test.mjs");
	assert.ok(record.transport.command.includes("LEAN_BRIDGE_STRUCTURED_CALLABLE_WASM_TEST=1"));
	const probe = record.transport.report;
	assert.equal(probe.kind, "npm-structured-callable-wasm-probe"); assert.equal(probe.schemaVersion, 1);
	for(const field of ["sourceSha256", "generatedAdapterSha256", "binarySha256", "runtimeSha256"]) hash(probe[field]);
	assert.equal(probe.shapes, 9); assert.equal(probe.scenarios.length, 115);
	assert.equal(new Set(probe.scenarios.map(item => `${item.shape}/${item.branch}/${item.operation}`)).size, 115);
	assert.deepEqual([...new Set(probe.scenarios.map(item => item.operation))].sort(), ["argument", "call", "captured", "make", "twice"]);
	for(const [field, expected] of [["nativeFaults", 833], ["jsFaults", 998]])
	{
		assert.equal(probe[field], expected);
		assert.equal(probe.scenarios.reduce((sum, item) => sum + item[field], 0), expected);
	}
	assert.deepEqual(probe.poisonCases, ["reply", "receipt", "result", "status", "cleanup", "cleanup-after-error", "release"].map(mode => ({ mode, hostCalls: ["receipt", "release"].includes(mode) ? 0 : 1, retired: true, unsafeFrees: 0 })));
	assert.deepEqual(probe.ownership, { nativeCopiedOutputOwnersAfterRecoverableFailures: 0
		, jsAllocationsAfterRecoverableFailures: 0
		, allLeanHeapAllocationsTracked: false
		, installedPackagesInstrumented: false });
	assert.deepEqual(probe.sharedScalarAndStructured, { reentryDepth: 64, closureCapacity: 1024, recoveredAfterLimit: true });
};

/**
 * Check exact source history and the 180 npm copied-callback inventory cells.
 *
 * @param record - Source transition, original receipts and bounded promotion.
 */
export const assertNpmStructuredCallableIntegration = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "npm-structured-callable-integration");
	assert.equal(record.baselineRevision, "8538d3f67b0cdfffabf35b95153a15ecd56d84f5");
	assert.deepEqual(record.scope, npmStructuredCallableScope);
	assert.deepEqual(record.inventory, { previousVersion: "0.93.0", version: "0.94.0", previousInstalled: 4506, installed: 4686, total: 6562 });
	assert.equal(record.previous.path, perlStructuredCallableHistoryPath);
	const previousBytes = await readFile(record.previous.path); assert.equal(sha256(previousBytes), record.previous.sha256);
	const previous = JSON.parse(previousBytes);
	assert.equal(record.execution.path, npmStructuredCallableExecutionPath);
	const executionBytes = await readFile(record.execution.path); assert.equal(sha256(executionBytes), record.execution.sha256);
	const execution = JSON.parse(executionBytes); await assertNpmStructuredCallableExecution(execution);
	assert.deepEqual(record.updates.map(item => item.path).sort(), npmStructuredCallableChangedPaths);
	assert.deepEqual(Object.keys(record.additions).sort(), npmStructuredCallableAddedPaths);
	const paths = [...new Set([...Object.keys(previous.sourceHashes), ...npmStructuredCallableChangedPaths, ...npmStructuredCallableAddedPaths])].sort();
	assert.deepEqual(Object.keys(record.sourceHashes).sort(), paths);
	for(const path of paths) assert.equal(sha256(await priorSource(path)), record.sourceHashes[path], path);
	const restored = {};
	for(const update of record.updates)
	{
		assert.equal(update.currentSha256, record.sourceHashes[update.path]);
		restored[update.path] = reverseNpmStructuredCallableUpdate(await priorSource(update.path), update);
		if(previous.sourceHashes[update.path]) assert.equal(update.previousSha256, previous.sourceHashes[update.path]);
	}
	for(const [path, digest] of Object.entries(record.additions)) assert.equal(digest, record.sourceHashes[path]);
	const { document, ...contracts } = { ...await readTypeSurface()
		, document: JSON.parse(await priorSource("docs/type-surface.v1.json")) };
	const old = JSON.parse(restored["docs/type-surface.v1.json"]);
	assert.equal(document.contractVersion, record.inventory.version); assert.equal(old.contractVersion, record.inventory.previousVersion);
	const cells = typeSurfaceCells(document, contracts), oldCells = typeSurfaceCells(old, contracts);
	const installed = values => values.filter(cell => cell.stages.installedExecution.state === "passed");
	assert.equal(installed(cells).length, record.inventory.installed); assert.equal(installed(oldCells).length, record.inventory.previousInstalled);
	assert.equal(cells.length, record.inventory.total);
	const promoted = cells.filter(cell => cell.stages.installedExecution.evidence.includes("npm-structured-callables-installed"));
	assert.equal(promoted.length, 180);
	for(const cell of promoted)
	{
		for(const [key, values] of Object.entries({ profile: record.scope.profiles, shape: record.scope.shapes, path: record.scope.paths, position: record.scope.positions })) assert.ok(values.includes(cell[key]));
		assert.ok(cell.hostType && cell.conversionNote);
		for(const stage of Object.values(cell.stages)) assert.deepEqual({ state: stage.state, evidence: stage.evidence }, { state: "passed", evidence: ["npm-structured-callables-installed"] });
	}
	const oldById = new Map(oldCells.map(cell => [cell.id, cell]));
	for(const cell of cells.filter(cell => !promoted.includes(cell))) assert.deepEqual(cell, oldById.get(cell.id), cell.id);
	const entry = document.evidence.find(item => item.id === "npm-structured-callables-installed");
	assert.deepEqual(entry.artifacts, execution.report.runs.flatMap(run => [run.receipt.package, run.receipt.runtime].map(item => ({ path: `${run.path}/${item.archive}`, sha256: item.sha256 }))));
	assert.ok(entry.files.some(file => file.path === npmStructuredCallableExecutionPath));
	await assertPerlStructuredCallableIntegration(previous);
};
