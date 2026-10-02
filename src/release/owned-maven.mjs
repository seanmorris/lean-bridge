/**
 * Package verified owned-value JVM artifacts without invoking a compiler.
 *
 * @file
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { nativeArtifactPaths, verifyNativeFiles } from "../build/native-artifacts.mjs";
import { ownedJvmEvidence } from "../build/owned-jvm-artifacts.mjs";
import { validateKotlinCompilation } from "../build/compile-jvm-sources.mjs";
import { generateOwnedJvmPackage } from "../backends/jvm/owned-package.mjs";
import { validateOrdinaryMavenSettings } from "../backends/jvm/copied-model.mjs";
import { createDeterministicZip } from "./deterministic-zip.mjs";
import { readVerifiedSourceNotices } from "./source-notices.mjs";
import { compiledPackageMetadata, mavenPackageMetadata } from "../analyze/package-metadata.mjs";

/**
 * Assemble reproducible Maven JAR and POM files from verified compiled inputs.
 *
 * @param options - Compiled staging roots, selected coordinate and platform floor.
 * @param options.working - Private release staging directory.
 * @param options.jvmRoot - Verified compiled Java artifacts.
 * @param options.nativeRoot - Verified native component artifacts.
 * @param options.runtimeRoot - Verified shared native runtime.
 * @param options.adapterRoot - Verified C adapter artifacts.
 * @param options.leanPrefix - Lean compiler license notices.
 * @param options.settings - Optional Maven coordinate and version.
 * @param options.glibcMinimumVersion - Validated Linux ABI floor.
 */
export const packageOwnedMaven = async ({ working, jvmRoot, nativeRoot, runtimeRoot, adapterRoot, leanPrefix, settings = {}, glibcMinimumVersion }) => {
	validateOrdinaryMavenSettings(settings);
	if(!/^2\.\d+$/u.test(glibcMinimumVersion)) throw new TypeError("Invalid owned Maven glibc floor");
	const { model, projection, evidence, receipt, libraryPaths, adapter } = await ownedJvmEvidence({ nativeRoot, runtimeRoot, adapterRoot });
	const compiled = JSON.parse(await readFile(join(jvmRoot, "native-jvm.json"), "utf8"));
	await verifyNativeFiles(jvmRoot, compiled.files);
	validateKotlinCompilation(compiled.kotlin, projection.namespace, { ownedValues: true });
	if(compiled.schemaVersion !== 1 || compiled.profile !== "native-library-v1" || compiled.bindingIrSha256 !== model.bindingIrSha256
		|| compiled.namespace !== projection.namespace || canonicalJson(compiled.evidence) !== canonicalJson(evidence)
		|| canonicalJson(compiled.ownedValues ?? null) !== canonicalJson(projection.contract)
		|| !/^javac 22(?:[.+ -]|$)/.test(compiled.compiler)
		|| (await nativeArtifactPaths(jvmRoot)).some(path => path !== "native-jvm.json" && !Object.hasOwn(compiled.files, path))) throw new Error("Compiled JVM projection differs from native evidence");
	const sources = generateOwnedJvmPackage(model.bindingIr, evidence).files;
	for(const path of Object.keys(compiled.files))
		if(!Object.hasOwn(sources, path) && !/^classes\/[A-Za-z0-9_.$/-]+\.(?:class|kotlin_module)$/u.test(path))
			throw new Error("Unexpected compiled owned JVM file: " + path);
	for(const [path, contents] of Object.entries(sources))
		if(await readFile(join(jvmRoot, path), "utf8") !== contents) throw new Error("Generated JVM source differs from the compiled model");
	const prefix = projection.prefix;
	const name = settings.name ?? `org.leanbridge:${prefix.replaceAll("_", "-")}`, version = settings.version ?? model.component.version;
	validateOrdinaryMavenSettings({ name, version });
	const [group, artifact] = name.split(":"), base = `${artifact}-${version}`;
	const root = join(working, "packages/maven/jar"), coordinateRoot = join(working, "packages/maven/repository", ...group.split("."), artifact, version);
	const save = async (path, bytes) => { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), bytes, { flag: "wx" }); };
	const copy = async (source, path) => save(path, await readFile(source));
	const classes = Object.keys(compiled.files).filter(path => path.startsWith("classes/"));
	if(!classes.includes(`classes/${projection.namespace.replaceAll(".", "/")}/Api.class`)) throw new Error("Compiled JVM API is missing");
	if(!classes.includes(`classes/${projection.namespace.replaceAll(".", "/")}/kotlin/Api.class`)
		|| !classes.includes(`classes/META-INF/${compiled.kotlin.module}.kotlin_module`)) throw new Error("Compiled Kotlin API or metadata is missing");
	for(const path of classes) await copy(join(jvmRoot, path), path.slice("classes/".length));
	for(const [file, path] of Object.entries(libraryPaths))
		await copy(path, `META-INF/lean-bridge/native/linux-x64/${file}`);
	for(const path of Object.keys(compiled.files).filter(path => path.startsWith("src/") || path === "binding-manifest.json"))
		await copy(join(jvmRoot, path), `META-INF/lean-bridge/jvm/${path}`);
	await copy(join(jvmRoot, "native-jvm.json"), "META-INF/lean-bridge/native-jvm.json");
	for(const path of ["native-component.json", "model.json", "metadata.json", "binding-ir.json", "generated.lean", "component.h", "allocation-guard.h", "artifacts.json", "callbacks.c"])
		await copy(join(nativeRoot, path), `META-INF/lean-bridge/component/${path}`);
	if(receipt.sourceIdentity.lakeDependencies?.generatedSourcesSha256 !== undefined)
	{
		const bytes = await readFile(join(nativeRoot, "lake-generated-sources.json"));
		if(sha256(bytes) !== receipt.sourceIdentity.lakeDependencies.generatedSourcesSha256)
			throw new Error("Owned JVM generated Lean inputs differ from compilation");
		await save("META-INF/lean-bridge/component/lake-generated-sources.json", bytes);
	}
	await copy(join(adapterRoot, "native-jvm-adapter.json"), "META-INF/lean-bridge/native-jvm-adapter.json");
	for(const path of Object.keys(adapter.files).filter(path => !path.startsWith("lib/") && !path.startsWith("gmp/lib/")))
		await copy(join(adapterRoot, path), `META-INF/lean-bridge/adapter/${path}`);
	await copy(join(runtimeRoot, "runtime.json"), "META-INF/lean-bridge/runtime.json");
	await copy(join(leanPrefix, "LICENSE"), "META-INF/lean-bridge/licenses/Lean-LICENSE");
	await copy(join(leanPrefix, "LICENSES"), "META-INF/lean-bridge/licenses/Lean-LICENSES");
	for(const [path, bytes] of (await readVerifiedSourceNotices(nativeRoot, model.sourceIdentity)).files) await save(`META-INF/lean-bridge/licenses/${path}`, bytes);
	await copy(new URL("../../LICENSE", import.meta.url), "META-INF/lean-bridge/licenses/LeanBridge-LICENSE");
	await save("README.md", `# ${name}:${version}\n\nRequires glibc ${glibcMinimumVersion} or newer.\n\n${await readFile(join(jvmRoot, "README.md"), "utf8")}`);
	const pom = `<?xml version="1.0" encoding="UTF-8"?>\n<project xmlns="http://maven.apache.org/POM/4.0.0"><modelVersion>4.0.0</modelVersion><groupId>${group}</groupId><artifactId>${artifact}</artifactId><version>${version}</version>${mavenPackageMetadata(compiledPackageMetadata(model.sourceIdentity))}<properties><maven.compiler.release>22</maven.compiler.release><project.build.sourceEncoding>UTF-8</project.build.sourceEncoding></properties><dependencies><dependency><groupId>org.jetbrains.kotlin</groupId><artifactId>kotlin-stdlib</artifactId><version>2.2.0</version></dependency></dependencies></project>\n`;
	await save(`META-INF/maven/${group}/${artifact}/pom.xml`, pom);
	await save("META-INF/MANIFEST.MF", "Manifest-Version: 1.0\n\n");
	const inventory = {};
	for(const path of await nativeArtifactPaths(root))
	{ const bytes = await readFile(join(root, path)); inventory[path] = { bytes: bytes.length, sha256: sha256(bytes) }; }
	await save("META-INF/lean-bridge/package-receipt.json", canonicalJson({ schemaVersion: 1, kind: "lean-bridge-owned-maven-package", ecosystem: "maven", name, version, component: model.component, bindingIrSha256: model.bindingIrSha256, runtimeIdentity: evidence.runtimeIdentity, sourceIdentity: model.sourceIdentity, glibcMinimumVersion, namespace: projection.namespace, kotlin: { namespace: compiled.kotlin.namespace, standardLibraryVersion: compiled.kotlin.standardLibraryVersion }, compiledProjectionSha256: sha256(canonicalJson(compiled)), ownedValues: projection.contract, files: inventory }));
	const jar = await createDeterministicZip({ directory: root, sourceDateEpoch: 315532800 }), packages = [];
	await mkdir(coordinateRoot, { recursive: true }); await mkdir(join(working, "archives"), { recursive: true });
	for(const [extension, bytes] of [["jar", jar], ["pom", Buffer.from(pom)]])
	{
		const archive = `${base}.${extension}`, hash = sha256(bytes);
		await writeFile(join(working, "archives", archive), bytes, { flag: "wx" });
		await writeFile(join(coordinateRoot, archive), bytes, { flag: "wx" });
		await writeFile(join(coordinateRoot, `${archive}.sha256`), `${hash}\n`, { flag: "wx" });
		packages.push({ archive, name, version, bytes: bytes.length, sha256: hash, compilerAccess: false });
	}
	return { ecosystem: "maven", backend: "owned-jvm-v1", runtimeIdentity: evidence.runtimeIdentity, glibcMinimumVersion, namespace: projection.namespace, packages };
};
