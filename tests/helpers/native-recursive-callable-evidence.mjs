/**
 * Authenticate installed recursive callbacks, failure cleanup and source history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import { recursiveCallableCConsumer, recursiveCallableCFaultConsumer } from "./c-recursive-callable-fixture.mjs";
import { recursiveCallableCppConsumer } from "./cpp-recursive-callable-fixture.mjs";
import { assertWitStructuredCallableIntegration } from "./wit-structured-callable-evidence.mjs";
import { witStructuredCallableHistoryPath } from "./wit-structured-callable-source-history.mjs";
import { nativeRecursiveCallableChangedPaths, reverseNativeRecursiveCallableUpdate } from "./native-recursive-callable-source-history.mjs";
import { assertNativeRecursiveCallableCodegen, nativeRecursiveCallableCodegenPath } from "./native-recursive-callable-regression.mjs";

export const nativeRecursiveCallableExecutionPath = "docs/evidence/native-recursive-callables-20260925.json";
export const nativeRecursiveCallableAddedPaths = [
	nativeRecursiveCallableExecutionPath, nativeRecursiveCallableCodegenPath
	, "docs/evidence/native-recursive-callables-20260925.md"
	, "src/backends/c/callable-graph-model.mjs"
	, "src/backends/c/callable-graph-package.mjs"
	, "src/backends/c/native-callable-graph-borrows.mjs"
	, "src/backends/c/native-callable-graph-calls.mjs"
	, "src/backends/c/native-callable-graph-payloads.mjs"
	, "src/backends/cpp/callable-graph-package.mjs"
	, "src/build/native-callable-graph.mjs"
	, "tests/c-family-recursive-documentation.test.mjs"
	, "tests/c-recursive-callable-package.test.mjs"
	, "tests/callable-graph-names.test.mjs"
	, "tests/cpp-recursive-callable-package.test.mjs"
	, "tests/fixtures/documentation/consumers/c/recursive-callables.c"
	, "tests/fixtures/documentation/consumers/cpp/recursive-callables.cpp"
	, "tests/helpers/c-family-recursive-callable-install.mjs"
	, "tests/helpers/c-recursive-callable-edges.mjs"
	, "tests/helpers/c-recursive-callable-faults.mjs"
	, "tests/helpers/c-recursive-callable-fixture.mjs"
	, "tests/helpers/cpp-recursive-callable-fixture.mjs"
	, "tests/helpers/native-recursive-callable-calls-probe.mjs"
	, "tests/helpers/native-recursive-callable-evidence.mjs"
	, "tests/helpers/native-recursive-callable-fixture.mjs"
	, "tests/helpers/native-recursive-callable-regression.mjs"
	, "tests/helpers/native-recursive-callable-source-history.mjs"
	, "tests/native-recursive-callable-compile.test.mjs"
	, "tests/native-recursive-callable-evidence.test.mjs"
	, "tests/native-recursive-callable-model.test.mjs"
].sort();
export const nativeRecursiveCallableScope = {
	profiles: ["c", "cpp"], paths: ["ordinary-source", "reviewed-ir"]
	, shapes: ["alias", "array", "list", "option", "record", "recursive", "result", "tuple", "variant"]
	, positions: ["callback-parameter", "callback-result"]
	, recursiveCallbacks: true, ownedResourceAggregates: false
};
const shapes = ["array", "list", "option", "result", "tuple", "record", "variant", "alias", "recursive"];
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const reports = record => {
	assert.deepEqual(record.reports.map(run => run.path), nativeRecursiveCallableScope.paths);
	return record.reports;
};
const passing = (run, tests) => {
	assert.equal(run.exitCode, 0); assert.equal(sha256(run.text), run.sha256);
	assert.match(run.text, new RegExp(`# tests ${tests}\\n# suites 0\\n# pass ${tests}\\n# fail 0\\n# cancelled 0\\n# skipped 0`, "u"));
};
const cResult = result => assert.deepEqual(result, {
	acceptedDepths: 64, activeDisposals: 0, aliases: 2, callbacks: 708
	, checks: 10207
	, edgeRejections: 52, nestedResultCases: 7, optionCases: 7, resultCases: 15
	, shapes: 9, wrongProcesses: 1, wrongThreads: 17
});
const safety = run => {
	for(const flag of ["archivesRemoved", "compilerFreeExecution", "sourceFreeExecution"]) assert.equal(run[flag], true, flag);
	digest(run.executableSha256); assert.deepEqual(run.sanitizers, ["address", "leak", "undefined"]);
	assert.deepEqual({ ...run.startupLeakBaseline, report: undefined }, {
		bytes: 128, allocations: 12, unchangedAfterConversions: true
		, report: undefined
	});
	assert.match(run.startupLeakBaseline.report, /__gmp_default_allocate/u);
};
const packages = (run, targets) => {
	assert.deepEqual(run.packages.map(pkg => pkg.target), targets);
	for(const pkg of run.packages)
	{
		assert.equal(pkg.role, "component"); digest(pkg.runtimeIdentity);
		assert.equal(pkg.artifacts.length, 1);
		const artifact = pkg.artifacts[0]; digest(artifact.sha256);
		assert.equal(artifact.path, `archives/structured-1.0.0-${pkg.target}.tar.gz`);
		assert.ok(Number.isSafeInteger(artifact.bytes) && artifact.bytes > 0);
	}
	for(const key of ["bindingIrSha256", "sourceTreeSha256"]) digest(run[key]);
	assert.equal(run.sourceRemovedBeforeInstallation, true);
	assert.equal(run.relocatedBeforeInstallation, true);
};

/**
 * Verify both public projections, all payload shapes and documented deployments.
 *
 * @param record - Original terminal logs and generated execution observations.
 */
export const assertNativeRecursiveCallableExecution = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "native-recursive-callable-execution");
	assert.deepEqual(record.scope, nativeRecursiveCallableScope);
	passing(record.installed, 7);
	for(const [flag, name] of [["NATIVE", "native-recursive-callable-compile"], ["C", "c-recursive-callable-package"], ["CPP", "cpp-recursive-callable-package"]])
	{
		assert.ok(record.installed.command.includes(`LEAN_BRIDGE_${flag}_RECURSIVE_CALLABLE_TEST=1`));
		assert.ok(record.installed.command.includes(`tests/${name}.test.mjs`));
	}
	for(const [profile, report] of [["c", record.c], ["cpp", record.cpp]]) for(const run of reports(report))
	{
		packages(run, profile === "c" ? ["c"] : ["c", "cpp"]); assert.equal(run.profile, profile);
		for(const flag of ["compilerFreePath", "offlineInstall"]) assert.equal(run[flag], true, flag);
		for(const key of ["modelSha256", "consumerSha256"]) digest(run[key]);
		assert.equal(run.consumerSha256, sha256(profile === "c" ? recursiveCallableCConsumer() : await recursiveCallableCppConsumer()));
		assert.equal(run.checks, run.result.checks); safety(run.safety);
		if(profile === "c")
		{
			cResult(run.result); const faults = run.faults;
			assert.equal(faults.consumerSha256, sha256(recursiveCallableCFaultConsumer()));
			digest(faults.executableSha256); assert.deepEqual(faults.sanitizers, ["address", "leak", "undefined"]);
			assert.equal(faults.trackedAllocationsRestoredAfterEveryCheckpoint, true);
			assert.equal(faults.trackedLiveAllocationsAtExit, 0); assert.equal(faults.startupLeakBaselineUnchanged, true);
			assert.match(faults.startupLeakReport, /__gmp_default_allocate/u);
			assert.deepEqual(faults.sources.map(item => item.layer), ["native", "gmp"]);
			for(const item of faults.sources)
			{ digest(item.sourceSha256); digest(item.instrumentedSha256); assert.notEqual(item.sourceSha256, item.instrumentedSha256); }
			assert.deepEqual(faults.rejectedMutations.map(item => item.name), ["argument-arena", "reply-owner"]);
			for(const item of faults.rejectedMutations) digest(item.sourceSha256);
			const { faults: rows, ...observed } = faults.result;
			assert.deepEqual(observed, { ...run.result, checks: 217706, callbacks: 5284, activeDisposals: 2 });
			assert.deepEqual(rows.map(item => item.shape), [...shapes, "nested-alias", "nested-plain"]);
			for(const row of rows)
			{
				assert.equal(row.nativeCases, 60); assert.equal(row.gmpCases, 60);
				assert.ok(row.gmpFailures > 0); assert.ok(row.nativeFailures > 0 || row.shape === "option");
			}
			assert.equal(rows.reduce((sum, row) => sum + row.nativeFailures, 0), 1974);
			assert.equal(rows.reduce((sum, row) => sum + row.gmpFailures, 0), 5328);
		}
		else
		{
			assert.equal(run.result.checks, 14073); assert.equal(run.result.acceptedDepths, 64);
			assert.equal(run.result.recycledThreadChecks, 16); assert.equal(run.result.allocationFailures, 8992);
			assert.deepEqual(run.result.faults.map(row => row.shape), shapes);
			assert.deepEqual(run.result.aliases.map(row => row.shape), ["alias", "plain"]);
			const rows = [...run.result.faults, ...run.result.aliases];
			for(const row of rows)
			{ assert.equal(row.cases, 48); assert.ok(row.failures > 0); }
			assert.equal(rows.reduce((sum, row) => sum + row.failures, 0), run.result.allocationFailures);
			assert.deepEqual(run.safety.rejected.map(item => item.name), ["argument", "callback-argument", "callback-result", "borrowed-result", "option-null", "closure-argument", "closure-copy"]);
			for(const item of run.safety.rejected)
			{ assert.ok(item.diagnostics > 0); digest(item.sourceSha256); }
			cResult(run.companionC.result); assert.equal(run.companionC.consumerSha256, sha256(recursiveCallableCConsumer()));
			assert.equal(run.companionC.checks, 10207);
			assert.equal(run.companionC.offlineInstall, true); assert.equal(run.companionC.compilerFreePath, true);
			const combined = run.combined;
			for(const flag of ["archivesRemoved", "compilerFreeExecution", "sourceFreeExecution"]) assert.equal(combined[flag], true, flag);
			assert.deepEqual(combined.sanitizers, ["address", "leak", "undefined"]);
			assert.equal(Object.keys(combined.libraries).length, 6);
			for(const hash of Object.values(combined.libraries)) digest(hash);
			assert.deepEqual(combined.reports.map(item => item.name), ["c-first", "cpp-first"]);
			for(const mixed of combined.reports)
			{
				digest(mixed.consumerSha256); digest(mixed.executableSha256);
				assert.deepEqual(mixed.observed, { checks: 421, iterations: 32, callbacks: 64, runtimeInitializations: 1, components: 1, identities: 0 });
				assert.match(mixed.startupLeakReport, /__gmp_default_allocate/u);
			}
		}
	}
	for(const run of reports(record.native))
	{
		assert.deepEqual(run.sanitized, run.result);
		assert.deepEqual(run.result, { checks: 26746, callbacks: 196, emptyReplies: 1, depth: 64, allocationFailures: 33, releasedReplies: 4 });
		assert.deepEqual(run.rejectedCleanupMutations, ["argument-arena", "reply-owner"]);
		assert.deepEqual(run.calls.sanitized, run.calls.result);
		assert.deepEqual(run.calls.result, { aliasSignatures: 2, allocationFailures: 579, callbacks: 3365, checks: 68613, ownedReplies: 343, reentryDepth: 64, rejections: 1163, shapes: 9 });
		assert.deepEqual(run.calls.rejectedMutations, ["closure-disposal", "failed-output"]);
		assert.deepEqual(run.calls.retirementChecks, ["stop-repeated-callback", "preserve-first-error", "malformed-carrier"]);
		for(const hash of [run.bindingIrSha256, run.consumerSha256, run.calls.sourceSha256, run.nativeLibrary.sha256]) digest(hash);
	}
	passing(record.documentation, 2);
	assert.ok(record.documentation.command.includes("LEAN_BRIDGE_C_FAMILY_RECURSIVE_DOCUMENTATION_TEST=1"));
	const publisher = (await readFile("docs/publish/c.md", "utf8")).split("## Export recursive callbacks\n")[1]?.split("## GMP dependency")[0];
	const lean = publisher?.match(/```lean\n([\s\S]*?)\n```/u)?.[1];
	const config = JSON.parse(publisher?.match(/```json\n([\s\S]*?)\n```/u)?.[1] ?? "null");
	assert.ok(lean && config);
	assert.deepEqual(record.documentation.report.reports.map(run => `${run.path}/${run.profile}`), ["ordinary-source/c", "ordinary-source/cpp", "reviewed-ir/c", "reviewed-ir/cpp"]);
	for(const run of record.documentation.report.reports)
	{
		packages(run, [run.profile]);
		for(const flag of ["headersAndArchivesRemoved", "compilerFreeExecution", "installedFilesUnchanged"]) assert.equal(run[flag], true, flag);
		assert.equal(run.stdout, "43\n"); assert.equal(run.repeatedExecutions, 2);
		assert.equal(run.consumerSourceSha256, sha256(await readFile(`tests/fixtures/documentation/consumers/${run.profile}/recursive-callables.${run.profile}`)));
		assert.equal(run.publisherSourceSha256, sha256(lean + "\n"));
		assert.equal(run.configurationSha256, sha256(canonicalJson(config)));
		for(const key of ["publisherSourceSha256", "configurationSha256", "executableSha256"]) digest(run[key]);
	}
	const regression = record.copiedRegression;
	passing(regression, 1);
	assert.ok(regression.command.includes("LEAN_BRIDGE_NATIVE_GRAPH_PACKAGE_TEST=1"));
	assert.ok(regression.command.includes("tests/native-graph-package.test.mjs"));
	assert.deepEqual(regression.report.reports.map(run => `${run.path}/${run.profile}`), ["ordinary-source/c", "ordinary-source/cpp", "reviewed-ir/c", "reviewed-ir/cpp"]);
	for(const run of regression.report.reports)
	{
		assert.equal(run.checks, run.profile === "c" ? 1425 : 270);
		assert.equal(run.sourceFreeChecks, run.checks);
		for(const flag of ["offlineInstall", "compilerFreePath", "sourceRemovedBeforeInstallation", "handoffRemovedBeforeExecution", "headersRemovedBeforeExecution"])
			assert.equal(run[flag], true, flag);
		assert.equal(run.consumerSha256, sha256(await readFile(`tests/fixtures/structured-types/recursive-installed.${run.profile}`)));
		for(const key of ["receiptSha256", "sourceTreeSha256", "modelSha256", "bindingIrSha256", "binarySha256", "executableSha256", "layoutSha256"]) digest(run[key]);
		assert.ok(run.rejected.diagnostics > 0); assert.equal(run.packages.length, 1);
		assert.equal(run.packages[0].target, run.profile);
		for(const artifact of run.packages[0].artifacts)
		{ digest(artifact.sha256); assert.ok(artifact.bytes > 0); }
		assert.ok(Object.keys(run.installedLibraries).length >= 4);
		for(const file of Object.values(run.installedLibraries)) digest(file.sha256);
	}
};

/**
 * Admit exactly eight new recursive callback cells and retain all prior records.
 *
 * @param record - Source-bound milestone and immutable predecessor references.
 */
export const assertNativeRecursiveCallableIntegration = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "native-recursive-callable-integration");
	assert.equal(record.baselineRevision, "136e4942ed32bd923cb721eb80aa038cfaa07f74");
	assert.deepEqual(record.scope, nativeRecursiveCallableScope);
	assert.deepEqual(record.inventory, { previousVersion: "0.97.0", version: "0.98.0", previousInstalled: 4782, installed: 4790, total: 6562 });
	const authenticated = async (entry, path) => {
		assert.equal(entry.path, path); const bytes = await readFile(path);
		assert.equal(sha256(bytes), entry.sha256); return JSON.parse(bytes);
	};
	const previous = await authenticated(record.previous, witStructuredCallableHistoryPath);
	await assertNativeRecursiveCallableExecution(await authenticated(record.execution, nativeRecursiveCallableExecutionPath));
	const codegen = await authenticated(record.codegen, nativeRecursiveCallableCodegenPath);
	assertNativeRecursiveCallableCodegen(codegen);
	assert.deepEqual(record.updates.map(update => update.path).sort(), nativeRecursiveCallableChangedPaths);
	assert.deepEqual(Object.keys(record.additions).sort(), nativeRecursiveCallableAddedPaths);
	const paths = [...new Set([...Object.keys(previous.sourceHashes), ...nativeRecursiveCallableChangedPaths, ...Object.keys(record.additions)])].sort();
	assert.deepEqual(Object.keys(record.sourceHashes).sort(), paths);
	for(const path of paths) assert.equal(sha256(await readFile(path)), record.sourceHashes[path], path);
	const restored = {};
	for(const update of record.updates)
	{
		assert.equal(update.currentSha256, record.sourceHashes[update.path]);
		restored[update.path] = reverseNativeRecursiveCallableUpdate(await readFile(update.path, "utf8"), update);
		if(previous.sourceHashes[update.path]) assert.equal(update.previousSha256, previous.sourceHashes[update.path]);
	}
	for(const [path, hash] of Object.entries(record.additions)) assert.equal(record.sourceHashes[path], hash);
	for(const [path, hash] of Object.entries(codegen.predecessors))
	{ assert.equal(hash, sha256(restored[path])); assert.equal(codegen.sourceHashes[path], record.sourceHashes[path]); }
	const { document, ...contracts } = await readTypeSurface(), old = JSON.parse(restored["docs/type-surface.v1.json"]);
	assert.equal(document.contractVersion, record.inventory.version); assert.equal(old.contractVersion, record.inventory.previousVersion);
	const cells = typeSurfaceCells(document, contracts), oldCells = typeSurfaceCells(old, contracts);
	const count = values => values.filter(cell => cell.stages.installedExecution.state === "passed").length;
	assert.equal(count(cells), 4790); assert.equal(count(oldCells), 4782); assert.equal(cells.length, 6562);
	const promoted = cells.filter(cell => cell.stages.installedExecution.evidence.includes("native-recursive-callables-installed"));
	assert.equal(promoted.length, 8);
	for(const cell of promoted)
	{
		assert.equal(cell.shape, "recursive"); assert.ok(record.scope.profiles.includes(cell.profile));
		assert.ok(record.scope.paths.includes(cell.path)); assert.ok(record.scope.positions.includes(cell.position));
		assert.ok(cell.hostType && cell.conversionNote);
		for(const stage of Object.values(cell.stages)) assert.deepEqual({ state: stage.state, evidence: stage.evidence }, { state: "passed", evidence: ["native-recursive-callables-installed"] });
	}
	const oldById = new Map(oldCells.map(cell => [cell.id, cell]));
	for(const cell of cells.filter(cell => !promoted.includes(cell))) assert.deepEqual(cell, oldById.get(cell.id), cell.id);
	await assertWitStructuredCallableIntegration(previous);
};
