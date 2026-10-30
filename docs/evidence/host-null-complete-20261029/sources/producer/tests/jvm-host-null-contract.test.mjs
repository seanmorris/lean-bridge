/**
 * Boxed Java and nullable Kotlin projections for compiler-authenticated HostNull.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import test from "node:test";
import { compileCopiedJvmModel } from "../src/backends/jvm/copied-model.mjs";
import { generateCopiedJvmPackage } from "../src/backends/jvm/copied-values.mjs";
import { compileCopiedKotlinModel, generateCopiedJvmKotlinPackage } from "../src/backends/jvm/copied-kotlin.mjs";
import { nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { hostNullReviewedIr } from "./helpers/host-null-fixture.mjs";
import { runHostNullManagedAcceptance } from "./helpers/host-null-managed-installed.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { javaCompilerOptions, kotlinCompilerOptions } from "./helpers/type-corpus-jvm-tools.mjs";

test("Java HostNull boxes direct values and preserves tagged nested absence", () => {
	const ir = hostNullReviewedIr(), model = compileCopiedJvmModel(ir), files = generateCopiedJvmPackage(ir);
	assert.deepEqual(files, generateCopiedJvmPackage(structuredClone(ir)));
	const root = "src/main/java/org/leanbridge/host_null_demo/";
	const api = files[`${root}Api.java`], packet = files[`${root}Packet.java`];
	const runtime = files[`${root}Runtime.java`], option = files[`${root}Option.java`];
	assert.match(api, /Long echo\(Long arg0\)/u);
	assert.match(api, /Option<Long> nullableOption\(Option<Long> arg0\)/u);
	assert.match(api, /Option<Long> optionalNullable\(Option<Long> arg0\)/u);
	assert.match(packet, /record Packet\(Long direct, Option<Long> nullableOption, Option<Long> optionalNullable\)/u);
	assert.doesNotMatch(packet, /requireNonNull\((?:direct|nullableOption)\)/u);
	assert.match(packet, /requireNonNull\(optionalNullable\)/u);
	assert.doesNotMatch(option, /requireNonNull\(value\)/u);
	assert.match(runtime, /if \(value != null\) \{ result\.set\(JAVA_BYTE, 0, \(byte\)1\);/u);
	assert.match(runtime, /case 0 -> null; case 1 -> from\d+\(/u);
	assert.match(runtime, /Invalid native HostNull flag/u);
	assert.match(files["README.md"], /Option \(HostNull T\) retains None, Some\(null\), and Some\(value\)/u);
	assert.deepEqual(model.surface.copies.filter(copy => copy.compound === "host-null").map(model.publicType), ["Long", "Option<Long>"]);
});

test("Kotlin HostNull emits nullable metadata for functions, fields and callback directions", () => {
	const ir = hostNullReviewedIr(), model = compileCopiedKotlinModel(ir), files = generateCopiedJvmKotlinPackage(ir);
	assert.deepEqual(files, generateCopiedJvmKotlinPackage(structuredClone(ir)));
	const kotlin = "src/main/kotlin/org/leanbridge/host_null_demo/kotlin/";
	const api = files[`${kotlin}Api.kt`], packet = files[`${kotlin}Packet.kt`], option = files[`${kotlin}Option.kt`];
	assert.match(api, /fun `echo`\(arg0: kotlin\.Long\?\): kotlin\.Long\?/u);
	assert.match(api, /fun `nullableOption`\([^\n]+Option`<kotlin\.Long>\?\)[^\n]+Option`<kotlin\.Long>\?/u);
	assert.match(api, /fun `optionalNullable`\([^\n]+Option`<kotlin\.Long\?>\)[^\n]+Option`<kotlin\.Long\?>/u);
	assert.match(packet, /val `direct`: kotlin\.Long\?/u);
	assert.match(packet, /val `nullableOption`:[^\n]+Option`<kotlin\.Long>\?/u);
	assert.match(packet, /val `optionalNullable`:[^\n]+Option`<kotlin\.Long\?>/u);
	assert.doesNotMatch(option, /\bT\s*:\s*kotlin\.Any|requireNonNull/u);
	const callback = [...model.surface.callbacks.values()][0];
	const source = files[`src/main/java/org/leanbridge/host_null_demo/${callback.publicName.split(".").at(-1)}.java`];
	assert.match(source, /@org\.jetbrains\.annotations\.Nullable org\.leanbridge\.host_null_demo\.kotlin\.Option<Long> invoke\(@org\.jetbrains\.annotations\.Nullable Long arg0\)/u);
	assert.deepEqual(model.surface.copies.filter(copy => copy.compound === "host-null").map(model.kotlinType)
		, ["kotlin.Long?", "`org`.`leanbridge`.`host_null_demo`.`kotlin`.`Option`<kotlin.Long>?"]);
});

test("JVM rejects directly nested HostNull rather than collapsing two null branches", () => {
	const ir = hostNullReviewedIr();
	ir.declarations[0].parameters[0].type = {
		kind: "apply"
		, constructor: "host-null"
		, arguments: [ir.declarations[0].parameters[0].type]
	};
	assert.throws(() => compileCopiedJvmModel(ir), error => error.code === "unsupported-jvm-signature"
		&& /HostNull payloads must retain a value distinct from null/u.test(error.message));
});

const environment = nativeFixtureEnvironment(["java", "kotlin"]);
const toolsAvailable = [environment.LEAN_BRIDGE_JAVA, environment.LEAN_BRIDGE_JAVAC, environment.LEAN_BRIDGE_KOTLINC].every(existsSync);
test("generated Java and Kotlin HostNull APIs compile all three absence states without warnings", {
	skip: !toolsAvailable, timeout: 180_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-jvm-host-null-contract-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const ir = hostNullReviewedIr(), files = generateCopiedJvmKotlinPackage(ir);
	for(const [path, source] of Object.entries(files)) await saveLakeFile(root, path, source);
	await saveLakeFile(root, "consumer.java", await readFile(
		"tests/fixtures/host-null-consumers/java.java"));
	await saveLakeFile(root, "consumer.kt", await readFile(
		"tests/fixtures/host-null-consumers/kotlin.kt"));
	const javaSources = [...Object.keys(files).filter(path => path.endsWith(".java")), "consumer.java"];
	const kotlinSources = [...Object.keys(files).filter(path => path.endsWith(".kt")), "consumer.kt"];
	const kotlinHome = dirname(dirname(environment.LEAN_BRIDGE_KOTLINC)), kotlinLib = join(kotlinHome, "lib");
	const jdk = dirname(dirname(environment.LEAN_BRIDGE_JAVA)), classpath = [
		join(kotlinLib, "kotlin-stdlib.jar"), join(kotlinLib, "annotations-13.0.jar")
	].join(delimiter);
	await runCopied(environment.LEAN_BRIDGE_JAVA, [
		"-Xmx512m"
		, "-classpath"
		, join(kotlinLib, "*")
		, "org.jetbrains.kotlin.cli.jvm.K2JVMCompiler"
		, "-kotlin-home"
		, kotlinHome
		, ...kotlinCompilerOptions
		, "-jdk-home"
		, jdk
		, "-classpath"
		, classpath
		, "-d"
		, "classes"
		, ...kotlinSources
		, ...javaSources
	], root, process.env);
	await runCopied(environment.LEAN_BRIDGE_JAVAC, [
		...javaCompilerOptions
		, "-classpath"
		, `classes${delimiter}${classpath}`
		, "-sourcepath"
		, "src/main/java"
		, "-d"
		, "classes"
		, ...javaSources
	], root, process.env);
});

const installedFlag = process.env.LEAN_BRIDGE_JVM_HOST_NULL_TEST;
assert.ok(installedFlag === undefined || ["0", "1"].includes(installedFlag)
	, "Invalid LEAN_BRIDGE_JVM_HOST_NULL_TEST");
test("installed Maven HostNull preserves all absence states on both author routes", {
	skip: installedFlag !== "1", timeout: 3_600_000
}, t => runHostNullManagedAcceptance(t, "jvm"));
