/**
 * Ordinary Maven releases execute copied values in installed Java and Kotlin.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, readdir, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { createNativeModel } from "../src/build/native-model.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { generateJvmBindingPackage, compileJvmPackageModel, renderJvmPackageLayout } from "../src/backends/jvm/generate.mjs";
import { compileCopiedJvmModel, validateOrdinaryMavenSettings } from "../src/backends/jvm/copied-model.mjs";
import { packageOrdinaryMaven } from "../src/release/native-maven.mjs";
import { createDeterministicZip } from "../src/release/deterministic-zip.mjs";
import { nativeMetadataFixture } from "./helpers/native-metadata.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";

const enabled = process.env.LEAN_BRIDGE_NATIVE_JVM_TEST === "1";
const leanPrefix = process.env.LEAN_BRIDGE_LEAN_PREFIX ?? join(process.cwd(), ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
const javac = process.env.LEAN_BRIDGE_JAVAC ?? "javac", java = process.env.LEAN_BRIDGE_JAVA ?? "java";
const kotlinc = process.env.LEAN_BRIDGE_KOTLINC ?? "kotlinc", kotlin = process.env.LEAN_BRIDGE_KOTLIN ?? "kotlin", mvn = process.env.LEAN_BRIDGE_MAVEN ?? "mvn";
const environment = { ...process.env, LEAN_BRIDGE_LEAN_PREFIX: leanPrefix, LEAN_BRIDGE_PERLS: '["/must/not/invoke/perl"]' };
const run = (command, args, cwd, env = environment) => processBuildRunner.capture({ command, args, cwd, env });
const synthetic = () => createNativeModel({ ...nativeMetadataFixture(), component: { id: "example@1.0.0", name: "example", version: "1.0.0" } }).bindingIr;
const cap = name => name[0].toUpperCase() + name.slice(1);
const scalars = [
	["unit", "Unit", "Unit", "Unit.INSTANCE", "LeanUnit.INSTANCE"]
	, ["bool", "Bool", "boolean", "true", "true"]
	, ["u8", "UInt8", "int", "255", "255"]
	, ["u16", "UInt16", "int", "65535", "65535"]
	, ["u32", "UInt32", "long", "0xffff_ffffL", "0xffff_ffffL"]
	, ["u64", "UInt64", "BigInteger", "BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE)", "BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE)"]
	, ["i8", "Int8", "byte", "Byte.MIN_VALUE", "Byte.MIN_VALUE"]
	, ["i16", "Int16", "short", "Short.MIN_VALUE", "Short.MIN_VALUE"]
	, ["i32", "Int32", "int", "Integer.MIN_VALUE", "Int.MIN_VALUE"]
	, ["i64", "Int64", "long", "Long.MIN_VALUE", "Long.MIN_VALUE"]
	, ["nat", "Nat", "BigInteger", "BigInteger.ONE.shiftLeft(4096).add(BigInteger.ONE)", "BigInteger.ONE.shiftLeft(4096).add(BigInteger.ONE)"]
	, ["integer", "Int", "BigInteger", "BigInteger.ONE.shiftLeft(4096).negate()", "BigInteger.ONE.shiftLeft(4096).negate()"]
	, ["f32", "Float32", "float", "-0.0f", "-0.0f"]
	, ["f64", "Float", "double", "-0.0", "-0.0"]
	, ["text", "String", "String", '"a\\0λ🌿"', '"a\\u0000λ🌿"']
	, ["bytes", "ByteArray", "byte[]", "new byte[] {0, -1, -128}", "byteArrayOf(0, -1, -128)"]
];
const ordered = name => name === "Maple" ? scalars : [...scalars].reverse();

test("ordinary JVM generation is source-named, deterministic and keeps FFM private", () => {
	const ir = synthetic(), files = generateJvmBindingPackage(ir);
	assert.deepEqual(files, generateJvmBindingPackage(structuredClone(ir)));
	assert.deepEqual(files, renderJvmPackageLayout(compileJvmPackageModel(ir)));
	assert.match(files["src/main/java/org/leanbridge/example/Api.java"], /public static long increment\(long arg0\)/);
	assert.doesNotMatch(files["src/main/java/org/leanbridge/example/Api.java"], /Alpha|MemorySegment|Arena|Linker/);
	assert.match(files["src/main/java/org/leanbridge/example/Runtime.java"], /example_increment/);
});

test("ordinary JVM admission rejects name collisions and non-release coordinates", () => {
	for(const name of ["wait", "get_class", "notify_all"])
	{
		const ir = synthetic(); ir.declarations[0].name = name;
		assert.throws(() => compileCopiedJvmModel(ir), error => error.code === "unsupported-jvm-signature" && error.details.source.path === "Sample.lean");
	}
	for(const settings of [{ name: "../escape" }, { name: "acme:../x" }, { version: "LATEST" }, { version: "[1,2]" }, { version: "1.0.0-SNAPSHOT" }]) assert.throws(() => validateOrdinaryMavenSettings(settings));
	validateOrdinaryMavenSettings({ name: "com.acme.tools:sample-api", version: "2.0.0-rc.1" });
});

const project = async (root, name) => {
	await saveLakeFile(root, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
	await saveLakeFile(root, "lakefile.toml", `name = "${name.toLowerCase()}"\n[[lean_lib]]\nname = "${name}"\n`);
	await saveLakeFile(root, `${name}.lean`, `namespace ${name}
structure Leaf where
${ordered(name).map(([label, type]) => `  v_${label} : ${type}`).join("\n")}
structure Packet where
  title : String
  leaf : Leaf
  rows : Array (Array Leaf)
structure Word where
  bits : ${name === "Maple" ? "UInt32" : "UInt64"}
structure Empty where
${scalars.map(([label, type]) => `def echo_${label} (value : ${type}) := value\ndef array_${label} (value : Array ${type}) := value`).join("\n")}
def echo_record (value : Packet) := value
def choose (left right : Packet) (pick : Bool) := if pick then left else right
def echo_rows (value : Array (Array Leaf)) := value
def echo_word (value : Word) := value
def echo_empty (value : Empty) := value
def array_empty (value : Array Empty) := value
def matrix (value : Array UInt32) := #[value, value]
def grow (value : String) := #[value, value]
def answer : UInt32 := 42
end ${name}
`);
	await saveLakeFile(root, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: [name], exports: [...scalars.flatMap(([label]) => [`${name}.echo_${label}`, `${name}.array_${label}`]), ...["echo_record", "choose", "echo_rows", "echo_word", "echo_empty", "array_empty", "matrix", "grow", "answer"].map(label => `${name}.${label}`)], targets: { maven: { name: `com.acme:${name.toLowerCase()}-api`, version: "2.0.0-rc.1" } } }));
};

const javaConsumer = name => `import org.leanbridge.${name.toLowerCase()}.*;
import java.math.BigInteger;
import java.util.*;
import java.util.stream.IntStream;
class Consumer {
  static void same(Object a, Object b) { if (!Objects.deepEquals(a, b)) throw new AssertionError("Value mismatch: " + a + " / " + b); }
  static void bad(Runnable call) { try { call.run(); throw new AssertionError("Accepted bad input"); } catch (IllegalArgumentException | NullPointerException expected) { } }
  public static void main(String[] args) {
${scalars.map(([label, , type, value]) => `    ${label === "unit" ? `Api.echoUnit(${value});` : `same(Api.echo${cap(label)}(${value}), ${value});`}\n    same(Api.array${cap(label)}(new ${type.replace("[]", "")}[]${type.endsWith("[]") ? "[]" : ""} { ${value} }), new ${type.replace("[]", "")}[]${type.endsWith("[]") ? "[]" : ""} { ${value} });`).join("\n")}
    var leaf = new Leaf(${ordered(name).map(([, , , value]) => value).join(", ")});
    var input = new Packet("rooms", leaf, new Leaf[][] { {leaf}, {} });
    var output = Api.echoRecord(input);
    same(output.title(), "rooms");
${scalars.map(([label, , , value]) => `    same(output.leaf().v${cap(label)}(), ${value});\n    same(output.rows()[0][0].v${cap(label)}(), ${value});`).join("\n")}
    if (output == input || output.rows() == input.rows() || output.leaf().vBytes() == leaf.vBytes()) throw new AssertionError("Shallow copy");
    same(Api.choose(input, new Packet("other", leaf, new Leaf[0][]), false).title(), "other");
    same(Api.echoRows(input.rows())[0][0].vText(), leaf.vText());
    same(Api.echoWord(new Word(${name === "Maple" ? "0xffff_ffffL" : "BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE)"})).bits(), ${name === "Maple" ? "0xffff_ffffL" : "BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE)"});
    same(Api.echoEmpty(new Empty()), new Empty());
    same(Api.arrayEmpty(new Empty[]{new Empty()}), new Empty[]{new Empty()});
    same(Api.matrix(new long[]{1,2})[1], new long[]{1,2});
    same(Api.answer(), 42L);
    same(Api.echoNat(BigInteger.ZERO), BigInteger.ZERO);
    same(Api.echoInteger(BigInteger.valueOf(-99)), BigInteger.valueOf(-99));
    same(Api.echoF32(Float.NaN), Float.NaN); same(Api.echoF64(Double.POSITIVE_INFINITY), Double.POSITIVE_INFINITY);
    same(Api.echoText(""), ""); same(Api.echoBytes(new byte[0]), new byte[0]);
    bad(() -> Api.echoU8(-1)); bad(() -> Api.echoU8(256)); bad(() -> Api.echoU16(65536)); bad(() -> Api.echoU32(0x1_0000_0000L));
    bad(() -> Api.echoU64(BigInteger.ONE.shiftLeft(64))); bad(() -> Api.echoNat(BigInteger.valueOf(-1)));
    bad(() -> Api.echoText("\\ud800")); bad(() -> Api.echoText(null)); bad(() -> Api.echoUnit(null));
    bad(() -> Api.echoRows(new Leaf[][] {{null}})); bad(() -> Api.echoRecord(null));
    bad(() -> Api.arrayU8(new int[]{1,256})); bad(() -> Api.echoBytes(new byte[17*1024*1024]));
    var large = "x".repeat(6 * 1024 * 1024);
    for (int index = 0; index < 3; index++) bad(() -> Api.grow(large));
    IntStream.range(0, 100).parallel().forEach(index -> same(Api.echoRecord(input).rows()[0][0].vNat(), leaf.vNat()));
    System.out.println("Java copied values, rejection, cleanup and concurrency passed");
  }
}
`;
const kotlinConsumer = name => `import org.leanbridge.${name.toLowerCase()}.*
import org.leanbridge.${name.toLowerCase()}.Unit as LeanUnit
import java.math.BigInteger
fun same(a: Any?, b: Any?) { check(java.util.Objects.deepEquals(a, b)) }
fun main() {
${scalars.map(([label, , type, , value]) => { const array = { boolean: "booleanArrayOf", int: "intArrayOf", long: "longArrayOf", byte: "byteArrayOf", short: "shortArrayOf", float: "floatArrayOf", double: "doubleArrayOf" }[type] ?? "arrayOf"; return `  ${label === "unit" ? `Api.echoUnit(${value})` : `same(Api.echo${cap(label)}(${value}), ${value})`}\n  same(Api.array${cap(label)}(${array}(${value})), ${array}(${value}))`; }).join("\n")}
  val leaf = Leaf(${ordered(name).map(([, , , , value]) => value).join(", ")})
  val input = Packet("rooms", leaf, arrayOf(arrayOf(leaf), emptyArray<Leaf>()))
  val output = Api.echoRecord(input)
${scalars.map(([label, , , , value]) => `  same(output.leaf().v${cap(label)}(), ${value})\n  same(output.rows()[0][0].v${cap(label)}(), ${value})`).join("\n")}
  check(output.rows() !== input.rows())
  same(Api.echoWord(Word(${name === "Maple" ? "0xffff_ffffL" : "BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE)"})).bits(), ${name === "Maple" ? "0xffff_ffffL" : "BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE)"})
  same(Api.echoEmpty(Empty()), Empty())
  same(Api.matrix(longArrayOf(1,2))[1], longArrayOf(1,2))
  same(Api.answer(), 42L)
  try { Api.echoNat(BigInteger.valueOf(-1)); error("Accepted negative Nat") } catch (expected: IllegalArgumentException) { }
  println("Kotlin copied values passed")
}
`;

const consume = async (working, build, name) => {
	const root = join(working, `consumer-${name}`), repository = join(working, "maven-cache");
	await mkdir(root); await mkdir(join(root, "native-temp"));
	const jar = build.packages.find(file => file.archive.endsWith(".jar")), pom = build.packages.find(file => file.archive.endsWith(".pom"));
	await run(mvn, ["--batch-mode", "--quiet", `-Dmaven.repo.local=${repository}`, "org.apache.maven.plugins:maven-install-plugin:3.1.4:install-file", `-Dfile=${join(build.output, "archives", jar.archive)}`, `-DpomFile=${join(build.output, "archives", pom.archive)}`], root);
	const installed = join(repository, "com/acme", `${name.toLowerCase()}-api`, jar.version, jar.archive);
	assert.equal(sha256(await readFile(installed)), jar.sha256);
	await saveLakeFile(root, "Consumer.java", javaConsumer(name));
	await saveLakeFile(root, "Consumer.kt", kotlinConsumer(name));
	await run(javac, ["--release", "22", "-encoding", "UTF-8", "-cp", installed, "-d", "classes", "Consumer.java"], root);
	const clean = { PATH: "/usr/bin:/bin", JAVA_HOME: process.env.JAVA_HOME };
	assert.match((await run(java, ["--enable-native-access=ALL-UNNAMED", `-Djava.io.tmpdir=${join(root, "native-temp")}`, "-cp", `classes:${installed}`, "Consumer"], root, clean)).stdout, /cleanup and concurrency passed/);
	await run(kotlinc, ["-classpath", installed, "-d", "kotlin-classes", "Consumer.kt"], root);
	assert.match((await run(kotlin, ["-J--enable-native-access=ALL-UNNAMED", `-J-Djava.io.tmpdir=${join(root, "native-temp")}`, "-classpath", `kotlin-classes:${installed}`, "ConsumerKt"], root, clean)).stdout, /Kotlin copied values passed/);
	assert.deepEqual(await readdir(join(root, "native-temp")), [], "Normal JVM shutdown removes extracted assets");
	return installed;
};

test("ordinary Maven archives reproduce and execute installed Java and Kotlin APIs", { skip: !enabled, timeout: 900_000 }, async t => {
	const working = await mkdtemp(join(tmpdir(), "lean-bridge-native-jvm-"));
	t.after(() => rm(working, { recursive: true, force: true }));
	const installed = [];
	for(const name of ["Maple", "Cedar"])
	{
		const source = join(working, name), relocated = `${source}-relocated`;
		await project(source, name); await cp(source, relocated, { recursive: true });
		const before = await lakeInputState(source), builds = [];
		for(const [index, projectRoot] of [source, relocated].entries())
			builds.push(await buildCanonicalProject({ projectRoot, outputRoot: join(working, `${name}-build${index}`), targets: ["maven", "c"], environment: { ...environment, JDK_JAVAC_OPTIONS: "--invalid-ambient-option", JAVA_TOOL_OPTIONS: "-invalid-ambient-option" } }));
		assert.deepEqual(await lakeInputState(source), before);
		assert.deepEqual(builds[0].packages, builds[1].packages);
		t.diagnostic(canonicalJson({ project: name, archives: builds[0].packages.map(({ archive, sha256 }) => ({ path: archive, sha256 })) }).trim());
		await rename(source, `${source}-hidden`); await rename(relocated, `${relocated}-hidden`);
		installed.push(await consume(working, builds[0], name));
		const native = join(builds[0].output, `packages/maven/jar/META-INF/lean-bridge/native/linux-x64/lib${name.toLowerCase()}.so`);
		const bytes = await readFile(native); bytes[bytes.length - 1] ^= 1;
		await saveLakeFile(dirname(native), `lib${name.toLowerCase()}.so`, bytes);
		const tampered = await createDeterministicZip({ directory: join(builds[0].output, "packages/maven/jar"), sourceDateEpoch: 315532800 });
		await saveLakeFile(working, "tampered.jar", tampered);
		await assert.rejects(() => run(java, ["--enable-native-access=ALL-UNNAMED", "-cp", `classes:${join(working, "tampered.jar")}`, "Consumer"], join(working, `consumer-${name}`)), error => /differs from compiled evidence/.test(error.details?.stderr));
		const classes = join(builds[0].output, `native/jvm/classes/org/leanbridge/${name.toLowerCase()}`);
		const code = await readFile(join(classes, "Api.class")); code[code.length - 1] ^= 1; await saveLakeFile(classes, "Api.class", code);
		await assert.rejects(() => packageOrdinaryMaven({ working: join(working, "bad"), jvmRoot: join(builds[0].output, "native/jvm"), nativeRoot: join(builds[0].output, "native/component"), runtimeRoot: join(builds[0].output, "native/runtime"), adapterRoot: join(builds[0].output, "native/c-binding"), leanPrefix, glibcMinimumVersion: "2.38" }), /drift/);
	}
	await saveLakeFile(working, "Composition.java", `import java.net.*; import java.nio.file.*; import java.lang.foreign.*;
class Composition {
 public static void main(String[] paths) throws Throwable {
  if (org.leanbridge.maple.Api.answer()!=42 || org.leanbridge.cedar.Api.answer()!=42) throw new AssertionError();
  var runtime = Class.forName("org.leanbridge.maple.Runtime");
  var field = runtime.getDeclaredField("LOOKUP"); field.setAccessible(true);
  var lookup = (SymbolLookup)field.get(null);
  try (var arena = Arena.ofConfined()) {
   var memory = arena.allocate(40,8);
   var call = Linker.nativeLinker().downcallHandle(lookup.find("lean_bridge_native_snapshot_read").orElseThrow(), FunctionDescriptor.ofVoid(ValueLayout.ADDRESS));
   call.invokeExact(memory);
   if (memory.get(ValueLayout.JAVA_INT,8)!=1 || memory.get(ValueLayout.JAVA_INT,12)!=2 || memory.get(ValueLayout.JAVA_INT,16)!=2) throw new AssertionError("Runtime is not shared");
  }
  for (int index=0;index<2;index++) try (var loader = new URLClassLoader(new URL[]{Path.of(paths[0]).toUri().toURL()}, ClassLoader.getPlatformClassLoader())) {
   if (!Class.forName("org.leanbridge.maple.Api",true,loader).getMethod("answer").invoke(null).equals(42L)) throw new AssertionError();
  }
  System.out.println("Two components and isolated class loaders share one runtime");
 }
}`);
	await run(javac, ["--release", "22", "-cp", installed.join(":"), "Composition.java"], working);
	assert.match((await run(java, ["--enable-native-access=ALL-UNNAMED", "-cp", `.:${installed.join(":")}`, "Composition", installed[0]], working)).stdout, /share one runtime/);
});

test("ordinary Maven compiler failure releases no partial package", { skip: !enabled, timeout: 180_000 }, async t => {
	const working = await mkdtemp(join(tmpdir(), "lean-bridge-native-jvm-failure-"));
	t.after(() => rm(working, { recursive: true, force: true }));
	const source = join(working, "source"); await project(source, "Failure");
	await assert.rejects(() => buildCanonicalProject({ projectRoot: source, outputRoot: join(working, "release"), targets: ["c", "maven"], environment: { ...environment, LEAN_BRIDGE_JAVAC: "/missing/javac" } }));
	assert.deepEqual(await readdir(working), ["source"]);
});
