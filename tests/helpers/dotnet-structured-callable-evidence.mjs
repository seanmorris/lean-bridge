/**
 * Bind original installed NuGet callbacks to exact sources, assemblies and cells.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import { structuredCallableExports } from "./structured-callable-fixture.mjs";
import { dotnetCallableSignatures, dotnetCallableConsumer } from "./dotnet-callable-fixture.mjs";
import { assertDotnetStructuredCodegenRegression } from "./dotnet-structured-callable-regression.mjs";
import { assertDotnetStructuredFaults } from "./dotnet-structured-callable-faults.mjs";
import { rubyStructuredCallableHistoryPath } from "./ruby-structured-callable-source-history.mjs";
import { assertRubyStructuredCallableIntegration } from "./ruby-structured-callable-evidence.mjs";
import { dotnetStructuredCallableChangedPaths, reverseDotnetStructuredCallableUpdate } from "./dotnet-structured-callable-source-history.mjs";
import { beforeJvmStructuredCallables } from "./jvm-structured-callable-source-history.mjs";

const priorSource = async path => beforeJvmStructuredCallables(path, await readFile(path, "utf8"));

export const dotnetStructuredCallableExecutionPath = "docs/evidence/dotnet-structured-callables-20260924.json";
export const dotnetStructuredCodegenPath = "docs/evidence/dotnet-structured-codegen-regression-20260924.json";
export const dotnetStructuredCallableAddedPaths = [
	dotnetStructuredCallableExecutionPath, dotnetStructuredCodegenPath
	, "docs/evidence/dotnet-structured-callables-20260924.md"
	, "tests/dotnet-structured-callable-contract.test.mjs"
	, "tests/dotnet-structured-callable-evidence.test.mjs"
	, "tests/dotnet-structured-callables.test.mjs"
	, "tests/fixtures/structured-callable-consumers/dotnet.cs"
	, "tests/fixtures/structured-callable-consumers/dotnet-values.cs"
	, "tests/fixtures/structured-callable-consumers/dotnet-faults.cs"
	, "tests/fixtures/structured-callable-consumers/dotnet-invalid.json"
	, "tests/helpers/dotnet-structured-callable-install.mjs"
	, "tests/helpers/dotnet-structured-callable-types.mjs"
	, "tests/helpers/dotnet-structured-callable-faults.mjs"
	, "tests/helpers/dotnet-structured-callable-regression.mjs"
	, "tests/helpers/dotnet-structured-callable-evidence.mjs"
	, "tests/helpers/dotnet-structured-callable-source-history.mjs"
].sort();
export const dotnetStructuredCallableScope = {
	profiles: ["dotnet"], paths: ["ordinary-source", "reviewed-ir"]
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
 * Require source-free original assemblies and separate, labelled fault probes.
 *
 * @param record - Captured reports and terminal unfiltered TAP logs.
 */
export const assertDotnetStructuredCallableExecution = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "dotnet-structured-callable-execution");
	assert.deepEqual(record.scope, dotnetStructuredCallableScope);
	passing(record.installed, "tests/dotnet-structured-callables.test.mjs", "LEAN_BRIDGE_DOTNET_STRUCTURED_CALLABLE_TEST");
	passing(record.primitiveRegression, "tests/dotnet-callables.test.mjs", "LEAN_BRIDGE_DOTNET_CALLABLE_TEST");
	assert.deepEqual(record.reports.map(run => run.path), dotnetStructuredCallableScope.paths);
	assert.deepEqual(record.primitiveReports.map(run => run.path), dotnetStructuredCallableScope.paths);
	const fixture = name => readFile(`tests/fixtures/structured-callable-consumers/${name}`, "utf8");
	const source = await fixture("dotnet.cs"), values = await fixture("dotnet-values.cs");
	const faultsSource = await fixture("dotnet-faults.cs"), invalid = await fixture("dotnet-invalid.json");
	const guide = await readFile("docs/consume/dotnet.md", "utf8");
	const documented = guide.match(/### Structured callback values\n[\s\S]*?```csharp\n([\s\S]*?)\n```/u)?.[1];
	assert.ok(documented);
	for(const run of record.reports)
	{
		assert.equal(run.profile, "dotnet");
		for(const key of ["sourceRemovedBeforeInstallation", "relocatedBeforeInstallation"]) assert.equal(run[key], true);
		assert.deepEqual(run.signatures.map(fn => fn.id).sort(), structuredCallableExports().map(name => `lean:${name}`).sort());
		assert.deepEqual(run.signatures, record.reports[0].signatures);
		for(const key of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256"]) hash(run[key]);
		assert.equal(run.packages.length, 1);
		const pkg = run.packages[0]; assert.equal(pkg.target, "nuget"); assert.equal(pkg.role, "component");
		assert.equal(pkg.runtimeDelivery, "embedded"); assert.equal(pkg.name, "Lean.Structured");
		hash(pkg.runtimeIdentity); assert.equal(pkg.runtimeIdentity, record.reports[0].packages[0].runtimeIdentity);
		assert.equal(pkg.artifacts.length, 1); hash(pkg.artifacts[0].sha256); assert.ok(pkg.artifacts[0].bytes > 0);
		assert.equal(pkg.artifacts[0].path, "archives/Lean.Structured.1.0.0.nupkg");
		const installation = run.installation, faults = installation.faults, typed = installation.publicTypes;
		assert.deepEqual(installation.public, record.reports[0].installation.public);
		assert.equal(installation.public.checks, 274237);
		assert.equal(installation.public.calls, 3072); assert.equal(installation.public.rejected, 937);
		assert.deepEqual(installation.public.shapes.toSorted(), dotnetStructuredCallableScope.shapes);
		assert.equal(installation.publicCallerSha256, sha256(source));
		assert.equal(installation.valuesSourceSha256, sha256(values));
		assertDotnetStructuredFaults(faults);
		assert.equal(faults.faults, 5444); assert.equal(faults.checks, 1000425);
		assert.equal(faults.malformed, 15); assert.equal(faults.clears, 10009);
		assert.equal(faults.isolatedInstrumentedProjection, true); assert.equal(faults.originalNativeLibraries, true);
		assert.equal(faults.probeSourceSha256, sha256(faultsSource)); assert.equal(faults.valuesSourceSha256, sha256(values));
		assert.notEqual(faults.runtimeSourceSha256, faults.instrumentedRuntimeSha256); hash(faults.instrumentedRuntimeSha256);
		assert.deepEqual(faults.shapes, record.reports[0].installation.faults.shapes);
		for(const [file, key] of [["Api.cs", "apiSourceSha256"], ["Runtime.cs", "runtimeSourceSha256"]])
			assert.equal(faults[key], installation.installedFiles[`lean-bridge/dotnet/src/LeanBridge.Structured/${file}`].sha256);
		assert.equal(typed.sdk, "8.0.424"); hash(typed.compilerSha256); assert.equal(typed.executed, true);
		assert.equal(typed.rejectionSourceSha256, sha256(invalid));
		assert.deepEqual(typed.rejected, JSON.parse(invalid).map(({ name, codes, statement }) => ({ name, codes, sourceSha256: sha256(`using LeanBridge.Structured; static class Invalid { static void Test() { ${statement} } }\n`) })));
		assert.equal(typed.assemblySha256, installation.installedFiles["lib/net8.0/LeanBridge.Structured.dll"].sha256);
		assert.equal(typed.assemblySha256, installation.deployment["LeanBridge.Structured.dll"].sha256);
		assert.deepEqual(installation.installedSnapshot["lean.structured.1.0.0.nupkg"], { bytes: pkg.artifacts[0].bytes, sha256: pkg.artifacts[0].sha256 });
		for(const key of ["offlineInstall", "emptyNuGetCache", "onlyPreparedDependency", "handoffRemovedBeforeExecution", "installedFilesUnchanged", "relocatedExecution", "sdkFreeExecution", "installedSourcesRemoved", "repeatExecution"]) assert.equal(installation[key], true);
		assert.equal(installation.sourceFreeExecutions, 2);
		assert.equal(installation.runtimeVersion, "8.0.30"); assert.equal(installation.fxrVersion, "8.0.30");
		assert.deepEqual(installation.documentation, { sourceSha256: sha256(documented + "\n"), stdout: "copied\nTrue\n2\n", assemblySha256: typed.assemblySha256, sourceFreeExecution: true, sdkFreeExecution: true, deploymentUnchanged: true });
		hash(installation.installedReceiptSha256);
		assert.equal(Object.keys(installation.nativeLibraries).length, 4);
		for(const [path, file] of Object.entries(installation.nativeLibraries))
		{
			assert.deepEqual(installation.installedFiles[path], file);
			assert.deepEqual(installation.installedSnapshot[path], file);
			assert.deepEqual(installation.deployment[path], file);
		}
		for(const file of Object.values(installation.installedFiles))
		{ hash(file.sha256); assert.ok(file.bytes >= 0); }
	}
	for(const run of record.primitiveReports)
	{
		assert.equal(run.profile, "dotnet"); assert.equal(run.checks, 128247);
		for(const key of ["sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreePath"]) assert.equal(run[key], true);
		assert.equal(run.consumerSha256, sha256(dotnetCallableConsumer()));
		const sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
		assert.deepEqual(sort(run.signatures), sort(dotnetCallableSignatures));
		assert.equal(run.installed.sourceFree, true); assert.equal(run.installed.sourceFreeExecutions, 2);
		assert.equal(run.installed.sourceFreeChecks, run.checks); assert.equal(run.installed.rejected.length, 7);
	}
};

/**
 * Authenticate every source edit and exactly thirty-two new installed cells.
 *
 * @param record - Frozen predecessor, literal edits and current inventory.
 */
export const assertDotnetStructuredCallableIntegration = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "dotnet-structured-callable-integration");
	assert.equal(record.baselineRevision, "35d11c8f9a623faaf294e2e475f82ef847f831ed");
	assert.deepEqual(record.scope, dotnetStructuredCallableScope);
	assert.deepEqual(record.inventory, { previousVersion: "0.90.0", version: "0.91.0", previousInstalled: 4378, installed: 4410, total: 6562 });
	assert.equal(record.previous.path, rubyStructuredCallableHistoryPath);
	const oldBytes = await readFile(record.previous.path); assert.equal(sha256(oldBytes), record.previous.sha256);
	const previous = JSON.parse(oldBytes);
	assert.equal(record.execution.path, dotnetStructuredCallableExecutionPath);
	const bytes = await readFile(record.execution.path); assert.equal(sha256(bytes), record.execution.sha256);
	const execution = JSON.parse(bytes); await assertDotnetStructuredCallableExecution(execution);
	assert.equal(record.codegen.path, dotnetStructuredCodegenPath);
	const codegenBytes = await readFile(record.codegen.path); assert.equal(sha256(codegenBytes), record.codegen.sha256);
	const codegen = JSON.parse(codegenBytes); assertDotnetStructuredCodegenRegression(codegen);
	assert.deepEqual(record.updates.map(update => update.path).sort(), dotnetStructuredCallableChangedPaths);
	assert.deepEqual(Object.keys(record.additions).sort(), dotnetStructuredCallableAddedPaths);
	const paths = [...new Set([...Object.keys(previous.sourceHashes), ...dotnetStructuredCallableChangedPaths, ...dotnetStructuredCallableAddedPaths])].sort();
	assert.deepEqual(Object.keys(record.sourceHashes).sort(), paths);
	for(const path of paths) assert.equal(sha256(await priorSource(path)), record.sourceHashes[path], path);
	const restored = {};
	for(const update of record.updates)
	{
		assert.equal(update.currentSha256, record.sourceHashes[update.path]);
		restored[update.path] = reverseDotnetStructuredCallableUpdate(await priorSource(update.path), update);
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
	const promoted = cells.filter(cell => cell.stages.installedExecution.evidence.includes("dotnet-structured-callables-installed"));
	assert.equal(promoted.length, 32);
	for(const cell of promoted)
	{
		assert.equal(cell.profile, "dotnet"); assert.ok(dotnetStructuredCallableScope.shapes.includes(cell.shape));
		assert.ok(dotnetStructuredCallableScope.paths.includes(cell.path)); assert.ok(dotnetStructuredCallableScope.positions.includes(cell.position));
		assert.ok(cell.hostType && cell.conversionNote);
		for(const stage of Object.values(cell.stages)) assert.deepEqual({ state: stage.state, evidence: stage.evidence }, { state: "passed", evidence: ["dotnet-structured-callables-installed"] });
	}
	const oldById = new Map(oldCells.map(cell => [cell.id, cell]));
	for(const cell of cells.filter(cell => !promoted.includes(cell))) assert.deepEqual(cell, oldById.get(cell.id), cell.id);
	const entry = document.evidence.find(item => item.id === "dotnet-structured-callables-installed");
	assert.deepEqual(entry.artifacts, execution.reports.flatMap(run => run.packages.flatMap(pkg => pkg.artifacts.map(artifact => ({ path: `dotnet/${run.path}/${artifact.path}`, sha256: artifact.sha256 })))));
	assert.ok(entry.files.some(file => file.path === dotnetStructuredCallableExecutionPath));
	await assertRubyStructuredCallableIntegration(previous);
};
