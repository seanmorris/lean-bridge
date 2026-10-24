/**
 * Prepare the author and consumer guidance as part of the gated promotion.
 *
 * @file
 */
import assert from "node:assert/strict";

export const ownedCheckedRecordDocumentationPaths = Object.freeze({
	existingPackage: "docs/lean/existing-package.md"
	, exportDecisions: "docs/lean/export-decisions.md"
	, javascript: "docs/javascript-typescript.md", php: "docs/php.md"
	, c: "docs/consume/c.md", cpp: "docs/consume/cpp.md"
	, dotnet: "docs/consume/dotnet.md", java: "docs/consume/java.md"
	, kotlin: "docs/consume/kotlin.md", perl: "docs/consume/perl.md"
	, python: "docs/consume/python.md", ruby: "docs/consume/ruby.md"
	, rust: "docs/consume/rust.md", witWasi: "docs/consume/wit-wasi.md"
});
const heading = "## Owned checked records";
const replaceOnce = (source, previous, next, label) => {
	assert.equal(source.split(previous).length, 2, `Expected one owned checked-record documentation marker: ${label}`);
	return source.replace(previous, next);
};
const consumer = Object.freeze({
	javascript: "Node JavaScript, TypeScript, browser pages, React and dedicated workers"
	, php: "native PHP and PHP-Wasm, each backed by an independent hosted archive"
	, c: "C", cpp: "C++", dotnet: "C#", java: "Java", kotlin: "Kotlin"
	, perl: "Perl", python: "Python", ruby: "Ruby", rust: "Rust"
	, witWasi: "WIT/WASI"
});

/**
 * Insert precise guidance outside generated conversion tables. Do not publish
 * it until every hosted lane passes the promotion gate.
 *
 * @param sources - All fourteen original author and consumer pages.
 */
export const renderOwnedCheckedRecordDocumentation = sources => {
	assert.deepEqual(Object.keys(sources).sort(), Object.keys(ownedCheckedRecordDocumentationPaths).sort());
	const output = {};
	for(const [name, path] of Object.entries(ownedCheckedRecordDocumentationPaths))
	{
		let source = sources[name];
		assert.equal(typeof source, "string", name);
		assert.ok(!source.includes(heading), `Owned checked-record documentation already published: ${name}`);
		const link = `${path.split("/").length === 2 ? "" : "../"}evidence/owned-checked-record-promotion-20261024.md`;
		const author = name === "existingPackage" || name === "exportDecisions";
		const scope = author ? "all seventeen consumer profiles" : consumer[name];
		const introduction = `[Hosted owned checked-record acceptance](${link}) covers ${scope} on ordinary Lean-source and independently reviewed package routes. The tested forms are \`Booking\`, whose \`Window\` field is copied and checked, and \`Claim\`, whose \`Ticket\` resource stays owned while its quota is checked. Proof fields do not cross the boundary.`;
		const usage = author
			? "Select `mkWindow` at the consumed `Booking.window` site and `mkClaim` at each consumed `Claim` site. Mark resource-bearing records as owned, and choose borrowed or transferred parameters and leased results explicitly. The generated boundary checks `lo ≤ hi` and `quota ≤ holder.serial` before the input enters Lean or its ownership moves. Synchronous host replies and returned-closure inputs keep their own constructor selections. Lean-produced values project payloads without running input constructors."
			: "Use the generated record carriers and keep the `Ticket` owner alive for the call. A borrowed call leaves the caller's owner intact. A transferred call validates the record before moving that owner; rejected inputs remain usable. Leased results require the cleanup described by this language's ownership API. Synchronous callbacks exchange proof-free `Claim` values: host-produced replies and inputs to a returned Lean closure are checked, while Lean-produced arguments and results are projected without proof fields.";
		const modes = "Full packages exercise inputs, results, the nested `Window` field, synchronous callbacks and returned Lean closures. Standalone result-only packages expose Lean-produced `Claim` results without checked-input, transfer or callback metadata. A successful result-only package is not evidence for those input or callback paths.";
		const limits = "This acceptance does not cover `Grant` and its nested Subtype, arbitrary owned containers, recursive owned graphs, retained or asynchronous callbacks, other predicates, dispatch cost or peak memory. Earlier copied, generic and dependent-record receipts retain their own narrower scopes.";
		const section = `${heading}\n\n${introduction}\n\n${usage}\n\n${modes}\n\n${limits}\n\n`;
		const marker = name === "existingPackage" ? "## Choose downstream languages\n"
			: name === "exportDecisions" ? "## Check each consumer representation\n"
				: "## Start from a raw Lean package\n";
		if(name === "existingPackage")
			source = replaceOnce(source, "owned and unarchived combinations remain separate |"
				, "the separately archived owned Booking/Window and Ticket/Claim forms are documented below; unarchived combinations remain separate |"
				, "author matrix boundary");
		output[name] = replaceOnce(source, marker, section + marker, name);
	}
	return output;
};
