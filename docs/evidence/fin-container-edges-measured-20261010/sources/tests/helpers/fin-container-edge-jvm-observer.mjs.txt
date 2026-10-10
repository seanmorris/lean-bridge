/**
 * Compile a receipt-bound public JVM probe outside the original installation and measure its entries.
 * The selected JDK/Kotlin distribution remains a trusted host toolchain, as in the guarded installer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile, realpath } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { finContainerEdgeEntries, finContainerEdgeSourceEntries, finContainerEdgeWireSymbols } from "./fin-container-edge-dispatch.mjs";
import { assertFinContainerEdgeProbeLocation, finContainerEdgeDefinitions, verifyFinContainerEdgeDeployment } from "./fin-container-edge-observer.mjs";
import { assertFinContainerEdgeJvmGdbRun, prepareFinContainerEdgeJvmGdb } from "./fin-container-edge-jvm-gdb.mjs";
import { finContainerGdbCommand } from "./fin-container-dispatch-gdb.mjs";
import { finContainerEdgeJvmChecks, finContainerEdgeJvmProbe, readFinContainerEdgeJvm } from "./fin-container-edge-jvm.mjs";
import { verifyFinContainerEdgeJvmEnvironment } from "./fin-container-edge-jvm-closure.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/**
 * Retain the complete original Java or Kotlin consumer, not a replacement subset of calls.
 *
 * @param options - Archive identity and the fully relocated installation.
 * @param options.installed - Receipt-verified extracted JAR directory used for model/ELF inspection.
 * @param options.receiptPath - Relative original JAR receipt path.
 * @param options.receiptBytes - Original authenticated archive member bytes.
 * @param options.expectedModelSha256 - Producer model identity.
 * @param options.probeRoot - Fresh probe directory outside the installation.
 * @param options.jvmEnvironment - Original JAR and guarded consumer identities.
 * @param options.toolchainEnvironment - Explicitly selected JDK and Kotlin compiler commands.
 */
export const observeFinContainerEdgeJvm = async ({ installed, receiptPath, receiptBytes, expectedModelSha256, probeRoot, jvmEnvironment, toolchainEnvironment }) => {
	await assertFinContainerEdgeProbeLocation(installed, probeRoot);
	assert.ok(jvmEnvironment, "JVM observation requires the original guarded classpath");
	assert.ok(toolchainEnvironment, "JVM probe compilers must be explicitly selected");
	const { command, profile } = jvmEnvironment;
	assert.ok(Object.hasOwn(finContainerEdgeJvmChecks, profile));
	assert.equal(installed, join(jvmEnvironment.root, "jar-inspection"));
	assert.deepEqual(Buffer.from(receiptBytes), Buffer.from(jvmEnvironment.receiptBytes));
	const options = { installed, receiptPath, receiptBytes, expectedModelSha256, exactFileClosure: true };
	const tools = { java: command
		, javac: await realpath(toolchainEnvironment.LEAN_BRIDGE_JAVAC)
		, ...(profile === "kotlin" ? { kotlinc: await realpath(toolchainEnvironment.LEAN_BRIDGE_KOTLINC) } : {}) };
	assert.equal(dirname(tools.javac), dirname(command), "probe javac must belong to the selected JDK");
	const toolDigests = Object.fromEntries(await Promise.all(Object.entries(tools).map(async ([name, path]) => [name, { path, sha256: sha256(await readFile(path)) }])));
	const check = async () => {
		await verifyFinContainerEdgeJvmEnvironment(jvmEnvironment);
		for(const { path, sha256: digest } of Object.values(toolDigests))
		{
			assert.equal(await realpath(path), path);
			assert.equal(sha256(await readFile(path)), digest, "JVM probe tool drift");
		}
		return verifyFinContainerEdgeDeployment(options);
	};
	const before = await check(), jar = join(jvmEnvironment.root, "component.jar");
	assert.equal(before.directory, join(installed, "META-INF/lean-bridge/native/linux-x64"));
	const definitions = await finContainerEdgeDefinitions(before, { publicWire: true });
	const source = await finContainerEdgeJvmProbe(before.model, before.receipt.component, profile, jar);
	await mkdir(probeRoot);
	const sources = { "EdgeCounter.java": source.counter
		, "EdgeApi.java": source.api
		, [profile === "java" ? "consumer.java" : "consumer.kt"]: source.consumer };
	for(const [path, bytes] of Object.entries(sources)) await saveLakeFile(probeRoot, path, bytes);
	try
	{
		await runCopied(tools.javac, ["--release", "22", "-Werror", "-proc:none", "-cp", jar, "-d", "classes", "EdgeCounter.java", "EdgeApi.java", ...profile === "java" ? ["consumer.java"] : []], probeRoot);
		if(profile === "kotlin")
			await runCopied(tools.kotlinc, ["-Werror", "-jvm-target", "22", "-cp", jar + ":classes", "consumer.kt", "-include-runtime", "-d", "consumer.jar"], probeRoot, { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin", JAVA_HOME: dirname(dirname(command)) });
	}
	finally
	{ await check(); }
	const classes = await nativeArtifactPaths(join(probeRoot, "classes"));
	assert.deepEqual(classes, profile === "java" ? ["Consumer.class", "EdgeApi.class", "EdgeCounter.class"] : ["EdgeApi.class", "EdgeCounter.class"]);
	const paths = [...Object.keys(sources), ...classes.map(path => `classes/${path}`), ...profile === "kotlin" ? ["consumer.jar"] : []].sort();
	assert.deepEqual(await nativeArtifactPaths(probeRoot), paths);
	const probeFiles = Object.fromEntries(await Promise.all(paths.map(async path => [path, sha256(await readFile(join(probeRoot, path)))])));
	for(const [path, bytes] of Object.entries(sources)) assert.equal(probeFiles[path], sha256(bytes), "probe source changed during compilation");
	const verifyProbe = async () => {
		assert.deepEqual(await nativeArtifactPaths(join(probeRoot, "classes")), classes);
		for(const [path, digest] of Object.entries(probeFiles))
		{
			assert.equal(await realpath(join(probeRoot, path)), join(probeRoot, path));
			assert.equal(sha256(await readFile(join(probeRoot, path))), digest, `JVM probe input drift: ${path}`);
		}
	};
	const version = await runCopied(command, ["--version"], probeRoot);
	assert.equal(version.stderr, ""); assert.match(version.stdout, /^openjdk 22\./u);
	const gdbVersion = await runCopied(finContainerGdbCommand, ["--version"], probeRoot, { ...copiedCleanEnvironment, XDG_CACHE_HOME: probeRoot });
	assert.equal(gdbVersion.stderr, ""); assert.match(gdbVersion.stdout, /^GNU gdb /u);
	const observer = await prepareFinContainerEdgeJvmGdb({ model: before.model
		, component: before.receipt.component
		, nativeDirectory: before.directory, libraries: before.libraries
		, probeRoot: join(probeRoot, "gdb"), cwd: probeRoot
		, env: { ...copiedCleanEnvironment, LEAN_NUM_THREADS: "1" }
		, argv: ({ record, nonce, configSha256, definerIndices, extractionRoot }) => [command
			, "--enable-native-access=ALL-UNNAMED", `-Djava.io.tmpdir=${extractionRoot}`
			, "-cp"
			, `${jar}:${join(probeRoot, "classes")}${profile === "kotlin" ? ":" + join(probeRoot, "consumer.jar") : ""}`
			, profile === "java" ? "Consumer" : "ConsumerKt"
			, record, nonce, configSha256, definerIndices.join(",")] });
	const runObserved = async settings => {
		await check(); await verifyProbe();
		try
		{ return await observer.run(settings); }
		finally
		{ await check(); await verifyProbe(); }
	};
	const absent = await runObserved({ gdb: false });
	assert.equal(absent.code, 2); assert.equal(absent.stdout, ""); assert.equal(absent.stderr, "edge record is not attached with empty counters\n");
	const run = await runObserved(); assert.equal(run.code, 0, run.output + run.stderr);
	const observations = readFinContainerEdgeJvm(run.stdout, profile);
	const armed = await assertFinContainerEdgeJvmGdbRun(observer, run, observations, before.libraries);
	const repeat = await runObserved(); assert.equal(repeat.code, 0, repeat.output + repeat.stderr);
	assert.equal(repeat.stdout, run.stdout, "a fresh JVM process must repeat every call");
	const again = await assertFinContainerEdgeJvmGdbRun(observer, repeat, readFinContainerEdgeJvm(repeat.stdout, profile), before.libraries);
	assert.notEqual(armed.pid, again.pid); assert.notEqual(run.nonce, repeat.nonce); assert.notEqual(run.extractionRoot, repeat.extractionRoot);
	assert.deepEqual(await check(), before, "JVM observation must not alter installed files");
	return { kind: "fin-container-edge-public-jvm-v1", observed: true, profile
		, caller: `The complete original-plus-edge ${profile} consumer of the generated Java API`
		, instrument: "GDB address breakpoints over authenticated JVM-extracted libraries; production loader unchanged"
		, checks: finContainerEdgeJvmChecks[profile]
		, measuredCalls: observations.length
		, observations, java: version.stdout.trim(), toolDigests
		, gdb: gdbVersion.stdout.split("\n")[0]
		, gdbSha256: sha256(await readFile(finContainerGdbCommand))
		, componentId: before.model.component.id, columns: before.columns
		, measuredAdapters: finContainerEdgeEntries.map(name => `FinContainers.${name}`)
		, measuredSources: finContainerEdgeSourceEntries.map(name => `FinContainers.${name}`)
		, sourceFunctionsNotMeasured: finContainerEdgeEntries.filter(name => !finContainerEdgeSourceEntries.includes(name)).map(name => `FinContainers.${name}`)
		, publicSymbols: finContainerEdgeWireSymbols, packageDirectory: installed
		, libraryDirectory: before.directory, libraries: before.libraries
		, definitions: Object.fromEntries(Object.entries(definitions).map(([symbol, path]) => [symbol, basename(path)]))
		, ...before.identity, jvmEnvironment: await verifyFinContainerEdgeJvmEnvironment(jvmEnvironment)
		, configIdentity: observer.identity, configSha256: observer.configSha256
		, probeFiles, probeFilesSha256: sha256(canonicalJson(probeFiles))
		, stdoutSha256: sha256(run.stdout)
		, runs: await Promise.all([[run, armed], [repeat, again]].map(async ([result, manifest]) => ({
			pid: manifest.pid, nonce: result.nonce, manifest
			, extractionRoot: result.extractionRoot
			, scriptSha256: result.scriptSha256
			, recordSha256: sha256(await readFile(result.record))
			, manifestSha256: sha256(await readFile(result.armed)) })))
		, missingInstrumentRefused: true, installedFilesUnchanged: true
		, runtimeDefinitionsChecked: true, loadedClassesChecked: true
		, nativeExtractionCheckedBeforeAndAfterExit: true
		, repeatedColdProcess: true };
};
