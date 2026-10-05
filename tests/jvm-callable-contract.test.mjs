/**
 * JVM callable admission, public SAM signatures and compiled lifetime contracts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { generateJvmBindingPackage, compileJvmPackageModel, renderJvmPackageLayout } from "../src/backends/jvm/generate.mjs";
import { jvmCallableState } from "../src/backends/jvm/callables.mjs";
import { callableReviewedIr } from "./helpers/callable-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { javaCompilerOptions } from "./helpers/type-corpus-jvm-tools.mjs";
import { verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { sha256 } from "../src/capsule/node.mjs";

test("native inventories admit nested Java class names without widening other paths", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-jvm-callable-paths-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const bytes = Buffer.from("class fixture"), identity = { bytes: bytes.length, sha256: sha256(bytes) };
	await saveLakeFile(root, "classes/org/leanbridge/Fn$LeanClosure.class", bytes);
	await verifyNativeFiles(root, { "classes/org/leanbridge/Fn$LeanClosure.class": identity });
	for(const path of ["lib$bad.so", "classes/$bad/Name.class", "classes/Name$(id).class"])
	{
		await saveLakeFile(root, path, bytes);
		await assert.rejects(() => verifyNativeFiles(root, { [path]: identity }), /invalid native artifact path/);
	}
	await assert.rejects(() => verifyNativeFiles(root, { "../outside.class": identity }), /invalid native artifact path/);
});

test("JVM callables expose typed SAMs and AutoCloseable functions without public FFM", () => {
	const ir = callableReviewedIr(), model = compileJvmPackageModel(ir), files = generateJvmBindingPackage(ir);
	assert.equal(model.copied.surface.callbacks.size, 38);
	assert.deepEqual(files, renderJvmPackageLayout(model));
	assert.deepEqual(files, generateJvmBindingPackage(structuredClone(ir)));
	const prefix = "src/main/java/org/leanbridge/callables/";
	assert.match(files[`${prefix}Api.java`], /public static void callUnit\(Unit arg0, FnUnitToUnit arg1\)/);
	assert.match(files[`${prefix}Api.java`], /FnBoolStringToString.LeanClosure makeString/);
	const manifest = JSON.parse(files["binding-manifest.json"]);
	for(const path of manifest.publicFiles) assert.doesNotMatch(files[path], /MemorySegment|Arena|Linker|MethodHandle/);
	assert.match(files[`${prefix}FnUInt32ToUInt32.java`], /long invoke\(long arg0\)/);
	assert.match(files[`${prefix}FnUnitToUnit.java`], /void invoke\(Unit arg0\)/);
	assert.match(files[`${prefix}FnBoolStringToString.java`], /Reference.reachabilityFence\(this\)/);
	assert.match(files[`${prefix}Runtime.java`], /catch \(Throwable failure\)/);
});

for(const [label, change] of Object.entries({
	"retained callback": ir => { ir.declarations[0].parameters[1].lifetime.scope = "explicit"; }
	, "async callback": ir => { ir.types[0].callable.resultMode = "promise"; }
	, "higher-order callback": ir => { ir.types[0].callable.result.type = { kind: "named", id: ir.types[0].id }; }
	, "zero-argument callable": ir => { ir.types[0].callable.parameters = []; }
	, "too many arguments": ir => { ir.types[0].callable.parameters = Array.from({ length: 17 }, (_, i) => ({ ...ir.types[0].callable.parameters[0], name: `arg${i}` })); }
})) test(`JVM callable admission rejects ${label}`, () => {
	const ir = callableReviewedIr(); change(ir); assert.throws(() => compileJvmPackageModel(ir));
});

const environment = nativeFixtureEnvironment(["java", "kotlin"]);
test("JVM generated callable sources compile and leases defer active close before process guards", { skip: !existsSync(environment.LEAN_BRIDGE_JAVAC) }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-jvm-callable-contract-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const files = generateJvmBindingPackage(callableReviewedIr()), sources = Object.keys(files).filter(path => path.endsWith(".java"));
	for(const path of sources) await saveLakeFile(root, path, files[path]);
	await runCopied(environment.LEAN_BRIDGE_JAVAC, [...javaCompilerOptions, "-d", "classes", ...sources], root);
	// Compile production lease state with a controlled PID, never fork a running JVM.
	const state = jvmCallableState.replace(/private static int pid\(\) \{[\s\S]*?\n {8}\}/, "private static int pid() { return currentPid; }");
	assert.notEqual(state, jvmCallableState);
	await saveLakeFile(root, "Runtime.java", `import java.lang.foreign.*;
import java.lang.invoke.*;
import static java.lang.foreign.ValueLayout.*;
final class Runtime {
    static int currentPid = 1, released;
${state}
    static void drop(MemorySegment pointer) { if (pointer.get(ADDRESS, 0).address() != 0) { ++released; pointer.set(ADDRESS, 0, MemorySegment.NULL); } }
    static void check(boolean value) { if (!value) throw new AssertionError(); }
    static void reject(Runnable action) { try { action.run(); } catch (IllegalStateException expected) { return; } throw new AssertionError("expected rejection"); }
    public static void main(String[] args) throws Throwable {
        var frame = new CallbackFrame(); var original = new Exception("checked exception"); frame.failure = original;
        try { frame.check(); throw new AssertionError(); } catch (Throwable error) { check(error == original); }
        var release = MethodHandles.lookup().findStatic(Runtime.class, "drop", MethodType.methodType(void.class, MemorySegment.class));
        var lease = new ClosureLease(release);
        try (Arena arena = Arena.ofConfined()) {
            var pointer = arena.allocate(ADDRESS); pointer.set(ADDRESS, 0, MemorySegment.ofAddress(42)); lease.adopt(pointer);
            check(pointer.get(ADDRESS, 0).equals(MemorySegment.NULL)); check(lease.enter() == 42);
            Thread closer = Thread.ofPlatform().start(lease::close); closer.join();
            check(lease.isClosed() && released == 0); reject(lease::enter);
            lease.leave(); check(released == 1); lease.close(); check(released == 1);
            var other = new ClosureLease(release); pointer.set(ADDRESS, 0, MemorySegment.ofAddress(7)); other.adopt(pointer);
            currentPid = 2; reject(other::enter); reject(other::close); reject(other::isClosed); other.run(); check(released == 1);
            currentPid = 1; other.close(); check(released == 2);
        }
        System.out.println("jvm-lease-contract-ok");
    }
}
`);
	await runCopied(environment.LEAN_BRIDGE_JAVAC, [...javaCompilerOptions, "Runtime.java"], root);
	assert.match((await runCopied(environment.LEAN_BRIDGE_JAVA, ["--enable-native-access=ALL-UNNAMED", "-cp", root, "Runtime"], root)).stdout, /jvm-lease-contract-ok/);
});
