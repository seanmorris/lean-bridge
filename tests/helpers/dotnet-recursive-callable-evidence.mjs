/**
 * Bind recursive C# support to original NuGet archives and exact source history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import { assertPerlRecursiveCallableIntegration } from "./perl-recursive-callable-evidence.mjs";
import { perlRecursiveCallableHistoryPath } from "./perl-recursive-callable-source-history.mjs";
import { assertDotnetStructuredCallableExecution, dotnetStructuredCallableExecutionPath } from "./dotnet-structured-callable-evidence.mjs";
import { assertDotnetGraphPackageReports } from "./dotnet-graph-receipt.mjs";
import { assertDotnetRecursiveProbes } from "./dotnet-recursive-callable-faults.mjs";
import { dotnetRecursiveCallableDocumentation } from "./dotnet-recursive-callable-docs.mjs";
import { dotnetRecursiveMixedFixture } from "./dotnet-recursive-callable-mixed.mjs";
import { dotnetRecursiveCallableChangedPaths, reverseDotnetRecursiveCallableUpdate } from "./dotnet-recursive-callable-source-history.mjs";

export const dotnetRecursiveCallableBaseline = "a8a255329c102155add79169d71a05246190b8fd";
export const dotnetRecursiveCallableExecutionPath = "docs/evidence/dotnet-recursive-callables-20260926.json";
export const dotnetRecursiveCallableAddedPaths = [
	dotnetRecursiveCallableExecutionPath
	, "docs/evidence/dotnet-recursive-callables-20260926.md"
	, ...["model", "runtime", "calls", "package"].map(name => `src/backends/dotnet/callable-graph-${name}.mjs`)
	, ...["dotnet-recursive", "dotnet-recursive-faults", "dotnet-recursive-installed"].map(name => `tests/fixtures/structured-callable-consumers/${name}.cs`)
	, ...["acceptance", "consumer", "docs", "faults", "mixed", "ownership", "probes", "types", "evidence", "source-history"].map(name => `tests/helpers/dotnet-recursive-callable-${name}.mjs`)
	, "tests/dotnet-recursive-callable-contract.test.mjs"
	, "tests/dotnet-recursive-callable-evidence.test.mjs"
	, "tests/dotnet-recursive-callables.test.mjs"
].sort();
export const dotnetRecursiveCallableScope = {
	profiles: ["dotnet"], paths: ["ordinary-source", "reviewed-ir"]
	, shapes: ["alias", "array", "list", "option", "record", "recursive", "result", "tuple", "variant"]
	, positions: ["callback-parameter", "callback-result"]
	, recursiveCallbacks: true, ownedResourceAggregates: false
};

/**
 * Add four Dotnet recursive callback cells and authenticate unchanged history.
 *
 * @param record - Reversible source transitions and immutable execution receipt.
 */
export const assertDotnetRecursiveCallableIntegration = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "dotnet-recursive-callable-integration");
	assert.equal(record.baselineRevision, dotnetRecursiveCallableBaseline);
	assert.deepEqual(record.scope, dotnetRecursiveCallableScope);
	assert.deepEqual(record.inventory, { previousVersion: "0.102.0", version: "0.103.0", previousInstalled: 4806, installed: 4810, total: 6562 });
	const previous = await authenticated(record.previous, perlRecursiveCallableHistoryPath);
	const execution = await authenticated(record.execution, dotnetRecursiveCallableExecutionPath);
	await assertDotnetRecursiveCallableExecution(execution);
	assert.deepEqual(record.updates.map(update => update.path).sort(), dotnetRecursiveCallableChangedPaths);
	assert.deepEqual(Object.keys(record.additions).sort(), dotnetRecursiveCallableAddedPaths);
	const paths = [...new Set([...Object.keys(previous.sourceHashes), ...dotnetRecursiveCallableChangedPaths, ...dotnetRecursiveCallableAddedPaths])].sort();
	assert.deepEqual(Object.keys(record.sourceHashes).sort(), paths);
	for(const path of paths) assert.equal(sha256(await readFile(path, "utf8")), record.sourceHashes[path], path);
	const restored = {};
	for(const update of record.updates)
	{
		assert.equal(update.currentSha256, record.sourceHashes[update.path]);
		if(previous.sourceHashes[update.path]) assert.equal(update.previousSha256, previous.sourceHashes[update.path]);
		restored[update.path] = reverseDotnetRecursiveCallableUpdate(await readFile(update.path, "utf8"), update);
	}
	for(const [path, hash] of Object.entries(record.additions)) assert.equal(hash, record.sourceHashes[path]);
	const { document, ...contracts } = await readTypeSurface(), old = JSON.parse(restored["docs/type-surface.v1.json"]);
	assert.equal(document.contractVersion, "0.103.0"); assert.equal(old.contractVersion, "0.102.0");
	const cells = typeSurfaceCells(document, contracts), oldCells = typeSurfaceCells(old, contracts);
	const count = values => values.filter(cell => cell.stages.installedExecution.state === "passed").length;
	assert.equal(count(cells), 4810); assert.equal(count(oldCells), 4806); assert.equal(cells.length, 6562);
	const promoted = cells.filter(cell => cell.stages.installedExecution.evidence.includes("dotnet-recursive-callables-installed"));
	assert.equal(promoted.length, 4);
	for(const cell of promoted)
	{
		assert.equal(cell.profile, "dotnet"); assert.equal(cell.shape, "recursive");
		assert.ok(record.scope.paths.includes(cell.path)); assert.ok(record.scope.positions.includes(cell.position));
		assert.ok(cell.hostType && cell.conversionNote);
		for(const stage of Object.values(cell.stages))
			assert.deepEqual({ state: stage.state, evidence: stage.evidence }, { state: "passed", evidence: ["dotnet-recursive-callables-installed"] });
	}
	const oldById = new Map(oldCells.map(cell => [cell.id, cell]));
	for(const cell of cells.filter(cell => !promoted.includes(cell))) assert.deepEqual(cell, oldById.get(cell.id), cell.id);
	const entry = document.evidence.find(item => item.id === "dotnet-recursive-callables-installed");
	assert.deepEqual(entry.artifacts, execution.reports.flatMap(run => run.packages.flatMap(pkg => pkg.artifacts.map(artifact => ({ path: `dotnet/${run.path}/${artifact.path}`, sha256: artifact.sha256 })))));
	assert.ok(entry.files.some(file => file.path === dotnetRecursiveCallableExecutionPath));
	await assertPerlRecursiveCallableIntegration(previous);
};
export const dotnetRecursiveCallableProjectionPaths = [
	...["model", "runtime", "calls", "package"].map(name => `src/backends/dotnet/callable-graph-${name}.mjs`)
	, "src/backends/dotnet/copied-graph-assets.mjs"
	, "src/backends/managed/package-audit.mjs"
	, "src/build/native-graph-projection.mjs"
	, "src/build/native-dotnet-artifacts.mjs"
	, "src/build/native-dotnet-projection.mjs", "src/release/native-nuget.mjs"
].sort();
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
const hashes = values => {
	assert.ok(Object.keys(values).length > 0);
	for(const value of Object.values(values)) digest(value);
};

/**
 * Require original archives, all callable shapes, fault recovery and exact examples.
 *
 * @param record - Complete installed reports and terminal unfiltered logs.
 */
export const assertDotnetRecursiveCallableExecution = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "dotnet-recursive-callable-execution");
	assert.equal(record.baselineRevision, dotnetRecursiveCallableBaseline);
	assert.deepEqual(record.scope, dotnetRecursiveCallableScope);
	passing(record.installed, 1); passing(record.contract, 7);
	assert.ok(record.installed.command.includes("LEAN_BRIDGE_DOTNET_RECURSIVE_CALLABLE_TEST=1"));
	assert.ok(record.installed.command.includes("tests/dotnet-recursive-callables.test.mjs"));
	assert.doesNotMatch(record.installed.command, /--import|loader/u);
	assert.ok(record.contract.command.includes("tests/dotnet-recursive-callable-contract.test.mjs"));
	const regressions = record.regressions;
	passing(regressions.primitive.installed, 1); passing(regressions.structured.installed, 1); passing(regressions.copied.installed, 15);
	for(const flag of ["PACKAGE", "INSTALLED", "COMPOSITION", "REPRODUCIBILITY", "CONFLICT"])
		assert.ok(regressions.copied.installed.command.includes(`LEAN_BRIDGE_DOTNET_GRAPH_${flag}_TEST=1`));
	assert.deepEqual(Object.keys(regressions.projectionSources).sort(), dotnetRecursiveCallableProjectionPaths);
	for(const [path, hash] of Object.entries(regressions.projectionSources)) assert.equal(sha256(await readFile(path)), hash, path);
	const old = await authenticated(record.previousDotnetExecution, dotnetStructuredCallableExecutionPath);
	await assertDotnetStructuredCallableExecution({ ...old
		, installed: regressions.structured.installed
		, reports: regressions.structured.reports
		, primitiveRegression: regressions.primitive.installed
		, primitiveReports: regressions.primitive.reports });
	assertDotnetGraphPackageReports(regressions.copied.reports);
	assert.deepEqual(record.reports.map(run => run.path), dotnetRecursiveCallableScope.paths);
	assert.deepEqual(record.mixedReports.map(run => run.path), dotnetRecursiveCallableScope.paths);
	const documentation = await dotnetRecursiveCallableDocumentation(), mixed = await dotnetRecursiveMixedFixture(documentation.source);
	const fixture = async name => sha256(await readFile(`tests/fixtures/structured-callable-consumers/${name}.cs`));
	for(const [isMixed, reports] of [[false, record.reports], [true, record.mixedReports]]) for(const run of reports)
	{
		assert.equal(run.profile, "dotnet"); assert.equal(run.exports, isMixed ? 97 : 33); assert.equal(run.signatures, isMixed ? 59 : 18);
		for(const key of ["freshAuthor", "nugetOnly", "onlyPreparedDependency", "emptyNuGetCache", "producerRemovedBeforeInstall", "handoffRemoved", "installedUnchanged", "sdkFree", "relocated"])
			assert.equal(run[key], true, key);
		for(const key of ["bindingIrSha256", "layoutSha256", "handoffSha256"]) digest(run[key]);
		for(const key of ["producerSources", "installedFiles", "deployedFiles"]) hashes(run[key]);
		assert.equal(run.packages.length, 1); const pkg = run.packages[0];
		assert.equal(pkg.target, "nuget"); assert.equal(pkg.ecosystem, "nuget"); assert.equal(pkg.role, "component");
		assert.equal(pkg.runtimeDelivery, "embedded"); assert.deepEqual(pkg.requires, []);
		assert.equal(pkg.name, "Lean.Structured"); assert.equal(pkg.artifacts.length, 1);
		assert.deepEqual(run.archive, pkg.artifacts[0]); digest(run.archive.sha256); assert.ok(run.archive.bytes > 0);
		assert.equal(run.installedFiles["lean.structured.1.0.0.nupkg"], run.archive.sha256);
		assert.equal(run.installedReceipt.runtimeIdentity, pkg.runtimeIdentity);
		assert.equal(run.installedReceipt.bindingIrSha256, run.bindingIrSha256);
		assert.equal(run.installedReceipt.kind, "lean-bridge-ordinary-nuget-package");
		const assembly = run.installedFiles["lib/net8.0/LeanBridge.Structured.dll"];
		digest(assembly); assert.equal(run.deployedFiles["LeanBridge.Structured.dll"], assembly);
		for(const [path, hash] of Object.entries(run.producerSources).filter(([path]) => path.startsWith("src/") || ["binding-manifest.json", "global.json"].includes(path)))
			assert.equal(run.installedFiles[`lean-bridge/dotnet/${path}`], hash, path);
		for(const path of ["lib/net8.0/LeanBridge.Structured.dll", "lib/net8.0/LeanBridge.Structured.xml"])
			assert.equal(run.installedFiles[path], run.producerSources[path]);
		assert.equal(run.installedFiles["lean-bridge/native-dotnet.json"], run.producerSources["native-dotnet.json"]);
		assert.deepEqual(run.public, { mode: "public", checks: 15 });
		assert.deepEqual(run.acyclic, regressions.structured.reports.find(prior => prior.path === run.path).installation.public);
		assert.deepEqual(run.documentation, { authorSha256: sha256(documentation.author), configurationSha256: sha256(documentation.configuration), consumerSha256: sha256(documentation.consumer) });
		const nativeFiles = Object.keys(run.deployedFiles).filter(path => path.endsWith(".so"));
		assert.equal(nativeFiles.length, 4); assert.deepEqual(run.tamperChecks.map(item => item.target), nativeFiles);
		for(const probe of run.tamperChecks)
		{
			assert.equal(run.installedFiles[probe.target], run.deployedFiles[probe.target]);
			assert.deepEqual(probe.cold, { mode: "cold", checks: 5 });
			assert.deepEqual(probe.tampered, { mode: "tampered", checks: 3 });
		}
		if(isMixed)
		{
			assert.equal(run.probes, null); assert.equal(run.originalRecursive, null);
			assert.deepEqual(run.mixed, { checks: 128266, sourceSha256: sha256(mixed.consumer), sourceFree: true, sdkFree: true });
			continue;
		}
		assert.equal(run.mixed, null); assertDotnetRecursiveProbes(run.probes);
		assert.equal(run.probes.installedAssemblySha256, assembly);
		for(const [file, hash] of Object.entries(run.probes.originalSources))
			assert.equal(run.installedFiles[`lean-bridge/dotnet/src/LeanBridge.Structured/${file}`], hash, file);
		const original = run.originalRecursive;
		assert.deepEqual(original.recursive, run.probes.recursive); assert.deepEqual(original.lifetimes, run.probes.lifetimes);
		assert.equal(original.originalAssemblySha256, assembly); assert.equal(original.example, "20\n19\n20\n");
		for(const key of ["sdkFree", "sourceFree", "relocated"]) assert.equal(original[key], true);
		for(const key of ["deployment", "exampleDeployment"])
		{
			hashes(original[key]); assert.equal(original[key]["LeanBridge.Structured.dll"], assembly);
			for(const path of nativeFiles) assert.equal(original[key][path], run.deployedFiles[path]);
		}
		hashes(original.sourceHashes);
		assert.equal(original.sourceHashes["RecursiveCases.cs"], await fixture("dotnet-recursive"));
		assert.equal(original.sourceHashes["StructuredValues.cs"], await fixture("dotnet-values"));
		assert.equal(original.sourceHashes["Example.cs"], sha256(documentation.consumer));
	}
};
