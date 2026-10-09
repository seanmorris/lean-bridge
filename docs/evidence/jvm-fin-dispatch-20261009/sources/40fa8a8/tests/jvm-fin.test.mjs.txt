/**
 * Checked top-level Fin sites in installed, relocated JVM packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { copiedJvmAssets } from "../src/backends/jvm/copied-assets.mjs";
import { compileCopiedJvmModel } from "../src/backends/jvm/copied-model.mjs";
import { renderCopiedJvmPackage } from "../src/backends/jvm/copied-values.mjs";
import { verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { supportsNativeRefinementTargets } from "../src/build/native-project.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { reviewedScalarHostIr } from "./helpers/reviewed-scalar-host-fixture.mjs";
import { corpusReviewedIr } from "./helpers/type-corpus-reviewed-ir.mjs";
import { nativeFinAdapterSymbol, nativeFinDispatchExpected, nativeFinDispatchSteps, nativeFinDispatchSymbols, readNativeFinDispatch } from "./helpers/native-fin-dispatch.mjs";
import { nativeFinGdbExit, nativeFinGdbRecord, readNativeFinGdbRecord } from "./helpers/native-fin-dispatch-gdb.mjs";
import { nativeFinGdbCommand } from "./helpers/native-fin-dispatch-gdb-run.mjs";
import { assertExtractedNativeFinGdbRun, nativeFinGdbExtractedScript, observeExtractedNativeFinDispatch } from "./helpers/native-fin-dispatch-gdb-extracted.mjs";
import { copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";

const huge = "1180591620717411303424";
const expectedBounds = {
	"NativeFin.impossible": [["0"], null]
	, "NativeFin.only": [["1"], null]
	, "NativeFin.mirror": [["10"], "10"]
	, "NativeFin.twice": [["300"], null]
	, "NativeFin.succHuge": [[huge], huge]
	, "NativeFin.wrap": [[null], "7"]
	, "NativeFin.label": [[null, "4", null], null]
};
const bounds = refinements => refinements ? [refinements.parameters.map(item => item?.bound ?? null), refinements.result?.bound ?? null] : null;
const sharedLibraries = files => Object.fromEntries(Object.entries(files)
	.filter(([path]) => /\.so(?:\.|$)/.test(path)).map(([path, file]) => [basename(path), file.sha256 ?? file]));

/** Public API cases: exact bounds, host exception identity, cleanup and recovery. */
const javaFinConsumer = () => `import org.leanbridge.native_fin.Api;
import java.math.BigInteger;

final class Consumer {
    private Consumer() { }
    private static int checks;
    static void check(boolean value, String label) { if (!value) throw new AssertionError("failed: " + label); checks++; }
    static boolean rejected(Runnable action, String parameter, String bound) {
        try { action.run(); }
        catch (IllegalArgumentException error) { return (parameter + " is not below its Fin " + bound + " bound").equals(error.getMessage()); }
        return false;
    }
    static boolean throwsType(Class<? extends Throwable> type, Runnable action) {
        try { action.run(); } catch (Throwable error) { return type.isInstance(error); }
        return false;
    }
    static BigInteger n(long value) { return BigInteger.valueOf(value); }
    public static void main(String[] args) {
        BigInteger huge = BigInteger.ONE.shiftLeft(70), word = BigInteger.ONE.shiftLeft(32);
        check(rejected(() -> Api.impossible(n(0)), "arg0", "0"), "Fin 0 rejects zero");
        check(rejected(() -> Api.impossible(n(1)), "arg0", "0"), "Fin 0 rejects one");
        check(Api.only(n(0)).equals(n(7)), "Fin 1 accepts zero");
        check(rejected(() -> Api.only(n(1)), "arg0", "1"), "Fin 1 rejects its bound");
        check(Api.mirror(n(0)).equals(n(9)) && Api.mirror(n(9)).equals(n(0)), "Fin 10 endpoints");
        for (BigInteger value : new BigInteger[] { n(10), n(11), word, huge })
            check(rejected(() -> Api.mirror(value), "arg0", "10"), "Fin 10 rejects " + value);
        check(throwsType(IllegalArgumentException.class, () -> Api.mirror(n(-1))) && !rejected(() -> Api.mirror(n(-1)), "arg0", "10"), "negative is the Nat error");
        check(throwsType(NullPointerException.class, () -> Api.mirror(null)), "null is rejected");
        check(Api.twice(n(299)).equals(n(598)), "alias accepts its largest value");
        check(rejected(() -> Api.twice(n(300)), "arg0", "300"), "alias rejects its bound");
        check(rejected(() -> Api.twice(n(301)), "arg0", "300"), "alias rejects beyond its bound");
        check(Api.succHuge(word).equals(word.add(BigInteger.ONE)), "large Fin crosses a limb");
        check(Api.succHuge(huge.subtract(n(2))).equals(huge.subtract(BigInteger.ONE)) && Api.succHuge(huge.subtract(BigInteger.ONE)).equals(huge.subtract(BigInteger.ONE)), "large Fin endpoints");
        for (BigInteger value : new BigInteger[] { huge, huge.add(BigInteger.ONE), BigInteger.ONE.shiftLeft(128) })
            check(rejected(() -> Api.succHuge(value), "arg0", huge.toString()), "large Fin rejects " + value);
        check(Api.wrap(n(100)).equals(n(2)) && Api.wrap(huge).equals(n(2)) && Api.wrap(n(0)).equals(n(0)), "result-only Fin values");
        BigInteger start = n(5); String name = "slot";
        check(Api.label(start, n(3), name).equals("slot:8"), "mixed arguments");
        check(rejected(() -> Api.label(start, n(4), name), "arg1", "4"), "mixed arguments reject the Fin site");
        check(start.equals(n(5)) && name.equals("slot") && Api.label(start, n(0), name).equals("slot:5"), "caller data unchanged");
        for (int i = 0; i < 1000; i++) {
            final int k = i;
            if (!rejected(() -> Api.mirror(n(10 + k)), "arg0", "10")) throw new AssertionError("invalid call accepted at " + i);
            if (!Api.mirror(n(i % 10)).equals(n(9 - i % 10))) throw new AssertionError("valid call failed at " + i);
        }
        checks += 2000;
        System.out.println("java-fin-ok:" + checks);
    }
}
`;

/** The same public API cases from Kotlin, compiled against the same JAR. */
const kotlinFinConsumer = () => `import org.leanbridge.native_fin.Api
import java.math.BigInteger

private var checks = 0
private fun check(value: Boolean, label: String) { if (!value) throw AssertionError("failed: " + label); checks++ }
private fun rejected(parameter: String, bound: String, action: () -> Any?): Boolean =
    try { action(); false }
    catch (error: IllegalArgumentException) { error.message == parameter + " is not below its Fin " + bound + " bound" }
private fun illegal(action: () -> Any?): Boolean = try { action(); false } catch (error: IllegalArgumentException) { true }
private fun n(value: Long): BigInteger = BigInteger.valueOf(value)

fun main() {
    val huge = BigInteger.ONE.shiftLeft(70)
    val word = BigInteger.ONE.shiftLeft(32)
    check(rejected("arg0", "0") { Api.impossible(n(0)) }, "Fin 0 rejects zero")
    check(rejected("arg0", "0") { Api.impossible(n(1)) }, "Fin 0 rejects one")
    check(Api.only(n(0)) == n(7), "Fin 1 accepts zero")
    check(rejected("arg0", "1") { Api.only(n(1)) }, "Fin 1 rejects its bound")
    check(Api.mirror(n(0)) == n(9) && Api.mirror(n(9)) == n(0), "Fin 10 endpoints")
    for (value in listOf(n(10), n(11), word, huge))
        check(rejected("arg0", "10") { Api.mirror(value) }, "Fin 10 rejects " + value)
    check(illegal { Api.mirror(n(-1)) } && !rejected("arg0", "10") { Api.mirror(n(-1)) }, "negative is the Nat error")
    check(Api.twice(n(299)) == n(598), "alias accepts its largest value")
    check(rejected("arg0", "300") { Api.twice(n(300)) }, "alias rejects its bound")
    check(rejected("arg0", "300") { Api.twice(n(301)) }, "alias rejects beyond its bound")
    check(Api.succHuge(word) == word + BigInteger.ONE, "large Fin crosses a limb")
    val last = huge - BigInteger.ONE
    check(Api.succHuge(huge - n(2)) == last && Api.succHuge(last) == last, "large Fin endpoints")
    for (value in listOf(huge, huge + BigInteger.ONE, BigInteger.ONE.shiftLeft(128)))
        check(rejected("arg0", huge.toString()) { Api.succHuge(value) }, "large Fin rejects " + value)
    check(Api.wrap(n(100)) == n(2) && Api.wrap(huge) == n(2) && Api.wrap(n(0)) == n(0), "result-only Fin values")
    val start = n(5)
    val name = "slot"
    check(Api.label(start, n(3), name) == "slot:8", "mixed arguments")
    check(rejected("arg1", "4") { Api.label(start, n(4), name) }, "mixed arguments reject the Fin site")
    check(start == n(5) && name == "slot" && Api.label(start, n(0), name) == "slot:5", "caller data unchanged")
    for (i in 0 until 1000) {
        if (!rejected("arg0", "10") { Api.mirror(n(10L + i)) }) throw AssertionError("invalid call accepted at " + i)
        if (Api.mirror(n(i % 10L)) != n(9L - i % 10)) throw AssertionError("valid call failed at " + i)
    }
    checks += 2000
    println("kotlin-fin-ok:" + checks)
}
`;

const jvmFinDispatchExpected = nativeFinDispatchExpected(outcome => outcome.rejected ? `rejected:${outcome.rejected[0]}<${outcome.rejected[1]}` : `ok:${outcome.ok}`);
const jvmFinDispatchRoutes = profile => [`public ${profile === "java" ? "Java" : "Kotlin"} calls of org.leanbridge.native_fin.Api.mirror, .impossible and .label through the verified extracting RTLD_DEEPBIND JAR loader and FFM downcalls into the bundled C adapter`];
const jvmLoadTrigger = "Api.only(0) == 7: a public call outside the six counted columns, after a record with nothing armed and no entries, and before a record with all six armed in one verified extraction root and still no entries";
const unattached = "fin dispatch instrumentation is not attached\n", uncovered = "fin dispatch instrumentation did not cover the verified deployment\n";
const untriggered = "fin dispatch load trigger failed\n";
const jvmValue = value => typeof value === "string" ? JSON.stringify(value) : `n(${JSON.stringify(value.toString())})`;
const javaRows = nativeFinDispatchSteps.slice(1).map(([step, name, args]) => `        report(${JSON.stringify(step)}, status(() -> Api.${name}(${args.map(jvmValue).join(", ")})));`).join("\n");
const kotlinRows = nativeFinDispatchSteps.slice(1).map(([step, name, args]) => `    report(${JSON.stringify(step)}, status { Api.${name}(${args.map(jvmValue).join(", ")}) })`).join("\n");

/**
 * Java probe run under GDB. The JAR extracts and opens its verified libraries only when its runtime class
 * initializes at the first public call, so before any call the probe requires a fresh record for this
 * process: the expected identity digest, this invocation's nonce and PID, an attached debugger, nothing
 * armed and no entries. Its one explicit load trigger is Api.only(0), outside the six counted columns;
 * afterwards all six verified definitions must be armed and still entered zero times before the first row.
 */
const javaFinDispatchProbe = () => `import java.math.BigInteger;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.function.Supplier;
import java.util.regex.Pattern;
import org.leanbridge.native_fin.Api;

final class Probe {
    private Probe() { }
    private static final Pattern REJECTED = Pattern.compile("\\\\A(arg[0-9]+) is not below its Fin ([0-9]+) bound\\\\z");
    private static final Pattern PRINTABLE = Pattern.compile("\\\\A[!-~]+\\\\z");
    private static String record = "", nonce = "", config = "";
    private static int[] expected = new int[0];
    private static ByteBuffer instrumentation() {
        try {
            byte[] bytes = Files.readAllBytes(Path.of(record));
            return bytes.length == ${nativeFinGdbRecord.size} ? ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN) : null;
        } catch (java.io.IOException | RuntimeException error) { return null; }
    }
    private static String ascii(ByteBuffer bytes, int offset, int length) { return new String(bytes.array(), offset, length, StandardCharsets.ISO_8859_1); }
    private static long word(ByteBuffer bytes, int offset) { return Integer.toUnsignedLong(bytes.getInt(offset)); }
    private static long[] entries(ByteBuffer bytes) {
        long[] counts = new long[6];
        for (int k = 0; k < 6; k++) counts[k] = bytes.getLong(232 + 8 * k);
        return counts;
    }
    private static boolean ours(ByteBuffer bytes) {
        return bytes != null && ascii(bytes, 0, 8).equals(${JSON.stringify(nativeFinGdbRecord.magic)}) && word(bytes, 8) == ${nativeFinGdbRecord.version} && word(bytes, 12) == 6
            && ascii(bytes, 16, 64).equals(config) && ascii(bytes, 80, 32).equals(nonce)
            && bytes.getLong(112) == ProcessHandle.current().pid() && word(bytes, 120) == 1;
    }
    // Exactly the given armed mask, no conflicting or foreign definition and no counted entry.
    private static boolean quiet(ByteBuffer bytes, long armed) {
        if (word(bytes, 124) != armed || word(bytes, 128) != 0 || word(bytes, 132) != 0) return false;
        for (long count : entries(bytes)) if (count != 0) return false;
        return true;
    }
    private static boolean covered(ByteBuffer bytes) {
        for (int k = 0; k < 6; k++) if (bytes.getLong(136 + 8 * k) != 1 || bytes.getInt(184 + 4 * k) != expected[k]) return false;
        return true;
    }
    private static int[] indices(String text) {
        String[] parts = text.split(",", -1);
        int[] values = new int[parts.length];
        for (int k = 0; k < parts.length; k++) values[k] = parts[k].matches("[0-9]{1,3}") ? Integer.parseInt(parts[k]) : -1;
        return values;
    }
    public static void main(String[] args) {
        if (args.length == 4 || args.length == 5) { record = args[0]; nonce = args[1]; config = args[2]; expected = indices(args[3]); }
        ByteBuffer before = expected.length == 6 ? instrumentation() : null;
        if (!ours(before) || !quiet(before, 0)) { System.err.print(${JSON.stringify(unattached)}); System.err.flush(); System.exit(2); }
        if (!trigger()) { System.err.print(${JSON.stringify(untriggered)}); System.err.flush(); System.exit(4); }
        ByteBuffer after = instrumentation();
        if (!ours(after) || !quiet(after, 0x3f) || !covered(after)) { System.err.print(${JSON.stringify(uncovered)}); System.err.flush(); System.exit(3); }
        measure(args.length == 5 ? args[4] : null);
        System.out.flush();
    }
    // The explicit load trigger: a public call that counts in no column extracts and opens the verified libraries.
    private static boolean trigger() {
        try { return Api.only(BigInteger.ZERO).equals(BigInteger.valueOf(7)); }
        catch (RuntimeException error) { return false; }
    }
    private static BigInteger n(String digits) { return new BigInteger(digits); }
    private static void report(String step, String status) {
        ByteBuffer bytes = instrumentation();
        if (bytes == null) throw new IllegalStateException("fin dispatch record is unreadable");
        StringBuilder line = new StringBuilder(step).append(' ').append(status);
        for (long count : entries(bytes)) line.append(' ').append(count);
        System.out.print(line.append('\\n'));
    }
    private static String status(Supplier<Object> call) {
        try {
            Object value = call.get();
            if (value instanceof BigInteger number) return "ok:" + number;
            return value instanceof String text && PRINTABLE.matcher(text).matches() ? "ok:" + text : "ok:unexpected";
        } catch (IllegalArgumentException error) {
            var match = REJECTED.matcher(String.valueOf(error.getMessage()));
            return match.matches() ? "rejected:" + match.group(1) + "<" + match.group(2) : "error:IllegalArgumentException";
        } catch (RuntimeException error) { return "error:" + error.getClass().getSimpleName(); }
    }
    private static void measure(String mode) {
        report("start", "ok");
${javaRows}
        if ("dynamic".equals(mode)) report("dynamic-impossible-adapter", status(() -> {
            try { return Api.class.getMethod("dynamicImpossibleAdapter").invoke(null); }
            catch (ReflectiveOperationException error) { throw new IllegalStateException(error); }
        }));
    }
}
`;

/** The same probe as a separate Kotlin caller of the public API, with its own record checks and trigger. */
const kotlinFinDispatchProbe = () => `import java.math.BigInteger
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.file.Files
import java.nio.file.Path
import kotlin.system.exitProcess
import org.leanbridge.native_fin.Api

private val rejectedPattern = Regex("(arg[0-9]+) is not below its Fin ([0-9]+) bound")
private val printablePattern = Regex("[!-~]+")
private var record = ""
private var nonce = ""
private var config = ""
private var expected = IntArray(0)

private fun instrumentation(): ByteBuffer? = try {
    val bytes = Files.readAllBytes(Path.of(record))
    if (bytes.size == ${nativeFinGdbRecord.size}) ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN) else null
} catch (error: java.io.IOException) { null } catch (error: RuntimeException) { null }
private fun ascii(bytes: ByteBuffer, offset: Int, length: Int) = String(bytes.array(), offset, length, Charsets.ISO_8859_1)
private fun word(bytes: ByteBuffer, offset: Int) = Integer.toUnsignedLong(bytes.getInt(offset))
private fun entries(bytes: ByteBuffer) = LongArray(6) { bytes.getLong(232 + 8 * it) }
private fun ours(bytes: ByteBuffer?) = bytes != null && ascii(bytes, 0, 8) == ${JSON.stringify(nativeFinGdbRecord.magic)} && word(bytes, 8) == ${nativeFinGdbRecord.version}L && word(bytes, 12) == 6L
    && ascii(bytes, 16, 64) == config && ascii(bytes, 80, 32) == nonce
    && bytes.getLong(112) == ProcessHandle.current().pid() && word(bytes, 120) == 1L
// Exactly the given armed mask, no conflicting or foreign definition and no counted entry.
private fun quiet(bytes: ByteBuffer, armed: Long) = word(bytes, 124) == armed && word(bytes, 128) == 0L && word(bytes, 132) == 0L && entries(bytes).all { it == 0L }
private fun covered(bytes: ByteBuffer) = (0 until 6).all { bytes.getLong(136 + 8 * it) == 1L && bytes.getInt(184 + 4 * it) == expected[it] }
private fun refuse(message: String, code: Int): Nothing {
    System.err.print(message)
    System.err.flush()
    exitProcess(code)
}

fun main(args: Array<String>) {
    if (args.size == 4 || args.size == 5) {
        record = args[0]; nonce = args[1]; config = args[2]
        expected = args[3].split(",").map { if (Regex("[0-9]{1,3}").matches(it)) it.toInt() else -1 }.toIntArray()
    }
    val before = if (expected.size == 6) instrumentation() else null
    if (!ours(before) || !quiet(before!!, 0L)) refuse(${JSON.stringify(unattached)}, 2)
    if (!trigger()) refuse(${JSON.stringify(untriggered)}, 4)
    val after = instrumentation()
    if (!ours(after) || !quiet(after!!, 0x3fL) || !covered(after)) refuse(${JSON.stringify(uncovered)}, 3)
    measure(if (args.size == 5) args[4] else null)
    System.out.flush()
}

// The explicit load trigger: a public call that counts in no column extracts and opens the verified libraries.
private fun trigger(): Boolean = try { Api.only(BigInteger.ZERO) == BigInteger.valueOf(7) } catch (error: RuntimeException) { false }
private fun n(digits: String) = BigInteger(digits)
private fun report(step: String, status: String) {
    val bytes = instrumentation() ?: throw IllegalStateException("fin dispatch record is unreadable")
    print(step + " " + status + " " + entries(bytes).joinToString(" ") + "\\n")
}
private fun status(call: () -> Any?): String = try {
    when (val value = call()) {
        is BigInteger -> "ok:" + value
        is String -> if (printablePattern.matches(value)) "ok:" + value else "ok:unexpected"
        else -> "ok:unexpected"
    }
} catch (error: IllegalArgumentException) {
    val match = rejectedPattern.matchEntire(error.message ?: "")
    if (match != null) "rejected:" + match.groupValues[1] + "<" + match.groupValues[2] else "error:IllegalArgumentException"
} catch (error: RuntimeException) { "error:" + error.javaClass.simpleName }
private fun measure(mode: String?) {
    report("start", "ok")
${kotlinRows}
    if (mode == "dynamic") report("dynamic-impossible-adapter", status { Api::class.java.getMethod("dynamicImpossibleAdapter").invoke(null) })
}
`;

const standInEvidence = libraries => ({ runtimeIdentity: sha256("JVM fin dispatch stand-in"), componentReceiptSha256: sha256("JVM fin dispatch stand-in receipt"), componentId: "native-fin@1.0.0", library: "libnative_fin.so", libraries });
const adapter = name => nativeFinAdapterSymbol("native-fin@1.0.0", `NativeFin.${name}`);
/**
 * A stand-in public API whose runtime class initializes the real generated extracting loader. Stand-in-only
 * environment hooks open extra library copies just before or after that loader, for the root controls, and
 * the extra dynamic method reaches the otherwise unreferenced Fin 0 adapter by symbol lookup.
 */
const standInApi = () => `package org.leanbridge.native_fin;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.lang.foreign.Arena;
import java.lang.foreign.FunctionDescriptor;
import java.lang.foreign.Linker;
import java.lang.foreign.MemorySegment;
import java.lang.foreign.SymbolLookup;
import java.lang.foreign.ValueLayout;
import java.lang.invoke.MethodHandle;
import java.math.BigInteger;
import java.nio.file.Files;
import java.nio.file.Path;

public final class Api {
    private Api() { }
    private static final class Runtime {
        private Runtime() { }
        static { hook("LEAN_BRIDGE_STAND_IN_BEFORE"); }
        static final SymbolLookup LOOKUP = NativeAssets.lookup();
        static { hook("LEAN_BRIDGE_STAND_IN_AFTER"); }
        static final FunctionDescriptor SCALAR = FunctionDescriptor.of(ValueLayout.JAVA_INT, ValueLayout.JAVA_LONG, ValueLayout.ADDRESS, ValueLayout.ADDRESS);
        static final MethodHandle MIRROR = handle("native_fin_mirror", SCALAR), IMPOSSIBLE = handle("native_fin_impossible", SCALAR), ONLY = handle("native_fin_only", SCALAR);
        static final MethodHandle LABEL = handle("native_fin_label", FunctionDescriptor.of(ValueLayout.JAVA_INT, ValueLayout.JAVA_LONG, ValueLayout.JAVA_LONG, ValueLayout.ADDRESS, ValueLayout.ADDRESS, ValueLayout.ADDRESS));
        static final MethodHandle DYNAMIC = handle(${JSON.stringify(adapter("impossible"))}, FunctionDescriptor.of(ValueLayout.ADDRESS, ValueLayout.ADDRESS));
        private static MethodHandle handle(String name, FunctionDescriptor descriptor) {
            return Linker.nativeLinker().downcallHandle(LOOKUP.find(name).orElseThrow(), descriptor);
        }
        // Copy the named libraries into a new extraction-style root under java.io.tmpdir and dlopen them there,
        // optionally through a symlinked root or symlinked files. dlopen sees the path as given, never canonicalized.
        private static void hook(String name) {
            String sources = System.getenv(name), link = System.getenv("LEAN_BRIDGE_STAND_IN_LINK");
            if (sources == null) return;
            try {
                Path root = Files.createTempDirectory("lean-bridge-jvm-"), store = link == null ? root : Files.createTempDirectory("stand-in-");
                if ("dir".equals(link)) { Files.delete(root); Files.createSymbolicLink(root, store); }
                for (String source : sources.split(":")) {
                    Path from = Path.of(source), copy = store.resolve(from.getFileName());
                    Files.copy(from, copy);
                    if ("file".equals(link)) Files.createSymbolicLink(root.resolve(from.getFileName()), copy);
                    open(root.resolve(from.getFileName()).toString());
                }
            } catch (IOException error) { throw new UncheckedIOException(error); }
        }
        private static void open(String path) {
            Linker linker = Linker.nativeLinker();
            MethodHandle dlopen = linker.downcallHandle(linker.defaultLookup().find("dlopen").orElseThrow(), FunctionDescriptor.of(ValueLayout.ADDRESS, ValueLayout.ADDRESS, ValueLayout.JAVA_INT));
            try (Arena arena = Arena.ofConfined()) {
                if (((MemorySegment)dlopen.invokeExact(arena.allocateFrom(path), 2)).address() == 0) throw new IllegalStateException("stand-in hook cannot open " + path);
            } catch (RuntimeException | Error failure) { throw failure; }
            catch (Throwable failure) { throw new IllegalStateException(failure); }
        }
    }
    private static long word(BigInteger value) {
        if (value.signum() < 0) throw new IllegalArgumentException("negative Nat");
        return value.bitLength() > 64 ? -1L : value.longValue();
    }
    private static BigInteger scalar(MethodHandle function, BigInteger value) {
        try (Arena arena = Arena.ofConfined()) {
            MemorySegment output = arena.allocate(8), error = arena.allocate(64);
            int status = (int)function.invokeExact(word(value), output, error);
            if (status != 0) throw new IllegalArgumentException(error.getString(0));
            return BigInteger.valueOf(output.get(ValueLayout.JAVA_LONG, 0));
        } catch (RuntimeException | Error failure) { throw failure; }
        catch (Throwable failure) { throw new IllegalStateException(failure); }
    }
    public static BigInteger mirror(BigInteger value0) { return scalar(Runtime.MIRROR, value0); }
    public static BigInteger impossible(BigInteger value0) { return scalar(Runtime.IMPOSSIBLE, value0); }
    public static BigInteger only(BigInteger value0) { return scalar(Runtime.ONLY, value0); }
    public static String label(BigInteger value0, BigInteger value1, String value2) {
        try (Arena arena = Arena.ofConfined()) {
            MemorySegment output = arena.allocate(64), error = arena.allocate(64);
            int status = (int)Runtime.LABEL.invokeExact(word(value0), word(value1), arena.allocateFrom(value2), output, error);
            if (status != 0) throw new IllegalArgumentException(error.getString(0));
            return output.getString(0);
        } catch (RuntimeException | Error failure) { throw failure; }
        catch (Throwable failure) { throw new IllegalStateException(failure); }
    }
    public static BigInteger dynamicImpossibleAdapter() {
        try { return BigInteger.valueOf(((MemorySegment)Runtime.DYNAMIC.invokeExact(MemorySegment.NULL)).address()); }
        catch (RuntimeException | Error failure) { throw failure; }
        catch (Throwable failure) { throw new IllegalStateException(failure); }
    }
}
`;
/** Stand-in Lean sources and their exported adapters, one library as in the component build. */
const standInComponent = () => `#include <stdint.h>
void *l_NativeFin_mirror(void *a0) { return (void *)(9 - (uintptr_t)a0); }
void *l_NativeFin_impossible(void *a0) { return a0; }
void *l_NativeFin_only(void *a0) { (void)a0; return (void *)7; }
void *l_NativeFin_label(void *a0, void *a1, void *a2) { (void)a2; return (void *)((uintptr_t)a0 + (uintptr_t)a1); }
void *${adapter("mirror")}(void *a0) { return l_NativeFin_mirror(a0); }
void *${adapter("impossible")}(void *a0) { return l_NativeFin_impossible(a0); }
void *${adapter("only")}(void *a0) { return l_NativeFin_only(a0); }
void *${adapter("label")}(void *a0, void *a1, void *a2) { return l_NativeFin_label(a0, a1, a2); }
`;
/**
 * The checked C entry points in the generated layout: each bound is checked before its adapter, and the
 * Fin 0 entry rejects without referencing its adapter at all. LEAK enters the mirror adapter first. The
 * stand-in trigger alone honors LEAN_BRIDGE_STAND_IN_TRIGGER=leak or =fail, for the load-trigger controls.
 */
const standInAdapter = () => `#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
void *${adapter("mirror")}(void *);
void *${adapter("only")}(void *);
void *${adapter("label")}(void *, void *, void *);
static volatile uintptr_t fin1 = 1, fin4 = 4, fin10 = 10;
static int reject(char *error, const char *message) { snprintf(error, 64, "%s", message); return 1; }
int native_fin_mirror(uintptr_t arg0, uintptr_t *out, char *error) {
#ifdef LEAK
  if (arg0 >= fin10) (void)${adapter("mirror")}((void *)arg0);
#endif
  if (arg0 >= fin10) return reject(error, "arg0 is not below its Fin 10 bound");
  *out = (uintptr_t)${adapter("mirror")}((void *)arg0); return 0;
}
int native_fin_impossible(uintptr_t arg0, uintptr_t *out, char *error) { (void)arg0; (void)out; return reject(error, "arg0 is not below its Fin 0 bound"); }
int native_fin_only(uintptr_t arg0, uintptr_t *out, char *error) {
  const char *trigger = getenv("LEAN_BRIDGE_STAND_IN_TRIGGER");
  if (trigger && strcmp(trigger, "leak") == 0) (void)${adapter("mirror")}((void *)0);
  if (trigger && strcmp(trigger, "fail") == 0) return reject(error, "stand-in trigger failure");
  if (arg0 >= fin1) return reject(error, "arg0 is not below its Fin 1 bound");
  *out = (uintptr_t)${adapter("only")}((void *)arg0); return 0;
}
int native_fin_label(uintptr_t arg0, uintptr_t arg1, const char *arg2, char *out, char *error) {
  if (arg1 >= fin4) return reject(error, "arg1 is not below its Fin 4 bound");
  snprintf(out, 64, "%s:%lu", arg2, (unsigned long)(uintptr_t)${adapter("label")}((void *)arg0, (void *)arg1, (void *)arg2)); return 0;
}
`;

/**
 * Compile the Java or Kotlin probe offline against one JAR; returns the class path entry and main class.
 *
 * @param root0 - Probe inputs.
 * @param root0.profile - Either "java" or "kotlin".
 * @param root0.root - Task-owned probe directory.
 * @param root0.jar - The JAR whose public API the probe calls.
 * @param root0.environment - Producer toolchain selection.
 */
const buildJvmProbe = async ({ profile, root, jar, environment }) => {
	if(profile === "java")
	{
		await saveLakeFile(root, "Probe.java", javaFinDispatchProbe());
		await runCopied(environment.LEAN_BRIDGE_JAVAC, ["--release", "22", "-Werror", "-Xlint:all", "-cp", jar, "-d", join(root, "classes"), "Probe.java"], root);
		return { classPath: `${jar}:${join(root, "classes")}`, main: "Probe" };
	}
	await saveLakeFile(root, "Probe.kt", kotlinFinDispatchProbe());
	await runCopied(environment.LEAN_BRIDGE_KOTLINC, ["-Werror", "-jvm-target", "22", "-cp", jar, "Probe.kt", "-include-runtime", "-d", join(root, "probe.jar")], root
		, { ...environment, JAVA_HOME: dirname(dirname(environment.LEAN_BRIDGE_JAVA)) });
	return { classPath: `${jar}:${join(root, "probe.jar")}`, main: "ProbeKt" };
};
const jvmProbeArgv = (java, { classPath, main }) => ({ record, nonce, configSha256, definerIndices, mode, tmpdir }) =>
	[java, "--enable-native-access=ALL-UNNAMED", `-Djava.io.tmpdir=${tmpdir}`, "-cp", classPath, main, record, nonce, configSha256, definerIndices.join(","), ...mode ? [mode] : []];

/**
 * One stand-in JAR: C stand-ins as packaged resources under the real generated loader, plus its own
 * resources extracted by the test for nm and hashing.
 *
 * @param root0 - Build inputs.
 * @param root0.root - Task-owned directory for this variant.
 * @param root0.flags - Extra C flags for the checked adapter.
 * @param root0.sources - Directory holding the stand-in C sources.
 * @param root0.environment - Producer toolchain selection.
 */
const buildStandInJar = async ({ root, flags, sources, environment }) => {
	const tools = { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin" }, staged = join(root, "native");
	const cc = args => runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-O2", "-shared", "-fPIC", ...args], root, tools);
	await mkdir(staged, { recursive: true });
	await cc([join(sources, "runtime.c"), "-o", join(staged, "libleanshared.so")]);
	await cc([join(sources, "runtime.c"), "-o", join(staged, "liblean_bridge_native.so")]);
	await cc([join(sources, "component.c"), "-o", join(staged, "libcomponent_stand_in.so")]);
	await cc([...flags, join(sources, "adapter.c"), "-L", staged, "-l:libcomponent_stand_in.so", "-Wl,-rpath,$ORIGIN", "-o", join(staged, "libnative_fin.so")]);
	const libraries = Object.fromEntries(await Promise.all((await readdir(staged)).sort().map(async name => [name, sha256(await readFile(join(staged, name)))])));
	const java = join(root, "src/org/leanbridge/native_fin");
	await saveLakeFile(java, "Api.java", standInApi());
	await saveLakeFile(java, "NativeAssets.java", copiedJvmAssets({ namespace: "org.leanbridge.native_fin" }, standInEvidence(libraries)));
	const classes = join(root, "classes"), packaged = join(classes, "META-INF/lean-bridge/native/linux-x64");
	await runCopied(environment.LEAN_BRIDGE_JAVAC, ["--release", "22", "-d", classes, join(java, "Api.java"), join(java, "NativeAssets.java")], root);
	await mkdir(packaged, { recursive: true });
	for(const name of Object.keys(libraries)) await cp(join(staged, name), join(packaged, name));
	const jar = join(root, "component.jar"), resources = join(root, "resources");
	await runCopied(join(dirname(environment.LEAN_BRIDGE_JAVAC), "jar"), ["--create", "--file", jar, "-C", classes, "."], root);
	await mkdir(resources);
	await runCopied("/usr/bin/unzip", ["-q", jar, "META-INF/lean-bridge/native/linux-x64/*", "-d", resources], root, tools);
	return { jar, staged, resources: join(resources, "META-INF/lean-bridge/native/linux-x64"), libraries };
};

// The configured JDK, Kotlin compiler and debugger, as in the installed acceptance.
const standInEnvironment = nativeFixtureEnvironment(["java", "kotlin"]);
const standInMissing = ["LEAN_BRIDGE_JAVA", "LEAN_BRIDGE_JAVAC", "LEAN_BRIDGE_KOTLINC"].map(name => standInEnvironment[name]).find(path => !existsSync(path))
	? "no JDK 22 or Kotlin compiler at the configured paths"
	: process.platform !== "linux" || process.arch !== "x64" ? "GDB entry counters target x86_64 Linux"
		: !existsSync(nativeFinGdbCommand) ? `no debugger at ${nativeFinGdbCommand}; entry-breakpoint controls need GDB with ptrace` : false;
// The gated installed acceptance requires these controls; only an ungated run may skip them.
const standInSkip = process.env.LEAN_BRIDGE_JVM_FIN_TEST === "1" ? false : standInMissing;
test("GDB entry breakpoints count a deep-bound extracting JVM stand-in from Java and Kotlin and refuse every other root, image or record", { skip: standInSkip, timeout: 1_200_000 }, async t => {
	assert.equal(standInMissing, false, `the gated JVM Fin acceptance requires its stand-in controls: ${standInMissing}`);
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-jvm-fin-gdb-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = standInEnvironment, java = environment.LEAN_BRIDGE_JAVA, componentId = "native-fin@1.0.0";
	const tools = { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin" }, sources = join(root, "src");
	await saveLakeFile(sources, "component.c", standInComponent());
	await saveLakeFile(sources, "adapter.c", standInAdapter());
	await saveLakeFile(sources, "runtime.c", "int lean_bridge_stand_in_runtime(void) { return 0; }\n");
	await saveLakeFile(sources, "wrong.c", "int lean_bridge_stand_in_runtime(void) { return 1; }\n");
	const jars = {};
	for(const [variant, flags] of [["package", []], ["leaking", ["-DLEAK"]]]) jars[variant] = await buildStandInJar({ root: join(root, variant), flags, sources, environment });
	// The same basename with other bytes, outside every extraction root.
	const wrong = join(root, "wrong/libleanshared.so");
	await mkdir(dirname(wrong));
	await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Werror", "-O2", "-shared", "-fPIC", join(sources, "wrong.c"), "-o", wrong], root, tools);
	assert.notEqual(sha256(await readFile(wrong)), jars.package.libraries["libleanshared.so"]);
	// As generated, nothing in the deployment references the Fin 0 adapter.
	const relocations = (await runCopied("/usr/bin/readelf", ["-rW", join(jars.package.staged, "libnative_fin.so")], root, tools)).stdout;
	assert.ok(relocations.includes(adapter("mirror")) && !relocations.includes(adapter("impossible")));
	// Both probe callers compile against the generated copied API as well as against the stand-in.
	const exported = [["impossible", ["nat"], "nat"], ["only", ["nat"], "nat"], ["mirror", ["nat"], "nat"], ["label", ["nat", "nat", "string"], "string"]];
	const ir = corpusReviewedIr({ id: "native-fin" }, exported.map(([name, parameters, result]) => ({ name: `NativeFin.${name}`, parameters, result })));
	const generated = Object.entries(renderCopiedJvmPackage(compileCopiedJvmModel(ir))).filter(([path]) => path.endsWith(".java"));
	const generatedRoot = join(root, "generated");
	for(const [path, source] of generated) await saveLakeFile(dirname(join(generatedRoot, "src", path)), basename(path), source);
	await runCopied(environment.LEAN_BRIDGE_JAVAC, ["--release", "22", "-d", join(generatedRoot, "classes"), ...generated.map(([path]) => join(generatedRoot, "src", path))], root);
	for(const profile of ["java", "kotlin"]) await buildJvmProbe({ profile, root: join(generatedRoot, profile), jar: join(generatedRoot, "classes"), environment });
	const probes = {};
	for(const profile of ["java", "kotlin"]) probes[profile] = await buildJvmProbe({ profile, root: join(root, `${profile}-probe`), jar: jars.package.jar, environment });
	const observe = (variant, probe, profile = "java", definers = null) => observeExtractedNativeFinDispatch({
		probeRoot: join(root, probe)
		, resourceDirectory: jars[variant].resources
		, componentId
		, argv: jvmProbeArgv(java, variant === "package" ? probes[profile] : { ...probes[profile], classPath: probes[profile].classPath.replace(jars.package.jar, jars[variant].jar) })
		, cwd: root
		, env: copiedCleanEnvironment
		, definers
	});
	const refused = (run, code, stderr) => {
		assert.equal(run.code, code, run.output);
		assert.equal(run.stdout ?? "", ""); if(stderr !== null) assert.equal(run.stderr, stderr);
	};
	const poisoned = (run, reason) => {
		assert.equal(run.code, nativeFinGdbExit.instrumentation, run.output);
		assert.match(run.output, new RegExp(`fin instrumentation refused: deployment refused: ${reason}`, "u"));
	};
	for(const profile of ["java", "kotlin"])
	{
		const observer = await observe("package", `${profile}-run`, profile);
		assert.deepEqual(observer.identity.definers, Array(6).fill("libcomponent_stand_in.so"));
		// Without GDB no record exists, and the probe refuses before its load trigger.
		const missing = await observer.run({ gdb: false });
		refused(missing, 2, unattached);
		assert.equal(existsSync(missing.record), false);
		// The trigger extracts into one root below the run's parent; all six entries are armed there.
		const accepted = await observer.run();
		assert.equal(accepted.code, 0, accepted.output); assert.equal(accepted.stderr, "");
		const observed = readNativeFinDispatch(accepted.stdout, jvmFinDispatchExpected);
		assert.deepEqual(observed, jvmFinDispatchExpected);
		const { root: extracted, breakpoints } = await assertExtractedNativeFinGdbRun(observer, accepted, observed);
		assert.equal(dirname(extracted), accepted.parent); assert.equal(breakpoints.length, 6);
		if(profile === "kotlin") continue;
		// A record carrying any other PID than the one GDB armed is refused.
		const foreignPid = await readFile(accepted.record);
		foreignPid.writeBigInt64LE(foreignPid.readBigInt64LE(112) + 1n, 112);
		await writeFile(join(root, "foreign-pid.record"), foreignPid, { flag: "wx" });
		await assert.rejects(() => assertExtractedNativeFinGdbRun(observer, { ...accepted, record: join(root, "foreign-pid.record") }, observed), /the record belongs to the instrumented inferior/u);
		// A second root with identical bytes, before the loader's own root is complete, poisons the run.
		poisoned(await observer.run({ extra: { LEAN_BRIDGE_STAND_IN_BEFORE: join(jars.package.staged, "libcomponent_stand_in.so") } }), "a second extraction root");
		// So does an identical copy in another root after arming.
		poisoned(await observer.run({ extra: { LEAN_BRIDGE_STAND_IN_AFTER: join(jars.package.staged, "libcomponent_stand_in.so") } }), "libcomponent_stand_in\\.so loaded again after arming");
		// The same basename with other bytes in an extraction-style root is refused by content.
		poisoned(await observer.run({ extra: { LEAN_BRIDGE_STAND_IN_BEFORE: wrong } }), "libleanshared\\.so has bytes");
		// A symlinked root or a symlinked library is refused, even with the verified bytes.
		for(const link of ["dir", "file"])
			poisoned(await observer.run({ extra: { LEAN_BRIDGE_STAND_IN_BEFORE: join(jars.package.staged, "libleanshared.so"), LEAN_BRIDGE_STAND_IN_LINK: link } }), "symlinked extraction root or library");
		// Libraries extracted outside the run's parent, or preloaded from anywhere, are never adopted.
		const outside = join(root, "outside");
		await mkdir(outside);
		poisoned(await observer.run({ tmpdir: outside }), "\\S+ loaded from outside a direct extraction child of the parent");
		poisoned(await observer.run({ extra: { LD_PRELOAD: Object.keys(jars.package.libraries).map(name => join(jars.package.staged, name)).join(":") } }), "\\S+ loaded from outside a direct extraction child of the parent");
		// A parent that is not fresh and empty is refused before the inferior starts.
		const planted = await observer.run({ before: (record, parent) => writeFile(join(parent, "planted"), "") });
		refused(planted, nativeFinGdbExit.refusedRecord, null);
		assert.match(planted.output, /the extraction parent is not a fresh, empty, canonical directory/u);
		// A trigger that enters a counted column, or that fails, yields no rows.
		const leakyTrigger = await observer.run({ extra: { LEAN_BRIDGE_STAND_IN_TRIGGER: "leak" } });
		refused(leakyTrigger, 3, uncovered);
		assert.deepEqual(readNativeFinGdbRecord(await readFile(leakyTrigger.record)).entries, [1, 0, 0, 1, 0, 0]);
		refused(await observer.run({ extra: { LEAN_BRIDGE_STAND_IN_TRIGGER: "fail" } }), 4, untriggered);
		// A failed count write or arming callback ends the run with 71, so no rows are accepted.
		const lost = await observer.run({ inject: { write: 3 } });
		assert.equal(lost.code, nativeFinGdbExit.instrumentation, lost.output);
		assert.match(lost.output, /fin instrumentation refused: entry count for column \d failed: injected record write failure/u);
		assert.throws(() => readNativeFinDispatch(lost.stdout ?? "", jvmFinDispatchExpected), TypeError);
		const unarmed = await observer.run({ inject: { arm: true } });
		assert.equal(unarmed.code, nativeFinGdbExit.instrumentation, unarmed.output);
		assert.match(unarmed.output, /fin instrumentation refused: instrumentation callback failed: injected arming failure/u);
		assert.equal(unarmed.stdout, "");
		// A computed-address call of the otherwise unreferenced Fin 0 adapter is an actual counted entry.
		const dynamic = await observer.run({ mode: "dynamic" });
		assert.equal(dynamic.code, 0, dynamic.output);
		const extended = [...jvmFinDispatchExpected, ["dynamic-impossible-adapter", "ok:0", [2, 1, 2, 2, 1, 2]]];
		assert.equal(dynamic.stdout, extended.map(([step, status, counts]) => `${step} ${status} ${counts.join(" ")}\n`).join(""));
		// A stale valid record is never adopted, with a fresh nonce or with its own nonce replayed.
		const stale = await readFile(accepted.record);
		for(const nonce of [undefined, accepted.nonce])
		{
			const attempt = await observer.run({ nonce, before: path => writeFile(path, stale, { flag: "wx" }) });
			refused(attempt, nativeFinGdbExit.refusedRecord, null);
			assert.match(attempt.output, /fin instrumentation refused: \[Errno 17\] File exists/u);
			assert.ok((await readFile(attempt.record)).equals(stale), "the stale record is untouched");
		}
		// Adapters configured in the wrong library are reported as foreign and never armed.
		const misplaced = Object.fromEntries(nativeFinDispatchSymbols(componentId).map((symbol, k) => [symbol, k < 3 ? "libcomponent_stand_in.so" : "libnative_fin.so"]));
		const misarmed = await (await observe("package", "wrong", "java", misplaced)).run();
		refused(misarmed, 3, uncovered);
		const partial = readNativeFinGdbRecord(await readFile(misarmed.record));
		assert.deepEqual([partial.armed, partial.foreign, partial.breakpoints], [0b000111, 3, [1, 1, 1, 0, 0, 0]]);
		// A C entry point that enters its adapter before rejecting is caught at its first invalid row.
		const leak = await (await observe("leaking", "leak")).run();
		assert.equal(leak.code, 0, leak.output);
		assert.match(leak.stdout, /^invalid-mirror-bound rejected:arg0<10 1 0 0 1 0 0$/mu);
		assert.throws(() => readNativeFinDispatch(leak.stdout, jvmFinDispatchExpected), /invalid-mirror-bound was rejected but changed counts by 1 0 0 1 0 0/u);
	}
});

test("JVM packages are checked Fin consumers beside C, C++, Python, Rust, Ruby and .NET", () => {
	for(const targets of [["maven"], ["c", "maven"], ["c", "cpp", "pypi", "cargo", "rubygems", "nuget", "maven"]])
		assert.equal(supportsNativeRefinementTargets(targets), true, targets.join(","));
	assert.equal(supportsNativeRefinementTargets(["maven", "cpan"]), true);
});

test("generated JVM bound docs come only from checked refinement metadata", () => {
	const ir = corpusReviewedIr({ id: "fins" }, [
		{ name: "Fins.label", parameters: ["nat", "nat", "string"], result: "string" }
		, { name: "Fins.plain", parameters: ["nat"], result: "nat" }]);
	const label = ir.declarations.find(item => item.id === "lean:Fins.label");
	label.source.extensions["lean-lang.org/refinements"] = { parameters: [null, { kind: "fin", bound: "4" }, null], result: null };
	const files = renderCopiedJvmPackage(compileCopiedJvmModel(ir));
	const api = Object.entries(files).find(([path]) => path.endsWith("/Api.java"))[1];
	assert.match(api, /\/\*\*\n \* Checked Lean Fin bounds: arg1 &lt; 4\.\n \*\/\n {4}public static String label\(/);
	assert.doesNotMatch(api, /bounds:[^\n]*\n[^\n]*\n {4}public static [^\n]* plain\(/);
	assert.match(files["README.md"], /Lean Fin n parameters and results are java\.math\.BigInteger values below n\./);
	assert.match(files["README.md"], /\n- org\.leanbridge\.fins\.Api\.label: arg1 < 4\n/);
	// A top-level Subtype documents its checked constructor; one inside a container is refused.
	label.source.extensions["lean-lang.org/refinements"] = { parameters: [null, { kind: "subtype", constructor: "Fins.check" }, null], result: null };
	const checked = renderCopiedJvmPackage(compileCopiedJvmModel(ir));
	assert.match(checked["README.md"], /arg1 checked by Fins\.check/);
	assert.match(checked["README.md"], /Lean Subtype parameters cross as their base value\./);
	assert.doesNotMatch(checked["README.md"], /Lean Fin n parameters/);
	label.source.extensions["lean-lang.org/refinements"] = { parameters: [null, { kind: "array", arguments: [{ kind: "subtype", constructor: "Fins.check" }] }, null], result: null };
	assert.throws(() => renderCopiedJvmPackage(compileCopiedJvmModel(ir)), TypeError);
});

const checkInstalledJvmFin = async (t, reviewed = false) => {
	const environment = nativeFixtureEnvironment(["c", "java", "kotlin"]), reports = [], archives = [];
	for(const attempt of [0, 1])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-jvm-fin-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-jvm-fin-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/native-fin", projectRoot, { recursive: true });
		const reviewedSource = reviewed ? canonicalJson(reviewedScalarHostIr()) : null;
		if(reviewed) await saveLakeFile(projectRoot, "api.binding-ir.json", reviewedSource);
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["NativeFin"]
			, targets: { c: { name: "native-fin", version: "1.0.0" }, maven: { name: "org.leanbridge:native-fin", version: "1.0.0" } } }));
		t.diagnostic(`build ${attempt}: compiling the shared C library and Maven JAR`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["c", "maven"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json"), "utf8"));
		assert.deepEqual(Object.fromEntries(model.exports.map(item => [item.name, bounds(item.refinements)])), expectedBounds);
		if(reviewed)
		{
			assert.equal(model.sourceIdentity.reviewedBindingIr.source, reviewedSource);
			assert.equal(model.sourceIdentity.reviewedBindingIr.sourceSha256, sha256(reviewedSource));
		}
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		archives.push(Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(artifact => [artifact.path, artifact.sha256]))));
		await rm(author, { recursive: true, force: true });
		if(attempt === 1) break;
		const cPackage = receipt.packages.find(pkg => pkg.target === "c" && pkg.role === "component");
		const extracted = join(consumer, "c-extract");
		await saveLakeFile(extracted, ".keep", "");
		await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xf", join(handoff, cPackage.artifacts[0].path)], extracted);
		const cInstalled = join(extracted, `${cPackage.name}-${cPackage.version}-c`);
		const cReceipt = JSON.parse(await readFile(join(cInstalled, "lean-bridge-package.json"), "utf8"));
		await verifyNativeFiles(cInstalled, cReceipt.files);
		const cLibraries = sharedLibraries(cReceipt.files);
		// The JAR bundles the exact checked adapter that the C, Python and Rust probes instrument.
		const packages = receipt.packages.filter(pkg => pkg.target === "maven");
		const jar = join(consumer, "jar");
		await saveLakeFile(jar, ".keep", "");
		await runCopied("/usr/bin/unzip", ["-q", join(handoff, packages.flatMap(pkg => pkg.artifacts).find(item => item.path.endsWith(".jar")).path), "-d", jar], consumer);
		const nativeDirectory = join(jar, "META-INF/lean-bridge/native/linux-x64");
		const packageLibraries = Object.fromEntries(await Promise.all((await readdir(nativeDirectory)).filter(name => /\.so(?:\.|$)/.test(name))
			.map(async name => [name, sha256(await readFile(join(nativeDirectory, name)))])));
		const shared = Object.keys(packageLibraries).filter(name => Object.hasOwn(cLibraries, name)).sort();
		assert.ok(shared.includes("libnative_fin.so"), JSON.stringify({ maven: packageLibraries, c: cLibraries }));
		for(const name of shared) assert.equal(packageLibraries[name], cLibraries[name], name);
		const docs = (await Promise.all((await readdir(jar, { recursive: true })).filter(path => path.endsWith("Api.java")).map(path => readFile(join(jar, path), "utf8")))).join("\n");
		assert.match(docs, /Checked Lean Fin bounds: arg0 &lt; 10; result &lt; 10\./);
		// Java and Kotlin each compile against the one installed JAR, without producer files or Lean/C compilers.
		// The counted adapters are the model's own exports for this component identity.
		assert.equal(model.component.id, "native-fin@1.0.0");
		for(const name of ["mirror", "impossible", "label"])
			assert.equal(model.exports.find(item => item.name === `NativeFin.${name}`).symbol, nativeFinAdapterSymbol(model.component.id, `NativeFin.${name}`), name);
		// The JAR loader opens its extracted libraries with RTLD_DEEPBIND, which bypasses LD_PRELOAD; installed entry
		// counts need GDB with ptrace, and their absence fails this gated acceptance, never skips it.
		assert.ok(existsSync(nativeFinGdbCommand), `GDB is required at ${nativeFinGdbCommand} for installed JVM entry counts; set LEAN_BRIDGE_GDB, and ptrace must be permitted`);
		const jarArtifact = packages.flatMap(pkg => pkg.artifacts).find(item => item.path.endsWith(".jar"));
		for(const [profile, source, entry] of [["java", javaFinConsumer, relocated => `${join(relocated, "component.jar")}:${relocated}`], ["kotlin", kotlinFinConsumer, relocated => `${join(relocated, "component.jar")}:${join(relocated, "consumer.jar")}`]])
		{
			t.diagnostic(`offline ${profile} compilation and execution`);
			const fixture = { source, success: `${profile}-fin-ok` };
			const { command, ...observation } = await installCopiedConsumer({ profile, consumer, handoff, packages, environment, fixture });
			const root = join(consumer, profile), relocated = join(consumer, `${profile}-relocated`);
			await rename(root, relocated);
			const repeated = await runCopied(command, ["--enable-native-access=ALL-UNNAMED", "-cp", entry(relocated), profile === "java" ? "Consumer" : "ConsumerKt"], relocated, copiedCleanEnvironment);
			assert.equal(repeated.stderr, ""); assert.equal(repeated.stdout.trim(), `${profile}-fin-ok:${observation.checks}`);
			t.diagnostic(`per-step source and adapter counts from ${profile} in a relocated cold JVM under GDB entry breakpoints`);
			// This caller's own probe compiles offline against the relocated installed JAR, the handoff's exact bytes.
			const installedJar = join(relocated, "component.jar");
			assert.equal(sha256(await readFile(installedJar)), jarArtifact.sha256);
			const probe = await buildJvmProbe({ profile, root: join(relocated, "probe"), jar: installedJar, environment });
			const observer = await observeExtractedNativeFinDispatch({
				probeRoot: join(consumer, `${profile}-dispatch`)
				, resourceDirectory: nativeDirectory
				, componentId: model.component.id
				, argv: jvmProbeArgv(command, probe)
				, cwd: relocated
				, env: copiedCleanEnvironment
			});
			// Without GDB the probe refuses before its load trigger, and no record appears.
			const missing = await observer.run({ gdb: false });
			assert.equal(missing.code, 2, missing.output); assert.equal(missing.stdout, ""); assert.equal(missing.stderr, unattached);
			assert.equal(existsSync(missing.record), false);
			const accepted = await observer.run();
			assert.equal(accepted.code, 0, `instrumented probe failed (2 armed before the trigger, 3 uncovered, 4 trigger failed, 70 stale record or parent, 71 ptrace, instrumentation or refused deployment, 72 signal): ${accepted.output}`);
			assert.equal(accepted.stderr, "");
			const observed = readNativeFinDispatch(accepted.stdout, jvmFinDispatchExpected);
			assert.deepEqual(observed, jvmFinDispatchExpected);
			const { breakpoints } = await assertExtractedNativeFinGdbRun(observer, accepted, observed);
			const dispatch = {
				columns: observer.identity.columns
				, observed
				, instrument: "gdb-breakpoints-extracted-root"
				, instrumentation: "in-memory int3 breakpoints at each verified definition in one hashed extraction root below a fresh run-owned java.io.tmpdir; deployed files and the production loader are unchanged"
				, routes: jvmFinDispatchRoutes(profile)
				, loadTrigger: jvmLoadTrigger
				, positiveControl: `valid public ${profile === "java" ? "Java" : "Kotlin"} calls increment exactly their source and adapter columns; rejected calls, including every Fin 0 call, change no column`
				, probeSha256: sha256(profile === "java" ? javaFinDispatchProbe() : kotlinFinDispatchProbe())
				, scriptSha256: sha256(nativeFinGdbExtractedScript)
				, configSha256: observer.configSha256
				, gdb: { version: (await runCopied(nativeFinGdbCommand, ["--version"], relocated, copiedCleanEnvironment)).stdout.split("\n")[0], sha256: sha256(await readFile(await realpath(nativeFinGdbCommand))) }
				, definers: observer.identity.definers
				, breakpoints
				, libraries: observer.identity.hashes
				, scope: "x86_64 Linux with GDB and ptrace; one cold process per caller"
			};
			reports.push({ profile, path: reviewed ? "reviewed-ir" : "ordinary-source"
				, ...observation
				, packages
				, sharedNativeLibraries: Object.fromEntries(shared.map(name => [name, packageLibraries[name]]))
				, dispatch
				, bindingIrSha256: built.bindingIrSha256
				, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
				, modelSha256: sha256(canonicalJson(model))
				, receiptSha256: sha256(await readFile(join(handoff, "package-set-receipt.json")))
				, ...(reviewed ? { reviewedSourceSha256: model.sourceIdentity.reviewedBindingIr.sourceSha256 } : {})
				, sourceRemovedBeforeInstallation: true
				, relocatedInstallation: true, repeatExecution: true });
		}
		await rm(consumer, { recursive: true, force: true });
	}
	assert.deepEqual(archives[1], archives[0]);
	await saveLakeFile("build/native-fin", reviewed ? "jvm-reviewed.json" : "jvm.json", canonicalJson({ schemaVersion: 1, reports, archives: archives[0], reproducible: true }));
};

test("relocated source-free JVM packages check Fin bounds from Java and Kotlin through the bundled C adapter", { skip: process.env.LEAN_BRIDGE_JVM_FIN_TEST !== "1", timeout: 2_400_000 }, t => checkInstalledJvmFin(t));

test("independently reviewed Jvm packages check scalar Fin through installed consumers", { skip: process.env.LEAN_BRIDGE_JVM_FIN_TEST !== "1", timeout: 2_400_000 }, t => checkInstalledJvmFin(t, true));
