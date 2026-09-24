/**
 * Compare current installed C# behavior without rewriting older build receipts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { inspectLeanProject } from "../../src/analyze/lean-project.mjs";
import { nativeAllocationGuardHeader } from "../../src/build/native-allocation-guard.mjs";
import { compoundReviewedIr as expandedCompounds } from "./compound-fixture.mjs";
import { compoundReviewedIr as namedCompounds } from "./compound-source-fixture.mjs";
import { assertRepeatedDotnetFamilies } from "./dotnet-repeat-observations.mjs";

const families = ["aliases", "callables", "collections", "compounds", "lists", "variants"];
const digest = value => sha256(canonicalJson(value));
const signaturesDigest = signatures => digest([...signatures].sort((a, b) => a.name.localeCompare(b.name)));
const same = (actual, previous, keys) => {
	for(const key of keys) assert.deepEqual(actual[key], previous[key], key);
};
const required = (value, keys) => {
	for(const key of keys) assert.equal(value[key], true, key);
};
const without = (value, keys) => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
const hash = value => assert.match(value, /^[a-f0-9]{64}$/);
const faultSourceHashes = ["apiSourceSha256", "runtimeSourceSha256", "instrumentedRuntimeSha256"];

/**
 * Normalize declaration listing order, never parameter or field order.
 *
 * @param report - Complete fresh installed-family report.
 */
export const dotnetRegressionExecutions = report => report.reports.map(({ signatures, ...run }) => ({ ...run
	, ...signatures ? { signaturesSha256: signaturesDigest(signatures) } : {} }));

/** Reconstruct the exact NuGet source trees around the earlier named-Deep fix. */
export const dotnetCompoundSourceTrees = async () => {
	const base = (await inspectLeanProject("tests/fixtures/onboarding/npm-compounds")).inputs.filter(input => input.path !== "lean-bridge.exports.json");
	const configuration = canonicalJson({ schemaVersion: 1, modules: ["Compounds"]
		, targets: { nuget: { name: "Lean.Compounds", version: "1.0.0" } } });
	const entry = (path, source) => ({ path, bytes: Buffer.byteLength(source), sha256: sha256(source) });
	return Object.fromEntries([["previous", expandedCompounds()], ["current", namedCompounds()]].map(([name, ir]) => {
		const inputs = [...base, entry("lean-bridge.exports.json", configuration), entry("reviewed.binding-ir.json", canonicalJson(ir))].sort((a, b) => a.path.localeCompare(b.path));
		return [name, { inputs, sourceTreeSha256: sha256(inputs.map(input => `${input.sha256}  ${input.path}\n`).join("")) }];
	}));
};

const installed = (run, previous) => {
	same(run, previous, ["sdk", "compilerSha256", "runtimeVersion", "fxrVersion", "rejected", "sourceFreeChecks", "sourceFreeExecutions"]);
	required(run, ["onlyPreparedDependency", "sourceFree"]);
	assert.equal(run.sourceFreeExecutions, 2);
	assert.deepEqual(Object.keys(run.deployment), Object.keys(previous.deployment));
	for(const [path, file] of Object.entries(run.deployment))
	{
		hash(file.sha256); assert.ok(Number.isSafeInteger(file.bytes) && file.bytes > 0);
		if(path.endsWith("/libleanshared.so")) assert.deepEqual(file, previous.deployment[path]);
	}
	for(const key of ["assemblySha256", "packageReceiptSha256"]) hash(run[key]);
};

const collection = (run, previous) => {
	same(run, previous, ["calls", "rejected", "fixedArrayDepth", "primitiveShapes", "recordTypes", "publicCallerSha256", "sourceApiSha256", "threadedCalls", "runtimeVersion", "fxrVersion", "sourceFreeExecutions"]);
	required(run, ["emptyNuGetCache", "handoffRemovedBeforeExecution", "installedFilesUnchanged", "installedSourcesRemoved", "onlyPreparedDependency", "relocatedExecution", "repeatExecution", "sdkFreeExecution"]);
	assert.equal(run.sourceFreeExecutions, 2);
	assert.deepEqual(without(run.publicTypes, ["assemblySha256"]), without(previous.publicTypes, ["assemblySha256"]));
	assert.deepEqual(without(run.documentation, ["assemblySha256"]), without(previous.documentation, ["assemblySha256"]));
	const guard = "lean-bridge/component/allocation-guard.h";
	assert.deepEqual(Object.keys(run.installedFiles), [...Object.keys(previous.installedFiles), guard].sort());
	assert.deepEqual(Object.keys(run.installedSnapshot), [...Object.keys(previous.installedSnapshot), guard].sort());
	assert.deepEqual(Object.keys(run.deployment), Object.keys(previous.deployment));
	const api = "lean-bridge/dotnet/src/LeanBridge.Collections/Api.cs";
	assert.deepEqual(run.installedFiles[api], previous.installedFiles[api]);
	assert.equal(run.installedFiles[api].sha256, run.faults.apiSourceSha256);
	assert.equal(run.installedFiles[guard].sha256, sha256(nativeAllocationGuardHeader));
	assert.deepEqual(run.nativeLibraries, Object.fromEntries(Object.entries(run.deployment).filter(([path]) => path.startsWith("runtimes/"))));
	for(const [path, file] of Object.entries(run.nativeLibraries))
	{
		assert.deepEqual(file, run.installedFiles[path]);
		if(path.endsWith("/libleanshared.so")) assert.deepEqual(file, previous.nativeLibraries[path]);
	}
};

const nativeFaults = (run, previous) => {
	const generated = ["adapterSha256", "executableSha256", "probeAdapterSha256", "startupLeakBaseline"];
	assert.deepEqual(without(run, generated), without(previous, generated));
	// LeakSanitizer embeds the temporary producer path in its diagnostic text.
	assert.deepEqual(without(run.startupLeakBaseline, ["report"]), without(previous.startupLeakBaseline, ["report"]));
	const normalize = text => text.replace(/\/tmp\/lean-bridge-dotnet-variant-author-[A-Za-z0-9]+/g, "/build/author");
	assert.equal(normalize(run.startupLeakBaseline.report), normalize(previous.startupLeakBaseline.report));
	for(const key of generated.slice(0, 3)) hash(run[key]);
};

/**
 * Require unchanged public contracts, all failure checks and relocated executions.
 * Older package bytes predate broker/allocation-guard/value-equality changes.
 * Their digests stay in the old receipts; new digests belong to the new record.
 *
 * @param runs - Current installed observations, grouped by C# type family.
 * @param baselines - Immutable original family receipts.
 * @param compoundSourceTrees - Independently reconstructed reviewed inputs.
 */
export const assertDotnetInstalledRegressions = (runs, baselines, compoundSourceTrees) => {
	assert.deepEqual(Object.keys(runs).sort(), families);
	for(const family of families)
	{
		const baseline = baselines[family], executions = runs[family].executions;
		assert.deepEqual(executions.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
		for(const run of executions)
		{
			const previous = (baseline.executions ?? baseline.runs).find(item => item.path === run.path);
			assert.equal(run.profile, "dotnet");
			same(run, previous, ["checks", "consumerSha256", "publicCallerSha256", "sourceApiSha256", "rejectionSourceSha256"]);
			required(run, ["offlineInstall", "sourceRemovedBeforeInstallation"]);
			if(family === "compounds" && run.path === "reviewed-ir")
			{
				assert.equal(previous.sourceTreeSha256, compoundSourceTrees.previous.sourceTreeSha256);
				assert.equal(run.sourceTreeSha256, compoundSourceTrees.current.sourceTreeSha256);
			} else same(run, previous, ["sourceTreeSha256"]);
			if(!["aliases", "variants"].includes(family)) assert.equal(run.signaturesSha256, signaturesDigest(baseline.signatures));
			if(family === "collections") collection(run, previous);
			else
			{
				assert.equal(run.compilerFreePath, true); installed(run.installed, previous.installed);
				assert.equal(run.installed.sourceFreeChecks, run.checks);
			}
			if(family === "aliases") same(run.installed, previous.installed, ["aliases", "rejectionSourceSha256", "xmlSha256"]);
			if(family === "variants")
			{
				nativeFaults(run.nativeFaults, previous.nativeFaults);
				const guard = "lean-bridge/component/allocation-guard.h";
				assert.deepEqual(Object.keys(run.installedFiles), [...Object.keys(previous.installedFiles), guard].sort());
				assert.equal(run.installedFiles[guard].sha256, sha256(nativeAllocationGuardHeader));
			}
			if(family !== "callables")
			{
				assert.deepEqual(without(run.faults, faultSourceHashes), without(previous.faults, faultSourceHashes));
				for(const key of faultSourceHashes) hash(run.faults[key]);
			}
			assert.equal(run.packages.length, 1);
			const pkg = run.packages[0];
			assert.equal(pkg.target, "nuget"); assert.equal(pkg.runtimeDelivery, "embedded");
			assert.deepEqual(pkg.requires, []); assert.equal(pkg.artifacts.length, 1);
			hash(pkg.artifacts[0].sha256); assert.ok(pkg.artifacts[0].bytes > 0);
		}
	}
};

/**
 * Separate installed-test dependencies from graph-only tests and receipt checkers.
 *
 * @param previous - The unchanged previous six-family regression receipt.
 */
export const dotnetFamilyExecutionPaths = previous => [...new Set([
	...Object.keys(previous.sourceHashes).filter(path => path !== "tests/dotnet-graph-package.test.mjs"
		&& !/^tests\/helpers\/dotnet-(?:graph-|native-graphs|source-history|installed-regressions)/.test(path))
	, "src/backends/c/copied-graph-layout.mjs"
	, "src/backends/c/native-graph-adapters.mjs"
	, "tests/helpers/native-variant-faults.mjs"
])].sort();

export const dotnetFamilyVerifierPaths = [
	"tests/dotnet-repeat-observations.test.mjs"
	, "tests/helpers/dotnet-installed-regressions.mjs"
	, "tests/helpers/dotnet-repeat-observations.mjs"
];

/**
 * Require fresh current-source runs and unchanged packages from the prior runs.
 * The older managed-auditor source is not reconstructed or silently re-certified.
 *
 * @param record - Current execution evidence, distinct from the old receipt.
 */
export const assertDotnetFamilyRegressionEvidence = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "dotnet-current-family-regressions"); assert.equal(record.finalAcceptance, false);
	assert.equal(record.packageGlibcFloor, "2.38"); assert.equal(record.wordBits, 64);
	assert.equal(record.previous.path, "docs/evidence/dotnet-recursive-family-regressions-20260923.json");
	const previousBytes = await readFile(record.previous.path);
	assert.equal(sha256(previousBytes), record.previous.sha256);
	const previous = JSON.parse(previousBytes);
	assert.deepEqual(Object.keys(record.sourceHashes).sort(), dotnetFamilyExecutionPaths(previous));
	for(const [path, expected] of Object.entries(record.sourceHashes)) assert.equal(sha256(await readFile(path)), expected, path);
	assert.deepEqual(Object.keys(record.verifierSources).sort(), dotnetFamilyVerifierPaths);
	for(const [path, expected] of Object.entries(record.verifierSources)) assert.equal(sha256(await readFile(path)), expected, path);
	const baselines = {};
	assert.deepEqual(record.baselines, previous.baselines);
	assert.deepEqual(Object.keys(record.baselines).sort(), families);
	for(const [family, entry] of Object.entries(record.baselines))
	{
		assert.match(entry.path, new RegExp(`^docs/evidence/dotnet-${family}-202609[0-9]{2}\\.json$`));
		const bytes = await readFile(entry.path); assert.equal(sha256(bytes), entry.sha256);
		baselines[family] = JSON.parse(bytes);
	}
	for(const runs of [record.runs, previous.runs])
		for(const run of Object.values(runs)) assert.equal(digest(run.executions), run.executionsSha256);
	assert.equal(sha256(record.log.text), record.log.sha256);
	assert.match(record.log.text, /# tests 6\n# suites 0\n# pass 6\n# fail 0\n# cancelled 0\n# skipped 0/);
	for(const family of families) assert.ok(record.log.text.includes(`installed .NET ${family === "collections" ? "arrays and records" : family}`), family);
	assert.deepEqual(record.compoundReviewedSource, await dotnetCompoundSourceTrees());
	assert.deepEqual(record.compoundReviewedSource, previous.compoundReviewedSource);
	assertDotnetInstalledRegressions(record.runs, baselines, record.compoundReviewedSource);
	assertRepeatedDotnetFamilies(record.runs, previous.runs);
	return { record, baselines, previous };
};

/** Check fresh current-source C# executions against both retained generations. */
export const assertDotnetFamilyRegressions = async () => assertDotnetFamilyRegressionEvidence(
	JSON.parse(await readFile("docs/evidence/dotnet-current-family-regressions-20260924.json")));
