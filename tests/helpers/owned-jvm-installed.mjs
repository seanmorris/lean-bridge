/**
 * Source-free installed consumers share the existing offline Maven harness.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ownedJvmInstalledSignatures } from "./owned-jvm-installed-signatures.mjs";

/**
 * Execute the public consumer examples exactly as printed in the guides.
 *
 * @param namespace - Source-derived namespace of the documented package.
 */
export const ownedJvmDocumentationExamples = async namespace => {
	const examples = {};
	for(const profile of ["java", "kotlin"])
	{
		const guide = await readFile(`docs/consume/${profile}.md`, "utf8");
		const section = guide.split("### Owned resources and aggregates\n")[1].split("\n### ")[0];
		const match = section.match(new RegExp("```" + profile + "\\n([^]*?)\\n```"));
		assert.ok(match); assert.ok(match[1].includes(namespace));
		examples[profile] = [{ id: "owned/documentation"
			, file: profile === "java" ? "OwnedExample.java" : "OwnedExample.kt"
			, main: profile === "java" ? "OwnedExample" : "OwnedExampleKt"
			, source: match[1] + "\n", stdout: "42\n" }];
	}
	return examples;
};

/**
 * Prepare independent public consumers from the authored value assertions.
 *
 * @param scalar - Select scalar packets instead of typed callback signatures.
 * @param namespace - Namespace derived from the compiled source package.
 * @param functions - Public method names from the checked component.
 */
export const ownedJvmInstalledFixture = async (scalar, namespace, functions) => {
	const signatures = profile => ownedJvmInstalledSignatures(scalar, namespace, profile, functions);
	const examples = scalar ? {} : await ownedJvmDocumentationExamples(namespace);
	const kind = scalar ? "scalars" : "signatures";
	let originalJava = await readFile(`tests/fixtures/structured-types/owned-jvm-callback-${kind}.java`, "utf8");
	if(!scalar)
	{
		// The standalone allocation probe observes private native TLS counters.
		// Installed consumers retain the public wrong-thread rejection check.
		for(const observation of [
			"            long threadAllocations = count(live), threadOwners = count(identities), expectedExits = count(exits) + 1;\n"
			, "            // Thread.join() can return before the native TLS destructor finishes.\n            awaitExit(expectedExits, threadAllocations, threadOwners);\n"
		]) {
			assert.equal(originalJava.split(observation).length, 2);
			originalJava = originalJava.replace(observation, "");
		}
	}
	const originalKotlin = await readFile(`tests/fixtures/structured-types/owned-kotlin-callback-${kind}.kt`, "utf8");
	const support = await readFile("tests/fixtures/structured-types/OwnedInstalledSupport.java", "utf8");
	const adaptJava = source => source.replaceAll("OwnedCallProbe::", "Consumer::")
		.replaceAll("failures(", "repeat(").replaceAll("_OwnedConvert.Limit", "IllegalArgumentException");
	const exercise = adaptJava(originalJava);
	let javaValues = "", kotlinValues = "";
	if(!scalar)
	{
		javaValues = adaptJava(await readFile("tests/fixtures/structured-types/owned-jvm-compositions.java", "utf8"))
			.replace("void exercise()", "void exerciseValues()")
			.replaceAll("with(mixed,", "OwnedInstalledSupport.with(mixed,");
		const callbacks = await readFile("tests/fixtures/structured-types/owned-jvm-callback-values.java", "utf8");
		javaValues += adaptJava(callbacks.slice(0, callbacks.indexOf("    private static void callbackThreads()")))
			.replace("void exercise()", "void exerciseCallbacks()").replace("        callbackThreads();\n", "");
		const kotlin = await readFile("tests/fixtures/structured-types/owned-kotlin-callback-values.kt", "utf8");
		kotlinValues = await readFile("tests/fixtures/structured-types/owned-installed-kotlin-compositions.kt", "utf8");
		kotlinValues += kotlin.slice(kotlin.indexOf("    fun run()"))
			.replace("    fun run()", "fun exerciseCallbacks()").replace(/\n\}\s*$/u, "")
			.replaceAll("OwnedCallProbe.", "OwnedInstalledSupport.").replaceAll("failures", "repeat");
	}
	const java = `import ${namespace}.*;
import static ${namespace}.Api.*;
import java.math.BigInteger;
import java.util.Arrays;
import java.util.List;

// Deliberate malformed generics and close-before-scope-exit lifetime probes.
@SuppressWarnings({"unchecked", "rawtypes", "try"})
public final class Consumer {
    private static void check(boolean value, String message) { OwnedInstalledSupport.check(value, message); }
    private static void reject(Class<? extends Throwable> expected, Runnable call) { OwnedInstalledSupport.reject(expected, call); }
    private static void drop(Object value) { OwnedInstalledSupport.drop(value); }
    private static void repeat(java.util.function.Supplier<Object> call) { OwnedInstalledSupport.repeat(call); }
${exercise}
${javaValues}
    public static void main(String[] args) throws Exception {
        ${signatures("java")}
        if (args.length == 1 && args[0].equals("--signatures")) return;
        exercise();
        ${scalar ? "" : "exerciseValues(); exerciseCallbacks();"}
        Wire.result("owned/checks", Wire.integer(OwnedInstalledSupport.checks()), true);
        Wire.finish("java", "${namespace}", System.getProperty("java.version"), Api.class);
    }
}
`;
	const body = originalKotlin.slice(originalKotlin.indexOf("    fun run()"))
		.replace("    fun run()", "fun exercise()").replace(/\n\}\s*$/u, "")
		.replaceAll("OwnedCallProbe.", "OwnedInstalledSupport.")
		.replaceAll("failures", "repeat");
	const kotlin = `import ${namespace}.kotlin.*
import ${namespace}.kotlin.Unit
${scalar ? "" : `import ${namespace}.kotlin.Pair`}
${functions.map(name => `import ${namespace}.kotlin.Api.Companion.${name}`).join("\n")}
import java.math.BigInteger

private var called = 0
private fun <T> seen(value: T): T { called++; return value }
private fun verify(value: Boolean, message: String) = OwnedInstalledSupport.check(value, message)
private fun drop(value: Any) = OwnedInstalledSupport.drop(value)
${body}
${kotlinValues}
fun main(args: Array<String>) {
    ${signatures("kotlin")}
    if (args.contentEquals(arrayOf("--signatures"))) return
    exercise()
    ${scalar ? "" : "exerciseValues(); exerciseCallbacks()"}
    Wire.result("owned/checks", Wire.integer(OwnedInstalledSupport.checks()), true)
    Wire.finish("kotlin", "${namespace}", KotlinVersion.CURRENT.toString(), Api::class.java)
}
`;
	for(const source of [java, kotlin, support])
		assert.doesNotMatch(source, /_Owned|OwnedCallProbe|\.foreign\b|SymbolLookup|\.bindings\b|awaitExit\(|count\(live\)|count\(identities\)|count\(exits\)/u);
	const negatives = profile => {
		const family = namespace + (profile === "kotlin" ? ".kotlin" : "");
		const resourceFunction = scalar ? "makePacket" : "serial";
		if(profile === "java") return [
			{ id: "owned/private-constructor"
				, expectation: { diagnostic: "compiler.err.cant.apply.symbol" }
				, source: `import ${family}.*; class Invalid { Object value = new Ticket(); }\n` }
			, { id: "owned/nominal-resource"
				, expectation: { diagnostic: "compiler.err.cant.apply.symbol" }
				, source: `import ${family}.*; class Invalid { void invalid() { Api.${resourceFunction}("not a ticket"); } }\n` }
		];
		return [
			{ id: "owned/private-constructor"
				, expectation: { diagnostic: "INVISIBLE_REFERENCE" }
				, source: `import ${family}.*\nfun invalid() { Ticket() }\n` }
			, { id: "owned/nominal-resource"
				, expectation: { diagnostic: "ARGUMENT_TYPE_MISMATCH" }
				, source: `import ${family}.*\nfun invalid() { Api.${resourceFunction}("not a ticket") }\n` }
		];
	};
	return { packageKind: "lean-bridge-owned-maven-package"
		, removeHandoffBeforeExecution: true
		, source: profile => profile === "java" ? java : kotlin
		, signatures, rejections: negatives
		, examples: profile => examples[profile] ?? []
		, javaSupport: { "OwnedInstalledSupport.java": support } };
};
