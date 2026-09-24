/**
 * Compile recursive Kotlin metadata and execute the shared finite JVM engine.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { compileJvmSources, validateKotlinCompilation } from "../src/build/compile-jvm-sources.mjs";
import { generateCopiedKotlinGraphValues } from "../src/backends/jvm/copied-graph-kotlin.mjs";
import { jvmGraphConversionIr } from "./helpers/jvm-graph-conversion-fixture.mjs";
import { jvmDeepArrayGraphIr, jvmGraphNamingIr } from "./helpers/jvm-graph-values-fixture.mjs";
import { nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { javaCompilerOptions, kotlinCompilerOptions } from "./helpers/type-corpus-jvm-tools.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { assertJvmGraphMetadataSource } from "./helpers/jvm-graph-metadata-source.mjs";

test("Kotlin recursive values retain metadata, private traversal and a shared converter", () => {
	const ir = jvmGraphConversionIr(), before = structuredClone(ir), generated = generateCopiedKotlinGraphValues(ir);
	assert.deepEqual(ir, before); assert.deepEqual(generateCopiedKotlinGraphValues(ir), generated);
	const prefix = "src/main/kotlin/org/leanbridge/recursive/kotlin/";
	assert.match(generated.files[`${prefix}Tree.kt`], /sealed interface `Tree`/);
	assert.match(generated.files[`${prefix}WideNext.kt`], /class `WideNext` private constructor\(source: Builder\)/);
	assert.match(generated.files[`${prefix}Envelope.kt`], /kotlin.Array<kotlin.Array</);
	assert.match(generated.files[`${prefix}Scalars.kt`], /java.math.BigInteger/);
	assert.match(generated.files[`${prefix}Unit.kt`], /typealias Unit = `org`.`leanbridge`.`recursive`.Unit/);
	const descriptor = generated.files["src/main/java/org/leanbridge/recursive/_KotlinGraphTypes.java"];
	assert.match(descriptor, /_GraphTypes.Catalog CATALOG/);
	assert.doesNotMatch(Object.keys(generated.files).join("\n"), /_GraphRuntime.java|_GraphScalars.java|_GraphLayouts.java/);
	for(const path of generated.publicFiles) assert.doesNotMatch(generated.files[path], /bridgeField|java.lang.foreign|_GraphRuntime|_GraphTypes/);
});

test("Kotlin recursive values and finite converters execute with an independent metadata consumer", {
	skip: process.env.LEAN_BRIDGE_KOTLIN_GRAPH_TEST !== "1", timeout: 180_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-kotlin-graphs-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const generated = generateCopiedKotlinGraphValues(jvmGraphConversionIr()), model = generated.model;
	const files = { ...model.files, ...generated.files };
	for(const fixture of [jvmDeepArrayGraphIr, jvmGraphNamingIr])
	{
		const other = generateCopiedKotlinGraphValues(fixture());
		Object.assign(files, other.model.files, other.files);
	}
	const bridge = `package ${model.namespace};
public final class KotlinProbe {
    private KotlinProbe() { }
    public static Object copy(Class<?> expected, Object value) {
        int type = -1;
        for (var node : _KotlinGraphTypes.NODES) if (node.kind() > 1 && node.hostType() == expected) type = node.id();
        if (type < 0) throw new IllegalArgumentException("Unknown copied type");
        try (var scope = new _GraphRuntime.Scope(false)) {
            var raw = _GraphRuntime.write(_KotlinGraphTypes.CATALOG, type, value, scope);
            return _GraphRuntime.read(_KotlinGraphTypes.CATALOG, type, raw, scope);
        }
    }
}
`;
	const bridgePath = "src/main/java/org/leanbridge/recursive/KotlinProbe.java"; files[bridgePath] = bridge;
	files["binding-manifest.json"] = canonicalJson({ generator: "jvm-copied-graph-v1", namespace: model.namespace, kotlin: { namespace: generated.namespace } });
	const sourceHashes = {};
	for(const [path, source] of Object.entries(files))
	{ await saveLakeFile(root, path, source); sourceHashes[path] = sha256(source); }
	const environment = nativeFixtureEnvironment(["java", "kotlin"]);
	const compilers = await compileJvmSources({ root, files, environment });
	assert.ok(compilers.kotlin.options.includes("-Xuse-type-table"));
	validateKotlinCompilation(compilers.kotlin, model.namespace, { copiedGraph: true });
	assert.throws(() => validateKotlinCompilation(compilers.kotlin, model.namespace), /compiler contract/);
	const altered = structuredClone(compilers.kotlin); altered.options.pop();
	assert.throws(() => validateKotlinCompilation(altered, model.namespace, { copiedGraph: true }), /compiler contract/);
	const home = dirname(dirname(environment.LEAN_BRIDGE_KOTLINC)), stdlib = join(home, "lib/kotlin-stdlib.jar");
	const sources = Object.keys(files).filter(path => path.endsWith(".java"));
	await runCopied(environment.LEAN_BRIDGE_JAVAC, [...javaCompilerOptions, "-cp", `classes:${stdlib}`, "-d", "classes", ...sources], root);
	const probe = (await readFile("tests/fixtures/structured-types/recursive-kotlin-values.kt", "utf8"))
		.replace("// WIDE_SETTERS", Array.from({ length: 255 }, (_, index) => `    builder.field${index}(${index})`).join("\n"))
		.replace("// DEPTH_AND_SLOTS", `val deep = org.leanbridge.deep.kotlin.Link(emptyArray())
    verify(deep == deep); verify(deep.hashCode() == deep.hashCode())
    var arrayType: Class<*> = deep.value.javaClass; var dimensions = 0
    while (arrayType.isArray) { dimensions++; arrayType = arrayType.componentType }
    verify(dimensions == 32); verify(arrayType == java.lang.Long.TYPE)
    val slots = org.leanbridge.names.kotlin.Slots254(${Array.from({ length: 127 }, (_, index) => `${index}L`).join(", ")})
    verify(slots.item126 == 126L)
    val wideSlots = org.leanbridge.names.kotlin.Slots256.builder()
${Array.from({ length: 128 }, (_, index) => `    wideSlots.item${index}(${index}L)`).join("\n")}
    val snapshot = wideSlots.build(); wideSlots.item0(999L)
    verify(snapshot.item0 == 0L); verify(snapshot != wideSlots.build())
    val frame = org.leanbridge.names.kotlin.Frame(org.leanbridge.names.kotlin.Option.none(), 7L)
    verify(frame == frame); verify(frame.hashCode() == frame.hashCode())
    verify(org.leanbridge.names.kotlin.Entry() == org.leanbridge.names.kotlin.Entry())
    val entry: Any = org.leanbridge.names.kotlin.Entry(); verify(entry != org.leanbridge.names.kotlin.Cursor())`);
	await saveLakeFile(root, "Values.kt", probe);
	const launch = ["-cp", join(home, "lib/*"), "org.jetbrains.kotlin.cli.jvm.K2JVMCompiler", "-kotlin-home", home];
	await runCopied(environment.LEAN_BRIDGE_JAVA, [
		...launch, ...kotlinCompilerOptions
		, "-jdk-home", dirname(dirname(environment.LEAN_BRIDGE_JAVA))
		, "-cp", `classes:${stdlib}`, "-d", "consumer", "Values.kt"], root);
	const result = await runCopied(environment.LEAN_BRIDGE_JAVA, ["--enable-native-access=ALL-UNNAMED", "-Xss256k", "-cp", `classes:consumer:${stdlib}`, "ValuesKt"], root);
	assert.equal(result.stderr, ""); const observation = JSON.parse(result.stdout);
	assert.ok(observation.checks > 100); assert.equal(observation.nativeCalls, 0);
	const rejected = [
		["WrongField", "SpineNext(1)", "ARGUMENT_TYPE_MISMATCH"]
		, ["WrongScalar", 'SpineLeaf("bad")', "ARGUMENT_TYPE_MISMATCH"]
		, ["NullField", "SpineNext(null)", "NULL_FOR_NONNULL_TYPE"]
		, ["NullOption", "Option.some<Tree>(null)", "NULL_FOR_NONNULL_TYPE"]
		, ["WrongOption", "val value: Option<Tree> = Option.some(SpineLeaf(1))", "TYPE_MISMATCH"]
		, ["WrongResult", 'val value: Result<Tree, String> = Result.ok("bad")', "TYPE_MISMATCH"]
		, ["ImmutableField", "SpineLeaf(1).value = 2", "VAL_REASSIGNMENT"]
		, ["WideField", 'WideNext.builder().field0("bad")', "ARGUMENT_TYPE_MISMATCH"]
		, ["PrivateTraversal", "SpineLeaf(1).bridgeField(0)", "UNRESOLVED_REFERENCE"]
		, ["PrivateHelper", "org.leanbridge.recursive._KotlinGraphValueOps.hash(SpineLeaf(1))", "INVISIBLE_REFERENCE"]
		, ["NominalLanguage", "val value: Tree = org.leanbridge.recursive.TreeBranch(emptyArray())", "INITIALIZER_TYPE_MISMATCH"]
		, ["AliasWrapper", "val value: Forest? = null", "UNRESOLVED_REFERENCE"]
	];
	const negativeHashes = {};
	for(const [name, expression] of rejected)
	{
		const source = `import org.leanbridge.recursive.kotlin.*\nfun invalid${name}() { ${expression} }\n`;
		await saveLakeFile(root, `negative/${name}.kt`, source); negativeHashes[name] = sha256(source);
	}
	let failure;
	try
	{
		await runCopied(environment.LEAN_BRIDGE_JAVA, [
			...launch, ...kotlinCompilerOptions
			, "-jdk-home", dirname(dirname(environment.LEAN_BRIDGE_JAVA))
			, "-cp", `classes:${stdlib}`, "-d", "invalid"
			, ...rejected.map(([name]) => `negative/${name}.kt`)], root);
	} catch(error)
	{ failure = error; }
	assert.ok(failure, "Invalid consumers must fail compilation");
	const diagnostics = failure.details.stderr.split(/\\n|\n/).filter(line => line.includes("error:"));
	for(const line of diagnostics) assert.match(line, /^negative\/[A-Za-z]+\.kt:2:\d+: error: \[[A-Z_]+\]/);
	for(const [name, , diagnostic] of rejected)
		assert.ok(diagnostics.some(line => line.includes(`negative/${name}.kt:`) && line.includes(`[${diagnostic}]`)), `${name}: ${failure.message}`);
	await saveLakeFile("build/recursive", "kotlin-values.json", canonicalJson({
		schemaVersion: 1, compiledLean: false, installedPackage: false
		, observation, sourceHashes, probeSha256: sha256(probe), compilers
		, rejections: rejected.map(([name, , diagnostic]) => ({ name, diagnostic, sourceSha256: negativeHashes[name] })) }));
});

test("recorded Kotlin recursive metadata checks bind generated code and compiler rejections", async () => {
	const record = JSON.parse(await readFile("docs/evidence/kotlin-recursive-values-20260923.json", "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	for(const [path, hash] of Object.entries(record.sourceHashes)) await assertJvmGraphMetadataSource(path, hash);
	assert.equal(sha256(record.log.text), record.log.sha256);
	assert.match(record.log.text, /# pass 1\n# fail 0\n# cancelled 0\n# skipped 0/);
	const { report } = record;
	assert.equal(record.reportSha256, sha256(canonicalJson(report)));
	assert.equal(report.compiledLean, false); assert.equal(report.installedPackage, false);
	assert.deepEqual(report.observation, { checks: 447, maximumSpineDepth: 127, nativeCalls: 0, wideFields: 256 });
	assert.equal(report.rejections.length, 12);
	assert.equal(new Set(report.rejections.map(item => item.name)).size, 12);
	for(const item of report.rejections) assert.match(item.sourceSha256, /^[a-f0-9]{64}$/);
	validateKotlinCompilation(report.compilers.kotlin, "org.leanbridge.recursive", { copiedGraph: true });
	for(const fixture of [jvmGraphConversionIr, jvmDeepArrayGraphIr, jvmGraphNamingIr])
	{
		const generated = generateCopiedKotlinGraphValues(fixture());
		for(const [path, source] of Object.entries({ ...generated.model.files, ...generated.files }))
			assert.equal(report.sourceHashes[path], sha256(source), path);
	}
});
