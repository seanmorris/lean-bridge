/**
 * Authenticate retained nineteen-base Maven members against original compiler and package records.
 * Native library identities remain in the receipt; their bytes stay in the handoff.
 *
 * @file
 */
import assert from "node:assert/strict";
import { posix } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { validateKotlinCompilation } from "../../src/build/compile-jvm-sources.mjs";
import { nominalSubtypeJvmGenerator } from "./nominal-subtype-jvm-generators.mjs";
import { nominalPrimitiveSubtypeJvmMavenName } from "./nominal-primitive-subtype-jvm-fixture.mjs";
import { nominalPrimitiveSubtypeJvmClasses, nominalPrimitiveSubtypeJvmNamespace } from "./nominal-primitive-subtype-jvm-package.mjs";

const identity = bytes => ({ bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) });
export const nominalPrimitiveSubtypeJvmReceiptPath = "META-INF/lean-bridge/package-receipt.json";
const nativePrefix = "META-INF/lean-bridge/native/linux-x64/";
const namespace = nominalPrimitiveSubtypeJvmNamespace;

/**
 * Enumerate the retained original members, excluding only the native binaries.
 *
 * @param receipt - Original package receipt from the authenticated JAR.
 */
export const nominalPrimitiveSubtypeJvmRetainedMembers = receipt => [
	...Object.keys(receipt.files).filter(path => !path.startsWith(nativePrefix))
	, nominalPrimitiveSubtypeJvmReceiptPath
].sort();

/**
 * Compare native identities, complete generated sources and retained class files.
 *
 * @param options - Independently reconciled model and selection-relative records.
 * @param options.read - Original byte reader.
 * @param options.json - Canonical JSON reader.
 * @param options.model - Compiler-authenticated model.
 * @param options.receipt - Package-set receipt from both author roots.
 * @param options.compiled - Original native-jvm.json record.
 * @param options.floor - Explicit native glibc floor.
 * @param options.mode - Full or result-only API.
 * @param options.producerCommit - Full original source revision.
 */
export const checkNominalPrimitiveSubtypeJvmPackageRecords = async ({ read, json, model, receipt, compiled, floor, mode, producerCommit }) => {
	const pkg = receipt.packages[0], installation = await json("installation.json");
	assert.deepEqual(Object.keys(installation).sort(), ["artifact", "packageFileSetSha256", "receipt", "receiptBytes"]);
	const artifact = pkg.artifacts.find(item => item.path.endsWith(".jar"));
	assert.deepEqual(pkg.artifacts.map(item => item.path).sort(), ["archives/nominalprimitivesubtypes-1.0.0.jar", "archives/nominalprimitivesubtypes-1.0.0.pom"]);
	assert.deepEqual(installation.artifact, artifact);
	const packageReceipt = await json("package/" + nominalPrimitiveSubtypeJvmReceiptPath);
	assert.deepEqual(installation.receipt, packageReceipt);
	assert.equal(installation.receiptBytes, canonicalJson(packageReceipt));
	assert.deepEqual(Object.keys(packageReceipt).sort(), ["bindingIrSha256"
		, "compiledProjectionSha256"
		, "component", "ecosystem", "files", "glibcMinimumVersion", "kind", "kotlin"
		, "name", "namespace", "runtimeIdentity", "schemaVersion"
		, "sourceIdentity", "version"]);
	assert.equal(packageReceipt.schemaVersion, 1);
	assert.equal(packageReceipt.kind, "lean-bridge-ordinary-maven-package");
	assert.equal(packageReceipt.ecosystem, "maven");
	assert.equal(packageReceipt.name, nominalPrimitiveSubtypeJvmMavenName);
	assert.equal(packageReceipt.version, "1.0.0");
	assert.equal(pkg.name, packageReceipt.name); assert.equal(pkg.version, packageReceipt.version);
	assert.equal(packageReceipt.namespace, namespace);
	assert.deepEqual(packageReceipt.kotlin, { namespace: namespace + ".kotlin", standardLibraryVersion: "2.2.0" });
	assert.equal(packageReceipt.glibcMinimumVersion, floor);
	assert.equal(packageReceipt.runtimeIdentity, pkg.runtimeIdentity);
	assert.equal(packageReceipt.bindingIrSha256, model.bindingIrSha256);
	assert.deepEqual(packageReceipt.sourceIdentity, model.sourceIdentity);
	assert.deepEqual(packageReceipt.component, model.component);
	const files = packageReceipt.files, paths = Object.keys(files).sort();
	assert.equal(new Set(paths.map(path => path.toLowerCase())).size, paths.length);
	assert.ok(!Object.hasOwn(files, nominalPrimitiveSubtypeJvmReceiptPath));
	for(const [path, file] of Object.entries(files))
	{
		assert.ok(/^[A-Za-z0-9_.$/-]+$/u.test(path) && posix.normalize(path) === path && !path.startsWith("../") && !path.startsWith("/"));
		assert.ok(path.split("/").every(part => part && part !== "." && part !== ".."));
		assert.ok(!/^META-INF\/(?:services\/|versions\/|INDEX\.LIST$)/u.test(path) && path !== "module-info.class");
		assert.deepEqual(Object.keys(file).sort(), ["bytes", "sha256"]);
		assert.ok(Number.isSafeInteger(file.bytes) && file.bytes > 0);
		assert.match(file.sha256, /^[a-f0-9]{64}$/u);
		if(!path.startsWith(nativePrefix)) assert.deepEqual(identity(await read("package/" + path)), file, path);
	}
	assert.equal(installation.packageFileSetSha256, sha256(canonicalJson([...paths, nominalPrimitiveSubtypeJvmReceiptPath].sort())));
	assert.equal((await read("package/META-INF/MANIFEST.MF")).toString(), "Manifest-Version: 1.0\n\n");
	const pom = '<?xml version="1.0" encoding="UTF-8"?>\n'
		+ '<project xmlns="http://maven.apache.org/POM/4.0.0"><modelVersion>4.0.0</modelVersion>'
		+ '<groupId>org.leanbridge</groupId><artifactId>nominalprimitivesubtypes</artifactId><version>1.0.0</version>'
		+ '<description>Compiled Lean API with generated Java conversions and native runtime.</description>'
		+ '<properties><maven.compiler.release>22</maven.compiler.release><project.build.sourceEncoding>UTF-8</project.build.sourceEncoding></properties>'
		+ '<dependencies><dependency><groupId>org.jetbrains.kotlin</groupId><artifactId>kotlin-stdlib</artifactId><version>2.2.0</version></dependency></dependencies></project>\n';
	assert.equal((await read("package/META-INF/maven/org.leanbridge/nominalprimitivesubtypes/pom.xml")).toString(), pom);
	assert.equal((await read("handoff/archives/nominalprimitivesubtypes-1.0.0.pom")).toString(), pom);
	const pomArtifact = pkg.artifacts.find(item => item.path.endsWith(".pom"));
	assert.deepEqual({ bytes: pomArtifact.bytes, sha256: pomArtifact.sha256 }, identity(pom));
	assert.deepEqual(await json("package/META-INF/lean-bridge/component/model.json"), model);
	assert.deepEqual(await json("package/META-INF/lean-bridge/component/binding-ir.json"), model.bindingIr);
	assert.deepEqual(await json("package/META-INF/lean-bridge/native-jvm.json"), compiled);
	const component = await json("package/META-INF/lean-bridge/component/native-component.json");
	const adapter = await json("package/META-INF/lean-bridge/native-c-adapter.json");
	const runtime = await json("package/META-INF/lean-bridge/runtime.json");
	assert.equal(sha256(canonicalJson(runtime)), packageReceipt.runtimeIdentity);
	for(const value of [component, adapter])
	{
		assert.equal(value.runtimeIdentity, packageReceipt.runtimeIdentity);
		assert.equal(value.bindingIrSha256, model.bindingIrSha256);
	}
	assert.deepEqual(component.sourceIdentity, model.sourceIdentity);
	assert.equal(adapter.componentReceiptSha256, sha256(canonicalJson(component)));
	const libraries = { [adapter.library]: adapter.files[`lib/${adapter.library}`]
		, [component.library]: component.nativeLibrary
		, ...Object.fromEntries(Object.entries(runtime.files).filter(([path]) => path.startsWith("lib/")).map(([path, file]) => [path.slice(4), file])) };
	assert.deepEqual(Object.fromEntries(paths.filter(path => path.startsWith(nativePrefix)).map(path => [path.slice(nativePrefix.length), files[path]])), libraries);
	const evidence = { runtimeIdentity: packageReceipt.runtimeIdentity
		, componentId: model.component.id
		, componentReceiptSha256: sha256(canonicalJson(component))
		, library: adapter.library
		, libraries: Object.fromEntries(Object.entries(libraries).map(([name, file]) => [name, file.sha256])) };
	assert.deepEqual(compiled.evidence, evidence);
	assert.deepEqual(Object.keys(compiled).sort(), ["bindingIrSha256", "compiler", "evidence", "files", "kotlin", "namespace", "profile", "schemaVersion"]);
	assert.equal(compiled.schemaVersion, 1); assert.equal(compiled.profile, "native-library-v1");
	assert.equal(compiled.namespace, namespace); assert.equal(compiled.bindingIrSha256, model.bindingIrSha256);
	assert.match(compiled.compiler, /^javac 22[. ]/u); validateKotlinCompilation(compiled.kotlin, namespace);
	assert.equal(packageReceipt.compiledProjectionSha256, sha256(canonicalJson(compiled)));
	const { generateCopiedJvmKotlinPackage, paths: generatorPaths } = await nominalSubtypeJvmGenerator(producerCommit);
	const generated = generateCopiedJvmKotlinPackage(model.bindingIr, evidence);
	assert.equal((await read("package/README.md")).toString(), `# ${pkg.name}:${pkg.version}\n\nRequires glibc ${floor} or newer.\n\n${generated["README.md"]}`);
	assert.equal(model.copiedGraph, undefined);
	assert.deepEqual(Object.keys(compiled.files).filter(path => !path.startsWith("classes/")).sort(), Object.keys(generated).sort());
	for(const [path, source] of Object.entries(generated))
	{
		assert.deepEqual(compiled.files[path], identity(source), path);
		if(path.startsWith("src/") || path === "binding-manifest.json")
			assert.equal((await read("package/META-INF/lean-bridge/jvm/" + path)).toString(), source, path);
	}
	assert.deepEqual(paths.filter(path => path.startsWith("META-INF/lean-bridge/jvm/")).sort(), Object.keys(generated)
		.filter(path => path.startsWith("src/") || path === "binding-manifest.json").map(path => "META-INF/lean-bridge/jvm/" + path).sort());
	assert.deepEqual(paths.filter(path => path.endsWith(".class") || path.endsWith(".kotlin_module")).sort(), Object.keys(compiled.files)
		.filter(path => path.startsWith("classes/")).map(path => path.slice(8)).sort());
	for(const [path, file] of Object.entries(compiled.files)) if(path.startsWith("classes/")) assert.deepEqual(files[path.slice(8)], file);
	for(const prefix of [`${namespace.replaceAll(".", "/")}/`, `${namespace.replaceAll(".", "/")}/kotlin/`])
		for(const name of nominalPrimitiveSubtypeJvmClasses) assert.ok(files[prefix + name + ".class"]?.bytes > 0, prefix + name);
	assert.ok(files[`${namespace.replaceAll(".", "/")}/Unit.class`]?.bytes > 0);
	assert.ok(files["META-INF/" + compiled.kotlin.module + ".kotlin_module"]?.bytes > 0);
	assert.ok(["full", "result-only"].includes(mode));
	return { installation, packageReceipt, generatorPaths, generatedFiles: Object.keys(generated).length };
};
