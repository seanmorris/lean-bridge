/**
 * Public receiver consumers reuse whole-owner regressions without FFM access.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ownedJvmBorrowInstalledFixture } from "./owned-jvm-borrow-installed.mjs";

/**
 * Exercise checked members, static calls, compiler rejections and guide examples.
 *
 * @param namespace - Installed package namespace.
 * @param functions - Independent export name catalog.
 */
export const ownedJvmReceiverInstalledFixture = async (namespace, functions) => {
	const previous = await ownedJvmBorrowInstalledFixture(namespace, functions, { receiverExports: true });
	const sources = {}, examples = {};
	for(const profile of ["java", "kotlin"])
	{
		const java = profile === "java";
		const members = (await readFile(`tests/fixtures/structured-types/owned-${java ? "jvm" : "kotlin"}-receiver-members.${java ? "java" : "kt"}`, "utf8"))
			.replaceAll("OwnedBorrowProbe.", "OwnedBorrowSupport.");
		const marker = java ? "    public static void main(String[] args)" : "fun main(args: Array<String>)";
		const calls = java ? "shapes(); callbacks(); transfers();" : "shapes(); callbacksAndTransfers()";
		let source = previous.source(profile);
		assert.equal(source.split(marker).length, 2); assert.equal(source.split(calls).length, 2);
		source = source.replace(marker, members + "\n" + marker).replace(calls, "receiverMembers(); " + calls);
		assert.doesNotMatch(source, /_Owned|OwnedBorrowProbe|KotlinBorrowProbe|\.foreign\b|SymbolLookup|\.bindings\b/u);
		sources[profile] = source;
		const file = java ? "OwnedReceiverExample.java" : "OwnedReceiverExample.kt";
		const example = await readFile(`tests/fixtures/documentation/consumers/${profile}/${file}`, "utf8");
		const guide = await readFile(`docs/consume/${profile}.md`, "utf8");
		assert.ok(guide.includes("```" + profile + ` file=${profile}/${file}\n` + example + "```"));
		examples[profile] = [...previous.examples(profile), {
			id: "owned/receivers-documentation", file
			, main: java ? "OwnedReceiverExample" : "OwnedReceiverExampleKt"
			, source: example, stdout: "42\n42\n" }];
	}
	const invalid = {
		java: [
			["read-only-property", "compiler.err.cant.resolve.location.args", "void bad(TicketValue value) { value.setSerial(java.math.BigInteger.ONE); }"]
			, ["raw-receiver-anchor", "compiler.err.cant.resolve.location.args", "void bad(Ticket value) { value.retainTicket(); }"]
			, ["raw-receiver-transfer", "compiler.err.cant.resolve.location.args", "void bad(Ticket value) { value.transferTicket(); }"]
			, ["wrong-member-owner", "compiler.err.cant.apply.symbol", "void bad(TicketValue value, BundleValue other) { value.chooseTicket(other); }"]
			, ["private-nominal-owner", "compiler.err.cant.apply.symbol", "Object value = new TicketValue();"]
		]
		, kotlin: [
			["read-only-property", "VAL_REASSIGNMENT", "fun bad(value: TicketValue) { value.serial = java.math.BigInteger.ONE }"]
			, ["raw-receiver-anchor", "UNRESOLVED_REFERENCE", "fun bad(value: Ticket) { value.retainTicket() }"]
			, ["raw-receiver-transfer", "UNRESOLVED_REFERENCE", "fun bad(value: Ticket) { value.transferTicket() }"]
			, ["wrong-member-owner", "ARGUMENT_TYPE_MISMATCH", "fun bad(value: TicketValue, other: BundleValue) { value.chooseTicket(other) }"]
		]
	};
	const rejections = profile => [...previous.rejections(profile)
		, ...invalid[profile].map(([name, diagnostic, code]) => ({
			id: "owned/" + name, expectation: { diagnostic }
			, source: profile === "java" ? `import ${namespace}.*; class Invalid { ${code} }\n` : `import ${namespace}.kotlin.*\n${code}\n`
		}))
	];
	return { ...previous, source: profile => sources[profile]
		, examples: profile => examples[profile], rejections };
};
