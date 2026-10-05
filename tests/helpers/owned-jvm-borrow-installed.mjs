/**
 * Source-free public Java/Kotlin borrowed-result consumers and examples.
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

/**
 * Keep all shape/lifetime assertions, excluding private FFM instrumentation.
 *
 * @param namespace - Prepared package namespace.
 * @param functions - Export names checked against an independent signature catalog.
 * @param options - Optional nominal receiver signature capability.
 * @param options.receiverExports - Include the public receiver fixture's exports.
 */
export const ownedJvmBorrowInstalledFixture = async (namespace, functions, { receiverExports = false } = {}) => {
	const javaProbe = await readFile("tests/fixtures/structured-types/owned-jvm-borrows.java", "utf8");
	const kotlinProbe = await readFile("tests/fixtures/structured-types/owned-kotlin-borrows.kt", "utf8");
	assert.ok(javaProbe.startsWith(`package ${namespace};`));
	const checks = section(javaProbe, "    public static void check", "    private static long count");
	const support = `import ${namespace}.LeanBridgeException;
public final class OwnedBorrowSupport {
    private OwnedBorrowSupport() { }
    private static int checks;
    public static int checks() { return checks; }
${checks}
}
`;
	const signatures = profile => ownedJvmInstalledSignatures(false, namespace, profile, functions, { anchoredResults: true, receiverExports });
	const javaBody = section(javaProbe, "    static Bundle bundle", "    public static <T> int[] faults")
		.replaceAll("OwnedBorrowProbe::", "Api::");
	const java = `import ${namespace}.*;
import static ${namespace}.Api.*;
import java.math.BigInteger;
import java.util.*;
import java.util.function.Function;
@SuppressWarnings({"unchecked", "rawtypes", "try"})
public final class Consumer {
    private static final List<Throwable> retainedFailures = new ArrayList<>();
    private static void check(boolean value, String message) { OwnedBorrowSupport.check(value, message); }
    private static <T extends Throwable> T reject(Class<T> type, Runnable call) { return OwnedBorrowSupport.reject(type, call); }
    private static void status(int expected, Runnable call) { OwnedBorrowSupport.status(expected, call); }
${javaBody}
    public static void main(String[] args) throws Exception {
        ${signatures("java")}
        if (args.length == 1 && args[0].equals("--signatures")) return;
        shapes(); callbacks(); transfers();
        Wire.result("owned/checks", Wire.integer(OwnedBorrowSupport.checks()), true);
        Wire.finish("java", "${namespace}", System.getProperty("java.version"), Api.class);
    }
}
`;
	const imports = section(kotlinProbe, "import java.math.BigInteger", "internal object KotlinBorrowProbe");
	const kotlinBody = section(kotlinProbe, "    private fun bundle", "    fun run(): IntArray")
		.replaceAll("OwnedBorrowProbe.", "OwnedBorrowSupport.");
	const copies = [...new Set([...javaBody.matchAll(/(?:Api::|\b)(copy[A-Z][A-Za-z0-9]+)/gu)].map(match => match[1]))];
	const kotlin = `${imports}
import ${namespace}.Value
import ${namespace}.kotlin.Api
${[...functions, ...copies].map(name => `import ${namespace}.kotlin.Api.Companion.${name}`).join("\n")}
private fun verify(value: Boolean, message: String) = OwnedBorrowSupport.check(value, message)
${kotlinBody}
fun main(args: Array<String>) {
    ${signatures("kotlin")}
    if (args.contentEquals(arrayOf("--signatures"))) return
    shapes(); callbacksAndTransfers()
    Wire.result("owned/checks", Wire.integer(OwnedBorrowSupport.checks()), true)
    Wire.finish("kotlin", "${namespace}", KotlinVersion.CURRENT.toString(), Api::class.java)
}
`;
	for(const source of [java, kotlin, support])
		assert.doesNotMatch(source, /_Owned|OwnedBorrowProbe|KotlinBorrowProbe|\.foreign\b|SymbolLookup|\.bindings\b|handoffs\(|count\(live\)|count\(identities\)/u);
	const examples = {};
	for(const profile of ["java", "kotlin"])
	{
		const file = profile === "java" ? "OwnedBorrowExample.java" : "OwnedBorrowExample.kt";
		const source = await readFile(`tests/fixtures/documentation/consumers/${profile}/${file}`, "utf8");
		const guide = await readFile(`docs/consume/${profile}.md`, "utf8");
		assert.ok(guide.includes("```" + profile + ` file=${profile}/${file}\n` + source + "```"));
		examples[profile] = [{ id: "owned/borrows-documentation", file
			, main: profile === "java" ? "OwnedBorrowExample" : "OwnedBorrowExampleKt"
			, source, stdout: "42\n" }];
	}
	const invalid = profile => profile === "java" ? [
		["raw-anchor", "compiler.err.cant.apply.symbol", "void bad(Ticket value) { Api.retainTicket(value); }"]
		, ["raw-transfer", "compiler.err.cant.apply.symbol", "void bad(Ticket value) { Api.transferTicket(value); }"]
		, ["wrong-owner", "compiler.err.cant.apply.symbol", "void bad(Value<Bundle> value) { Api.retainTicket(value); }"]
		, ["wrong-element", "compiler.err.cant.apply.symbol", "void bad() { Api.copyEchoArrayResult(new String[0]); }"]
		, ["private-owner", "compiler.err.cant.apply.symbol", "Object value = new Value<Ticket>();"]
		, ["private-resource", "compiler.err.cant.apply.symbol", "Object value = new Ticket();"]
	] : [
		["raw-anchor", "ARGUMENT_TYPE_MISMATCH", "fun bad(value: Ticket) { Api.retainTicket(value) }"]
		, ["raw-transfer", "ARGUMENT_TYPE_MISMATCH", "fun bad(value: Ticket) { Api.transferTicket(value) }"]
		, ["wrong-owner", "ARGUMENT_TYPE_MISMATCH", "fun bad(value: Value<Bundle>) { Api.retainTicket(value) }"]
		, ["wrong-element", "ARGUMENT_TYPE_MISMATCH", "fun bad() { Api.copyEchoArrayResult(arrayOf(\"wrong\")) }"]
		, ["null-owner", "NULL_FOR_NONNULL_TYPE", "fun bad() { Api.retainTicket(null) }"]
	];
	return { packageKind: "lean-bridge-owned-maven-package"
		, removeHandoffBeforeExecution: true
		, source: profile => profile === "java" ? java : kotlin
		, signatures
		, rejections: profile => invalid(profile).map(([name, diagnostic, code]) => ({ id: "owned/" + name
			, expectation: { diagnostic }
			, source: profile === "java" ? `import ${namespace}.*; class Invalid { ${code} }\n` : `import ${namespace}.kotlin.*\n${code}\n` }))
		, examples: profile => examples[profile]
		, javaSupport: { "OwnedBorrowSupport.java": support } };
};
