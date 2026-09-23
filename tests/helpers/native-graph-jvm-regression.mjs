/**
 * Bind C-only graph build changes to fresh, source-free Java and Kotlin runs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeAllocationGuardHeader } from "../../src/build/native-allocation-guard.mjs";
import { assertAdministrativeSourceUpdate } from "./test-registration-history.mjs";

const digest = value => sha256(canonicalJson(value));

/**
 * Preserve the original receipt while requiring separately recorded current builds.
 *
 * @param lineage - The immutable receipt's explicit source lineage.
 * @param original - The original installed Kotlin collection evidence.
 */
export const assertNativeGraphJvmRegression = async (lineage, original) => {
	assert.equal(lineage.regression.path, "docs/evidence/native-recursive-jvm-regression-20260923.json");
	const bytes = await readFile(lineage.regression.path);
	assert.equal(sha256(bytes), lineage.regression.sha256);
	const regression = JSON.parse(bytes);
	assert.equal(regression.schemaVersion, 1); assert.equal(regression.planNode, 1219);
	assert.deepEqual(regression.baseline, { path: "docs/evidence/kotlin-collections-20260922.json", sha256: lineage.receiptSha256 });
	assert.equal(regression.log.sha256, sha256(regression.log.text));
	assert.match(regression.log.text, /# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0/);
	for(const [path, hash] of Object.entries(regression.sourceHashes)) await assertAdministrativeSourceUpdate(path, hash);
	for(const path of ["src/build/native-project.mjs", "src/build/native-c-projection.mjs"])
		assert.equal(regression.sourceHashes[path], lineage.sources[path].currentSha256);
	assert.equal(regression.sourceHashes["tests/jvm-collections.test.mjs"], original.sourceHashes["tests/jvm-collections.test.mjs"]);
	assert.deepEqual(regression.executions.map(run => `${run.path}/${run.profile}`), ["ordinary-source/java", "ordinary-source/kotlin", "reviewed-ir/java", "reviewed-ir/kotlin"]);
	for(const run of regression.executions)
	{
		const previous = original.executions.find(item => item.path === run.path && item.profile === run.profile);
		for(const key of ["checks", "calls", "rejected", "sourceTreeSha256", "sourceApiSha256", "signaturesSha256", "documentation"])
			assert.deepEqual(run[key], previous[key], key);
		// Full IR identities also bind the measured producer. Compare the public
		// API separately and bind the new IR to the newly installed JAR receipt.
		assert.match(run.bindingIrSha256, /^[a-f0-9]{64}$/);
		assert.equal(run.jvm.bindingIrSha256, run.bindingIrSha256);
		assert.equal(run.observationSha256, digest({ results: previous.observation.results, errors: previous.observation.errors }));
		assert.equal(run.sourceRemovedBeforeInstallation, true);
		for(const key of ["offline", "emptyRepository", "emptyUserHome", "resolvedClasspathOnly", "installedSourcesRemoved", "compilerFreeExecution", "runtimeOnlyExecution", "normalExitCleanup", "repeatExecution", "localLibraries", "publicApiOnly", "exactPublicSignatures", "runtimeOverridesDisabled", "handoffRemovedBeforeExecution"])
			assert.equal(run.jvm[key], true, key);
		assert.deepEqual(run.jvm.resolvedDependencies, previous.jvm.resolvedDependencies);
		assert.deepEqual(run.jvm.runtimeModules, previous.jvm.runtimeModules);
		for(const key of ["consumerSourceSha256", "signaturesSha256", "declarationsSha256"])
			assert.equal(run.jvm[key], previous.jvm[key], key);
		assert.equal(run.packages.length, 1);
		assert.equal(run.packages[0].target, "maven"); assert.equal(run.packages[0].runtimeDelivery, "embedded");
		assert.deepEqual(run.packages[0].requires, []);
		assert.equal(run.packages[0].artifacts.find(item => item.path.endsWith(".jar")).sha256, run.jvm.archiveSha256);
		assert.equal(run.packages[0].artifacts.find(item => item.path.endsWith(".pom")).sha256, run.jvm.pomSha256);
		assert.equal(run.jvm.deployment["package.jar"].sha256, run.jvm.archiveSha256);
		const guard = "META-INF/lean-bridge/component/allocation-guard.h";
		assert.deepEqual(Object.keys(run.installedFiles).sort(), [...Object.keys(previous.installedFiles), guard].sort());
		assert.equal(run.installedFiles[guard].sha256, sha256(nativeAllocationGuardHeader));
		for(const [path, file] of Object.entries(run.installedFiles))
			if(/\.(java|kt|class|kotlin_module)$/.test(path) && !/\/NativeAssets\.(java|class)$/.test(path))
				assert.deepEqual(file, previous.installedFiles[path], path);
		for(const [name, hash] of Object.entries(run.jvm.nativeLibraries))
			assert.equal(run.installedFiles[`META-INF/lean-bridge/native/linux-x64/${name}`].sha256, hash);
		for(const [key, value] of Object.entries(previous.faults).filter(([key]) => !["originalSources", "instrumentedSources"].includes(key)))
			assert.deepEqual(run.faults[key], value, key);
		for(const [path, hash] of Object.entries(run.faults.originalSources))
			assert.equal(run.installedFiles[`META-INF/lean-bridge/jvm/${path}`].sha256, hash);
		assert.deepEqual(Object.keys(run.faults.instrumentedSources), Object.keys(previous.faults.instrumentedSources));
		for(const [path, hash] of Object.entries(run.faults.instrumentedSources))
			assert.equal(hash, path.endsWith("/NativeAssets.java") ? run.faults.originalSources[path] : previous.faults.instrumentedSources[path], path);
	}
};
