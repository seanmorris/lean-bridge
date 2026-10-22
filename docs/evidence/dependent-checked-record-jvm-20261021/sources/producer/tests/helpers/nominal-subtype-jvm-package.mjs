/**
 * Authenticate nominal Maven packages and source-free consumer classpaths.
 * The explicitly selected JDK and Kotlin distributions remain trusted tools.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, realpath } from "node:fs/promises";
import { join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { validateKotlinCompilation } from "../../src/build/compile-jvm-sources.mjs";
import { inspectFinContainerEdgeJvmArchive } from "./fin-container-edge-jvm-closure.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { nominalSubtypeJvmModes, nominalSubtypeJvmProfiles } from "./nominal-subtype-jvm-fixture.mjs";

const identity = bytes => ({ bytes: bytes.length, sha256: sha256(bytes) });
const namespace = "org.leanbridge.nominalsubtypes";

/**
 * Bind the original closed JAR to both build records and the explicit platform floor.
 *
 * @param bytes - Original JAR bytes retained from the package-set handoff.
 * @param expected - Independently verified build and package-set records.
 * @param expected.pkg - Maven component package-set entry.
 * @param expected.model - Fresh compiler-authenticated component model.
 * @param expected.compiled - Original native-jvm.json compilation record.
 * @param expected.floor - Explicit Linux glibc floor selected for the build.
 * @param expected.mode - Full API or standalone result-only API.
 */
export const inspectNominalSubtypeJvmPackage = (bytes, { pkg, model, compiled, floor, mode }) => {
	assert.ok(nominalSubtypeJvmModes.includes(mode));
	assert.equal(pkg.target, "maven"); assert.equal(pkg.role, "component");
	assert.deepEqual(pkg.artifacts.map(item => item.path).sort(), ["archives/nominalsubtypes-1.0.0.jar", "archives/nominalsubtypes-1.0.0.pom"]);
	const artifact = pkg.artifacts.find(item => item.path.endsWith(".jar"));
	assert.deepEqual(identity(bytes), { bytes: artifact.bytes, sha256: artifact.sha256 });
	const original = inspectFinContainerEdgeJvmArchive(bytes, artifact.sha256);
	const receipt = JSON.parse(original.receiptBytes);
	assert.equal(receipt.name, "org.leanbridge:nominalsubtypes"); assert.equal(receipt.version, "1.0.0");
	assert.equal(receipt.name, pkg.name); assert.equal(receipt.version, pkg.version);
	assert.equal(receipt.namespace, namespace);
	assert.deepEqual(receipt.kotlin, { namespace: namespace + ".kotlin", standardLibraryVersion: "2.2.0" });
	assert.equal(receipt.glibcMinimumVersion, floor); assert.equal(receipt.runtimeIdentity, pkg.runtimeIdentity);
	assert.equal(receipt.bindingIrSha256, model.bindingIrSha256);
	assert.deepEqual(receipt.sourceIdentity, model.sourceIdentity); assert.deepEqual(receipt.component, model.component);
	assert.equal(compiled.schemaVersion, 1); assert.equal(compiled.profile, "native-library-v1");
	assert.equal(compiled.namespace, namespace); assert.equal(compiled.bindingIrSha256, model.bindingIrSha256);
	assert.match(compiled.compiler, /^javac 22[. ]/u); validateKotlinCompilation(compiled.kotlin, namespace);
	assert.equal(receipt.compiledProjectionSha256, sha256(canonicalJson(compiled)));
	assert.deepEqual(receipt.files["META-INF/lean-bridge/component/model.json"], identity(Buffer.from(canonicalJson(model))));
	assert.deepEqual(receipt.files["META-INF/lean-bridge/native-jvm.json"], identity(Buffer.from(canonicalJson(compiled))));
	for(const [path, entry] of Object.entries(compiled.files))
	{
		if(path.startsWith("classes/")) assert.deepEqual(receipt.files[path.slice(8)], entry);
		if(path.startsWith("src/") || path === "binding-manifest.json")
			assert.deepEqual(receipt.files["META-INF/lean-bridge/jvm/" + path], entry);
	}
	for(const prefix of ["org/leanbridge/nominalsubtypes/", "org/leanbridge/nominalsubtypes/kotlin/"])
	{
		for(const name of ["Api", "Envelope", "AliasPair", "Event", "EventEmpty", "EventBox", "EventChoices", "Option", "Pair", "Result"])
			assert.ok(receipt.files[prefix + name + ".class"]?.bytes > 0, name);
		assert.equal(Object.hasOwn(receipt.files, prefix + "EnvelopePair.class"), mode === "full");
	}
	assert.ok(receipt.files["META-INF/" + compiled.kotlin.module + ".kotlin_module"]?.bytes > 0);
	return { ...original, receipt, artifact };
};

/**
 * Derive deployable inputs from the original compiler output identities.
 * No source-free directory is trusted to describe its own expected contents.
 *
 * @param context - Authenticated original JVM installation context.
 */
export const nominalSubtypeJvmDeploymentFiles = context => {
	assert.ok(nominalSubtypeJvmProfiles.includes(context.profile));
	const source = context.profile === "java" ? "consumer.java" : "consumer.kt";
	assert.ok(context.files[source]);
	const files = Object.fromEntries(Object.entries(context.files).filter(([path]) => path !== source));
	assert.equal(files["component.jar"].sha256, context.archiveSha256);
	const outputs = Object.keys(files).filter(path => path !== "component.jar");
	if(context.profile === "java")
	{
		assert.ok(outputs.includes("classes/Consumer.class"));
		for(const path of outputs) assert.match(path, /^classes\/Consumer(?:\$[A-Za-z0-9_$]+)?\.class$/u);
	}
	else assert.deepEqual(outputs, ["consumer.jar"]);
	for(const entry of Object.values(files))
	{
		assert.deepEqual(Object.keys(entry).sort(), ["bytes", "sha256"]);
		assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes > 0);
		assert.match(entry.sha256, /^[a-f0-9]{64}$/u);
	}
	return files;
};

/**
 * Require the exact source-free classpath and unchanged selected interpreter.
 *
 * @param root - Physically separated deployment directory.
 * @param context - Original installation identities, before source removal.
 */
export const verifyNominalSubtypeJvmDeployment = async (root, context) => {
	const files = nominalSubtypeJvmDeploymentFiles(context);
	assert.equal(await realpath(root), resolve(root));
	assert.deepEqual(await nativeArtifactPaths(root), Object.keys(files).sort());
	assert.equal(sha256(await readFile(context.command)), context.interpreterSha256);
	for(const [path, entry] of Object.entries(files))
		assert.deepEqual(identity(await readFile(join(root, path))), entry, path);
	return { files, classpathFilesSha256: sha256(canonicalJson(files)), interpreterSha256: context.interpreterSha256 };
};

/**
 * Replay unchanged bytecode with no author sources or compilers on PATH.
 *
 * @param root - Verified source-free deployment directory.
 * @param context - Original immutable package and consumer output identities.
 */
export const runNominalSubtypeJvmDeployment = async (root, context) => {
	await verifyNominalSubtypeJvmDeployment(root, context);
	try
	{
		const args = ["--enable-native-access=ALL-UNNAMED", "-cp"
			, context.profile === "java" ? "component.jar:classes" : "component.jar:consumer.jar"
			, context.profile === "java" ? "Consumer" : "ConsumerKt"];
		return await runCopied(context.command, args, root);
	}
	finally
	{
		await verifyNominalSubtypeJvmDeployment(root, context);
	}
};
