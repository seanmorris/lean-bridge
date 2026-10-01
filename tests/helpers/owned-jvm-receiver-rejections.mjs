/**
 * Compile downstream misuse against the public Java and Kotlin class files.
 *
 * @file
 */
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { nativeFixtureEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { javaCompilerOptions, kotlinCompilerOptions } from "./type-corpus-jvm-tools.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/**
 * Members remain typed, read-only and unavailable on unowned receiver views.
 *
 * @param namespace - Generated public Java package.
 */
export const ownedJvmReceiverRejections = namespace => ({
	java: [
		["read-only-property", "receiver.setSerial(java.math.BigInteger.ONE);", /cannot find symbol/u]
		, ["raw-receiver-anchor", "receiver.get().retainTicket();", /cannot find symbol/u]
		, ["raw-receiver-transfer", "receiver.get().transferTicket();", /cannot find symbol/u]
		, ["wrong-owner", "receiver.chooseTicket(other);", /incompatible types/u]
		, ["private-owner-construction", "new TicketValue();", /cannot be applied/u]
	].map(([name, body, pattern]) => ({ name, pattern, file: "Invalid.java"
		, source: `package misuse;\nimport ${namespace}.*;\nfinal class Invalid { static void call(TicketValue receiver, BundleValue other) { ${body} } }\n` }))
	, kotlin: [
		["read-only-property", "receiver.serial = java.math.BigInteger.ONE", /cannot be reassigned/u]
		, ["raw-receiver-anchor", "receiver.get().retainTicket()", /[Uu]nresolved reference/u]
		, ["raw-receiver-transfer", "receiver.get().transferTicket()", /[Uu]nresolved reference/u]
		, ["wrong-owner", "receiver.chooseTicket(other)", /[Tt]ype mismatch/u]
		, ["private-owner-construction", "TicketValue()", /[Cc]annot access|[Nn]o value passed/u]
	].map(([name, body, pattern]) => ({ name, pattern, file: "Invalid.kt"
		, source: `package misuse\nimport ${namespace}.kotlin.*\nfun call(receiver: TicketValue, other: BundleValue) { ${body} }\n` }))
});

/**
 * Reject each bad client using real compilers and class files, with no generator.
 *
 * @param root - Isolated compiled fixture directory.
 * @param namespace - Generated public Java package.
 */
export const rejectOwnedJvmReceiverMisuse = async (root, namespace) => {
	const environment = nativeFixtureEnvironment(["java", "kotlin"]);
	const home = dirname(dirname(environment.LEAN_BRIDGE_KOTLINC));
	const stdlib = join(home, "lib/kotlin-stdlib.jar"), rejected = [];
	for(const [profile, examples] of Object.entries(ownedJvmReceiverRejections(namespace))) for(const example of examples)
	{
		const source = `misuse/${example.file}`;
		await saveLakeFile(root, source, example.source);
		const command = profile === "java" ? environment.LEAN_BRIDGE_JAVAC : environment.LEAN_BRIDGE_JAVA;
		const args = profile === "java" ? [...javaCompilerOptions
			, "-sourcepath", "misuse", "-cp", "classes:" + stdlib
			, "-d", "misuse-classes", source]
			: ["-cp", join(home, "lib/*"), "org.jetbrains.kotlin.cli.jvm.K2JVMCompiler"
				, "-kotlin-home", home, ...kotlinCompilerOptions
				, "-jdk-home", dirname(dirname(environment.LEAN_BRIDGE_JAVA))
				, "-cp", "classes:" + stdlib, "-d", "misuse-classes", source];
		await assert.rejects(runCopied(command, args, root), error => {
			assert.match(error.details.stderr, example.pattern, `${profile}/${example.name}`);
			return true;
		}, `${profile}/${example.name} compiled unexpectedly`);
		rejected.push({ profile, name: example.name, compiledRejection: true, sourceSha256: sha256(example.source) });
	}
	return rejected;
};
