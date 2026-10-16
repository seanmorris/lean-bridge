/**
 * Compile-time probes for the nested checked-record Maven package. Full APIs expose every input
 * export, result-only APIs expose none of them, and Kotlin rejects null for every non-null public
 * parameter while an adjacent valid source compiles against the same JAR.
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
import {
	nestedCheckedRecordJvmModes, nestedCheckedRecordJvmProfiles
} from "./nested-checked-record-jvm-fixture.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { captureCorpusCompiler } from "./type-corpus-compiler.mjs";

export const nestedCheckedRecordJvmInputNames = Object.freeze([
	"echoArray", "first", "inArray", "inChoice", "inExcept", "inHolder"
	, "inList", "inOption", "inProduct", "pair", "second"
]);
const binary = new Set(["pair"]);

/**
 * Reference every input-only public method without naming full-only carrier types.
 *
 * @param profile - Java or Kotlin public API.
 */
export const nestedCheckedRecordJvmProbeSource = profile => {
	assert.ok(nestedCheckedRecordJvmProfiles.includes(profile));
	if(profile === "java") return "import org.leanbridge.nestedcheckedrecords.*;\nfinal class Probe {\n"
		+ nestedCheckedRecordJvmInputNames.map(name => `    static Object ${name}() { return Api.${name}(${binary.has(name) ? "null, null" : "null"}); }\n`).join("")
		+ "}\n";
	return "import org.leanbridge.nestedcheckedrecords.kotlin.*\n"
		+ nestedCheckedRecordJvmInputNames.map(name => `val probe${name[0].toUpperCase()}${name.slice(1)} = Api::${name}\n`).join("");
};

/**
 * Require success for full APIs, or exactly the missing input members for result-only APIs.
 *
 * @param record - Complete compiler record.
 * @param profile - Java or Kotlin public API.
 * @param mode - Full or result-only package API.
 */
export const checkNestedCheckedRecordJvmProbe = (record, profile, mode) => {
	assert.ok(nestedCheckedRecordJvmProfiles.includes(profile));
	assert.ok(nestedCheckedRecordJvmModes.includes(mode));
	assert.equal(record.profile, profile); assert.equal(record.mode, mode);
	const source = nestedCheckedRecordJvmProbeSource(profile);
	assert.equal(record.source, source); assert.equal(record.sourceSha256, sha256(source));
	assert.match(record.archiveSha256, /^[a-f0-9]{64}$/u);
	assert.equal(record.run.stdout, "");
	if(mode === "full")
	{
		assert.equal(record.run.code, 0, record.run.stderr);
		assert.equal(record.run.stderr, "");
		const expectedOutputs = profile === "java" ? ["Probe.class"] : [
			"META-INF/main.kotlin_module", "ProbeKt.class"
			, ...nestedCheckedRecordJvmInputNames.map(name =>
				`ProbeKt$probe${name[0].toUpperCase()}${name.slice(1)}$1.class`
			)
		];
		assert.deepEqual(Object.keys(record.outputs).sort(), expectedOutputs.sort());
		for(const entry of Object.values(record.outputs))
		{
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
	const expected = [...nestedCheckedRecordJvmInputNames];
	assert.equal(diagnostics.length, expected.length, record.run.stderr);
	assert.equal((record.run.stderr.match(profile === "java" ? /compiler\.err\./gu : /error:/gu) ?? []).length, expected.length);
	assert.doesNotMatch(record.run.stderr, /compiler\.warn\.|warning:/u);
	const found = [];
	for(const [, lineText, columnText, code, message] of diagnostics)
	{
		const line = Number(lineText), column = Number(columnText);
		const text = profile === "java" ? code : message;
		assert.ok(Number.isSafeInteger(column) && column > 0);
		if(profile === "kotlin") assert.equal(code, "UNRESOLVED_REFERENCE");
		else assert.match(code, /^compiler\.err\.cant\.resolve\.location(?:\.args)?:/u);
		const name = expected.find(item => new RegExp(`\\b${item}\\b`, "u").test(text));
		assert.ok(name, text); found.push(name);
		assert.equal(line, source.split("\n").findIndex(value => value.includes(
			profile === "java" ? `Api.${name}(` : `Api::${name}`
		)) + 1);
	}
	assert.deepEqual(found.sort(), expected.sort());
};

/**
 * Compile an API-shape probe against exact authenticated package bytes.
 *
 * @param options - Archive, compiler and output selection.
 * @param options.root - Fresh task-owned probe directory.
 * @param options.archive - Original verified Maven JAR bytes.
 * @param options.archiveSha256 - Digest from the verified package-set receipt.
 * @param options.environment - Selected JDK and Kotlin toolchains.
 * @param options.profile - Java or Kotlin public API.
 * @param options.mode - Full or result-only package API.
 * @param options.output - Persistent directory for the original records.
 */
export const runNestedCheckedRecordJvmProbe = async ({
	root, archive, archiveSha256, environment, profile, mode, output
}) => {
	assert.ok(nestedCheckedRecordJvmProfiles.includes(profile));
	assert.ok(nestedCheckedRecordJvmModes.includes(mode));
	inspectFinContainerEdgeJvmArchive(archive, archiveSha256);
	await assert.rejects(access(root), { code: "ENOENT" });
	await mkdir(root, { recursive: true });
	const source = nestedCheckedRecordJvmProbeSource(profile);
	const name = profile === "java" ? "probe.java" : "probe.kt";
	await saveLakeFile(root, "component.jar", archive);
	await saveLakeFile(root, name, source); await mkdir(join(root, "classes"));
	const command = profile === "java"
		? environment.LEAN_BRIDGE_JAVAC : environment.LEAN_BRIDGE_KOTLINC;
	const args = profile === "java"
		? ["--release", "22", "-Werror", "-proc:none", "-XDrawDiagnostics", "-cp", "component.jar", "-d", "classes", name]
		: ["-Werror", "-jvm-target", "22", "-Xrender-internal-diagnostic-names", "-cp", "component.jar", name, "-d", "classes"];
	const env = profile === "java" ? copiedCleanEnvironment
		: { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin"
			, JAVA_HOME: dirname(dirname(environment.LEAN_BRIDGE_JAVA)) };
	const run = await captureCorpusCompiler(command, args, root, env), outputs = {};
	for(const path of await nativeArtifactPaths(join(root, "classes")))
	{
		const bytes = await readFile(join(root, "classes", path));
		outputs[path] = { bytes: bytes.length, sha256: sha256(bytes) };
		await saveLakeFile(output, "classes/" + path, bytes);
	}
	const record = { profile, mode, command, args, cwd: root, environment: env
		, source, sourceSha256: sha256(source), archiveSha256, run, outputs };
	await saveLakeFile(output, name, source);
	await saveLakeFile(output, "record.json", canonicalJson(record));
	assert.deepEqual(await readFile(join(root, "component.jar")), archive);
	assert.equal(await readFile(join(root, name), "utf8"), source);
	checkNestedCheckedRecordJvmProbe(record, profile, mode);
	return record;
};

const packet = "Packet(java.math.BigInteger.ONE, java.math.BigInteger.ONE)";
const validCalls = {
	produceOption: "java.math.BigInteger.ONE"
	, produceArray: "java.math.BigInteger.ONE"
	, echoArray: `arrayOf(${packet})`, first: packet, inArray: `arrayOf(${packet})`
	, inChoice: "ChoiceEmpty()", inExcept: `Result.ok<Packet, Packet>(${packet})`
	, inHolder: `Holder(${packet}, java.math.BigInteger.ONE)`
	, inList: `arrayOf(${packet})`, inOption: `Option.some(${packet})`
	, inProduct: `Pair(${packet}, ${packet})`, pair: `${packet}, ${packet}`
	, second: packet
};
const nullNames = ["produceOption", "produceArray", ...nestedCheckedRecordJvmInputNames];

/**
 * Change only argument expressions between a compiling control and a null-rejection probe.
 *
 * @param mode - Full or result-only public API.
 * @param invalid - Substitute null for every non-null parameter.
 */
export const nestedCheckedRecordKotlinNullSource = (mode, invalid) => {
	assert.ok(nestedCheckedRecordJvmModes.includes(mode));
	assert.equal(typeof invalid, "boolean");
	const names = mode === "full" ? nullNames : nullNames.slice(0, 2);
	return "import org.leanbridge.nestedcheckedrecords.kotlin.*\n"
		+ names.map(name => `fun ${name}Null() = Api.${name}(${invalid ? (binary.has(name) ? "null, null" : "null") : validCalls[name]})\n`).join("");
};

/**
 * Require a successful adjacent control or only non-null type diagnostics.
 *
 * @param record - Original compiler outcome and source identities.
 * @param mode - Independently selected package API.
 * @param invalid - Whether this is the deliberately ill-typed source.
 */
export const checkNestedCheckedRecordKotlinNullProbe = (record, mode, invalid) => {
	const source = nestedCheckedRecordKotlinNullSource(mode, invalid);
	assert.equal(record.mode, mode); assert.equal(record.invalid, invalid);
	assert.equal(record.source, source); assert.equal(record.sourceSha256, sha256(source));
	assert.match(record.archiveSha256, /^[a-f0-9]{64}$/u);
	assert.equal(record.run.stdout, "");
	if(!invalid)
	{
		assert.equal(record.run.code, 0, record.run.stderr);
		assert.equal(record.run.stderr, "");
		assert.deepEqual(Object.keys(record.outputs).sort(), [
			"META-INF/main.kotlin_module", "NullProbeKt.class"
		]);
		for(const entry of Object.values(record.outputs))
		{
			assert.deepEqual(Object.keys(entry).sort(), ["bytes", "sha256"]);
			assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes > 0);
			assert.match(entry.sha256, /^[a-f0-9]{64}$/u);
		}
		return;
	}
	assert.equal(record.run.code, 1); assert.deepEqual(record.outputs, {});
	const diagnostics = [...record.run.stderr.matchAll(
		/^NullProbe\.kt:(\d+):(\d+): error: \[([^\]]+)\] ([^\n]+)$/gmu
	)];
	const names = mode === "full" ? nullNames : nullNames.slice(0, 2);
	const count = names.length + (mode === "full" ? 1 : 0);
	assert.equal(diagnostics.length, count, record.run.stderr);
	assert.equal((record.run.stderr.match(/error:/gu) ?? []).length, count);
	assert.doesNotMatch(record.run.stderr, /warning:/u);
	const expectedLines = names.flatMap((name, index) =>
		binary.has(name) ? [index + 2, index + 2] : [index + 2]
	);
	assert.deepEqual(diagnostics.map(([, line]) => Number(line)), expectedLines);
	for(const [, , column, code] of diagnostics)
	{
		assert.ok(Number(column) > 0); assert.equal(code, "NULL_FOR_NONNULL_TYPE");
	}
};

/**
 * Compile one Kotlin nullability control or negative probe against exact package bytes.
 *
 * @param options - Archive, compiler and output selection.
 * @param options.root - Fresh task-owned directory.
 * @param options.archive - Original verified JAR bytes.
 * @param options.archiveSha256 - Independently supplied archive digest.
 * @param options.environment - Explicit selected JVM toolchains.
 * @param options.mode - Full or result-only package API.
 * @param options.invalid - Positive control or null-rejection probe.
 * @param options.output - Persistent original-record directory.
 */
export const runNestedCheckedRecordKotlinNullProbe = async ({
	root, archive, archiveSha256, environment, mode, invalid, output
}) => {
	inspectFinContainerEdgeJvmArchive(archive, archiveSha256);
	await assert.rejects(access(root), { code: "ENOENT" });
	await mkdir(root, { recursive: true });
	const source = nestedCheckedRecordKotlinNullSource(mode, invalid);
	await saveLakeFile(root, "component.jar", archive);
	await saveLakeFile(root, "NullProbe.kt", source);
	await mkdir(join(root, "classes"));
	const command = environment.LEAN_BRIDGE_KOTLINC;
	const args = [
		"-Werror"
		, "-jvm-target"
		, "22"
		, "-Xrender-internal-diagnostic-names"
		, "-cp"
		, "component.jar"
		, "NullProbe.kt"
		, "-d"
		, "classes"
	];
	const env = { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin"
		, JAVA_HOME: dirname(dirname(environment.LEAN_BRIDGE_JAVA)) };
	const run = await captureCorpusCompiler(command, args, root, env), outputs = {};
	for(const path of await nativeArtifactPaths(join(root, "classes")))
	{
		const bytes = await readFile(join(root, "classes", path));
		outputs[path] = { bytes: bytes.length, sha256: sha256(bytes) };
		await saveLakeFile(output, "classes/" + path, bytes);
	}
	const record = { mode, invalid, command, args, cwd: root, environment: env
		, source, sourceSha256: sha256(source), archiveSha256, run, outputs };
	await saveLakeFile(output, "NullProbe.kt", source);
	await saveLakeFile(output, "record.json", canonicalJson(record));
	assert.deepEqual(await readFile(join(root, "component.jar")), archive);
	assert.equal(await readFile(join(root, "NullProbe.kt"), "utf8"), source);
	checkNestedCheckedRecordKotlinNullProbe(record, mode, invalid);
	return record;
};
