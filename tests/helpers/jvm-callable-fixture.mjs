/**
 * Independent typed Java and Kotlin callable consumers, not generated-API introspection.
 *
 * @file
 */
import { callableArities, callablePrimitives, callableSignatures } from "./callable-fixture.mjs";

export const jvmCallableSignatures = [...callableSignatures
	, { name: "Callables.retainCallback", parameters: [{ callback: { parameters: ["uint32"], result: "uint32" } }], result: { callback: { parameters: ["uint32"], result: "uint32" } } }
	, { name: "Callables.combine", parameters: ["string", "uint64", { callback: { parameters: ["string", "uint64"], result: "string" } }, { callback: { parameters: ["string"], result: "string" } }], result: "string" }
	, { name: "Callables.wide", parameters: ["uint32", { callback: { parameters: Array(16).fill("uint32"), result: "uint32" } }], result: "uint32" }
	, { name: "Callables.makeWide", parameters: ["uint32"], result: { callback: { parameters: Array(16).fill("uint32"), result: "uint32" } } }
	, { name: "Callables.makeAdder", parameters: ["uint32"], result: { callback: { parameters: ["uint32"], result: "uint32" } } }];
export const jvmCallableArities = { ...callableArities, "Callables.retainCallback": 1, "Callables.makeWide": 1, "Callables.makeAdder": 1 };

const values = {
	unit: ["Unit", "LeanUnit", ["Unit.INSTANCE"]]
	, bool: ["boolean", "Boolean", ["false", "true"]]
	, uint8: ["int", "Int", ["0", "1", "127", "128", "255"]]
	, uint16: ["int", "Int", ["0", "1", "32767", "32768", "65535"]]
	, uint32: ["long", "Long", ["0L", "1L", "2147483647L", "2147483648L", "4294967295L"]]
	, uint64: ["BigInteger", "BigInteger", ["BigInteger.ZERO", "BigInteger.ONE", ...[32, 53].map(bit => `BigInteger.ONE.shiftLeft(${bit}).add(BigInteger.ONE)`), "BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE)"]]
	, int8: ["byte", "Byte", ["Byte.MIN_VALUE", "(byte)-1", "(byte)0", "(byte)1", "Byte.MAX_VALUE"]]
	, int16: ["short", "Short", ["Short.MIN_VALUE", "(short)-1", "(short)0", "(short)1", "Short.MAX_VALUE"]]
	, int32: ["int", "Int", ["Integer.MIN_VALUE", "-1", "0", "1", "Integer.MAX_VALUE"]]
	, int64: ["long", "Long", ["Long.MIN_VALUE", "-9007199254740993L", "-1L", "0L", "1L", "Long.MAX_VALUE"]]
	, nat: ["BigInteger", "BigInteger", ["BigInteger.ZERO", "BigInteger.ONE", ...[31, 32, 53, 64, 255, 4096, 16384].map(bit => `BigInteger.ONE.shiftLeft(${bit}).add(BigInteger.ONE)`)]]
	, int: ["BigInteger", "BigInteger", ["BigInteger.ZERO", "BigInteger.ONE", ...[31, 32, 53, 64, 255, 4096, 16384].flatMap(bit => [`BigInteger.ONE.shiftLeft(${bit}).add(BigInteger.ONE)`, `BigInteger.ONE.shiftLeft(${bit}).add(BigInteger.ONE).negate()`])]]
	, float32: ["float", "Float", ["0f", "-0f", "Float.MIN_VALUE", "-Float.MIN_VALUE", "Float.MAX_VALUE", "Float.NaN", "Float.POSITIVE_INFINITY", "Float.NEGATIVE_INFINITY", "1.0000001f"]]
	, float64: ["double", "Double", ["0.0", "-0.0", "Double.MIN_VALUE", "-Double.MIN_VALUE", "Double.MAX_VALUE", "Double.NaN", "Double.POSITIVE_INFINITY", "Double.NEGATIVE_INFINITY", "1.0000000000000002"]]
	, string: ["String", "String", ['""', '"a\\u0000λ🌿"', '"e\\u0301"', '"\\ufdd0\\uffff"', '"\\r\\n"', '"x".repeat(2048)']]
	, bytes: ["byte[]", "ByteArray", ["new byte[0]", "new byte[] { 0, -1, -128, 1 }", "allBytes()"]]
	, char: ["int", "Int", ["0", "0x10ffff", "0xd7ff", "0xe000", "0x301", "0x1f33f", "0xfdd0"]]
};
values.usize = values.uint64; values.isize = values.int64;
const fnName = kind => ({ uint8: "UInt8", uint16: "UInt16", uint32: "UInt32", uint64: "UInt64", usize: "USize", isize: "ISize" })[kind] ?? kind[0].toUpperCase() + kind.slice(1);
const suffix = name => name.replace("UInt", "Uint").replace("USize", "Usize").replace("ISize", "Isize");
const kotlinValue = value => value.replaceAll("Unit.INSTANCE", "LeanUnit.INSTANCE").replace(/\bInteger\./g, "Int.")
	.replace(/\(byte\)(-?\d+)/g, "($1).toByte()").replace(/\(short\)(-?\d+)/g, "($1).toShort()")
	.replace("new byte[0]", "byteArrayOf()").replace("new byte[] { 0, -1, -128, 1 }", "byteArrayOf(0, -1, -128, 1)");

/**
 * Public method and SAM types are determined by this independent primitive table.
 *
 * @param profile - Java or Kotlin.
 */
export const jvmCallablePublicChecks = profile => callablePrimitives.map(([name, kind]) => {
	const [type, kotlin] = values[kind], fn = fnName(kind), method = suffix(name);
	return profile === "java" ? `check(Api.class.getMethod("call${method}", ${type}.class, Fn${fn}To${fn}.class).getReturnType() == ${kind === "unit" ? "void" : type}.class);
            check(Api.class.getMethod("make${method}", ${type}.class).getReturnType() == FnBool${fn}To${fn}.LeanClosure.class);`
		: `val call${method}: (${kotlin}, Fn${fn}To${fn}) -> ${kind === "unit" ? "kotlin.Unit" : kotlin} = Api::call${method}
    val make${method}: (${kotlin}) -> FnBool${fn}To${fn}.LeanClosure = Api::make${method}
    Wire.consume(call${method}); Wire.consume(make${method})`;
}).join("\n");

const javaConsumer = () => `import org.leanbridge.callables.*;
import java.math.BigInteger;
import java.util.*;
import java.lang.ref.*;
import java.util.concurrent.atomic.AtomicReference;
class Consumer {
    static int checks;
    static void check(boolean value) { if (!value) throw new AssertionError("Check " + checks); ++checks; }
    static void equal(Object a, Object b) { check(Objects.deepEquals(a, b)); }
    static byte[] allBytes() { byte[] result = new byte[256]; for (int i = 0; i < 256; ++i) result[i] = (byte)i; return result; }
    static <T extends Throwable> T reject(Class<T> type, Runnable call) { try { call.run(); } catch (Throwable error) { if (!type.isInstance(error)) throw new AssertionError(error); ++checks; return type.cast(error); } throw new AssertionError("Accepted invalid call"); }
    @SuppressWarnings("unchecked") static <T extends Throwable> void raise(Throwable error) throws T { throw (T)error; }
    static void throwMarker(Throwable marker) { Consumer.<RuntimeException>raise(marker); }
    static long reenter(int depth) { return depth == 0 ? 42 : Api.callUint32(depth, value -> reenter(depth - 1)); }
    static WeakReference<Object> abandoned() { return new WeakReference<>(Api.makeString("abandoned")); }
    static FnBoolUInt32ToUInt32 alias() { var closure = Api.makeUint32(42); return closure::invoke; }
    public static void main(String[] args) throws Exception {
        check(Api.wordBits() == 64);
        ${jvmCallablePublicChecks("java")}
${callablePrimitives.map(([name, kind]) => {
	const [type, , cases] = values[kind], method = suffix(name), u = kind === "unit";
	return `        {
            ${type}[] values = new ${type.replace("[]", "")}[]${type.endsWith("[]") ? "[]" : ""} { ${cases.join(", ")} };
            for (int iteration = 0; iteration < 64; ++iteration) for (var value : values) {
                ${u ? "Api.callUnit(value, v -> { }); ++checks;" : `equal(Api.call${method}(value, v -> v), value);`}
                int[] calls = {0};
                ${u ? "Api.twiceUnit(value, v -> { ++calls[0]; });" : `equal(Api.twice${method}(value, v -> { ++calls[0]; return v; }), value);`}
                check(calls[0] == 2);
                var closure = Api.make${method}(value);
                try {
                    ${u ? "closure.invoke(true, Unit.INSTANCE); closure.invoke(false, Unit.INSTANCE); checks += 2;" : "equal(closure.invoke(true, values[0]), value); equal(closure.invoke(false, values[0]), values[0]);"}
                    check(!closure.isClosed()); closure.close(); closure.close(); check(closure.isClosed());
                    reject(IllegalStateException.class, () -> closure.invoke(true, values[0]));
                } finally { closure.close(); }
            }
            var marker = new IllegalArgumentException("callback\\0λ"); var suppressed = new Exception("identity"); marker.addSuppressed(suppressed); int[] calls = {0};
            var caught = reject(IllegalArgumentException.class, () -> Api.twice${method}(values[0], v -> { ++calls[0]; throw marker; }));
            check(caught == marker && caught.getSuppressed()[0] == suppressed && calls[0] == 1);
            reject(NullPointerException.class, () -> Api.call${method}(values[0], null));
        }`;
}).join("\n")}
        check(Api.wide(100, (${Array.from({ length: 16 }, (_, i) => `a${i}`).join(", ")}) -> { ${Array.from({ length: 16 }, (_, i) => `check(a${i} == ${i ? i : 100});`).join(" ")} return 42; }) == 42);
        try (var wide = Api.makeWide(3)) { check(wide.invoke(${Array.from({ length: 16 }, (_, i) => i).join(", ")}) == 197968); }
        try (var adder = Api.makeAdder(2)) { check(Api.twiceUint32(40, adder) == 44); }
        equal(Api.combine("λ", BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE), (text, number) -> text + number, text -> text + "!"), "λ18446744073709551615!");
        for (Throwable marker : new Throwable[] { new Error("error"), new Exception("checked"), new RuntimeException("runtime") }) {
            var stack = marker.getStackTrace();
            var caught = reject(Throwable.class, () -> Api.callUint32(1, value -> { throwMarker(marker); return value; }));
            check(caught == marker && Arrays.equals(caught.getStackTrace(), stack));
        }
        int[] later = {0}; var first = new Error("first");
        check(reject(Error.class, () -> Api.combine("x", BigInteger.ONE, (text, number) -> { throw first; }, text -> { ++later[0]; return text; })) == first); check(later[0] == 0);
        for (int i = 0; i < 30; ++i) equal(Api.callString("rooted\\0λ", value -> { System.gc(); return value; }), "rooted\\0λ");
        byte[] input = {1,2}; var retained = new AtomicReference<byte[]>();
        var copied = Api.callBytes(input, value -> { retained.set(value); value[0] = 3; return value; });
        check(input[0] == 1 && copied[0] == 3); retained.get()[0] = 4; check(copied[0] == 3);
        reject(IllegalArgumentException.class, () -> Api.callNat(BigInteger.valueOf(-1), value -> value));
        reject(IllegalArgumentException.class, () -> Api.callNat(BigInteger.ONE, value -> BigInteger.valueOf(-1)));
        reject(IllegalArgumentException.class, () -> Api.callUint8(1, value -> 256));
        reject(IllegalArgumentException.class, () -> Api.callUint16(1, value -> -1));
        reject(IllegalArgumentException.class, () -> Api.callUint32(1, value -> 4294967296L));
        reject(IllegalArgumentException.class, () -> Api.callUint64(BigInteger.ONE, value -> BigInteger.ONE.shiftLeft(64)));
        reject(IllegalArgumentException.class, () -> Api.callUsize(BigInteger.ONE, value -> BigInteger.valueOf(-1)));
        reject(IllegalArgumentException.class, () -> Api.callChar(1, value -> 0xd800));
        reject(IllegalArgumentException.class, () -> Api.callString("\\ud800", value -> value));
        reject(IllegalArgumentException.class, () -> Api.callString("x", value -> "\\ud800"));
        reject(NullPointerException.class, () -> Api.callString("x", value -> null));
        reject(NullPointerException.class, () -> Api.callBytes(new byte[0], value -> null));
        reject(NullPointerException.class, () -> Api.callNat(BigInteger.ONE, value -> null));
        reject(IllegalArgumentException.class, () -> Api.callBytes(new byte[17*1024*1024], value -> value));
        reject(IllegalArgumentException.class, () -> Api.callBytes(new byte[0], value -> new byte[17*1024*1024]));
        check(reenter(12) == 42);
        check(reject(LeanBridgeException.class, () -> reenter(80)).getMessage().contains("reentry limit (64)")); check(reenter(2) == 42);
        try (var expired = Api.retainCallback(value -> value + 1)) { reject(IllegalArgumentException.class, () -> expired.invoke(1)); }
        var closure = Api.makeUint32(42); var errors = new AtomicReference<Throwable>();
        var wrong = Thread.ofPlatform().start(() -> { try { closure.invoke(true, 0); } catch (Throwable error) { errors.set(error); } }); wrong.join();
        check(errors.get() instanceof IllegalStateException && closure.invoke(true, 0) == 42);
        var closer = Thread.ofPlatform().start(closure::close); closer.join(); check(closure.isClosed()); reject(IllegalStateException.class, () -> closure.invoke(true, 0));
        var orphan = new AtomicReference<FnBoolUInt32ToUInt32.LeanClosure>();
        Thread.ofPlatform().start(() -> orphan.set(Api.makeUint32(9))).join(); reject(IllegalStateException.class, () -> orphan.get().invoke(true, 0)); orphan.get().close();
        var virtualFailure = new AtomicReference<Throwable>();
        Thread.ofVirtual().start(() -> { try { Api.makeUint32(1); } catch (Throwable error) { virtualFailure.set(error); } }).join(); check(virtualFailure.get() instanceof IllegalStateException);
        var alias = alias(); System.gc(); check(alias.invoke(true, 0) == 42); Reference.reachabilityFence(alias);
        var weak = abandoned(); for (int i = 0; weak.get() != null && i < 200; ++i) { System.gc(); Thread.sleep(10); } check(weak.get() == null);
        // Drop the earlier method-reference alias before exhausting the native registry.
        alias = null;
        ArrayList<FnBoolUInt32ToUInt32.LeanClosure> held = new ArrayList<>();
        for (int attempt = 0; attempt < 200; ++attempt) {
            try { for (int i = 0; i < 4096; ++i) held.add(Api.makeUint32(i)); break; }
            catch (LeanBridgeException full) { for (var value : held) value.close(); held.clear(); System.gc(); Thread.sleep(10); }
        }
        try { check(held.size() == 4096); reject(LeanBridgeException.class, () -> Api.makeUint32(1)); check(held.get(0).invoke(true, 0) == 0 && held.get(4095).invoke(true, 0) == 4095); }
        finally { for (var value : held) value.close(); }
        for (int i = 0; i < 8192; ++i) { try (var value = Api.makeUint32(i)) { check(value.invoke(true, 0) == i); } }
        Wire.result("callables/assertions", Wire.integer(checks), true);
        Wire.finish("java", "Callables", System.getProperty("java.version"), Api.class);
    }
}
`;

const kotlinConsumer = () => `import org.leanbridge.callables.*
import org.leanbridge.callables.Unit as LeanUnit
import java.math.BigInteger
import java.util.concurrent.atomic.AtomicReference
var checks = 0
fun verify(value: Boolean) { if (!value) error("Check " + checks); ++checks }
fun equal(a: Any?, b: Any?) { verify(java.util.Objects.deepEquals(a, b)) }
fun allBytes() = ByteArray(256) { it.toByte() }
fun <T : Throwable> reject(type: Class<T>, call: () -> kotlin.Unit): T { try { call() } catch (error: Throwable) { if (!type.isInstance(error)) throw error; ++checks; return type.cast(error) }; error("Accepted invalid call") }
fun reenter(depth: Int): Long = if (depth == 0) 42 else Api.callUint32(depth.toLong()) { reenter(depth - 1) }
fun main() {
    verify(Api.wordBits() == 64L)
    ${jvmCallablePublicChecks("kotlin")}
${callablePrimitives.map(([name, kind]) => {
	const [type, kt, cases] = values[kind], method = suffix(name), u = kind === "unit";
	const array = ({ boolean: "booleanArrayOf", byte: "byteArrayOf", short: "shortArrayOf", int: "intArrayOf", long: "longArrayOf", float: "floatArrayOf", double: "doubleArrayOf" })[type] ?? `arrayOf<${kt}>`;
	return `    run {
        val values = ${array}(${cases.map(kotlinValue).join(", ")})
        repeat(64) { for (value in values) {
            ${u ? "Api.callUnit(value) { }; ++checks" : `equal(Api.call${method}(value) { it }, value)`}
            var calls = 0
            ${u ? "Api.twiceUnit(value) { ++calls }" : `equal(Api.twice${method}(value) { ++calls; it }, value)`}
            verify(calls == 2)
            Api.make${method}(value).use { closure ->
                ${u ? "closure.invoke(true, LeanUnit.INSTANCE); closure.invoke(false, LeanUnit.INSTANCE); checks += 2" : "equal(closure.invoke(true, values[0]), value); equal(closure.invoke(false, values[0]), values[0])"}
                verify(!closure.isClosed()); closure.close(); closure.close(); verify(closure.isClosed())
                reject(IllegalStateException::class.java) { closure.invoke(true, values[0]) }
            }
        } }
        val marker = Exception("checked\\u0000λ"); var calls = 0
        verify(reject(Exception::class.java) { Api.twice${method}(values[0]) { ++calls; throw marker } } === marker); verify(calls == 1)
        reject(NullPointerException::class.java) { Api.call${method}(values[0], null) }
    }`;
}).join("\n")}
    verify(Api.wide(100) { ${Array.from({ length: 16 }, (_, i) => `a${i}`).join(", ")} -> ${Array.from({ length: 16 }, (_, i) => `verify(a${i} == ${i ? i : 100}L);`).join(" ")} 42 } == 42L)
    Api.makeWide(3).use { verify(it.invoke(${Array.from({ length: 16 }, (_, i) => i).join(", ")}) == 197968L) }
    Api.makeAdder(2).use { verify(Api.twiceUint32(40, it) == 44L) }
    equal(Api.combine("λ", BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE), { text, number -> text + number }, { text -> text + "!" }), "λ18446744073709551615!")
    val first = Error("first"); var later = 0
    verify(reject(Error::class.java) { Api.combine("x", BigInteger.ONE, { _, _ -> throw first }, { ++later; it }) } === first); verify(later == 0)
    repeat(30) { equal(Api.callString("rooted\\u0000λ") { System.gc(); it }, "rooted\\u0000λ") }
    val input = byteArrayOf(1,2); var retained: ByteArray? = null
    val copied = Api.callBytes(input) { retained = it; it[0] = 3; it }
    verify(input[0] == 1.toByte() && copied[0] == 3.toByte()); retained!![0] = 4; verify(copied[0] == 3.toByte())
    reject(IllegalArgumentException::class.java) { Api.callNat(BigInteger.valueOf(-1)) { it } }
    reject(IllegalArgumentException::class.java) { Api.callNat(BigInteger.ONE) { BigInteger.valueOf(-1) } }
    reject(IllegalArgumentException::class.java) { Api.callUint8(1) { 256 } }
    reject(IllegalArgumentException::class.java) { Api.callUint16(1) { -1 } }
    reject(IllegalArgumentException::class.java) { Api.callUint32(1) { 4294967296L } }
    reject(IllegalArgumentException::class.java) { Api.callUint64(BigInteger.ONE) { BigInteger.ONE.shiftLeft(64) } }
    reject(IllegalArgumentException::class.java) { Api.callUsize(BigInteger.ONE) { BigInteger.valueOf(-1) } }
    reject(IllegalArgumentException::class.java) { Api.callChar(1) { 0xd800 } }
    reject(IllegalArgumentException::class.java) { Api.callString("\\ud800") { it } }
    reject(IllegalArgumentException::class.java) { Api.callString("x") { "\\ud800" } }
    reject(NullPointerException::class.java) { Api.callString("x") { null } }
    reject(NullPointerException::class.java) { Api.callNat(BigInteger.ONE) { null } }
    reject(IllegalArgumentException::class.java) { Api.callBytes(ByteArray(17*1024*1024)) { it } }
    reject(IllegalArgumentException::class.java) { Api.callBytes(byteArrayOf()) { ByteArray(17*1024*1024) } }
    verify(reenter(12) == 42L); verify(reject(LeanBridgeException::class.java) { reenter(80) }.message!!.contains("reentry limit (64)")); verify(reenter(2) == 42L)
    Api.retainCallback { it + 1 }.use { reject(IllegalArgumentException::class.java) { it.invoke(1) } }
    val closure = Api.makeUint32(42); val errors = AtomicReference<Throwable>()
    Thread.ofPlatform().start { try { closure.invoke(true, 0) } catch (error: Throwable) { errors.set(error) } }.join()
    verify(errors.get() is IllegalStateException && closure.invoke(true, 0) == 42L)
    Thread.ofPlatform().start { closure.close() }.join(); verify(closure.isClosed()); reject(IllegalStateException::class.java) { closure.invoke(true, 0) }
    val virtualFailure = AtomicReference<Throwable>()
    Thread.ofVirtual().start { try { Api.makeUint32(1) } catch (error: Throwable) { virtualFailure.set(error) } }.join(); verify(virtualFailure.get() is IllegalStateException)
    val aliasOwner = Api.makeUint32(7); val alias: (Boolean, Long) -> Long = aliasOwner::invoke
    System.gc(); verify(alias(true, 0) == 7L); aliasOwner.close(); reject(IllegalStateException::class.java) { alias(true, 0) }
    val held = ArrayList<FnBoolUInt32ToUInt32.LeanClosure>()
    try {
        repeat(4096) { held.add(Api.makeUint32(it.toLong())) }
        reject(LeanBridgeException::class.java) { Api.makeUint32(1) }; verify(held[4095].invoke(true, 0) == 4095L)
    } finally { held.forEach { it.close() } }
    repeat(8192) { i -> Api.makeUint32(i.toLong()).use { verify(it.invoke(true, 0) == i.toLong()) } }
    Wire.result("callables/assertions", Wire.integer(checks), true)
    Wire.finish("kotlin", "Callables", KotlinVersion.CURRENT.toString(), Api::class.java)
}
`;

/**
 * Independent installed Java/Kotlin caller source.
 *
 * @param profile - Java or Kotlin.
 */
export const jvmCallableConsumer = profile => profile === "java" ? javaConsumer() : kotlinConsumer();

/**
 * Invalid callers must fail at the source expression, not at package loading.
 *
 * @param profile - Java or Kotlin.
 */
export const jvmCallableRejections = profile => {
	const java = profile === "java";
	const cases = java ? {
		"callback-result": 'Api.callNat(BigInteger.ONE, value -> 1.5);'
		, "callback-parameter": 'Api.callUint32(1, (String value) -> 1L);'
		, "async-result": 'Api.callUint32(1, value -> java.util.concurrent.CompletableFuture.completedFuture(value));'
		, "closure-result": 'String value = Api.makeUint32(1).invoke(true, 0);'
		, "closure-argument": 'Api.makeNat(BigInteger.ONE).invoke("x", BigInteger.ZERO);'
		, "closure-constructor": 'new FnBoolUInt32ToUInt32.LeanClosure(null);'
	} : {
		"callback-result": 'Api.callNat(BigInteger.ONE) { 1.5 }'
		, "callback-parameter": 'Api.callUint32(1) { value: String -> value.length.toLong() }'
		, "async-result": 'Api.callUint32(1) { java.util.concurrent.CompletableFuture.completedFuture(it) }'
		, "closure-result": 'val value: String = Api.makeUint32(1).invoke(true, 0); println(value)'
		, "closure-argument": 'Api.makeNat(BigInteger.ONE).invoke("x", BigInteger.ZERO)'
		, "closure-constructor": 'FnBoolUInt32ToUInt32.LeanClosure(null)'
	};
	const codes = java ? ["compiler.err.cant.apply.symbol", "compiler.err.cant.apply.symbol", "compiler.err.cant.apply.symbol", "compiler.err.prob.found.req", "compiler.err.cant.apply.symbol", "compiler.err.not.def.public.cant.access"] : ["RETURN_TYPE_MISMATCH", "ARGUMENT_TYPE_MISMATCH", ["RETURN_TYPE_MISMATCH", "TYPE_MISMATCH"], ["INITIALIZER_TYPE_MISMATCH", "TYPE_MISMATCH"], "ARGUMENT_TYPE_MISMATCH", "INVISIBLE_REFERENCE"];
	return Object.entries(cases).map(([id, expression], index) => ({ id: `callables/${id}`
		, expectation: { kind: "compile-rejection", diagnostic: codes[index] }
		, source: `import org.leanbridge.callables.*;\nimport java.math.BigInteger;\n${java ? "class Invalid { static void rejected() {" : "fun rejected() {"}\n${expression}\n}${java ? " }" : ""}\n` }));
};
