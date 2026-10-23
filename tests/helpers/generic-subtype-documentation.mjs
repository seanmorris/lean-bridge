/**
 * Repair exact author and consumer prose when the closed generic Subtype
 * matrix is promoted.
 *
 * @file
 */
import assert from "node:assert/strict";

export const genericSubtypeDocumentationPaths = Object.freeze({
	existingPackage: "docs/lean/existing-package.md"
	, exportDecisions: "docs/lean/export-decisions.md"
	, javascript: "docs/javascript-typescript.md"
	, php: "docs/php.md"
	, c: "docs/consume/c.md"
	, cpp: "docs/consume/cpp.md"
	, dotnet: "docs/consume/dotnet.md"
	, java: "docs/consume/java.md"
	, kotlin: "docs/consume/kotlin.md"
	, perl: "docs/consume/perl.md"
	, python: "docs/consume/python.md"
	, ruby: "docs/consume/ruby.md"
	, rust: "docs/consume/rust.md"
	, witWasi: "docs/consume/wit-wasi.md"
});

const replaceOnce = (source, previous, next, label) => {
	assert.equal(source.split(previous).length, 2
		, `Expected one generic-Subtype documentation marker: ${label}`);
	return source.replace(previous, next);
};

const evidence = "generic-subtype-promotion-20261023.md";
const nestedEvidence = `../evidence/${evidence}`;
const boundary = link => `The [hosted generic-Subtype matrix](${link}) installs the closed \`GenericNat\` alias of \`GenericCarrier Nat\` on ordinary-source and reviewed-IR packages across the sixteen non-PHP-Wasm consumer profiles. Its selected \`Positive\` field crosses as a proof-erased value beside a retained \`Nat\` marker, and the two named specializations keep their distinct \`plusOne\` and \`plusTwo\` constructors. Rejection preserves the caller record, a later valid call recovers, and copied results carry no constructor. PHP-Wasm, open generic host types, arbitrary type arguments or predicates, generic \`Fin\` fields, callback and owned positions, recursive generic graphs, dispatch cost and memory remain outside this evidence.`;
const closedAlias = "generic Subtypes beyond the closed `GenericNat` alias";

/**
 * Render the exact prose transition without mutating unrelated documentation.
 *
 * @param sources - Current canonical documentation sources by logical name.
 */
export const renderGenericSubtypeDocumentation = sources => {
	assert.deepEqual(Object.keys(sources).sort()
		, Object.keys(genericSubtypeDocumentationPaths).sort());
	const output = { ...sources };
	output.existingPackage = replaceOnce(output.existingPackage
		, "| `Subtype` inside owned callbacks, recursive owned graphs or generic record fields | Rejected | Rejected | Rejected | Rejected | Pending implementation and acceptance |"
		, `| \`Subtype\` field of the closed \`GenericNat\` alias of \`GenericCarrier Nat\` | Node, browser, React and worker installed, both source routes | C/C++, Python, Ruby, Rust, C#, Java, Kotlin, native PHP and WIT/WASI installed, both source routes | Installed, both source routes | Pending | ${boundary(nestedEvidence)} |
| \`Subtype\` inside owned callbacks, recursive owned graphs or other generic record fields | Rejected | Rejected | Rejected | Rejected | Pending implementation and acceptance |`
		, "Lean author support matrix");
	output.exportDecisions = replaceOnce(output.exportDecisions
		, "generated consumers use concrete host record and array types.\n"
		, `generated consumers use concrete host record and array types. A selected Subtype field inside an alias-named generic record follows the same rule. ${boundary(nestedEvidence)} Subtype fields in other generic records remain unfinished.\n`
		, "Lean export decision boundary");
	output.javascript = replaceOnce(output.javascript
		, "Callback, owned, recursive, dependent and broader generic\nSubtype combinations need their own checks.\n"
		, `Callback, owned, recursive and dependent Subtype
combinations, plus ${closedAlias}, need their own checks.

${boundary(`evidence/${evidence}`)}\n`
		, "JavaScript generic-Subtype boundary");
	output.php = replaceOnce(output.php
		, "Recursive\nrefined-callback payloads, recursive owned graphs and broader generic or\ndependent combinations remain separate profiles. The local PHP-Wasm checks do not measure\nconstructor/source entry counts or dispatch.\n"
		, `Recursive
refined-callback payloads, recursive owned graphs, dependent combinations and
${closedAlias} remain separate profiles. The local PHP-Wasm checks do not measure
constructor/source entry counts or dispatch.

${boundary(`evidence/${evidence}`)} Native PHP is
one of those profiles.\n`
		, "PHP generic-Subtype boundary");
	for(const name of ["c", "cpp"])
		output[name] = replaceOnce(output[name]
			, "Refined callbacks, owned, recursive, dependent and broader generic\nSubtypes remain pending.\n"
			, `Refined callbacks, owned, recursive and dependent Subtypes, plus
${closedAlias}, remain pending.

${boundary(nestedEvidence)}\n`
			, `${name} generic-Subtype boundary`);
	output.dotnet = replaceOnce(output.dotnet
		, "owned,\nrecursive, dependent and broader generic Subtypes still need separate acceptance.\n"
		, `owned,
recursive and dependent Subtypes, plus ${closedAlias}, still need
separate acceptance.

${boundary(nestedEvidence)}\n`
		, ".NET generic-Subtype boundary");
	output.java = replaceOnce(output.java
		, "owned,\nrecursive, dependent and broader generic Subtypes still need acceptance. These runs do not measure\nconstructor/source entry counts or memory.\n"
		, `owned,
recursive and dependent Subtypes, plus ${closedAlias}, still need
acceptance. These runs do not measure constructor/source entry counts or memory.

${boundary(nestedEvidence)}\n`
		, "Java generic-Subtype boundary");
	output.kotlin = replaceOnce(output.kotlin
		, "Refined callbacks, owned, recursive, dependent and broader\ngeneric Subtypes still need acceptance. These runs do not measure\nconstructor/source entry counts or memory.\n"
		, `Refined callbacks, owned, recursive and dependent Subtypes,
plus ${closedAlias}, still need acceptance. These runs do not
measure constructor/source entry counts or memory.

${boundary(nestedEvidence)}\n`
		, "Kotlin generic-Subtype boundary");
	output.perl = replaceOnce(output.perl
		, "Refined callbacks, owned values,\nrecursive and broader generic or dependent Subtypes, plus constructor/source\nentry counts and memory measurement, remain separate work.\n"
		, `Refined callbacks, owned values,
recursive and dependent Subtypes, ${closedAlias}, plus
constructor/source entry counts and memory measurement, remain separate work.

${boundary(nestedEvidence)}\n`
		, "Perl generic-Subtype boundary");
	output.python = replaceOnce(output.python
		, "Refined callbacks, owned, recursive, dependent\nand broader generic Subtypes, plus constructor/source entry counts, remain\nseparate work.\n"
		, `Refined callbacks, owned, recursive and dependent
Subtypes, ${closedAlias}, plus constructor/source entry
counts, remain separate work.

${boundary(nestedEvidence)}\n`
		, "Python generic-Subtype boundary");
	for(const name of ["ruby", "rust"])
		output[name] = replaceOnce(output[name]
			, "Refined callbacks, owned, recursive, dependent and broader generic\nSubtypes, plus constructor/source entry counts, remain separate work.\n"
			, `Refined callbacks, owned, recursive and dependent Subtypes,
${closedAlias}, plus constructor/source entry counts, remain
separate work.

${boundary(nestedEvidence)}\n`
			, `${name} generic-Subtype boundary`);
	output.witWasi = replaceOnce(output.witWasi
		, "owned\nvalues, recursive graphs, dependent and broader generic Subtypes, plus\nconstructor/source entry counts, remain separate work.\n"
		, `owned
values, recursive graphs, dependent Subtypes, ${closedAlias},
plus constructor/source entry counts, remain separate work.

${boundary(nestedEvidence)}\n`
		, "WIT generic-Subtype boundary");
	return output;
};
