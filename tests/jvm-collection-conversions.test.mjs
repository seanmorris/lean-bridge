/**
 * Execute the generated converters in isolation before native package builds.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { compileCopiedJvmModel } from "../src/backends/jvm/copied-model.mjs";
import { generateCopiedJvmPackage } from "../src/backends/jvm/copied-values.mjs";
import { copiedJvmConversions, copiedJvmHelpers } from "../src/backends/jvm/copied-conversions.mjs";
import { collectionReviewedIr } from "./helpers/collection-fixture.mjs";
import { nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { javaCompilerOptions } from "./helpers/type-corpus-jvm-tools.mjs";

test("generated JVM collection converters reject malformed values without native calls", { skip: process.env.LEAN_BRIDGE_JVM_CONVERSIONS_TEST !== "1", timeout: 120_000 }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-jvm-collection-conversions-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const ir = collectionReviewedIr(), model = compileCopiedJvmModel(ir), original = generateCopiedJvmPackage(ir);
	const prefix = "src/main/java/org/leanbridge/collections/", files = { ...original };
	files[`${prefix}ConversionProbe.java`] = `package ${model.namespace};
import static java.lang.foreign.ValueLayout.*;
import java.lang.foreign.*;
import java.math.BigInteger;
import java.nio.CharBuffer;
import java.nio.charset.*;
import java.util.Objects;
final class ConversionProbe {
    private ConversionProbe() { }
${copiedJvmHelpers}
${copiedJvmConversions(model)}
}
`;
	const program = await readFile("tests/fixtures/collection-consumers/jvm-conversions.java", "utf8");
	files[`${prefix}Conversions.java`] = program;
	const sources = Object.keys(files).filter(path => path.endsWith(".java"));
	for(const path of sources) await saveLakeFile(root, path, files[path]);
	const environment = nativeFixtureEnvironment(["java"]);
	await runCopied(environment.LEAN_BRIDGE_JAVAC, [...javaCompilerOptions, "-d", "classes", ...sources], root);
	const copy = name => model.surface.copies.find(copy => !copy.aggregate && copy.scalarName === name);
	const scalar = name => model.surface.copies.find(copy => copy.scalarName === name);
	const fn = name => model.surface.copy(model.surface.functions.find(fn => fn.publicName === name).declaration.result.type);
	const indices = [copy("unit"), copy("bool"), copy("char"), scalar("string"), scalar("bytes"), scalar("nat"), scalar("int"), fn("arrayReverseUint32").element, fn("deep")].map(copy => String(copy.index));
	const result = await runCopied(environment.LEAN_BRIDGE_JAVA, ["--enable-native-access=ALL-UNNAMED", "-cp", "classes", `${model.namespace}.Conversions`, ...indices], root);
	assert.equal(result.stderr, ""); const observation = JSON.parse(result.stdout);
	assert.ok(observation.checks > 500); assert.ok(observation.rejected > 500); assert.equal(observation.nativeCalls, 0);
	assert.deepEqual(original, generateCopiedJvmPackage(ir));
	await saveLakeFile("build/collections", "jvm-conversions.json", canonicalJson({ schemaVersion: 1
		, kind: "jvm-conversion-preflight"
		, compiledLean: false
		, installedPackage: false
		, probeSourceSha256: sha256(program)
		, generatedSourceHashes: Object.fromEntries(Object.entries(original).filter(([path]) => path.endsWith(".java")).map(([path, source]) => [path, sha256(source)]))
		, converterSourceSha256: sha256(files[`${prefix}ConversionProbe.java`])
		, observation }));
	t.diagnostic(`${observation.checks} converter checks, ${observation.rejected} malformed values rejected, no native library loaded`);
});
