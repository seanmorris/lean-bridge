/**
 * Authenticate dependent checked-record Maven packages and source-free Java/Kotlin
 * classpaths. Selected JDK and Kotlin distributions remain explicit tools.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	validateKotlinCompilation
} from "../../src/build/compile-jvm-sources.mjs";
import {
	inspectFinContainerEdgeJvmArchive
} from "./fin-container-edge-jvm-closure.mjs";
import {
	dependentCheckedRecordJvmRoutes, dependentCheckedRecordJvmTarget
} from "./dependent-checked-record-jvm-fixture.mjs";
export {
	nominalSubtypeJvmDeploymentFiles as dependentCheckedRecordJvmDeploymentFiles
	, runNominalSubtypeJvmDeployment as runDependentCheckedRecordJvmDeployment
	, verifyNominalSubtypeJvmDeployment as verifyDependentCheckedRecordJvmDeployment
} from "./nominal-subtype-jvm-package.mjs";

const identity = bytes => ({ bytes: bytes.length, sha256: sha256(bytes) });
export const dependentCheckedRecordJvmNamespace
	= "org.leanbridge.dependentrecords";
export const dependentCheckedRecordJvmClasses = Object.freeze(["Api", "Dependent"]);

/**
 * Bind the closed JAR to compiler model, projection and package-set records.
 *
 * @param bytes - Original Maven JAR bytes.
 * @param expected - Independently authenticated package context.
 * @param expected.pkg - Maven package-set entry.
 * @param expected.model - Compiler-authenticated component model.
 * @param expected.compiled - Original native-jvm projection record.
 * @param expected.floor - Explicit glibc package floor.
 * @param expected.route - Exact author/API route.
 */
export const inspectDependentCheckedRecordJvmPackage = (bytes, expected) => {
	const { pkg, model, compiled, floor, route } = expected;
	assert.ok(dependentCheckedRecordJvmRoutes.includes(route));
	assert.equal(pkg.target, "maven");
	assert.equal(pkg.role, "component");
	assert.deepEqual(pkg.artifacts.map(item => item.path).sort(), [
		"archives/dependentrecords-1.0.0.jar"
		, "archives/dependentrecords-1.0.0.pom"
	]);
	const artifact = pkg.artifacts.find(item => item.path.endsWith(".jar"));
	assert.deepEqual(identity(bytes), {
		bytes: artifact.bytes, sha256: artifact.sha256
	});
	const original = inspectFinContainerEdgeJvmArchive(bytes, artifact.sha256);
	const receipt = JSON.parse(original.receiptBytes);
	assert.equal(receipt.name, dependentCheckedRecordJvmTarget.name);
	assert.equal(receipt.version, dependentCheckedRecordJvmTarget.version);
	assert.equal(receipt.name, pkg.name);
	assert.equal(receipt.version, pkg.version);
	assert.equal(receipt.namespace, dependentCheckedRecordJvmNamespace);
	assert.deepEqual(receipt.kotlin, {
		namespace: dependentCheckedRecordJvmNamespace + ".kotlin"
		, standardLibraryVersion: "2.2.0"
	});
	assert.equal(receipt.glibcMinimumVersion, floor);
	assert.equal(receipt.runtimeIdentity, pkg.runtimeIdentity);
	assert.equal(receipt.bindingIrSha256, model.bindingIrSha256);
	assert.deepEqual(receipt.sourceIdentity, model.sourceIdentity);
	assert.deepEqual(receipt.component, model.component);
	assert.equal(compiled.schemaVersion, 1);
	assert.equal(compiled.profile, "native-library-v1");
	assert.equal(compiled.namespace, dependentCheckedRecordJvmNamespace);
	assert.equal(compiled.bindingIrSha256, model.bindingIrSha256);
	assert.match(compiled.compiler, /^javac 22[. ]/u);
	validateKotlinCompilation(compiled.kotlin, dependentCheckedRecordJvmNamespace);
	assert.equal(receipt.compiledProjectionSha256
		, sha256(canonicalJson(compiled)));
	assert.deepEqual(receipt.files[
		"META-INF/lean-bridge/component/model.json"
	], identity(Buffer.from(canonicalJson(model))));
	assert.deepEqual(receipt.files["META-INF/lean-bridge/native-jvm.json"]
		, identity(Buffer.from(canonicalJson(compiled))));
	for(const [path, entry] of Object.entries(compiled.files))
	{
		if(path.startsWith("classes/"))
			assert.deepEqual(receipt.files[path.slice(8)], entry);
		if(path.startsWith("src/") || path === "binding-manifest.json")
			assert.deepEqual(receipt.files[
				"META-INF/lean-bridge/jvm/" + path
			], entry);
	}
	for(const [prefix, unit] of [
		[`${dependentCheckedRecordJvmNamespace.replaceAll(".", "/")}/`, "Unit"]
		, [`${dependentCheckedRecordJvmNamespace.replaceAll(".", "/")}/kotlin/`, "UnitKt"]
	]) for(const name of [...dependentCheckedRecordJvmClasses, unit])
		assert.ok(receipt.files[prefix + name + ".class"]?.bytes > 0
			, prefix + name);
	assert.ok(receipt.files[
		"META-INF/" + compiled.kotlin.module + ".kotlin_module"
	]?.bytes > 0);
	return { ...original, receipt, artifact };
};
