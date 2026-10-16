/**
 * Authenticate nested checked-record Maven packages and source-free classpaths.
 * The explicitly selected JDK and Kotlin distributions remain trusted tools.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { validateKotlinCompilation } from "../../src/build/compile-jvm-sources.mjs";
import { inspectFinContainerEdgeJvmArchive } from "./fin-container-edge-jvm-closure.mjs";
import {
	nestedCheckedRecordJvmMavenName, nestedCheckedRecordJvmModes
} from "./nested-checked-record-jvm-fixture.mjs";
export {
	nominalSubtypeJvmDeploymentFiles as nestedCheckedRecordJvmDeploymentFiles
	, runNominalSubtypeJvmDeployment as runNestedCheckedRecordJvmDeployment
	, verifyNominalSubtypeJvmDeployment as verifyNestedCheckedRecordJvmDeployment
} from "./nominal-subtype-jvm-package.mjs";

const identity = bytes => ({ bytes: bytes.length, sha256: sha256(bytes) });
export const nestedCheckedRecordJvmNamespace
	= "org.leanbridge.nestedcheckedrecords";
const commonClasses = ["Api", "Option", "Packet", "Pair", "Result", "Unit"];
const fullClasses = ["Choice", "ChoiceEmpty", "ChoicePacket", "Holder"];

/**
 * Bind the original closed JAR to both build records and the platform floor.
 *
 * @param bytes - Original JAR bytes retained from the package handoff.
 * @param expected - Independently verified build and package records.
 * @param expected.pkg - Maven component package-set entry.
 * @param expected.model - Fresh compiler-authenticated component model.
 * @param expected.compiled - Original native-jvm.json compilation record.
 * @param expected.floor - Explicit Linux glibc floor selected for the build.
 * @param expected.mode - Full or standalone result-only API.
 */
export const inspectNestedCheckedRecordJvmPackage = (
	bytes, expected
) => {
	const { pkg, model, compiled, floor, mode } = expected;
	assert.ok(nestedCheckedRecordJvmModes.includes(mode));
	assert.equal(pkg.target, "maven"); assert.equal(pkg.role, "component");
	assert.deepEqual(pkg.artifacts.map(item => item.path).sort(), [
		"archives/nestedcheckedrecords-1.0.0.jar"
		, "archives/nestedcheckedrecords-1.0.0.pom"
	]);
	const artifact = pkg.artifacts.find(item => item.path.endsWith(".jar"));
	assert.deepEqual(identity(bytes), {
		bytes: artifact.bytes, sha256: artifact.sha256
	});
	const original = inspectFinContainerEdgeJvmArchive(bytes, artifact.sha256);
	const receipt = JSON.parse(original.receiptBytes);
	assert.equal(receipt.name, nestedCheckedRecordJvmMavenName);
	assert.equal(receipt.version, "1.0.0");
	assert.equal(receipt.name, pkg.name); assert.equal(receipt.version, pkg.version);
	assert.equal(receipt.namespace, nestedCheckedRecordJvmNamespace);
	assert.deepEqual(receipt.kotlin, {
		namespace: nestedCheckedRecordJvmNamespace + ".kotlin"
		, standardLibraryVersion: "2.2.0"
	});
	assert.equal(receipt.glibcMinimumVersion, floor);
	assert.equal(receipt.runtimeIdentity, pkg.runtimeIdentity);
	assert.equal(receipt.bindingIrSha256, model.bindingIrSha256);
	assert.deepEqual(receipt.sourceIdentity, model.sourceIdentity);
	assert.deepEqual(receipt.component, model.component);
	assert.equal(compiled.schemaVersion, 1);
	assert.equal(compiled.profile, "native-library-v1");
	assert.equal(compiled.namespace, nestedCheckedRecordJvmNamespace);
	assert.equal(compiled.bindingIrSha256, model.bindingIrSha256);
	assert.match(compiled.compiler, /^javac 22[. ]/u);
	validateKotlinCompilation(compiled.kotlin, nestedCheckedRecordJvmNamespace);
	assert.equal(receipt.compiledProjectionSha256, sha256(canonicalJson(compiled)));
	assert.deepEqual(receipt.files["META-INF/lean-bridge/component/model.json"]
		, identity(Buffer.from(canonicalJson(model))));
	assert.deepEqual(receipt.files["META-INF/lean-bridge/native-jvm.json"]
		, identity(Buffer.from(canonicalJson(compiled))));
	for(const [path, entry] of Object.entries(compiled.files))
	{
		if(path.startsWith("classes/"))
			assert.deepEqual(receipt.files[path.slice(8)], entry);
		if(path.startsWith("src/") || path === "binding-manifest.json")
			assert.deepEqual(receipt.files["META-INF/lean-bridge/jvm/" + path], entry);
	}
	for(const prefix of [
		`${nestedCheckedRecordJvmNamespace.replaceAll(".", "/")}/`
		, `${nestedCheckedRecordJvmNamespace.replaceAll(".", "/")}/kotlin/`
	]) {
		for(const name of commonClasses)
			assert.ok(receipt.files[prefix + name + ".class"]?.bytes > 0, prefix + name);
		for(const name of fullClasses)
			assert.equal(Boolean(receipt.files[prefix + name + ".class"])
				, mode === "full", prefix + name);
	}
	assert.ok(receipt.files[
		"META-INF/" + compiled.kotlin.module + ".kotlin_module"
	]?.bytes > 0);
	return { ...original, receipt, artifact };
};
