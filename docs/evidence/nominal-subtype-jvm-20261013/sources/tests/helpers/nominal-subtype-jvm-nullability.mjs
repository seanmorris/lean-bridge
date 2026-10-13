/**
 * Check Kotlin null rejection with adjacent compiling controls against the same JAR.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { copiedCleanEnvironment } from "./copied-fixture-install.mjs";
import { captureCorpusCompiler } from "./type-corpus-compiler.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { nominalSubtypeJvmModes } from "./nominal-subtype-jvm-fixture.mjs";
import { inspectFinContainerEdgeJvmArchive } from "./fin-container-edge-jvm-closure.mjs";

/**
 * Change only argument expressions between compiling controls and null probes.
 *
 * @param mode - Full or result-only public API.
 * @param invalid - Substitute null for each non-null typed argument.
 */
export const nominalSubtypeKotlinNullSource = (mode, invalid) => {
	assert.ok(nominalSubtypeJvmModes.includes(mode)); assert.equal(typeof invalid, "boolean");
	const envelope = "Envelope(java.math.BigInteger.ONE, java.math.BigInteger.TWO)";
	const calls = [["scalar", "java.math.BigInteger.ONE"]
		, ...mode === "full" ? [["first", envelope]
			, ["echoGroups", "emptyArray<Option<Envelope>>()"]
			, ["eventFirst", "EventEmpty()"]] : []];
	return "import org.leanbridge.nominalsubtypes.kotlin.*\n"
		+ calls.map(([name, value]) => `fun ${name}() = Api.${name}(${invalid ? "null" : value})\n`).join("");
};

/**
 * Require a successful adjacent control or only the expected non-null type errors.
 *
 * @param record - Original compiler outcome, source and class output identities.
 * @param mode - Independently selected package API.
 * @param invalid - Whether this run is the deliberately ill-typed source.
 */
export const checkNominalSubtypeKotlinNullProbe = (record, mode, invalid) => {
	const source = nominalSubtypeKotlinNullSource(mode, invalid);
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
	const count = mode === "full" ? 4 : 1;
	assert.equal(diagnostics.length, count, record.run.stderr);
	assert.equal((record.run.stderr.match(/error:/gu) ?? []).length, count);
	assert.doesNotMatch(record.run.stderr, /warning:/u);
	assert.deepEqual(diagnostics.map(([, line]) => Number(line)), Array.from({ length: count }, (_, index) => index + 2));
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
export const runNominalSubtypeKotlinNullProbe = async ({ root, archive, archiveSha256, environment, mode, invalid, output }) => {
	inspectFinContainerEdgeJvmArchive(archive, archiveSha256);
	await assert.rejects(access(root), { code: "ENOENT" }); await mkdir(root, { recursive: true });
	const source = nominalSubtypeKotlinNullSource(mode, invalid);
	await saveLakeFile(root, "component.jar", archive); await saveLakeFile(root, "NullProbe.kt", source); await mkdir(join(root, "classes"));
	const command = environment.LEAN_BRIDGE_KOTLINC;
	const args = ["-Werror", "-jvm-target", "22"
		, "-Xrender-internal-diagnostic-names"
		, "-cp", "component.jar", "NullProbe.kt", "-d", "classes"];
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
	checkNominalSubtypeKotlinNullProbe(record, mode, invalid);
	return record;
};
