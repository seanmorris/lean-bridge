/**
 * Bind installed JVM structured callbacks to original archives and exact sources.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import { structuredCallableReviewedIr } from "./structured-callable-fixture.mjs";
import { jvmCallableSignatures, jvmCallableConsumer, jvmCallablePublicChecks, jvmCallableRejections } from "./jvm-callable-fixture.mjs";
import { jvmStructuredCallableSignatures, jvmStructuredCallableConsumer, jvmStructuredCallableRejections, jvmStructuredCallableExamples } from "./jvm-structured-callable-fixture.mjs";
import { assertJvmStructuredCodegenRegression } from "./jvm-structured-callable-regression.mjs";
import { assertJvmStructuredFaults } from "./jvm-structured-callable-faults.mjs";
import { dotnetStructuredCallableHistoryPath } from "./dotnet-structured-callable-source-history.mjs";
import { assertDotnetStructuredCallableIntegration } from "./dotnet-structured-callable-evidence.mjs";
import { jvmStructuredCallableChangedPaths, reverseJvmStructuredCallableUpdate } from "./jvm-structured-callable-source-history.mjs";
import { beforePerlStructuredCallables } from "./perl-structured-callable-source-history.mjs";

const priorSource = async path => beforePerlStructuredCallables(path, await readFile(path, "utf8"));

export const jvmStructuredCallableExecutionPath = "docs/evidence/jvm-structured-callables-20260925.json";
export const jvmStructuredCodegenPath = "docs/evidence/jvm-structured-codegen-regression-20260924.json";
export const jvmStructuredCallableAddedPaths = [
	jvmStructuredCallableExecutionPath, jvmStructuredCodegenPath
	, "docs/evidence/jvm-structured-callables-20260925.md"
	, "tests/jvm-structured-callable-contract.test.mjs"
	, "tests/jvm-structured-callable-evidence.test.mjs"
	, "tests/jvm-structured-callables.test.mjs"
	, "tests/fixtures/structured-callable-consumers/java.java"
	, "tests/fixtures/structured-callable-consumers/java-values.java"
	, "tests/fixtures/structured-callable-consumers/kotlin.kt"
	, "tests/fixtures/structured-callable-consumers/kotlin-values.kt"
	, "tests/fixtures/structured-callable-consumers/jvm-faults.java"
	, "tests/fixtures/structured-callable-consumers/jvm-probe.java"
	, "tests/helpers/jvm-structured-callable-fixture.mjs"
	, "tests/helpers/jvm-structured-callable-faults.mjs"
	, "tests/helpers/jvm-structured-callable-regression.mjs"
	, "tests/helpers/jvm-structured-callable-evidence.mjs"
	, "tests/helpers/jvm-structured-callable-source-history.mjs"
].sort();
export const jvmStructuredCallableScope = {
	profiles: ["java", "kotlin"], paths: ["ordinary-source", "reviewed-ir"]
	, shapes: ["alias", "array", "list", "option", "record", "result", "tuple", "variant"]
	, positions: ["callback-parameter", "callback-result"]
	, recursiveCallbacks: false, ownedResourceAggregates: false
};

/**
 * Authenticate every source edit and exactly sixty-four new installed cells.
 *
 * @param record - Frozen predecessor, literal edits and current inventory.
 */
export const assertJvmStructuredCallableIntegration = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "jvm-structured-callable-integration");
	assert.equal(record.baselineRevision, "594287dd2e4ab9550de349f9414b3d0ecf9d0c22");
	assert.deepEqual(record.scope, jvmStructuredCallableScope);
	assert.deepEqual(record.inventory, { previousVersion: "0.91.0", version: "0.92.0", previousInstalled: 4410, installed: 4474, total: 6562 });
	assert.equal(record.previous.path, dotnetStructuredCallableHistoryPath);
	const oldBytes = await readFile(record.previous.path); assert.equal(sha256(oldBytes), record.previous.sha256);
	const previous = JSON.parse(oldBytes);
	assert.equal(record.execution.path, jvmStructuredCallableExecutionPath);
	const bytes = await readFile(record.execution.path); assert.equal(sha256(bytes), record.execution.sha256);
	const execution = JSON.parse(bytes); await assertJvmStructuredCallableExecution(execution);
	assert.equal(record.codegen.path, jvmStructuredCodegenPath);
	const codegenBytes = await readFile(record.codegen.path); assert.equal(sha256(codegenBytes), record.codegen.sha256);
	const codegen = JSON.parse(codegenBytes); assertJvmStructuredCodegenRegression(codegen);
	assert.deepEqual(record.updates.map(update => update.path).sort(), jvmStructuredCallableChangedPaths);
	assert.deepEqual(Object.keys(record.additions).sort(), jvmStructuredCallableAddedPaths);
	const paths = [...new Set([...Object.keys(previous.sourceHashes), ...jvmStructuredCallableChangedPaths, ...jvmStructuredCallableAddedPaths])].sort();
	assert.deepEqual(Object.keys(record.sourceHashes).sort(), paths);
	for(const path of paths) assert.equal(sha256(await priorSource(path)), record.sourceHashes[path], path);
	const restored = {};
	for(const update of record.updates)
	{
		assert.equal(update.currentSha256, record.sourceHashes[update.path]);
		restored[update.path] = reverseJvmStructuredCallableUpdate(await priorSource(update.path), update);
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
	const promoted = cells.filter(cell => cell.stages.installedExecution.evidence.includes("jvm-structured-callables-installed"));
	assert.equal(promoted.length, 64);
	for(const cell of promoted)
	{
		assert.ok(jvmStructuredCallableScope.profiles.includes(cell.profile)); assert.ok(jvmStructuredCallableScope.shapes.includes(cell.shape));
		assert.ok(jvmStructuredCallableScope.paths.includes(cell.path)); assert.ok(jvmStructuredCallableScope.positions.includes(cell.position));
		assert.ok(cell.hostType && cell.conversionNote);
		for(const stage of Object.values(cell.stages)) assert.deepEqual({ state: stage.state, evidence: stage.evidence }, { state: "passed", evidence: ["jvm-structured-callables-installed"] });
	}
	const oldById = new Map(oldCells.map(cell => [cell.id, cell]));
	for(const cell of cells.filter(cell => !promoted.includes(cell))) assert.deepEqual(cell, oldById.get(cell.id), cell.id);
	const entry = document.evidence.find(item => item.id === "jvm-structured-callables-installed");
	assert.deepEqual(entry.artifacts, execution.reports.flatMap(run => run.packages.flatMap(pkg => pkg.artifacts.map(artifact => ({ path: `${run.profile}/${run.path}/${artifact.path}`, sha256: artifact.sha256 })))));
	assert.ok(entry.files.some(file => file.path === jvmStructuredCallableExecutionPath));
	await assertDotnetStructuredCallableIntegration(previous);
};
const order = jvmStructuredCallableScope.paths.flatMap(path => jvmStructuredCallableScope.profiles.map(profile => `${path}/${profile}`));
const hash = value => assert.match(value, /^[a-f0-9]{64}$/u);
const passing = (run, file, flag) => {
	assert.ok(run.command.includes(file)); assert.equal(run.exitCode, 0);
	assert.ok(run.command.includes(`${flag}=1`));
	assert.doesNotMatch(run.command, /--test-name-pattern/u);
	assert.equal(sha256(run.text), run.sha256);
	assert.ok(run.text.includes("# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n"));
};
const installed = run => {
	assert.equal(run.sourceRemovedBeforeInstallation, true);
	for(const key of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256"]) hash(run[key]);
	const jvm = run.jvm;
	for(const key of ["offline", "emptyRepository", "emptyUserHome", "resolvedClasspathOnly", "installedSourcesRemoved", "compilerFreeExecution", "runtimeOnlyExecution", "normalExitCleanup", "repeatExecution", "localLibraries", "publicApiOnly", "runtimeOverridesDisabled", "exactPublicSignatures"]) assert.equal(jvm[key], true, key);
	assert.equal(jvm.javacVersion, "javac 22.0.2");
	assert.deepEqual(jvm.runtimeModules, ["java.base@22.0.2"]);
	assert.equal(jvm.bindingIrSha256, run.bindingIrSha256);
	for(const [, value] of Object.entries(jvm).filter(([key]) => key.endsWith("Sha256"))) hash(value);
	assert.equal(run.packages.length, 1);
	const pkg = run.packages[0];
	assert.equal(pkg.target, "maven"); assert.equal(pkg.role, "component");
	assert.equal(pkg.runtimeDelivery, "embedded"); assert.deepEqual(pkg.requires, []);
	hash(pkg.runtimeIdentity); assert.equal(pkg.artifacts.length, 2);
	const jar = pkg.artifacts.find(item => item.path.endsWith(".jar"));
	const pom = pkg.artifacts.find(item => item.path.endsWith(".pom"));
	assert.equal(jar.sha256, jvm.archiveSha256); assert.equal(pom.sha256, jvm.pomSha256);
	assert.deepEqual(jvm.deployment["package.jar"], { bytes: jar.bytes, sha256: jar.sha256 });
	assert.equal(Object.keys(jvm.nativeLibraries).length, 4);
	assert.deepEqual(run.observation.nativeLibraries, jvm.nativeLibraries);
	assert.equal(run.observation.nativeRootCount, 1); assert.deepEqual(run.observation.errors, []);
	assert.equal(run.observation.profile, run.profile);
	assert.match(run.observation.apiLocation, /\/relocated\/package\.jar$/u);
	assert.deepEqual(jvm.resolvedDependencies.map(item => item.mavenPath), [
		"org/jetbrains/kotlin/kotlin-stdlib/2.2.0/kotlin-stdlib-2.2.0.jar"
		, "org/jetbrains/annotations/13.0/annotations-13.0.jar"
	]);
	for(const dependency of jvm.resolvedDependencies)
	{
		assert.equal(jvm.dependencies.files[dependency.mavenPath].sha256, dependency.sha256);
		assert.equal(jvm.deployment[`dependencies/${dependency.mavenPath.split("/").at(-1)}`].sha256, dependency.sha256);
	}
	for(const file of Object.values(jvm.deployment))
	{ hash(file.sha256); assert.ok(file.bytes > 0); }
	if(run.profile === "kotlin")
	{
		assert.match(jvm.kotlin.version, /kotlinc-jvm 2\.2\.0/u);
		assert.equal(jvm.kotlin.stdlibSha256, jvm.resolvedDependencies[0].sha256);
	}
};
const rejected = (run, expected) => {
	const results = run.observation.results.filter(value => value.status === "rejected-at-compile-time");
	assert.deepEqual(results.map(value => value.id), expected.map(value => value.id));
	for(const [index, result] of results.entries())
	{
		assert.equal(result.sourceSha256, sha256(expected[index].source));
		assert.deepEqual(result.diagnostics.map(value => value.code), [expected[index].expectation.diagnostic].flat());
		for(const diagnostic of result.diagnostics)
		{
			assert.ok(diagnostic.line > 0 && diagnostic.column > 0);
			assert.equal(diagnostic.file, `src/reject-${result.id.split("/")[1]}.${run.profile === "java" ? "java" : "kt"}`);
		}
	}
};

/**
 * Require source-free original archives and separate, labelled failure probes.
 *
 * @param record - Captured reports and terminal unfiltered TAP logs.
 */
export const assertJvmStructuredCallableExecution = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "jvm-structured-callable-execution");
	assert.deepEqual(record.scope, jvmStructuredCallableScope);
	passing(record.installed, "tests/jvm-structured-callables.test.mjs", "LEAN_BRIDGE_JVM_STRUCTURED_CALLABLE_TEST");
	passing(record.primitiveRegression, "tests/jvm-callables.test.mjs", "LEAN_BRIDGE_JVM_CALLABLE_TEST");
	for(const runs of [record.reports, record.primitiveReports]) assert.deepEqual(runs.map(run => `${run.path}/${run.profile}`), order);
	const fixtureHash = async name => sha256(await readFile(`tests/fixtures/structured-callable-consumers/${name}`));
	for(const run of record.reports)
	{
		installed(run); assert.equal(run.relocatedBeforeInstallation, true);
		assert.deepEqual(run.signatures, jvmStructuredCallableSignatures(structuredCallableReviewedIr()));
		assert.equal(run.packages[0].name, "org.leanbridge:structured");
		assert.equal(run.checks, run.profile === "java" ? 257978 : 177270);
		const jvm = run.jvm, publicResults = run.observation.results.filter(value => value.status === "matched");
		assert.deepEqual(publicResults, [
			["assertions", run.checks], ["calls", 3072]
			, ["rejections", run.profile === "java" ? 807 : 789]
		].map(([name, count]) => ({ id: `structured/${name}`, independentCopy: true, observed: { integer: String(count) }, status: "matched" })));
		assert.equal(jvm.consumerSourceSha256, sha256(jvmStructuredCallableConsumer(run.profile)));
		assert.equal(jvm.signaturesSha256, jvm.consumerSourceSha256);
		rejected(run, jvmStructuredCallableRejections(run.profile));
		const example = jvmStructuredCallableExamples(run.profile)[0];
		assert.deepEqual(jvm.documentation, [{ id: example.id
			, sourceSha256: sha256(example.source), stdout: example.stdout
			, archiveSha256: jvm.archiveSha256, sourceFreeExecution: true
			, runtimeOnlyExecution: true, normalExitCleanup: true }]);
		const java = record.reports.find(value => value.path === run.path && value.profile === "java");
		assert.deepEqual(run.packages, java.packages);
		assert.equal(run.receiptSha256, java.receiptSha256);
		if(run.profile === "kotlin")
		{
			assert.equal(jvm.handoffRemovedBeforeExecution, true);
			assert.equal(jvm.inspection, undefined);
			continue;
		}
		const faults = jvm.inspection;
		assert.equal(jvm.handoffRemovedBeforeExecution, undefined);
		assert.equal(faults.archiveSha256, jvm.archiveSha256);
		for(const key of ["isolatedInstrumentedProjection", "originalNativeLibraries", "releaseJarUnchanged", "normalExitCleanup"]) assert.equal(faults[key], true);
		for(const [file, key] of [["jvm-probe.java", "probeSourceSha256"], ["jvm-faults.java", "programSourceSha256"], ["java-values.java", "javaValuesSha256"], ["kotlin-values.kt", "kotlinValuesSha256"]]) assert.equal(faults[key], await fixtureHash(file));
		assert.deepEqual(faults.runs.map(value => value.profile), jvmStructuredCallableScope.profiles);
		for(const probe of faults.runs)
		{
			assertJvmStructuredFaults(probe);
			assert.equal(probe.faults, 8396); assert.equal(probe.checks, 836813);
			assert.equal(probe.clears, 10042); assert.equal(probe.disposals, 2384);
			assert.deepEqual(probe.shapes, record.reports[0].jvm.inspection.runs[0].shapes);
		}
		const prefix = "src/main/java/org/leanbridge/structured/";
		assert.equal(faults.originalSources[`${prefix}Api.java`], jvm.declarationsSha256);
		for(const name of ["Runtime", "KotlinRuntime"])
		{
			const file = `${prefix}${name}.java`;
			assert.notEqual(faults.originalSources[file], faults.instrumentedSources[file]);
			assert.equal(faults.replacements[`${file}:conversions`], 50);
			assert.equal(faults.replacements[`${file}:clears`], 40);
			assert.equal(faults.replacements[`${file}:adoption`], 14);
		}
		for(const value of Object.values(faults.originalSources)) hash(value);
		for(const value of Object.values(faults.instrumentedSources)) hash(value);
	}
	for(const run of record.primitiveReports)
	{
		installed(run); assert.equal(run.checks, run.profile === "java" ? 66683 : 66655);
		const sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
		assert.deepEqual(sort(run.signatures), sort(jvmCallableSignatures));
		let source = jvmCallableConsumer(run.profile);
		if(run.profile === "kotlin") source = source.replace("fun main() {", "fun main() {\n    checkKotlinMetadata()");
		assert.equal(run.jvm.consumerSourceSha256, sha256(source));
		assert.equal(run.jvm.signaturesSha256, sha256(jvmCallablePublicChecks(run.profile)));
		rejected(run, jvmCallableRejections(run.profile));
		if(run.profile === "kotlin") assert.ok(run.jvm.kotlinMetadataChecks > 0);
	}
};
