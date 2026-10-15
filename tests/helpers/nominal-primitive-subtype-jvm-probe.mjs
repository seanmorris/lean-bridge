/**
 * Compile-time probes of the installed nineteen-base Maven package: the full API exposes every
 * input export to Java and Kotlin, the result-only API exposes none of them, and Kotlin refuses null
 * for every non-null parameter type while the adjacent control compiles against the same JAR.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { inspectFinContainerEdgeJvmArchive } from "./fin-container-edge-jvm-closure.mjs";
import { copiedCleanEnvironment } from "./copied-fixture-install.mjs";
import { captureCorpusCompiler } from "./type-corpus-compiler.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { nominalPrimitiveSubtypeJvmModes, nominalPrimitiveSubtypeJvmProfiles } from "./nominal-primitive-subtype-jvm-fixture.mjs";

export const nominalPrimitiveSubtypeJvmInputNames = Object.freeze(["echoA", "echoB", "refuseUnit", "combine", "echoPair", "echoEventA", "echoEventB", "aliases"]);
const binary = new Set(["combine", "aliases"]);
const kotlinInputs = {
	echoA: "value: Packet", echoB: "value: Packet", refuseUnit: "value: Packet"
	, combine: "left: Packet, right: Packet", echoPair: "value: PacketPair"
	, echoEventA: "value: Event", echoEventB: "value: Event"
	, aliases: "left: Array<Option<Packet>>, right: Array<Option<Packet>>"
};

/**
 * Reference every input-only public method; the nominal records exist in both API modes.
 *
 * @param profile - Java or Kotlin public API.
 */
export const nominalPrimitiveSubtypeJvmProbeSource = profile => {
	assert.ok(nominalPrimitiveSubtypeJvmProfiles.includes(profile));
	if(profile === "java") return "import org.leanbridge.nominalprimitivesubtypes.*;\nfinal class Probe {\n"
		+ nominalPrimitiveSubtypeJvmInputNames.map(name => `    static Object ${name}() { return Api.${name}(${binary.has(name) ? "null, null" : "null"}); }\n`).join("")
		+ "    static PacketPair inputValue;\n}\n";
	return "import org.leanbridge.nominalprimitivesubtypes.kotlin.*\n"
		+ nominalPrimitiveSubtypeJvmInputNames.map(name => `fun ${name}(${kotlinInputs[name]}) = Api.${name}(${binary.has(name) ? "left, right" : "value"})\n`).join("");
};

/**
 * Require success for full APIs, or exactly the eight missing input members for results.
 * Unknown compiler diagnostics never count as a successful negative probe.
 *
 * @param record - Original complete compiler process and output identities.
 * @param profile - Independently selected public API.
 * @param mode - Independently selected package API surface.
 */
export const checkNominalPrimitiveSubtypeJvmProbe = (record, profile, mode) => {
	assert.ok(nominalPrimitiveSubtypeJvmProfiles.includes(profile)); assert.ok(nominalPrimitiveSubtypeJvmModes.includes(mode));
	assert.equal(record.profile, profile); assert.equal(record.mode, mode);
	const source = nominalPrimitiveSubtypeJvmProbeSource(profile);
	assert.equal(record.source, source); assert.equal(record.sourceSha256, sha256(source));
	assert.match(record.archiveSha256, /^[a-f0-9]{64}$/u);
	assert.equal(record.run.stdout, "");
	if(mode === "full")
	{
		assert.equal(record.run.code, 0, record.run.stderr); assert.equal(record.run.stderr, "");
		assert.ok(record.outputs[profile === "java" ? "Probe.class" : "ProbeKt.class"]?.bytes > 0);
		for(const [path, entry] of Object.entries(record.outputs))
		{
			assert.ok(profile === "java" ? path === "Probe.class" : path === "ProbeKt.class" || path === "META-INF/main.kotlin_module");
			assert.deepEqual(Object.keys(entry).sort(), ["bytes", "sha256"]);
			assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes > 0);
			assert.match(entry.sha256, /^[a-f0-9]{64}$/u);
		}
		return;
	}
	assert.equal(record.run.code, 1); assert.deepEqual(record.outputs, {});
	const diagnostics = profile === "java"
		? [...record.run.stderr.matchAll(/^probe\.java:(\d+):(\d+): (compiler\.err\.[^\n]+)$/gmu)]
		: [...record.run.stderr.matchAll(/^probe\.kt:(\d+):(\d+): error: \[([^\]]+)\] ([^\n]+)$/gmu)];
	const expected = [...nominalPrimitiveSubtypeJvmInputNames];
	assert.equal(diagnostics.length, expected.length, record.run.stderr);
	assert.equal((record.run.stderr.match(profile === "java" ? /compiler\.err\./gu : /error:/gu) ?? []).length, expected.length);
	assert.doesNotMatch(record.run.stderr, /compiler\.warn\.|warning:/u);
	const found = [];
	for(const [, lineText, columnText, code, message] of diagnostics)
	{
		const line = Number(lineText), column = Number(columnText), text = profile === "java" ? code : message;
		assert.ok(Number.isSafeInteger(column) && column > 0);
		if(profile === "kotlin") assert.equal(code, "UNRESOLVED_REFERENCE");
		else assert.match(code, /^compiler\.err\.cant\.resolve\.location(?:\.args)?:/u);
		const name = expected.find(name => new RegExp(`\\b${name}\\b`, "u").test(text));
		assert.ok(name, text); found.push(name);
		assert.equal(line, source.split("\n").findIndex(value => value.includes(`Api.${name}(`)) + 1);
	}
	assert.deepEqual(found.sort(), expected.sort());
};

/**
 * Probe exact package bytes in an isolated directory, leaving the installation unchanged.
 *
 * @param options - Original archive and explicitly selected compiler paths.
 * @param options.root - Fresh task-owned probe directory.
 * @param options.archive - Original verified Maven JAR bytes.
 * @param options.archiveSha256 - Digest from the verified package-set receipt.
 * @param options.environment - Selected JDK and Kotlin toolchain paths.
 * @param options.profile - Java or Kotlin public API.
 * @param options.mode - Full API or result-only API.
 * @param options.output - Persistent directory for the original probe records.
 */
export const runNominalPrimitiveSubtypeJvmProbe = async ({ root, archive, archiveSha256, environment, profile, mode, output }) => {
	assert.ok(nominalPrimitiveSubtypeJvmProfiles.includes(profile)); assert.ok(nominalPrimitiveSubtypeJvmModes.includes(mode));
	inspectFinContainerEdgeJvmArchive(archive, archiveSha256);
	await assert.rejects(access(root), { code: "ENOENT" }); await mkdir(root, { recursive: true });
	const source = nominalPrimitiveSubtypeJvmProbeSource(profile), name = profile === "java" ? "probe.java" : "probe.kt";
	await saveLakeFile(root, "component.jar", archive); await saveLakeFile(root, name, source); await mkdir(join(root, "classes"));
	const command = profile === "java" ? environment.LEAN_BRIDGE_JAVAC : environment.LEAN_BRIDGE_KOTLINC;
	const args = profile === "java"
		? ["--release", "22", "-Werror", "-proc:none", "-XDrawDiagnostics", "-cp", "component.jar", "-d", "classes", name]
		: ["-Werror", "-jvm-target", "22", "-Xrender-internal-diagnostic-names", "-cp", "component.jar", name, "-d", "classes"];
	const env = profile === "java" ? copiedCleanEnvironment
		: { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin", JAVA_HOME: dirname(dirname(environment.LEAN_BRIDGE_JAVA)) };
	const run = await captureCorpusCompiler(command, args, root, env), outputs = {};
	for(const path of await nativeArtifactPaths(join(root, "classes")))
	{
		const bytes = await readFile(join(root, "classes", path)); outputs[path] = { bytes: bytes.length, sha256: sha256(bytes) };
		await saveLakeFile(output, "classes/" + path, bytes);
	}
	const record = { profile, mode, command, args, cwd: root, environment: env
		, source, sourceSha256: sha256(source), archiveSha256, run, outputs };
	await saveLakeFile(output, name, source); await saveLakeFile(output, "record.json", canonicalJson(record));
	assert.deepEqual(await readFile(join(root, "component.jar")), archive);
	assert.equal(await readFile(join(root, name), "utf8"), source);
	checkNominalPrimitiveSubtypeJvmProbe(record, profile, mode);
	return record;
};

/**
 * Change only argument expressions between compiling controls and null probes.
 *
 * @param mode - Full or result-only public API.
 * @param invalid - Substitute null for each non-null typed argument.
 */
export const nominalPrimitiveSubtypeKotlinNullSource = (mode, invalid) => {
	assert.ok(nominalPrimitiveSubtypeJvmModes.includes(mode)); assert.equal(typeof invalid, "boolean");
	const raw = "RawPacket(org.leanbridge.nominalprimitivesubtypes.Unit.INSTANCE, true, 42, 42, 42L, java.math.BigInteger.TWO, -42, -42, -42, -42L, java.math.BigInteger.TWO, java.math.BigInteger.TWO, 1.5f, 1.5, \"a\", byteArrayOf(1), 97, java.math.BigInteger.TWO, -42L, java.math.BigInteger.TWO)";
	const packet = raw.replace("RawPacket(", "Packet(");
	const calls = [["produce", raw]
		, ...mode === "full" ? [["echoA", packet]
			, ["aliases", "emptyArray<Option<Packet>>(), emptyArray<Option<Packet>>()"]
			, ["echoEventA", "EventEmpty()"]] : []];
	return "import org.leanbridge.nominalprimitivesubtypes.kotlin.*\n"
		+ calls.map(([name, value]) => `fun ${name}() = Api.${name}(${invalid ? (binary.has(name) ? "null, null" : "null") : value})\n`).join("");
};

/**
 * Require a successful adjacent control or only the expected non-null type errors.
 *
 * @param record - Original compiler outcome, source and class output identities.
 * @param mode - Independently selected package API.
 * @param invalid - Whether this run is the deliberately ill-typed source.
 */
export const checkNominalPrimitiveSubtypeKotlinNullProbe = (record, mode, invalid) => {
	const source = nominalPrimitiveSubtypeKotlinNullSource(mode, invalid);
	assert.equal(record.mode, mode); assert.equal(record.invalid, invalid);
	assert.equal(record.source, source); assert.equal(record.sourceSha256, sha256(source));
	assert.match(record.archiveSha256, /^[a-f0-9]{64}$/u);
	assert.equal(record.run.stdout, "");
	if(!invalid)
	{
		assert.equal(record.run.code, 0, record.run.stderr); assert.equal(record.run.stderr, "");
		assert.deepEqual(Object.keys(record.outputs).sort(), ["META-INF/main.kotlin_module", "NullProbeKt.class"]);
		for(const entry of Object.values(record.outputs))
		{
			assert.deepEqual(Object.keys(entry).sort(), ["bytes", "sha256"]);
			assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes > 0); assert.match(entry.sha256, /^[a-f0-9]{64}$/u);
		}
		return;
	}
	assert.equal(record.run.code, 1); assert.deepEqual(record.outputs, {});
	const diagnostics = [...record.run.stderr.matchAll(/^NullProbe\.kt:(\d+):(\d+): error: \[([^\]]+)\] ([^\n]+)$/gmu)];
	// One null per parameter: produce takes one argument, aliases two, the others one.
	const count = mode === "full" ? 5 : 1;
	assert.equal(diagnostics.length, count, record.run.stderr);
	assert.equal((record.run.stderr.match(/error:/gu) ?? []).length, count);
	assert.doesNotMatch(record.run.stderr, /warning:/u);
	const lines = diagnostics.map(([, line]) => Number(line));
	assert.deepEqual(lines, mode === "full" ? [2, 3, 4, 4, 5] : [2]);
	for(const [, , column, code] of diagnostics)
	{ assert.ok(Number(column) > 0); assert.equal(code, "NULL_FOR_NONNULL_TYPE"); }
};

/**
 * Retain all original probe records before checking diagnostics and exit status.
 *
 * @param options - Verified archive and explicitly selected Kotlin compiler.
 * @param options.root - Fresh task-owned directory.
 * @param options.archive - Original verified JAR bytes.
 * @param options.archiveSha256 - Independently supplied archive digest.
 * @param options.environment - Explicit selected JVM toolchains.
 * @param options.mode - Full or result-only package API.
 * @param options.invalid - Positive control or null-rejection probe.
 * @param options.output - Persistent original-record directory.
 */
export const runNominalPrimitiveSubtypeKotlinNullProbe = async ({ root, archive, archiveSha256, environment, mode, invalid, output }) => {
	inspectFinContainerEdgeJvmArchive(archive, archiveSha256);
	await assert.rejects(access(root), { code: "ENOENT" }); await mkdir(root, { recursive: true });
	const source = nominalPrimitiveSubtypeKotlinNullSource(mode, invalid);
	await saveLakeFile(root, "component.jar", archive); await saveLakeFile(root, "NullProbe.kt", source); await mkdir(join(root, "classes"));
	const command = environment.LEAN_BRIDGE_KOTLINC;
	const args = ["-Werror", "-jvm-target", "22", "-Xrender-internal-diagnostic-names", "-cp", "component.jar", "NullProbe.kt", "-d", "classes"];
	const env = { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin", JAVA_HOME: dirname(dirname(environment.LEAN_BRIDGE_JAVA)) };
	const run = await captureCorpusCompiler(command, args, root, env), outputs = {};
	for(const path of await nativeArtifactPaths(join(root, "classes")))
	{
		const bytes = await readFile(join(root, "classes", path)); outputs[path] = { bytes: bytes.length, sha256: sha256(bytes) };
		await saveLakeFile(output, "classes/" + path, bytes);
	}
	const record = { mode, invalid, command, args, cwd: root, environment: env
		, source, sourceSha256: sha256(source), archiveSha256, run, outputs };
	await saveLakeFile(output, "NullProbe.kt", source); await saveLakeFile(output, "record.json", canonicalJson(record));
	assert.deepEqual(await readFile(join(root, "component.jar")), archive);
	assert.equal(await readFile(join(root, "NullProbe.kt"), "utf8"), source);
	checkNominalPrimitiveSubtypeKotlinNullProbe(record, mode, invalid);
	return record;
};
