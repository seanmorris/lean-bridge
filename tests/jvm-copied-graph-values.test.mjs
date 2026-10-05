/**
 * Compile finite recursive Java values without loading Lean or a native adapter.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateCopiedJvmGraphValues } from "../src/backends/jvm/copied-graph-values.mjs";
import { compileCopiedJvmModel } from "../src/backends/jvm/copied-model.mjs";
import { nativeRecursiveReviewedIr } from "./helpers/native-recursive-reviewed.mjs";
import { jvmLinkedGraphIr, jvmAliasGraphIr, jvmDeepArrayGraphIr, jvmGraphNamingIr } from "./helpers/jvm-graph-values-fixture.mjs";
import { nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { javaCompilerOptions } from "./helpers/type-corpus-jvm-tools.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { assertJvmGraphMetadataSource } from "./helpers/jvm-graph-metadata-source.mjs";

test("Java recursive declarations retain nominal recursion, transparent aliases and checked wide builders", () => {
	const ir = nativeRecursiveReviewedIr(), before = structuredClone(ir), model = generateCopiedJvmGraphValues(ir);
	assert.deepEqual(ir, before); assert.deepEqual(generateCopiedJvmGraphValues(ir), model);
	const reversed = structuredClone(ir); reversed.types.reverse(); assert.deepEqual(generateCopiedJvmGraphValues(reversed), model);
	assert.equal(model.namespace, "org.leanbridge.recursive"); assert.equal(model.functions.length, 18); assert.equal(model.types.length, 38);
	const source = name => model.files[`src/main/java/org/leanbridge/recursive/${name}.java`];
	assert.match(source("SpineNext"), /public record SpineNext\(Spine value\) implements Spine/);
	assert.match(source("TreeBranch"), /public record TreeBranch\(Tree\[\] children\)/);
	assert.match(source("EmptyRecord"), /public record EmptyRecord\(\)/);
	assert.match(source("Scalars"), /java.math.BigInteger natural/);
	assert.match(source("WideNext"), /public final class WideNext implements Wide/);
	assert.match(source("WideNext"), /public Builder field254\(int value\)/);
	assert.match(source("WideNext"), /public Builder child\(Wide value\)/);
	assert.match(source("WideNext"), /assigned.cardinality\(\) != 256/);
	assert.equal(model.aliases.find(alias => alias.name === "Forest").managedType, "Tree[]");
	assert.equal(model.aliases.find(alias => alias.name === "TreeAlias").managedType, "Tree");
	assert.equal(model.records.filter(record => record.builder).length, 1);
	assert.doesNotMatch(Object.values(model.files).join("\n"), /java.lang.foreign|System.load|lean_object|constructor_tag|\bnative\s+\w+\(/);
	assert.throws(() => compileCopiedJvmModel(ir), /recursive|acyclic|unsupported/i);
});

test("Java graph names reject collisions and preserve escaped fields and constructors", () => {
	for(const name of ["GraphValues", "Api", "Option", "Spine", "String", "Builder", "Class"])
	{
		const ir = nativeRecursiveReviewedIr(); ir.types.find(type => type.name === "Scalars").name = name;
		assert.throws(() => generateCopiedJvmGraphValues(ir), /reserved|duplicate|collision|invalid nominal name/i);
	}
	for(const name of ["equals", "getClass", "hashCode", "bridgeField", "builder", "java"])
	{
		const ir = jvmLinkedGraphIr(); ir.types[0].fields[0].name = name;
		assert.throws(() => generateCopiedJvmGraphValues(ir), /reserved|duplicate/);
	}
	const distinct = nativeRecursiveReviewedIr();
	distinct.types.find(type => type.name === "Marker").cases[0].name = "unit_";
	distinct.types.find(type => type.name === "Marker").cases[1].fields[0].name = "class";
	const files = generateCopiedJvmGraphValues(distinct).files;
	assert.match(files["src/main/java/org/leanbridge/recursive/MarkerUnit_.java"], /record MarkerUnit_\(\)/);
	assert.match(files["src/main/java/org/leanbridge/recursive/MarkerUnit.java"], /Unit class_/);
	const collision = jvmLinkedGraphIr(); collision.types[0].fields[0].name = "class"; collision.types[0].fields[1].name = "class_";
	assert.throws(() => generateCopiedJvmGraphValues(collision), /duplicate/);
});

test("Java aliases reject exponential expansion without inventing nominal wrappers", () => {
	const chain = generateCopiedJvmGraphValues(jvmAliasGraphIr(700, "alias"));
	assert.equal(chain.aliases.length, 700); assert.equal(chain.types.length, 1);
	assert.equal(chain.aliases.at(-1).managedType, "long");
	assert.ok(Object.values(chain.files).join("\n").length < 20000);
	assert.throws(() => generateCopiedJvmGraphValues(jvmAliasGraphIr(700)), /expanded Java structural type exceeds/);
	assert.throws(() => generateCopiedJvmGraphValues(jvmAliasGraphIr(34, "array")), /expanded Java structural type exceeds/);
	assert.equal(generateCopiedJvmGraphValues(jvmAliasGraphIr(33, "array")).aliases.find(alias => alias.name === "Alias32").managedType, `long${"[]".repeat(32)}`);
	const repeated = jvmAliasGraphIr(13), record = jvmLinkedGraphIr().types[0];
	repeated.types.push({ ...record, id: "lean:Recursive.Large", name: "Large"
		, fields: Array.from({ length: 256 }, (_, index) => ({ ...record.fields[0], name: `item${index}`, type: { kind: "named", id: "lean:Recursive.Alias12" } })) });
	assert.throws(() => generateCopiedJvmGraphValues(repeated), /generated Java declarations exceed 4 MiB/);
	const slots = generateCopiedJvmGraphValues(jvmGraphNamingIr());
	assert.equal(slots.records.find(record => record.name === "Slots254").builder, false);
	assert.equal(slots.records.find(record => record.name === "Slots256").builder, true);
});

test("Java recursive types execute bounded equality, hashing, patterns and wide constructors", {
	skip: process.env.LEAN_BRIDGE_JVM_GRAPH_TEST !== "1", timeout: 180_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-jvm-graph-values-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const sourceHashes = {}, sources = [];
	for(const fixture of [nativeRecursiveReviewedIr, jvmLinkedGraphIr, jvmDeepArrayGraphIr, jvmGraphNamingIr])
		for(const [path, source] of Object.entries(generateCopiedJvmGraphValues(fixture()).files))
		{ await saveLakeFile(root, path, source); sources.push(path); sourceHashes[path] = sha256(source); }
	const environment = nativeFixtureEnvironment(["java"]);
	const probe = (await readFile("tests/fixtures/structured-types/recursive-values.java", "utf8"))
		.replace("// WIDE_SETTERS", Array.from({ length: 255 }, (_, index) => `        builder.field${index}(${index});`).join("\n"));
	await saveLakeFile(root, "RecursiveValues.java", probe);
	await runCopied(environment.LEAN_BRIDGE_JAVAC, [...javaCompilerOptions, "-d", "classes", ...sources, "RecursiveValues.java"], root);
	const result = await runCopied(environment.LEAN_BRIDGE_JAVA, ["-Xss256k", "-cp", "classes", "RecursiveValues"], root);
	assert.equal(result.stderr, ""); const observation = JSON.parse(result.stdout);
	assert.ok(observation.checks >= 500); assert.equal(observation.wideFields, 256);
	assert.equal(observation.nativeCalls, 0); assert.equal(observation.cycleRejections, 9);
	const rejections = [
		["abstract-family", "Object value = new Tree();", "abstract; cannot be instantiated"]
		, ["wrong-field", "Object value = new SpineNext(1);", "incompatible types"]
		, ["wrong-scalar", 'Object value = new SpineLeaf("1");', "incompatible types"]
		, ["immutable-field", "SpineLeaf value = new SpineLeaf(1); value.value = 2;", "private access"]
		, ["wrong-option", "Option<Tree> value = Option.some(new SpineLeaf(1));", "incompatible bounds"]
		, ["wrong-result", 'Result<Tree, String> value = Result.ok("bad");', "incompatible bounds"]
		, ["unexported-alias", "Forest value = null;", "cannot find symbol"]
		, ["sealed-constructor", "class Fake extends TreeBranch {}", "final TreeBranch"]
		, ["closed-family", "class Fake implements Tree {}", "sealed class"]
		, ["private-traversal", "Object value = new SpineLeaf(1).bridgeField(0);", "cannot be accessed"]
		, ["wrong-wide-field", 'Object value = WideNext.builder().field0("bad");', "incompatible types"]
	];
	for(const [name, source, diagnostic] of rejections)
	{
		await saveLakeFile(root, "Invalid.java", `import org.leanbridge.recursive.*;\nclass Invalid { void check() { ${source} } }\n`);
		let failure;
		try
		{ await runCopied(environment.LEAN_BRIDGE_JAVAC, [...javaCompilerOptions, "-cp", "classes", "Invalid.java"], root); }
		catch(error)
		{ failure = error; }
		assert.ok(failure, `Must reject ${name}`); assert.ok(failure.message.includes(diagnostic), `${name}: ${failure.message}`);
	}
	await saveLakeFile("build/recursive", "jvm-values.json", canonicalJson({ schemaVersion: 1
		, compiledLean: false
		, installedPackage: false
		, observation
		, rejections: rejections.map(([name, , diagnostic]) => ({ name, diagnostic }))
		, probeSha256: sha256(probe)
		, generatedSourceHashes: sourceHashes }));
});

test("Java graph declaration execution is required in downstream CI", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	assert.ok(workflow.includes("LEAN_BRIDGE_JVM_GRAPH_TEST=1 node --test tests/jvm-copied-graph-values.test.mjs"));
	assert.ok(workflow.includes("test -s build/recursive/jvm-values.json"));
	assert.ok(workflow.includes("            build/recursive/jvm-values.json\n"));
});

test("recorded Java declaration checks bind current sources and exact generated values", async () => {
	const record = JSON.parse(await readFile("docs/evidence/jvm-recursive-values-20260923.json"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(sha256(record.log.text), record.log.sha256);
	assert.match(record.log.text, /# pass 1\n# fail 0\n/); assert.match(record.log.text, /# skipped 0\n/);
	assert.equal(record.report.compiledLean, false); assert.equal(record.report.installedPackage, false);
	for(const [path, hash] of Object.entries(record.sourceHashes)) await assertJvmGraphMetadataSource(path, hash);
	const hashes = {};
	for(const fixture of [nativeRecursiveReviewedIr, jvmLinkedGraphIr, jvmDeepArrayGraphIr, jvmGraphNamingIr])
		for(const [path, source] of Object.entries(generateCopiedJvmGraphValues(fixture()).files)) hashes[path] = sha256(source);
	assert.deepEqual(record.report.generatedSourceHashes, hashes);
	const probe = (await readFile("tests/fixtures/structured-types/recursive-values.java", "utf8"))
		.replace("// WIDE_SETTERS", Array.from({ length: 255 }, (_, index) => `        builder.field${index}(${index});`).join("\n"));
	assert.equal(record.report.probeSha256, sha256(probe));
	assert.ok(record.report.observation.checks >= 900); assert.equal(record.report.observation.wideFields, 256);
	assert.equal(record.report.observation.cycleRejections, 9); assert.equal(record.report.rejections.length, 11);
	assert.equal(record.report.observation.nativeCalls, 0);
});
