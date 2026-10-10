/**
 * JVM installation-input closure controls using synthetic packages and real host compilers.
 * These tests do not claim installed Lean or Fin acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rename, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { createDeterministicZip } from "../src/release/deterministic-zip.mjs";
import { readClosedPackageZip } from "./helpers/closed-package-zip.mjs";
import { installCopiedConsumer, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { inspectFinContainerEdgeJvmArchive, installFinContainerEdgeJvm, runFinContainerEdgeJvm, verifyFinContainerEdgeJvmEnvironment } from "./helpers/fin-container-edge-jvm-closure.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const sourceGate = process.env.LEAN_BRIDGE_FIN_CONTAINER_EDGE_SOURCE_TEST === "1";
const receiptPath = "META-INF/lean-bridge/package-receipt.json";
const temporary = async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-fin-edge-jvm-closure-"));
	t.after(() => rm(root, { recursive: true, force: true })); return root;
};
const zip = directory => createDeterministicZip({ directory, sourceDateEpoch: 315532800 });
const receipt = async directory => {
	const files = {};
	for(const path of await nativeArtifactPaths(directory))
	{
		if(path === receiptPath) continue;
		const bytes = await readFile(join(directory, path)); files[path] = { bytes: bytes.length, sha256: sha256(bytes) };
	}
	await saveLakeFile(directory, receiptPath, canonicalJson({
		schemaVersion: 1, kind: "lean-bridge-ordinary-maven-package"
		, ecosystem: "maven", name: "org.example:probe", version: "1.0.0", files }));
};
const setup = async t => {
	const root = await temporary(t), payload = join(root, "payload"), environment = nativeFixtureEnvironment(["java", "kotlin"]);
	await saveLakeFile(root, "Api.java", "package probe; public final class Api { public static int value() { return 1; } }\n");
	await runCopied(environment.LEAN_BRIDGE_JAVAC, ["--release", "22", "-Werror", "-d", "payload", "Api.java"], root);
	await saveLakeFile(payload, "META-INF/MANIFEST.MF", "Manifest-Version: 1.0\n\n");
	await receipt(payload);
	return { root, payload, environment };
};
const consumerSource = profile => profile === "java"
	? 'final class Consumer { public static void main(String[] args) throws Exception { try { Class.forName("Injected"); } catch (ClassNotFoundException expected) { } System.out.println("jvm-closure-ok:" + probe.Api.value()); } }\n'
	: 'fun main() { println("jvm-closure-ok:${probe.Api.value()}") }\n';
const install = async (fixture, profile, name, installJvm = installFinContainerEdgeJvm, source = consumerSource(profile)) => {
	const { root, payload, environment } = fixture, bytes = await zip(payload);
	const handoff = join(root, `handoff-${name}`), consumer = join(root, name);
	await saveLakeFile(handoff, "probe.jar", bytes);
	return installCopiedConsumer({ profile, consumer, handoff
		, packages: [{ role: "component", name: "org.example:probe", version: "1.0.0", artifacts: [{ path: "probe.jar", sha256: sha256(bytes) }] }]
		, environment: { ...environment, JAVA_TOOL_OPTIONS: "-invalid-ambient-option", JDK_JAVA_OPTIONS: "-invalid-ambient-option", KOTLIN_RUNNER: "poison" }
		, fixture: { source: () => source, success: "jvm-closure-ok", expectedChecks: 1, installJvm } });
};

test("closed ZIP reader validates every member and refuses unsafe or inconsistent layouts", async t => {
	const root = await temporary(t);
	await saveLakeFile(root, "a.txt", "one"); await saveLakeFile(root, "b.txt", "two");
	await saveLakeFile(root, "Nested$Inner.class", "synthetic"); await saveLakeFile(root, "empty", "");
	const bytes = await zip(root), files = readClosedPackageZip(bytes);
	assert.equal(files.get("a.txt").toString(), "one"); assert.equal(files.get("empty").length, 0);
	const renameMember = (from, to) => Buffer.from(bytes.toString("binary").replaceAll(from, to), "binary");
	assert.throws(() => readClosedPackageZip(renameMember("b.txt", "a.txt")), /duplicate ZIP path/u);
	assert.throws(() => readClosedPackageZip(renameMember("a.txt", "../xx")), /safe ZIP path/u);
	assert.throws(() => readClosedPackageZip(renameMember("a.txt", "/xxxx")), /safe ZIP path/u);
	assert.throws(() => readClosedPackageZip(Buffer.concat([bytes, Buffer.from("trailing")])));
	const end = bytes.length - 22, central = bytes.readUInt32LE(end + 16);
	for(const mutate of [
		copy => copy.writeUInt32LE((0o120777 << 16) >>> 0, central + 38)
		, copy => copy.writeUInt32LE(1, central + 42)
		, copy => copy.writeUInt16LE(1, end + 4)
		, copy => copy.writeUInt16LE(0, 6)
		, copy => copy.writeUInt32LE(0, 14)
		, copy => copy.writeUInt32LE(512 * 1024 ** 2, 22)
		, copy => { copy[central + 46] ^= 1; }
	]){ const copy = Buffer.from(bytes); mutate(copy); assert.throws(() => readClosedPackageZip(copy)); }
	await saveLakeFile(root, "a", "file"); await saveLakeFile(root, "z/q", "child");
	const conflict = await zip(root);
	assert.throws(() => readClosedPackageZip(Buffer.from(conflict.toString("binary").replaceAll("z/q", "a/q"), "binary")), /file\/directory conflict/u);
});

test("JVM archive closure authenticates the receipt before any package discovery", async t => {
	const root = await temporary(t);
	await saveLakeFile(root, "META-INF/MANIFEST.MF", "Manifest-Version: 1.0\n\n");
	await saveLakeFile(root, "probe/Api.class", "synthetic class bytes"); await receipt(root);
	const bytes = await zip(root), original = inspectFinContainerEdgeJvmArchive(bytes, sha256(bytes));
	assert.equal(original.receiptBytes, await readFile(join(root, receiptPath), "utf8"));
	assert.throws(() => inspectFinContainerEdgeJvmArchive(bytes, sha256("wrong")), /original JVM archive drift/u);
	await saveLakeFile(root, "META-INF/services/javax.annotation.processing.Processor", "Exploit");
	let changed = await zip(root);
	assert.throws(() => inspectFinContainerEdgeJvmArchive(changed, sha256(changed)), /unrecorded or missing JVM archive file/u);
	await receipt(root); changed = await zip(root);
	assert.throws(() => inspectFinContainerEdgeJvmArchive(changed, sha256(changed)), /unexpected JVM discovery input/u);
	await rm(join(root, "META-INF/services/javax.annotation.processing.Processor"));
	await saveLakeFile(root, "META-INF/MANIFEST.MF", "Manifest-Version: 1.0\nClass-Path: extra.jar\n\n");
	await receipt(root); changed = await zip(root);
	assert.throws(() => inspectFinContainerEdgeJvmArchive(changed, sha256(changed)), /manifest must not extend/u);
	await saveLakeFile(root, "META-INF/MANIFEST.MF", "Manifest-Version: 1.0\n\n"); await receipt(root);
	await saveLakeFile(root, "probe/Api.class", "changed"); changed = await zip(root);
	assert.throws(() => inspectFinContainerEdgeJvmArchive(changed, sha256(changed)), /member drift/u);
});

test("JVM installation refuses an executable annotation processor before javac", { skip: !sourceGate }, async t => {
	const fixture = await setup(t), { root, payload, environment } = fixture, marker = join(root, "processor-executed");
	await saveLakeFile(root, "Exploit.java", `import javax.annotation.processing.*;
import javax.lang.model.SourceVersion;
import javax.lang.model.element.TypeElement;
import java.util.Set;
@SupportedAnnotationTypes("*") @SupportedSourceVersion(SourceVersion.RELEASE_22)
public final class Exploit extends AbstractProcessor {
    public boolean process(Set<? extends TypeElement> annotations, RoundEnvironment round) {
        try { java.nio.file.Files.writeString(java.nio.file.Path.of(${JSON.stringify(marker)}), "executed"); }
        catch (Exception error) { throw new RuntimeException(error); } return false;
    }
}
`);
	await runCopied(environment.LEAN_BRIDGE_JAVAC, ["--release", "22", "-Werror", "-d", "payload", "Exploit.java"], root);
	await saveLakeFile(payload, "META-INF/services/javax.annotation.processing.Processor", "Exploit\n");
	await assert.rejects(install(fixture, "java", "guarded"), /unrecorded or missing JVM archive file/u);
	await assert.rejects(access(marker), { code: "ENOENT" });
	await assert.rejects(access(join(root, "guarded/java/classes")), { code: "ENOENT" });
	// The same injected processor really executes through the unguarded installation path.
	assert.equal((await install(fixture, "java", "unguarded", null)).checks, 1);
	assert.equal(await readFile(marker, "utf8"), "executed");
});

test("Java checks the exact runtime classpath before and after execution and relocation", { skip: !sourceGate }, async t => {
	const fixture = await setup(t), { root, environment } = fixture;
	const installed = await install(fixture, "java", "clean"); assert.equal(installed.checks, 1);
	let context = installed.jvmEnvironment;
	const expected = await verifyFinContainerEdgeJvmEnvironment(context);
	const call = () => runFinContainerEdgeJvm(context);
	assert.equal((await call()).stdout, "jvm-closure-ok:1\n");
	const marker = join(root, "class-executed");
	await saveLakeFile(root, "Injected.java", `final class Injected { static { try { java.nio.file.Files.writeString(java.nio.file.Path.of(${JSON.stringify(marker)}), "executed"); } catch (Exception error) { throw new ExceptionInInitializerError(error); } } }\n`);
	await runCopied(environment.LEAN_BRIDGE_JAVAC, ["--release", "22", "-Werror", "-d", "injected", "Injected.java"], root);
	await saveLakeFile(context.root, "classes/Injected.class", await readFile(join(root, "injected/Injected.class")));
	await assert.rejects(call(), /unrecorded or missing JVM classpath file/u);
	await assert.rejects(access(marker), { code: "ENOENT" });
	await runCopied(context.command, ["-cp", "component.jar:classes", "Consumer"], context.root);
	assert.equal(await readFile(marker, "utf8"), "executed");
	await rm(marker); await rm(join(context.root, "classes/Injected.class"));
	for(const path of ["component.jar", "consumer.java", "classes/Consumer.class"])
	{
		const original = await readFile(join(context.root, path));
		await saveLakeFile(context.root, path, "changed"); await assert.rejects(call(), /JVM environment drift/u);
		await saveLakeFile(context.root, path, original);
	}
	await assert.rejects(runFinContainerEdgeJvm({ ...context, interpreterSha256: sha256("wrong") }), /interpreter drift/u);
	await rename(join(context.root, "classes"), join(root, "linked-classes"));
	await symlink(join(root, "linked-classes"), join(context.root, "classes"));
	await assert.rejects(call(), /classes must not traverse a symlink/u);
	await rm(join(context.root, "classes")); await rename(join(root, "linked-classes"), join(context.root, "classes"));
	await rename(join(context.root, "component.jar"), join(root, "linked.jar"));
	await symlink(join(root, "linked.jar"), join(context.root, "component.jar"));
	await assert.rejects(call(), /regular JVM input/u);
	await rm(join(context.root, "component.jar")); await rename(join(root, "linked.jar"), join(context.root, "component.jar"));
	const moved = join(root, "relocated"); await rename(context.root, moved); context = { ...context, root: moved };
	assert.equal((await call()).stdout, "jvm-closure-ok:1\n");
	assert.deepEqual(await verifyFinContainerEdgeJvmEnvironment(context), expected);
	await symlink(moved, join(root, "alias"));
	await assert.rejects(runFinContainerEdgeJvm({ ...context, root: join(root, "alias") }), /root must not traverse a symlink/u);
});

test("JVM post-execution verification also runs after a failing consumer", { skip: !sourceGate }, async t => {
	const fixture = await setup(t);
	for(const failure of [false, true])
	{
		const source = `final class Consumer { public static void main(String[] args) throws Exception {
java.nio.file.Files.writeString(java.nio.file.Path.of("classes/Unexpected.class"), "extra");
${failure ? 'throw new IllegalStateException("failed after mutation");' : 'System.out.println("jvm-closure-ok:1");'}
} }\n`;
		await assert.rejects(install(fixture, "java", `post-run-${failure}`, installFinContainerEdgeJvm, source), /unrecorded or missing JVM classpath file/u);
	}
});

test("Kotlin compiles in a clean environment and rechecks both JARs after relocation", { skip: !sourceGate }, async t => {
	const fixture = await setup(t), { root } = fixture;
	const installed = await install(fixture, "kotlin", "clean"); assert.equal(installed.checks, 1);
	let context = installed.jvmEnvironment;
	const expected = await verifyFinContainerEdgeJvmEnvironment(context);
	for(const path of ["component.jar", "consumer.jar", "consumer.kt"])
	{
		const original = await readFile(join(context.root, path));
		await saveLakeFile(context.root, path, "changed");
		await assert.rejects(runFinContainerEdgeJvm(context), /JVM environment drift/u);
		await saveLakeFile(context.root, path, original);
	}
	const moved = join(root, "relocated"); await rename(context.root, moved); context = { ...context, root: moved };
	assert.equal((await runFinContainerEdgeJvm(context)).stdout, "jvm-closure-ok:1\n");
	assert.deepEqual(await verifyFinContainerEdgeJvmEnvironment(context), expected);
});

test("JVM installation refuses a reused directory before compiling", { skip: !sourceGate }, async t => {
	const fixture = await setup(t), root = join(fixture.root, "reused");
	await mkdir(root); await saveLakeFile(root, "consumer.java", consumerSource("java"));
	await saveLakeFile(root, "extra.class", "unrecorded");
	await assert.rejects(installFinContainerEdgeJvm({
		profile: "java", root, archive: "/unavailable"
		, archiveSha256: sha256("none")
		, environment: fixture.environment }), /fresh JVM consumer directory/u);
	await assert.rejects(access(join(root, "component.jar")), { code: "ENOENT" });
});
