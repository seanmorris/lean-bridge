/**
 * Public Java/Kotlin transfer consumers over the prepared Maven artifact.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ownedJvmInstalledSignatures } from "./owned-jvm-installed-signatures.mjs";

const section = (source, start, end) => {
	assert.equal(source.split(start).length, 2); assert.equal(source.split(end).length, 2);
	const first = source.indexOf(start), last = source.indexOf(end);
	assert.ok(last > first); return source.slice(first, last);
};
const replace = (source, before, after) => {
	assert.equal(source.split(before).length, 2); return source.replace(before, after);
};

/**
 * Reuse the independent value assertions, excluding private probes and fault injection.
 *
 * @param namespace - Compiled package namespace.
 * @param functions - Compiler-authenticated public names checked against the authored catalog.
 */
export const ownedJvmTransferInstalledFixture = async (namespace, functions) => {
	const examples = {};
	for(const profile of ["java", "kotlin"])
	{
		const file = profile === "java" ? "OwnedTransferExample.java" : "OwnedTransferExample.kt";
		const source = await readFile(`tests/fixtures/documentation/consumers/${profile}/${file}`, "utf8");
		const guide = await readFile(`docs/consume/${profile}.md`, "utf8");
		assert.ok(guide.includes("```" + profile + ` file=${profile}/${file}\n` + source + "```"));
		examples[profile] = [{ id: "owned/transfers-documentation", file
			, main: profile === "java" ? "OwnedTransferExample" : "OwnedTransferExampleKt"
			, source, stdout: "transferred\n" }];
	}
	const javaProbe = await readFile("tests/fixtures/structured-types/owned-jvm-transfers.java", "utf8");
	const kotlinProbe = await readFile("tests/fixtures/structured-types/owned-kotlin-transfers.kt", "utf8");
	assert.match(javaProbe, new RegExp(`^package ${namespace.replaceAll(".", "\\.")};`, "u"));
	const checks = section(javaProbe, "    public static synchronized void check", "    private static long count");
	let supportMethods = section(javaProbe, "    private static List<Object> children", "    public record FaultCase")
		.replaceAll("value instanceof _OwnedValue", "value instanceof AutoCloseable")
		.replaceAll("OwnedTransferProbe::", "OwnedTransferSupport::")
		.replaceAll("_OwnedRuntime.rethrow(error)", "new AssertionError(error)");
	supportMethods = replace(supportMethods, "        if (value instanceof Ticket ticket) return \"ticket:\" + serial(ticket) + \":\" + label(ticket);\n        if (value instanceof _OwnedKotlinTicket) return KotlinTransferProbe.INSTANCE.identity(value);", "        if (value instanceof AutoCloseable) return identity.apply(value);");
	const threadRead = section(javaProbe, "    public static void visibleOnOtherThread", "    private static void awaitExit")
		.replaceAll("_OwnedRuntime.rethrow(failure.get())", "new AssertionError(failure.get())");
	const support = `import ${namespace}.*;
import java.lang.reflect.Array;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.*;

public final class OwnedTransferSupport {
    private OwnedTransferSupport() { }
    private static int checks;
    public static int checks() { return checks; }
    public static Function<Object, String> identity = value -> {
        var ticket = (Ticket)value; return "ticket:" + Api.serial(ticket) + ":" + Api.label(ticket);
    };
${checks}
${supportMethods}
${threadRead}
}
`;
	let javaBody = section(javaProbe, "    private static Ticket ticket", "    private static int[] exercise")
		.replaceAll("OwnedTransferProbe::echo", "Api::echo")
		.replaceAll("OwnedTransferProbe::record", "Consumer::record")
		.replaceAll("_OwnedConvert.Limit", "IllegalArgumentException");
	javaBody = replace(javaBody, "            long before = handoffs();\n", "");
	javaBody = replace(javaBody, "handoffs() == before && ", "");
	const signatures = profile => ownedJvmInstalledSignatures(false, namespace, profile, functions, { transferredInputs: true });
	const java = `import ${namespace}.*;
import static ${namespace}.Api.*;
import java.math.BigInteger;
import java.util.*;
import java.util.function.*;

@SuppressWarnings({"unchecked", "rawtypes", "try"})
public final class Consumer {
    private static void check(boolean value, String message) { OwnedTransferSupport.check(value, message); }
    private static <T extends Throwable> T reject(Class<T> expected, Runnable action) { return OwnedTransferSupport.reject(expected, action); }
    private static void status(int expected, Runnable action) { OwnedTransferSupport.status(expected, action); }
    private static void drop(Object value) { OwnedTransferSupport.drop(value); }
    private static String semantic(Object value) { return OwnedTransferSupport.semantic(value); }
    private static boolean allClosed(Object value) { return OwnedTransferSupport.allClosed(value); }
    private static boolean allOpen(Object value) { return OwnedTransferSupport.allOpen(value); }
    private static <T> void roundTrip(Supplier<T> make, Function<T, T> call) { OwnedTransferSupport.roundTrip(make, call); }
    private static void visibleOnOtherThread(Object value) { OwnedTransferSupport.visibleOnOtherThread(value); }
${javaBody}
    public static void main(String[] args) throws Exception {
        ${signatures("java")}
        if (args.length == 1 && args[0].equals("--signatures")) return;
        values(); validation(); callbacks();
        Wire.result("owned/checks", Wire.integer(OwnedTransferSupport.checks()), true);
        Wire.finish("java", "${namespace}", System.getProperty("java.version"), Api.class);
    }
}
`;
	const imports = section(kotlinProbe, "import java.math.BigInteger", "internal object KotlinTransferProbe");
	let kotlinBody = section(kotlinProbe, "    private fun ticket", "    fun run(): IntArray")
		.replaceAll("OwnedTransferProbe.", "OwnedTransferSupport.")
		.replaceAll("_OwnedConvert.Limit::class.java", "IllegalArgumentException::class.java");
	kotlinBody = replace(kotlinBody, "            val before = OwnedTransferSupport.handoffs()\n", "");
	kotlinBody = replace(kotlinBody, "OwnedTransferSupport.handoffs() == before && ", "");
	const kotlin = `${imports}
import ${namespace}.kotlin.*
import ${namespace}.kotlin.Api
import ${namespace}.kotlin.Unit
${functions.map(name => `import ${namespace}.kotlin.Api.Companion.${name}`).join("\n")}
private fun verify(value: Boolean, message: String) = OwnedTransferSupport.check(value, message)
private fun drop(value: Any) = OwnedTransferSupport.drop(value)
private fun allClosed(value: Any) = OwnedTransferSupport.allClosed(value)
private fun allOpen(value: Any) = OwnedTransferSupport.allOpen(value)
private fun semantic(value: Any) = OwnedTransferSupport.semantic(value)
private fun <T : Any> roundTrip(make: () -> T, call: (T) -> T) = OwnedTransferSupport.roundTrip({ make() }, { call(it) })
${kotlinBody}
fun main(args: Array<String>) {
    ${signatures("kotlin")}
    if (args.contentEquals(arrayOf("--signatures"))) return
    OwnedTransferSupport.identity = java.util.function.Function { value ->
        val ticket = value as Ticket; "ticket:" + serial(ticket) + ":" + label(ticket)
    }
    values(); validation(); callbacks()
    Wire.result("owned/checks", Wire.integer(OwnedTransferSupport.checks()), true)
    Wire.finish("kotlin", "${namespace}", KotlinVersion.CURRENT.toString(), Api::class.java)
}
`;
	for(const source of [java, kotlin, support])
		assert.doesNotMatch(source, /_Owned|OwnedTransferProbe|KotlinTransferProbe|\.foreign\b|SymbolLookup|\.bindings\b|handoffs\(|count\(live\)|count\(identities\)/u);
	const rejections = profile => profile === "java" ? [
		{ id: "owned/private-constructor"
			, expectation: { diagnostic: "compiler.err.cant.apply.symbol" }
			, source: `import ${namespace}.*; class Invalid { Object value = new Ticket(); }\n` }
		, { id: "owned/nominal-resource"
			, expectation: { diagnostic: "compiler.err.cant.apply.symbol" }
			, source: `import ${namespace}.*; class Invalid { void invalid() { Api.retainTicket("not a ticket"); } }\n` }
		, { id: "owned/element-type"
			, expectation: { diagnostic: "compiler.err.cant.apply.symbol" }
			, source: `import ${namespace}.*; class Invalid { void invalid() { Api.echoArray(new String[0]); } }\n` }
	] : [
		{ id: "owned/private-constructor"
			, expectation: { diagnostic: "INVISIBLE_REFERENCE" }
			, source: `import ${namespace}.kotlin.*\nfun invalid() { Ticket() }\n` }
		, { id: "owned/nominal-resource"
			, expectation: { diagnostic: "ARGUMENT_TYPE_MISMATCH" }
			, source: `import ${namespace}.kotlin.*\nfun invalid() { Api.retainTicket("not a ticket") }\n` }
		, { id: "owned/element-type"
			, expectation: { diagnostic: "ARGUMENT_TYPE_MISMATCH" }
			, source: `import ${namespace}.kotlin.*\nfun invalid() { Api.echoArray(arrayOf("wrong")) }\n` }
		, { id: "owned/null-resource"
			, expectation: { diagnostic: "NULL_FOR_NONNULL_TYPE" }
			, source: `import ${namespace}.kotlin.*\nfun invalid() { Api.retainTicket(null) }\n` }
	];
	return { packageKind: "lean-bridge-owned-maven-package"
		, removeHandoffBeforeExecution: true
		, source: profile => profile === "java" ? java : kotlin
		, signatures, rejections
		, examples: profile => examples[profile]
		, javaSupport: { "OwnedTransferSupport.java": support } };
};
