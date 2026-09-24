/**
 * Verify recursive JVM execution evidence against original package identities,
 * typed consumers, relocated runtimes and independent-build observations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { basename } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";

const hash = value => assert.match(value, /^[a-f0-9]{64}$/);
const required = (value, keys) => { for(const key of keys) assert.equal(value[key], true, key); };
const files = inventory => {
	assert.ok(Object.keys(inventory).length > 0);
	for(const [path, file] of Object.entries(inventory))
	{
		assert.ok(!path.startsWith("/") && !path.split("/").includes(".."));
		hash(file.sha256); assert.ok(Number.isSafeInteger(file.bytes) && file.bytes > 0);
	}
};
const artifacts = pkg => {
	assert.equal(pkg.target, "maven"); assert.equal(pkg.ecosystem, "maven");
	assert.equal(pkg.runtimeDelivery, "embedded"); assert.deepEqual(pkg.requires, []);
	assert.equal(pkg.artifacts.length, 2); hash(pkg.runtimeIdentity);
	assert.deepEqual(pkg.artifacts.map(file => file.path.split(".").at(-1)), ["jar", "pom"]);
	for(const file of pkg.artifacts)
	{ hash(file.sha256); assert.ok(file.bytes > 0); }
	return { jar: pkg.artifacts[0], pom: pkg.artifacts[1] };
};
const nativeFiles = receipt => Object.fromEntries(Object.entries(receipt.files)
	.filter(([path]) => path.startsWith("META-INF/lean-bridge/native/linux-x64/"))
	.map(([path, file]) => [basename(path), file.sha256]));
const loading = report => {
	assert.equal(report.schemaVersion, 1);
	required(report, ["offlineInstall", "emptyRepository", "sourceFreeExecution", "compilerFreeExecution"]);
	files(report.deployment); files(report.runtimeFiles); files(report.dependencies.files); hash(report.dependencies.sha256);
	assert.equal(report.runtimeModules.length, 1); assert.match(report.runtimeModules[0], /^java\.base@22\./);
	assert.equal(report.receipts.length, report.packages.length);
	assert.equal(new Set(report.packages.map(item => item.package.runtimeIdentity)).size, 1);
	for(const [index, entry] of report.packages.entries())
	{
		const { jar, pom } = artifacts(entry.package), { receipt, sha256: receiptHash } = report.receipts[index];
		assert.equal(entry.authorInputsUnchanged, true); hash(entry.sourceSha256);
		assert.equal(receiptHash, sha256(canonicalJson(receipt))); files(receipt.files);
		assert.equal(receipt.kind, "lean-bridge-ordinary-maven-package");
		assert.equal(receipt.name, entry.package.name); assert.equal(receipt.version, entry.package.version);
		assert.equal(receipt.runtimeIdentity, entry.package.runtimeIdentity);
		assert.equal(receipt.namespace, `org.leanbridge.${entry.name}`);
		assert.deepEqual(receipt.kotlin, { namespace: `${receipt.namespace}.kotlin`, standardLibraryVersion: "2.2.0" });
		const [group, name] = entry.package.name.split(":");
		assert.equal(receipt.files[`META-INF/maven/${group}/${name}/pom.xml`].sha256, pom.sha256);
		assert.equal(report.deployment[`component${index}.jar`].sha256, jar.sha256);
		assert.equal(report.deployment[`component${index}.jar`].bytes, jar.bytes);
		assert.equal(Object.keys(nativeFiles(receipt)).length, 4);
		for(const key of ["bindingIrSha256", "compiledProjectionSha256"]) hash(receipt[key]);
	}
	for(const scenario of report.scenarios)
	{
		required(scenario, ["deploymentUnchanged", "normalExitCleanup"]);
		const output = Object.entries(scenario.mappings).map(([name, hash]) => `mapped:${name}:${hash}\n`).join("") + `${scenario.profile}-${scenario.mode}-ok\n`;
		assert.equal(scenario.stdout, output);
	}
};

/**
 * Require complete installed, reproduction, composition and conflict results.
 *
 * @param reports - Exact execution reports retained by CI.
 */
export const assertJvmGraphPackageReports = reports => {
	assert.deepEqual(Object.keys(reports).sort(), ["cold", "composition", "conflicts", "packages", "reproducibility"]);
	const { cold, packages, reproducibility, composition, conflicts } = reports;
	assert.equal(cold.schemaVersion, 1); assert.equal(cold.compiledLean, false); assert.equal(cold.installedPackage, false);
	assert.deepEqual(cold.observations.map(run => run.collision), [false, true]);
	for(const run of cold.observations)
	{
		assert.deepEqual(run.results, { java: "cold-java-ok:6", kotlin: "cold-kotlin-ok:4" });
		hash(run.javaProbeSha256); hash(run.kotlinProbeSha256);
		assert.ok(run.compilers.kotlin.options.includes("-Xuse-type-table"));
		for(const value of Object.values(run.sourceHashes)) hash(value);
	}
	assert.equal(packages.schemaVersion, 1); assert.equal(packages.compiledLean, true); assert.equal(packages.installedPackage, true);
	assert.deepEqual(packages.observations.map(run => [run.reviewed, run.profile]), [[false, "java"], [false, "kotlin"], [true, "java"], [true, "kotlin"]]);
	assert.equal(reproducibility.schemaVersion, 1);
	assert.equal(reproducibility.originalReportSha256, sha256(canonicalJson(packages)));
	assert.deepEqual(reproducibility.observations.map(run => run.reviewed), [false, true]);
	for(const run of packages.observations)
	{
		const { jar, pom } = artifacts(run.package), { jvm, observation } = run;
		assert.equal(run.exports, 18); assert.equal(run.checks, run.profile === "java" ? 955 : 952);
		assert.equal(run.rejectsGraphReceiptDrift, 3); assert.equal(run.rejectsRegeneratedSourceDrift, 4);
		required(run, ["checkedSourceUnchanged", "deterministicReassembly", "mavenOnly", "sourceRemovedBeforeInstallation"]);
		for(const key of ["binarySha256", "bindingIrSha256", "layoutSha256", "modelSha256", "probeSha256"]) hash(run[key]);
		required(jvm, ["compilerFreeExecution", "emptyRepository", "emptyUserHome"
			, "exactPublicSignatures", "handoffRemovedBeforeExecution"
			, "installedSourcesRemoved", "localLibraries", "normalExitCleanup"
			, "offline", "publicApiOnly", "repeatExecution", "resolvedClasspathOnly"
			, "runtimeOnlyExecution", "runtimeOverridesDisabled"]);
		assert.equal(jvm.archiveSha256, jar.sha256); assert.equal(jvm.pomSha256, pom.sha256);
		assert.equal(jvm.deployment["package.jar"].sha256, jar.sha256);
		assert.equal(jvm.deployment["package.jar"].bytes, jar.bytes);
		assert.equal(jvm.bindingIrSha256, run.bindingIrSha256); assert.equal(jvm.consumerSourceSha256, run.probeSha256);
		for(const key of ["compiledProjectionSha256", "compilerSha256", "javaSha256", "javaModulesSha256", "declarationsSha256", "packageReceiptSha256", "signaturesSha256"]) hash(jvm[key]);
		files(jvm.deployment); files(jvm.runtimeFiles); files(jvm.dependencies.files); hash(jvm.dependencies.sha256);
		assert.equal(jvm.runtimeModules.length, 1); assert.match(jvm.runtimeModules[0], /^java\.base@22\./);
		assert.ok(jvm.resolvedDependencies.some(item => item.mavenPath === "org/jetbrains/kotlin/kotlin-stdlib/2.2.0/kotlin-stdlib-2.2.0.jar"));
		for(const dependency of jvm.resolvedDependencies) assert.equal(dependency.sha256, jvm.dependencies.files[dependency.mavenPath].sha256);
		assert.deepEqual(observation.nativeLibraries, jvm.nativeLibraries); assert.equal(observation.nativeRootCount, 1);
		assert.equal(Object.keys(jvm.nativeLibraries).length, 4);
		assert.equal(Object.entries(jvm.nativeLibraries).find(([name]) => /^libcomponent_/.test(name))[1], run.binarySha256);
		assert.equal(observation.profile, run.profile); assert.deepEqual(observation.errors, []);
		assert.equal(observation.results.length, 7);
		const result = id => observation.results.find(item => item.id === `recursive/${id}`);
		for(const id of ["checks", "concurrent-calls", "documentation"]) assert.equal(result(id).status, "matched");
		assert.equal(Number(result("checks").observed.integer), run.checks); assert.equal(result("concurrent-calls").observed.integer, "256");
		assert.equal(result("documentation").observed.string, "true\nfalse\ntrue\ntrue\n");
		assert.equal(run.documentation.stdout, result("documentation").observed.string); hash(run.documentation.sourceSha256);
		required(run.documentation, ["sourceFreeExecution", "compilerFreeExecution", "repeatExecution"]);
		const rejected = observation.results.filter(item => item.status === "rejected-at-compile-time");
		assert.deepEqual(rejected.map(item => item.id), ["tree-scalar", "forest-depth", "word-narrowing", "wrong-constructor"].map(name => `recursive/${name}`));
		for(const item of rejected)
		{
			hash(item.sourceSha256); assert.equal(item.diagnostics.length, 1);
			const diagnostic = item.diagnostics[0];
			assert.equal(diagnostic.code, run.profile === "java" ? "compiler.err.cant.apply.symbol" : "ARGUMENT_TYPE_MISMATCH");
			assert.equal(diagnostic.line, 2); assert.ok(diagnostic.column > 0);
			assert.equal(diagnostic.file, `src/reject-${item.id.split("/")[1]}.${run.profile === "java" ? "java" : "kt"}`);
		}
		assert.deepEqual(run.tamperRejections.map(item => item.name).sort(), run.profile === "java" ? Object.keys(jvm.nativeLibraries).sort() : []);
		for(const item of run.tamperRejections) hash(item.tamperedJarSha256);
		const repeated = reproducibility.observations.find(item => item.reviewed === run.reviewed);
		assert.equal(repeated.exactOriginalArtifacts, true); assert.deepEqual(repeated.package, run.package);
		for(const key of ["binarySha256", "bindingIrSha256", "layoutSha256", "modelSha256"]) assert.equal(repeated[key], run[key], key);
	}
	assert.equal(new Set(packages.observations.map(run => run.binarySha256)).size, 1);
	assert.equal(new Set(packages.observations.map(run => run.layoutSha256)).size, 1);
	loading(composition); required(composition, ["sharedRetirement", "mixedCppMaven"]);
	assert.equal(composition.packages.length, 3);
	assert.deepEqual(composition.packages.map(entry => entry.graph), [true, true, false]);
	assert.deepEqual(composition.packages[1].targets, ["cpp", "maven"]);
	assert.deepEqual(composition.scenarios.map(item => [item.profile, item.mode]), ["java", "kotlin"].flatMap(profile => ["graph-first", "peer-first"].map(mode => [profile, mode])));
	const mappings = Object.assign({}, ...composition.receipts.map(item => nativeFiles(item.receipt)));
	assert.equal(Object.keys(mappings).length, 8);
	for(const scenario of composition.scenarios)
	{ assert.equal(scenario.concurrentCalls, 192); assert.deepEqual(scenario.mappings, mappings); }
	loading(conflicts); required(conflicts, ["duplicateClassLoaders", "conflictRejectedBeforeMapping", "existingComponentRemainsUsable"]);
	assert.deepEqual(conflicts.packages.map(item => item.value), [41, 43]);
	assert.equal(conflicts.receipts[0].receipt.component.id, "graph_collision@1.0.0");
	assert.equal(conflicts.receipts[1].receipt.component.id, "graph_collision@1.0.0");
	assert.notEqual(conflicts.receipts[0].sha256, conflicts.receipts[1].sha256);
	const components = conflicts.receipts.map(item => Object.entries(nativeFiles(item.receipt)).filter(([name]) => /^libcomponent_/.test(name)));
	for(const entries of components) assert.equal(entries.length, 1);
	assert.equal(components[0][0][0], components[1][0][0]);
	assert.notEqual(components[0][0][1], components[1][0][1]);
	assert.deepEqual(conflicts.scenarios.map(item => [item.profile, item.first, item.mode]), ["java", "kotlin"].flatMap(profile => [0, 1].flatMap(first => ["duplicate", "conflict"].map(mode => [profile, first, mode]))));
	for(const scenario of conflicts.scenarios) assert.deepEqual(scenario.mappings, nativeFiles(conflicts.receipts[scenario.first].receipt));
};
