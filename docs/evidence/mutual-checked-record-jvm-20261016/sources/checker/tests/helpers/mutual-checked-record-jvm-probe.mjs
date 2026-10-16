/**
 * Compile-time Kotlin nullability controls for the exact recursive Maven JAR.
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
import { saveLakeFile } from "./lake-workspace.mjs";
import { captureCorpusCompiler } from "./type-corpus-compiler.mjs";

/**
 * Use the same three call positions in the positive and negative sources.
 *
 * @param invalid - Substitute null for every non-null public parameter.
 */
export const mutualCheckedRecordKotlinNullSource = invalid => {
	assert.equal(typeof invalid, "boolean");
	const value = invalid ? "null" : "Envelope(java.math.BigInteger.ONE, java.math.BigInteger.ONE, Option.none())";
	const array = invalid ? "null" : "arrayOf(Option.none<Envelope>())";
	return "import org.leanbridge.mutualcheckedrecords.kotlin.*\n"
		+ `fun root() = Api.first(${value})\n`
		+ `fun aliases() = Api.groups(${array})\n`
		+ `fun active() = StepMore(${value})\n`;
};

/**
 * Require either one clean class or exactly three non-null diagnostics.
 *
 * @param record - Original compiler outcome and source identities.
 */
export const checkMutualCheckedRecordKotlinNullProbe = record => {
	const source = mutualCheckedRecordKotlinNullSource(record.invalid);
	assert.equal(record.source, source);
	assert.equal(record.sourceSha256, sha256(source));
	assert.match(record.archiveSha256, /^[a-f0-9]{64}$/u);
	assert.equal(record.run.stdout, "");
	if(!record.invalid)
	{
		assert.equal(record.run.code, 0, record.run.stderr);
		assert.equal(record.run.stderr, "");
		assert.deepEqual(Object.keys(record.outputs).sort(), [
			"META-INF/main.kotlin_module", "NullProbeKt.class"
		]);
		return;
	}
	assert.equal(record.run.code, 1); assert.deepEqual(record.outputs, {});
	const diagnostics = [...record.run.stderr.matchAll(
		/^NullProbe\.kt:(\d+):(\d+): error: \[([^\]]+)\] ([^\n]+)$/gmu
	)];
	assert.equal(diagnostics.length, 3, record.run.stderr);
	assert.deepEqual(diagnostics.map(([, line]) => Number(line)), [2, 3, 4]);
	for(const [, , column, code] of diagnostics)
	{
		assert.ok(Number(column) > 0); assert.equal(code, "NULL_FOR_NONNULL_TYPE");
	}
	assert.doesNotMatch(record.run.stderr, /warning:/u);
};

/**
 * Compile one positive or negative probe against authenticated package bytes.
 *
 * @param options - Archive, compiler and output selection.
 * @param options.root - Fresh task-owned probe directory.
 * @param options.archive - Original verified Maven JAR bytes.
 * @param options.archiveSha256 - Digest from the package-set receipt.
 * @param options.environment - Selected JDK and Kotlin toolchains.
 * @param options.invalid - Positive control or null-rejection probe.
 * @param options.output - Persistent directory for original records.
 */
export const runMutualCheckedRecordKotlinNullProbe = async options => {
	const { root, archive, archiveSha256, environment, invalid, output } = options;
	inspectFinContainerEdgeJvmArchive(archive, archiveSha256);
	await assert.rejects(access(root), { code: "ENOENT" });
	await mkdir(root, { recursive: true });
	const source = mutualCheckedRecordKotlinNullSource(invalid);
	await saveLakeFile(root, "component.jar", archive);
	await saveLakeFile(root, "NullProbe.kt", source);
	await mkdir(join(root, "classes"));
	const args = [
		"-Werror", "-jvm-target", "22", "-Xrender-internal-diagnostic-names"
		, "-cp", "component.jar", "NullProbe.kt", "-d", "classes"
	];
	const env = { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin"
		, JAVA_HOME: dirname(dirname(environment.LEAN_BRIDGE_JAVA)) };
	const run = await captureCorpusCompiler(
			environment.LEAN_BRIDGE_KOTLINC, args, root, env
	), outputs = {};
	for(const path of await nativeArtifactPaths(join(root, "classes")))
	{
		const bytes = await readFile(join(root, "classes", path));
		outputs[path] = { bytes: bytes.length, sha256: sha256(bytes) };
		await saveLakeFile(output, "classes/" + path, bytes);
	}
	const record = { invalid, args, environment: env, source
		, sourceSha256: sha256(source), archiveSha256, run, outputs };
	await saveLakeFile(output, "NullProbe.kt", source);
	await saveLakeFile(output, "record.json", canonicalJson(record));
	checkMutualCheckedRecordKotlinNullProbe(record);
	return record;
};
