/**
 * Typed recursive JVM entry points and authenticated lazy loading.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateCopiedJvmGraphPackage, compileCopiedJvmGraphPackageModel } from "../src/backends/jvm/copied-graph-package.mjs";
import { compileJvmSources } from "../src/build/compile-jvm-sources.mjs";
import { jvmGraphConversionIr } from "./helpers/jvm-graph-conversion-fixture.mjs";
import { jvmGraphCollisionIr } from "./helpers/jvm-graph-converter-types.mjs";
import { nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { javaCompilerOptions, kotlinCompilerOptions } from "./helpers/type-corpus-jvm-tools.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { auditManagedBindingPackage } from "../src/backends/managed/package-audit.mjs";
import { compileNativeGraphProjection } from "../src/build/native-graph-projection.mjs";
import { assertJvmGraphPackageReports } from "./helpers/jvm-graph-receipt.mjs";
import { assertAdministrativeSourceUpdate } from "./helpers/test-registration-history.mjs";

const loadingEvidence = () => ({ componentId: "recursive@1.0.0"
	, library: "librecursive.so"
	, runtimeIdentity: "1".repeat(64), componentReceiptSha256: "2".repeat(64)
	, libraries: Object.fromEntries(["librecursive.so", "librecursive_component.so", "libleanshared.so", "liblean_bridge_native.so"].map(name => [name, "3".repeat(64)])) });

test("recursive JVM APIs preserve typed Java and Kotlin surfaces over one runtime", () => {
	const ir = jvmGraphConversionIr(), before = structuredClone(ir);
	const files = generateCopiedJvmGraphPackage(ir), model = compileCopiedJvmGraphPackageModel(ir);
	assert.deepEqual(ir, before); assert.deepEqual(generateCopiedJvmGraphPackage(ir), files);
	auditManagedBindingPackage(ir, files, "jvm");
	const java = "src/main/java/org/leanbridge/recursive/", kotlin = "src/main/kotlin/org/leanbridge/recursive/";
	assert.match(files[`${java}Api.java`], /public static Tree tree\(Tree value0\)/);
	assert.match(files[`${java}Api.java`], /new Object\[\] \{ value0 \}/);
	assert.match(files[`${kotlin}kotlin/Api.kt`], /fun `tree`\(`value0`: `org`.`leanbridge`.`recursive`.`kotlin`.`Tree`\)/);
	assert.match(files[`${kotlin}_KotlinGraphApiCalls.kt`], /_GraphCalls.call\(_KotlinGraphTypes.CATALOG/);
	const calls = files[`${java}_GraphCalls.java`];
	assert.ok(calls.indexOf("_GraphRuntime.validate(") < calls.indexOf("_GraphNative.resolve()"));
	assert.equal(Object.keys(files).filter(path => path.endsWith("/_GraphRuntime.java")).length, 1);
	const manifest = JSON.parse(files["binding-manifest.json"]);
	assert.deepEqual(manifest.copiedGraph, { schemaVersion: 1, layoutSha256: model.layoutSha256 });
	assert.equal(manifest.kotlin.metadataVersion, "2.2.0");
	for(const path of manifest.publicFiles) assert.doesNotMatch(files[path], /java.lang.foreign/);
});

test("Maven graph admission checks both JVM projections without adding a public C target", () => {
	const ir = jvmGraphConversionIr(), model = compileNativeGraphProjection(ir, ["maven"]);
	assert.equal(model.namespace, "org.leanbridge.recursive"); assert.equal(model.kotlin.namespace, "org.leanbridge.recursive.kotlin");
	assert.equal(compileNativeGraphProjection(ir, ["nuget", "maven"]).prefix, "recursive");
	assert.equal(compileNativeGraphProjection(ir, ["maven", "php-native"]).prefix, "recursive");
	for(const targets of [["maven", "wit-wasi"]])
		assert.throws(() => compileNativeGraphProjection(ir, targets), { code: "native-graph-projection-unavailable" });
	const files = generateCopiedJvmGraphPackage(jvmGraphCollisionIr());
	auditManagedBindingPackage(jvmGraphCollisionIr(), files, "jvm");
	const path = "src/main/java/org/leanbridge/recursive/MemorySegment.java";
	assert.throws(() => auditManagedBindingPackage(jvmGraphCollisionIr(), { ...files, [path]: files[path] + "\n// source drift\n" }, "jvm"), { code: "private-ffi-public" });
	const manifest = JSON.parse(files["binding-manifest.json"]); manifest.publicFiles.pop();
	assert.throws(() => auditManagedBindingPackage(jvmGraphCollisionIr(), { ...files, "binding-manifest.json": JSON.stringify(manifest) }, "jvm"), { code: "private-ffi-public" });
});

test("recursive Maven packages install offline and execute Java and Kotlin without author tools", {
	skip: process.env.LEAN_BRIDGE_JVM_GRAPH_INSTALLED_TEST !== "1"
	, timeout: 1_200_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-jvm-graph-installed-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const { checkJvmGraphPackages } = await import("./helpers/jvm-graph-packages.mjs");
	const report = await checkJvmGraphPackages(root, message => t.diagnostic(message));
	assert.deepEqual(report.observations.map(run => [run.reviewed, run.profile]), [[false, "java"], [false, "kotlin"], [true, "java"], [true, "kotlin"]]);
	await saveLakeFile("build/recursive", "jvm-packages.json", canonicalJson(report));
});

test("independent recursive Maven builds reproduce the installed Java and Kotlin artifacts", {
	skip: process.env.LEAN_BRIDGE_JVM_GRAPH_REPRO_TEST !== "1", timeout: 1_200_000
}, async t => {
	const original = JSON.parse(await readFile("build/recursive/jvm-packages.json", "utf8"));
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-jvm-graph-repro-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const { checkJvmGraphReproducibility } = await import("./helpers/jvm-graph-packages.mjs");
	const report = await checkJvmGraphReproducibility(root, original, message => t.diagnostic(message));
	await saveLakeFile("build/recursive", "jvm-reproducibility.json", canonicalJson(report));
});

for(const scenario of ["Composition", "Conflicts"])
	test(`recursive Maven installed packages verify shared-runtime ${scenario.toLowerCase()}`, {
		skip: process.env.LEAN_BRIDGE_JVM_GRAPH_LOADING_TEST !== "1"
		, timeout: 1_200_000
	}, async t => {
		const root = await mkdtemp(join(tmpdir(), `lean-bridge-jvm-graph-${scenario.toLowerCase()}-`));
		t.after(() => rm(root, { recursive: true, force: true }));
		const helpers = await import("./helpers/jvm-graph-loading.mjs");
		const report = await helpers[`checkJvmGraph${scenario}`](root, message => t.diagnostic(message));
		await saveLakeFile("build/recursive", `jvm-${scenario.toLowerCase()}.json`, canonicalJson(report));
	});

test("recursive JVM loaders require pinned asset identities and safe parameter names", () => {
	const ir = jvmGraphConversionIr(), evidence = loadingEvidence();
	const files = generateCopiedJvmGraphPackage(ir, evidence), source = files["src/main/java/org/leanbridge/recursive/_GraphNative.java"];
	assert.ok(source.indexOf("verify(root.resolve(") < source.indexOf("SymbolLookup.libraryLookup("));
	assert.match(source, /Conflicting builds of the same Lean component/);
	assert.match(source, /Incompatible Lean runtime identities/);
	assert.match(source, /volatile _GraphRuntime.Target\[\]/);
	assert.ok(source.indexOf("var clear = downcall(") < source.indexOf("targets = resolved"));
	for(const change of [
		{ componentId: "wrong" }, { runtimeIdentity: "x" }
		, { componentReceiptSha256: "x" }
		, { library: "../librecursive.so" }
		, { libraries: { ...evidence.libraries, "../outside.so": "3".repeat(64) } }
		, { libraries: { "librecursive.so": "3".repeat(64) } }])
		assert.throws(() => generateCopiedJvmGraphPackage(ir, { ...evidence, ...change }), /evidence|identities/);
	const escaped = structuredClone(ir); escaped.declarations[0].parameters[0].name = "class";
	assert.match(generateCopiedJvmGraphPackage(escaped)["src/main/java/org/leanbridge/recursive/Api.java"], /Tree tree\(Tree class_\)/);
	const collision = structuredClone(ir), fn = collision.declarations.find(item => item.parameters.length === 2);
	fn.parameters[0].name = "class"; fn.parameters[1].name = "class_";
	assert.throws(() => compileCopiedJvmGraphPackageModel(collision), /distinct ASCII/);
});

test("recursive Maven acceptance remains required in CI with retained reports", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	for(const command of [
		"LEAN_BRIDGE_KOTLIN_GRAPH_TEST=1 node --test tests/jvm-copied-graph-kotlin.test.mjs"
		, "LEAN_BRIDGE_JVM_GRAPH_PACKAGE_TEST=1 LEAN_BRIDGE_JVM_GRAPH_INSTALLED_TEST=1 node --test tests/jvm-graph-package.test.mjs"
		, "LEAN_BRIDGE_JVM_GRAPH_REPRO_TEST=1 LEAN_BRIDGE_JVM_GRAPH_LOADING_TEST=1 node --test tests/jvm-graph-package.test.mjs"
	]){
		assert.ok(workflow.includes(`          ${command}\n`));
		assert.ok(workflow.includes(`consumer_command="$consumer_command && ${command}"`));
	}
	for(const name of ["kotlin-values", "jvm-package-cold", "jvm-packages", "jvm-reproducibility", "jvm-composition", "jvm-conflicts"])
	{
		assert.ok(workflow.includes(`test -s build/recursive/${name}.json`));
		assert.ok(workflow.includes(`            build/recursive/${name}.json\n`));
	}
});

test("recursive Maven package evidence binds installed archives and rejects incomplete matrices", async () => {
	const record = JSON.parse(await readFile("docs/evidence/jvm-recursive-packages-20260923.json", "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.finalAcceptance, false);
	assert.deepEqual(record.pending, ["shared-backend regressions", "source-lineage verification", "complete repository suite"]);
	for(const [path, hash] of Object.entries(record.sourceHashes)) await assertAdministrativeSourceUpdate(path, hash);
	for(const [name, report] of Object.entries(record.reports))
		assert.equal(record.reportHashes[name], sha256(canonicalJson(report)));
	assertJvmGraphPackageReports(record.reports);
	for(const [name, log] of Object.entries(record.logs))
	{
		assert.equal(log.sha256, sha256(log.text));
		assert.match(log.text, new RegExp(`# pass ${name === "loading" ? 2 : 1}\\n# fail 0\\n# cancelled 0\\n# skipped 0`));
	}
	for(const name of ["composition", "conflicts"])
		for(const [path, hash] of Object.entries(record.reports[name].sourceHashes))
			assert.equal(sha256(await readFile(`tests/fixtures/structured-types/${path}`)), hash, path);
	for(const profile of ["java", "kotlin"])
	{
		const guide = await readFile(`docs/consume/${profile}.md`, "utf8");
		const section = guide.split("### Recursive values\n")[1].split("\n### ")[0];
		const source = section.match(new RegExp("```" + profile + "\\n([^]*?)\\n```"))[1] + "\n";
		for(const run of record.reports.packages.observations.filter(run => run.profile === profile))
			assert.equal(run.documentation.sourceSha256, sha256(source));
	}
	for(const change of [
		reports => { reports.packages.observations.pop(); }
		, reports => { reports.packages.observations[0].jvm.archiveSha256 = "0".repeat(64); }
		, reports => { reports.packages.observations[0].tamperRejections.pop(); }
		, reports => { reports.packages.observations[1].documentation.stdout = "wrong"; }
		, reports => { reports.reproducibility.observations[0].package.artifacts[0].sha256 = "0".repeat(64); }
		, reports => { reports.composition.scenarios[0].mappings["libleanshared.so"] = "0".repeat(64); }
		, reports => { reports.conflicts.scenarios.pop(); }
		, reports => { reports.cold.observations[1].results.kotlin = "wrong"; }
	]){
		const altered = structuredClone(record.reports); change(altered);
		// Rebind the outer report hash so these checks exercise its contents.
		altered.reproducibility.originalReportSha256 = sha256(canonicalJson(altered.packages));
		assert.throws(() => assertJvmGraphPackageReports(altered));
	}
});

test("recursive Java and Kotlin package APIs compile and validate before cold native loading", {
	skip: process.env.LEAN_BRIDGE_JVM_GRAPH_PACKAGE_TEST !== "1", timeout: 300_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-jvm-graph-package-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = nativeFixtureEnvironment(["java", "kotlin"]), observations = [];
	const home = dirname(dirname(environment.LEAN_BRIDGE_KOTLINC)), stdlib = join(home, "lib/kotlin-stdlib.jar");
	const launch = ["-cp", join(home, "lib/*"), "org.jetbrains.kotlin.cli.jvm.K2JVMCompiler", "-kotlin-home", home];
	for(const collision of [false, true])
	{
		const ir = collision ? jvmGraphCollisionIr() : jvmGraphConversionIr(), unit = { kind: "primitive", name: "unit" };
		ir.declarations[0].parameters[0].name = "org";
		const joined = ir.declarations.find(item => item.parameters.length === 2);
		joined.parameters[0].name = "_GraphCalls"; joined.parameters[1].name = "_GraphTypes";
		ir.declarations.find(item => item.name === "spine").parameters[0].name = "kotlin";
		const fn = structuredClone(ir.declarations[0]);
		Object.assign(fn, { id: "lean:Recursive.touch", name: "touch", overloadKey: "touch" });
		fn.parameters[0].name = "class"; fn.parameters[0].type = unit; fn.result.type = unit; ir.declarations.push(fn);
		const files = generateCopiedJvmGraphPackage(ir, collision ? loadingEvidence() : null);
		const directory = join(root, collision ? "collision" : "ordinary"), sourceHashes = {};
		for(const [path, contents] of Object.entries(files))
		{ await saveLakeFile(directory, path, contents); sourceHashes[path] = sha256(contents); }
		const compilers = await compileJvmSources({ root: directory, files, environment });
		await runCopied(environment.LEAN_BRIDGE_JAVAC, [...javaCompilerOptions, "-cp", `classes:${stdlib}`, "-d", "classes", ...Object.keys(files).filter(path => path.endsWith(".java"))], directory);
		const tree = collision ? "MemorySegment" : "Tree", spine = collision ? "Arena" : "Spine";
		const java = `import org.leanbridge.recursive.*;
public final class ColdJava {
    private static int checks;
    private static void reject(Runnable call) { try { call.run(); } catch (IllegalArgumentException error) { checks++; return; } throw new AssertionError("Invalid input must reject before loading"); }
    public static void main(String[] arguments) {
        reject(() -> Api.tree(null));
        reject(() -> Api.joinTrees(new ${tree}Branch(new ${tree}[0]), null));
        ${tree}[] children = new ${tree}[1]; var cycle = new ${tree}Branch(children); children[0] = cycle;
        reject(() -> Api.tree(cycle));
        ${spine} deep = new ${spine}Leaf(1); for (int index = 0; index < 130; index++) deep = new ${spine}Next(deep);
        final ${spine} value = deep; reject(() -> Api.spine(value));
        reject(() -> Api.wordMax(java.math.BigInteger.ONE.negate()));
        if (System.getProperties().keySet().stream().anyMatch(key -> key.toString().startsWith("lean.bridge.jvm.native-library-v1."))) throw new AssertionError("Cold validation attempted loading");
        try { Api.touch(Unit.INSTANCE); throw new AssertionError("Valid call must reach missing assets"); }
        catch (${collision ? "LeanBridgeException" : "IllegalStateException"} error) { checks++; }
        if (checks != 6) throw new AssertionError(checks);
        System.out.println("cold-java-ok:" + checks);
    }
}
`;
		const kotlin = `import org.leanbridge.recursive.kotlin.*
import org.leanbridge.recursive.kotlin.Unit
private var checks = 0
private fun reject(call: () -> kotlin.Unit) { try { call() } catch (_: IllegalArgumentException) { checks++; return }; error("Invalid input must reject before loading") }
fun main() {
    val children = arrayOf<${tree}>(${tree}Branch(emptyArray()))
    val cycle = ${tree}Branch(children); children[0] = cycle
    reject { Api.tree(cycle) }
    var deep: ${spine} = ${spine}Leaf(1); repeat(130) { deep = ${spine}Next(deep) }
    reject { Api.spine(deep) }
    reject { Api.wordMax(java.math.BigInteger.ONE.negate()) }
    check(System.getProperties().keys.none { it.toString().startsWith("lean.bridge.jvm.native-library-v1.") })
    try { Api.touch(class_ = Unit.INSTANCE); error("Valid call must reach missing assets") }
    catch (_: ${collision ? "LeanBridgeException" : "IllegalStateException"}) { checks++ }
    check(checks == 4); println("cold-kotlin-ok:$checks")
}
`;
		await saveLakeFile(directory, "ColdJava.java", java); await saveLakeFile(directory, "ColdKotlin.kt", kotlin);
		await runCopied(environment.LEAN_BRIDGE_JAVAC, [...javaCompilerOptions, "-cp", "classes", "-d", "consumer", "ColdJava.java"], directory);
		await runCopied(environment.LEAN_BRIDGE_JAVA, [...launch, ...kotlinCompilerOptions, "-jdk-home", dirname(dirname(environment.LEAN_BRIDGE_JAVA)), "-cp", `classes:${stdlib}`, "-d", "consumer", "ColdKotlin.kt"], directory);
		const results = {};
		for(const [profile, main] of [["java", "ColdJava"], ["kotlin", "ColdKotlinKt"]])
		{
			const result = await runCopied(environment.LEAN_BRIDGE_JAVA, ["--enable-native-access=ALL-UNNAMED", "-Xss256k", `-Djava.io.tmpdir=${directory}`, "-cp", `classes:consumer:${stdlib}`, main], directory);
			assert.equal(result.stderr, ""); assert.equal(result.stdout, `cold-${profile}-ok:${profile === "java" ? 6 : 4}\n`);
			results[profile] = result.stdout.trim();
		}
		observations.push({ collision, sourceHashes, compilers, results, javaProbeSha256: sha256(java), kotlinProbeSha256: sha256(kotlin) });
	}
	await saveLakeFile("build/recursive", "jvm-package-cold.json", canonicalJson({ schemaVersion: 1, compiledLean: false, installedPackage: false, observations }));
});
