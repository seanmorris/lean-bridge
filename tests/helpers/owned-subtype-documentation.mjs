/**
 * Repair exact author and consumer prose when owned Subtypes are promoted.
 *
 * @file
 */
import assert from "node:assert/strict";

export const ownedSubtypeDocumentationPaths = Object.freeze({
	existingPackage: "docs/lean/existing-package.md"
	, exportDecisions: "docs/lean/export-decisions.md"
	, dotnet: "docs/consume/dotnet.md"
	, perl: "docs/consume/perl.md"
	, python: "docs/consume/python.md"
	, ruby: "docs/consume/ruby.md"
});

const replaceOnce = (source, previous, next, label) => {
	assert.equal(source.split(previous).length, 2
		, `Expected one owned-Subtype documentation marker: ${label}`);
	return source.replace(previous, next);
};

const evidence = "../evidence/owned-subtype-promotion-20261023.md";
const installedBoundary = `The [hosted owned-Subtype matrix](${evidence}) covers one selected \`Nat\` Subtype field in the tested acyclic \`Bundle\` owner on both source routes. Host input is validated before ownership transfer; rejection keeps ownership with the caller. Leased or retained results preserve the owner lifetime, explicit close or release performs cleanup, and later valid calls recover. Recursive owned graphs and owned Subtype callback positions remain separate work. Owned checked-record fields have [separate acceptance](../evidence/owned-checked-record-promotion-20261025.md).`;

/**
 * Render the exact prose transition without mutating unrelated documentation.
 *
 * @param sources - Current canonical documentation sources by logical name.
 */
export const renderOwnedSubtypeDocumentation = sources => {
	assert.deepEqual(Object.keys(sources).sort()
		, Object.keys(ownedSubtypeDocumentationPaths).sort());
	const output = { ...sources };
	output.existingPackage = replaceOnce(output.existingPackage
		, "| `Subtype` inside a borrowed, retained or transferred acyclic owned record | Node, browser, React and worker installed, both source routes | Rejected | Rejected | Node and Chromium installed, both source routes | JavaScript npm and PHP-Wasm installed for the tested proof-erased `Int` field, including validation before transfer, source-free offline installation, relocation, explicit disposal, finalizer fallback and request recovery; other hosts pending |"
		, "| `Subtype` inside a borrowed, retained or transferred acyclic owned record | Node, browser, React and worker installed, both source routes | C/C++, Python, Ruby, Rust, C#, Java, Kotlin, native PHP and WIT/WASI installed, both source routes | Installed, both source routes on four ABIs | Node and Chromium installed, both source routes | The [hosted owned-Subtype matrix](../evidence/owned-subtype-promotion-20261023.md) establishes ordinary/reviewed packages across all seventeen profiles for the tested acyclic owner: one selected `Nat` field in the sixteen non-PHP-Wasm profiles and the separately qualified selected `Int` field in PHP-Wasm; validation precedes transfer and rejection preserves caller ownership |"
		, "Lean author support matrix");
	output.exportDecisions = replaceOnce(output.exportDecisions
		, "Synchronous `Fin` callbacks outside C/C++, retained or asynchronous refined\ncallbacks, owned and recursive Subtypes, and Subtype fields in generic records\nremain unfinished."
		, `Synchronous \`Fin\` callbacks outside C/C++, retained or asynchronous refined
callbacks, recursive owned Subtypes, and Subtype fields in generic records remain
unfinished. The [hosted owned-Subtype matrix](${evidence}) establishes one selected
\`Nat\` field in the tested acyclic \`Bundle\` owner across all sixteen non-PHP-Wasm
profiles and both author routes. PHP-Wasm retains its separate selected-\`Int\`
owned-Subtype qualification.`
		, "Lean export decision boundary");
	output.perl = replaceOnce(output.perl
		, "Directional callback Subtypes use the explicit recovery and returned-closure\nrules below. Owned Subtypes remain unsupported. These local runs do not measure\ndispatch counters or memory, or establish hosted release-floor acceptance."
		, `Directional callback Subtypes use the explicit recovery and returned-closure
rules below. ${installedBoundary} The structural-container runs above do not
measure dispatch counters or memory, or establish hosted release-floor acceptance.`
		, "Perl owned-Subtype boundary");
	output.dotnet = replaceOnce(output.dotnet
		, "Synchronous `Fin` callbacks, retained or asynchronous refined callbacks and owned Subtypes remain pending. These local\nruns do not measure dispatch counts or establish hosted release-floor acceptance."
		, `Synchronous \`Fin\` callbacks and retained or asynchronous refined callbacks
remain pending. ${installedBoundary} The structural-container runs above do not
measure dispatch counts or establish hosted release-floor acceptance.`
		, ".NET owned-Subtype boundary");
	output.python = replaceOnce(output.python
		, "These directional callback checks are implemented\nfor synchronous copied-value callbacks; retained or asynchronous host callbacks\nand owned `Subtype` payloads remain unsupported."
		, `These directional callback checks are implemented for synchronous copied-value
callbacks; retained or asynchronous host callbacks remain unsupported.
${installedBoundary}`
		, "Python owned-Subtype boundary");
	output.ruby = replaceOnce(output.ruby
		, "Directional checks currently require synchronous MRI\ncallbacks. Retained or asynchronous host callbacks and owned `Subtype` payloads\nremain unsupported."
		, `Directional checks currently require synchronous MRI callbacks. Retained or
asynchronous host callbacks remain unsupported. ${installedBoundary}`
		, "Ruby owned-Subtype boundary");
	return output;
};
