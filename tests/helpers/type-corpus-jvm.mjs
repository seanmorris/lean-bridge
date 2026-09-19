/**
 * Offline Maven installations, typed Java/Kotlin consumers and runtime-only relocation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdir, readFile, readdir, realpath, rename, rm } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { corpusCases, corpusHostCase } from "../fixtures/type-corpus/cases.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { captureCorpusCompiler } from "./type-corpus-compiler.mjs";
import { corpusJvmSource, corpusJvmSignatures, corpusJvmRejection } from "./type-corpus-jvm-source.mjs";
import { jvmRun, jvmDigest, jvmTools, jvmMaven, mavenGoals, mavenSettings, jvmConsumerPom, javaCompilerOptions, kotlinCompilerOptions, jvmDiagnostics } from "./type-corpus-jvm-tools.mjs";

const repository = resolve(import.meta.dirname, "../..");
const json = async path => JSON.parse(await readFile(path, "utf8"));
const inventory = async root => {
	const result = {};
	for(const path of await nativeArtifactPaths(root))
	{
		assert.ok(/^[A-Za-z0-9_.$+/-]+$/.test(path) && path.split("/").every(part => part !== "." && part !== ".."));
		const bytes = await readFile(join(root, path));
		result[path] = { sha256: sha256(bytes), bytes: bytes.length };
	}
	return result;
};

/**
 * Consume the exact prepared JAR/POM without author sources or ambient caches.
 *
 * @param options - Verified package handoff and private consumer environment.
 * @param options.library - Independent catalog library.
 * @param options.profile - Java or Kotlin.
 * @param options.consumer - Task-owned consumer root.
 * @param options.handoff - Relocated prepared archives.
 * @param options.pkg - Component package receipt entry.
 * @param options.dependencies - Hashed Maven build-tool plugin closure.
 * @param options.environment - Selected compiler tools.
 * @param options.clean - Compiler-free runtime environment.
 * @param options.fixture - Optional independent callable source/signature/rejection catalog.
 */
export const installedJvmCorpus = async ({ library, profile, consumer, handoff, pkg, dependencies, environment, clean, fixture }) => {
	const root = join(consumer, profile), project = join(root, "project");
	const tools = await jvmTools(environment), javaProfile = profile === "java";
	await mkdir(join(project, "repository"), { recursive: true });
	await mkdir(join(project, "home")); await mkdir(join(project, "empty-source"));
	assert.deepEqual(await readdir(join(project, "repository")), []);
	assert.deepEqual(await readdir(join(project, "home")), []);
	assert.equal(await jvmDigest(join(handoff, dependencies.archive)), dependencies.sha256);
	await jvmRun("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xf", join(handoff, dependencies.archive), "-C", project], project, clean);
	assert.deepEqual(await inventory(join(project, "repository")), dependencies.files);
	const pomSource = jvmConsumerPom(pkg);
	await saveLakeFile(project, "pom.xml", pomSource);
	await saveLakeFile(project, "settings.xml", mavenSettings);
	const jar = pkg.artifacts.find(file => file.path.endsWith(".jar")), pom = pkg.artifacts.find(file => file.path.endsWith(".pom"));
	await jvmMaven(tools, project, [mavenGoals.install, `-Dfile=${join(handoff, jar.path)}`, `-DpomFile=${join(handoff, pom.path)}`], clean);
	await jvmMaven(tools, project, [mavenGoals.resolve, "-Dmdep.outputFile=classpath.txt"], clean);
	const [group, name] = pkg.name.split(":"), installed = join(project, "repository", ...group.split("."), name, pkg.version);
	const installedJar = join(installed, basename(jar.path)), installedPom = join(installed, basename(pom.path));
	assert.equal((await readFile(join(project, "classpath.txt"), "utf8")).trim(), installedJar);
	assert.equal(await jvmDigest(installedJar), jar.sha256); assert.equal(await jvmDigest(installedPom), pom.sha256);
	const extracted = join(project, "extracted");
	await mkdir(extracted);
	await jvmRun("/usr/bin/unzip", ["-q", installedJar, "-d", extracted], project, clean);
	const receiptPath = "META-INF/lean-bridge/package-receipt.json", receipt = await json(join(extracted, receiptPath));
	assert.equal(receipt.kind, "lean-bridge-ordinary-maven-package");
	assert.equal(receipt.namespace, library.jvmModule);
	assert.equal(receipt.name, pkg.name); assert.equal(receipt.version, pkg.version);
	assert.equal(receipt.runtimeIdentity, pkg.runtimeIdentity);
	const payload = await inventory(extracted); delete payload[receiptPath];
	assert.deepEqual(payload, receipt.files);
	assert.equal(await jvmDigest(join(extracted, `META-INF/maven/${group}/${name}/pom.xml`)), pom.sha256);
	const javacVersion = (await jvmRun(tools.javac, ["-version"], project, clean)).stdout.trim();
	assert.match(javacVersion, /^javac 22(?:\.|$)/);
	const javaVersion = (await jvmRun(tools.java, ["-version"], project, clean)).stderr.trim();
	assert.match(javaVersion, /version "22[."]/);
	const source = fixture ? fixture.source(profile) : corpusJvmSource(library, profile), file = `src/Consumer.${javaProfile ? "java" : "kt"}`;
	await saveLakeFile(project, file, source);
	await saveLakeFile(project, "src/Wire.java", await readFile(join(repository, "tests/fixtures/type-corpus/consumers/Wire.java")));
	const javacArgs = [...javaCompilerOptions, "-sourcepath", "empty-source", "-classpath", installedJar, "-d", "classes"];
	await jvmRun(tools.javac, [...javacArgs, "src/Wire.java", ...javaProfile ? [file] : []], project, clean);
	let kotlin, kotlinArgs;
	if(!javaProfile)
	{
		const kotlinRoot = dirname(dirname(await realpath(environment.LEAN_BRIDGE_KOTLINC))), lib = join(kotlinRoot, "lib");
		const compilerFiles = Object.fromEntries(await Promise.all((await readdir(lib)).filter(name => name.endsWith(".jar")).sort().map(async name => [name, await jvmDigest(join(lib, name))])));
		const launch = ["-classpath", join(lib, "*"), "org.jetbrains.kotlin.cli.jvm.K2JVMCompiler", "-kotlin-home", kotlinRoot];
		const version = (await jvmRun(tools.java, [...launch, "-version"], project, clean)).stderr.trim();
		assert.match(version, /kotlinc-jvm 2\.2\.0 /);
		kotlinArgs = [...launch, ...kotlinCompilerOptions, "-jdk-home", tools.jdk, "-classpath", `${installedJar}:${join(project, "classes")}:${join(lib, "kotlin-stdlib.jar")}:${join(lib, "annotations-13.0.jar")}`, "-d", "classes"];
		await jvmRun(tools.java, [...kotlinArgs, file], project, clean);
		kotlin = { version, compilerFiles, stdlib: join(lib, "kotlin-stdlib.jar") };
	}
	const rejected = [];
	for(const entry of fixture ? fixture.rejections(profile) : corpusCases(library).map(entry => corpusHostCase(entry, profile)).filter(entry => entry.expectation.kind === "compile-rejection"))
	{
		const invalidFile = `src/reject-${entry.id.split("/")[1]}.${javaProfile ? "java" : "kt"}`, invalidSource = fixture ? entry.source : corpusJvmRejection(library, entry, profile);
		await saveLakeFile(project, invalidFile, invalidSource);
		const result = await captureCorpusCompiler(javaProfile ? tools.javac : tools.java, javaProfile ? [...javacArgs, "-XDrawDiagnostics", invalidFile] : [...kotlinArgs, invalidFile], project, clean);
		rejected.push({ id: entry.id, status: "rejected-at-compile-time", sourceSha256: sha256(invalidSource), diagnostics: jvmDiagnostics(result, entry, profile, project, invalidFile) });
	}
	const mavenVersion = (await jvmMaven(tools, project, ["--version"], clean)).stdout.trim();
	// Distribution packages may symlink Maven's tool JARs into /usr/share/java.
	// Hash their resolved bytes; prepared package payloads still reject symlinks.
	const mavenFiles = {};
	for(const name of (await readdir(join(tools.maven, "lib"))).filter(name => name.endsWith(".jar")).sort())
	{
		const bytes = await readFile(join(tools.maven, "lib", name));
		mavenFiles[name] = { sha256: sha256(bytes), bytes: bytes.length };
	}
	const jvm = { javacVersion, javaVersion, mavenVersion
		, compilerSha256: await jvmDigest(tools.javac)
		, javaSha256: await jvmDigest(tools.java)
		, javaModulesSha256: await jvmDigest(join(tools.jdk, "lib/modules"))
		, mavenBootSha256: await jvmDigest(tools.boot)
		, mavenFiles
		, consumerSourceSha256: sha256(source)
		, signaturesSha256: sha256(fixture ? fixture.signatures(profile) : corpusJvmSignatures(library, profile))
		, declarationsSha256: await jvmDigest(join(extracted, `META-INF/lean-bridge/jvm/src/main/java/${library.jvmModule.replaceAll(".", "/")}/Api.java`))
		, packageReceiptSha256: await jvmDigest(join(extracted, receiptPath))
		, compiledProjectionSha256: receipt.compiledProjectionSha256
		, bindingIrSha256: receipt.bindingIrSha256
		, archiveSha256: jar.sha256, pomSha256: pom.sha256
		, projectSourceSha256: sha256(pomSource)
		, settingsSha256: sha256(mavenSettings)
		, classpathSha256: await jvmDigest(join(project, "classpath.txt"))
		, compilerOptions: [...javaProfile ? javaCompilerOptions : kotlinCompilerOptions]
		, dependencies, exactPublicSignatures: true, emptyRepository: true
		, emptyUserHome: true, offline: true, resolvedClasspathOnly: true
		, publicApiOnly: true, runtimeOverridesDisabled: true };
	const deployment = join(root, "relocated");
	await mkdir(deployment); await rename(join(project, "classes"), join(deployment, "classes"));
	await cp(installedJar, join(deployment, "package.jar"));
	if(kotlin)
	{
		await cp(kotlin.stdlib, join(deployment, "kotlin-stdlib.jar"));
		jvm.kotlin = { version: kotlin.version, compilerFiles: kotlin.compilerFiles, stdlibSha256: await jvmDigest(kotlin.stdlib) };
	}
	const runtime = join(root, "runtime-only");
	await jvmRun(tools.jlink, ["--module-path", join(tools.jdk, "jmods"), "--add-modules", "java.base", "--no-header-files", "--no-man-pages", "--output", runtime], project, clean);
	jvm.runtimeFiles = await inventory(runtime); jvm.deployment = await inventory(deployment);
	assert.equal(jvm.deployment["package.jar"].sha256, jar.sha256);
	await rm(project, { recursive: true, force: true });
	assert.deepEqual((await readdir(root)).sort(), ["relocated", "runtime-only"]);
	const runtimeJava = join(runtime, "bin/java"), runtimeEnv = { ...clean, JAVA_HOME: runtime };
	jvm.runtimeModules = (await jvmRun(runtimeJava, ["--list-modules"], deployment, runtimeEnv)).stdout.trim().split("\n");
	assert.equal(jvm.runtimeModules.length, 1); assert.match(jvm.runtimeModules[0], /^java\.base@22(?:\.|$)/);
	const temp = join(deployment, "native-temp"), observations = [];
	await mkdir(temp);
	for(let i = 0; i < 2; ++i)
	{
		assert.deepEqual(await readdir(temp), []);
		observations.push(JSON.parse((await jvmRun(runtimeJava, ["--enable-native-access=ALL-UNNAMED", `-Djava.io.tmpdir=${temp}`, "-classpath", `classes:package.jar${javaProfile ? "" : ":kotlin-stdlib.jar"}`, javaProfile ? "Consumer" : "ConsumerKt"], deployment, runtimeEnv)).stdout));
		assert.deepEqual(await readdir(temp), [], "Normal exit must remove extracted native assets");
	}
	assert.deepEqual(observations[0], observations[1]);
	assert.equal(observations[0].apiLocation, join(deployment, "package.jar"));
	const native = Object.fromEntries(Object.entries(receipt.files).filter(([path]) => path.startsWith("META-INF/lean-bridge/native/linux-x64/")).map(([path, value]) => [basename(path), value.sha256]));
	assert.deepEqual(observations[0].nativeLibraries, native);
	assert.deepEqual(await inventory(deployment), jvm.deployment);
	assert.deepEqual(await inventory(runtime), jvm.runtimeFiles);
	Object.assign(jvm, { nativeLibraries: native, installedSourcesRemoved: true, compilerFreeExecution: true, runtimeOnlyExecution: true, normalExitCleanup: true, repeatExecution: true, localLibraries: true });
	const observation = observations[0]; observation.results.push(...rejected);
	return { observation, jvm };
};
