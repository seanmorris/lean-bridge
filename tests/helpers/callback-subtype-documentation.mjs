/**
 * Render the Lean-author boundary after all hosted callback Subtype archives
 * have been independently replayed.
 *
 * @file
 */
import assert from "node:assert/strict";

const replaceParagraph = (source, start, replacement) => {
	assert.equal(source.split(start).length, 2, `Expected one documentation marker: ${start}`);
	const offset = source.indexOf(start);
	const end = source.indexOf("\n\n", offset);
	assert.ok(end > offset, `Expected paragraph after marker: ${start}`);
	return source.slice(0, offset) + replacement + source.slice(end);
};

const insertBeforeParagraph = (source, start, paragraph) => {
	assert.equal(source.split(start).length, 2, `Expected one documentation marker: ${start}`);
	const offset = source.indexOf(start);
	return source.slice(0, offset) + paragraph + "\n\n" + source.slice(offset);
};

const replaceExact = (source, current, replacement) => {
	assert.equal(source.split(current).length, 2
		, `Expected one documentation statement: ${current}`);
	const offset = source.indexOf(current);
	return source.slice(0, offset) + replacement
		+ source.slice(offset + current.length);
};

const existingPackageStart
	= "C/C++ execute closure inputs, Lean-produced results and arguments sent to host callbacks";
const existingPackageReplacement
	= "C/C++ execute closure inputs, Lean-produced results and arguments sent to host callbacks for `Fin` and selected `Subtype` values, including supported copied containers and mixed refined and unrefined arguments. The [hosted synchronous callback Subtype matrix](../evidence/callback-subtype-promotion-20261022.md) extends the two selected-Subtype directions to all sixteen non-PHP-Wasm consumer profiles on ordinary-source and reviewed-IR packages. A selected Subtype produced by Lean crosses a host callback argument or returned-closure result as its proof-erased base value. A base value produced by the host is checked by the selected Lean constructor when it is returned from a callback or passed into a returned Lean closure. For a host callback result containing a selected Subtype, the host supplies one typed recovery value before the call: the C callback descriptor's `recovery` pointer, the generated `with_recovery(callback, value)` API in C++, Python, Ruby and Rust, `Runtime::Callback` in CPAN, or the corresponding generated typed wrapper in the other installed profiles. The public wrapper validates and copies recovery before Lean or the callback runs. Recovery exists only for Lean's failure path and is never successful output. Missing or invalid recovery prevents callback entry; rejection preserves caller values, and a later valid call succeeds. The separate C/C++ `Fin` host-reply checks record first-error preservation and suppression of later callbacks. [PHP-Wasm callback Subtypes](../evidence/callback-subtype-php-wasm-local-qualification-20261022.md) have a separate local Node/Chromium qualification on both source routes. Nested callbacks, retained or asynchronous callbacks, arbitrary predicates, owned callback Subtypes, recursive or generic refined payloads, dispatch cost and peak memory remain separate work. The [hosted callback checked-record matrix](../evidence/callback-checked-record-promotion-20261022.md) separately establishes synchronous proof-free checked records in all sixteen non-PHP-Wasm profiles on both source routes; PHP-Wasm callback positions, retained or asynchronous callbacks and owned checked records remain separate.";

const existingPackageRow
	= "| Directional `Subtype` inside callback signatures | npm implementation; hosted acceptance tracked separately | C/C++ installed locally; other native hosts pending | Installed locally on both source routes, four ABIs and both install modes | Rejected | Ordinary/reviewed C, C++ and CPAN installed locally; other native hosts pending |";
const promotedExistingPackageRow
	= "| Directional `Subtype` inside callback signatures | Node, TypeScript, Chromium, Firefox, WebKit, React and workers installed, both source routes | C/C++, Python, Ruby, Rust, .NET, Java, Kotlin, native PHP and WIT/WASI installed, both source routes | Installed on both source routes, four ABIs and both install modes | Node and Chromium installed locally, both source routes | Ordinary/reviewed installed across all seventeen profiles; hosted in every non-PHP-Wasm profile and locally qualified in PHP-Wasm |";

const exportDecisionsStart
	= "C, C++, Rust, Python, Ruby, C#, Java, Kotlin, Perl, native PHP, PHP-Wasm, JavaScript/TypeScript and WIT/WASI packages also support [parameter-anchored function results]";
const exportDecisionsReplacement
	= "For synchronous callback Subtypes, select each constructor according to who produces the value. A selected value produced by Lean crosses a host callback argument or returned-closure result as its proof-erased base value. A value produced by the host is checked by the selected Lean constructor when it is returned from a callback or passed into a returned Lean closure. Host callback replies use the target's generated exact typed recovery value. Missing or invalid recovery prevents callback entry, caller values remain unchanged and a later valid call succeeds. The [hosted synchronous callback Subtype matrix](../evidence/callback-subtype-promotion-20261022.md) establishes this directional contract in all sixteen non-PHP-Wasm profiles on ordinary-source and reviewed-IR packages. [PHP-Wasm callback Subtypes](../evidence/callback-subtype-php-wasm-local-qualification-20261022.md) have a separate local Node/Chromium qualification. Retained or asynchronous callbacks, arbitrary predicates, checked-record or owned callback positions, recursive or generic refined payloads, dispatch cost and peak memory require separate evidence.";

/**
 * Replace only the stale Lean-author and hand-written consumer boundaries after
 * evidence promotion.
 *
 * @param docs - Current canonical Lean-author guides.
 * @param docs.existingPackage - Existing-package guide source.
 * @param docs.exportDecisions - Export-decision guide source.
 * @param docs.dotnet - .NET consumer guide source.
 * @param docs.java - Java consumer guide source.
 * @param docs.witWasi - WIT/WASI consumer guide source.
 */
export const renderCallbackSubtypeLeanAuthorDocs = ({
	existingPackage, exportDecisions, dotnet, java, witWasi
}) => ({
	existingPackage: replaceExact(replaceParagraph(existingPackage
		, existingPackageStart, existingPackageReplacement)
	, existingPackageRow, promotedExistingPackageRow)
	, exportDecisions: replaceExact(insertBeforeParagraph(exportDecisions
		, exportDecisionsStart, exportDecisionsReplacement)
	, "Refined\ncallbacks, owned and recursive Subtypes, and Subtype fields in generic records\nremain unfinished."
	, "Synchronous `Fin` callbacks outside C/C++, retained or asynchronous refined\ncallbacks, owned and recursive Subtypes, and Subtype fields in generic records\nremain unfinished.")
	, dotnet: replaceExact(replaceExact(dotnet
		, "Installed refined-callback acceptance and owned Subtypes remain pending. These local"
		, "Synchronous `Fin` callbacks, retained or asynchronous refined callbacks and owned Subtypes remain pending. These local")
	, "Installed refined-callback acceptance, owned, recursive,\ndependent and broader generic Subtypes still need separate acceptance."
	, "Synchronous `Fin` callbacks, retained or asynchronous refined callbacks, owned,\nrecursive, dependent and broader generic Subtypes still need separate acceptance.")
	, java: replaceExact(java
		, "Installed refined-callback acceptance, owned, recursive, dependent and broader\ngeneric Subtypes still need acceptance."
		, "Synchronous `Fin` callbacks, retained or asynchronous refined callbacks, owned,\nrecursive, dependent and broader generic Subtypes still need acceptance.")
	, witWasi: replaceExact(replaceExact(witWasi
		, "Installed refined-callback acceptance,\nowned values, recursive graphs, dependent and broader generic Subtypes, plus"
		, "Synchronous `Fin` callbacks, retained or asynchronous refined callbacks, owned\nvalues, recursive graphs, dependent and broader generic Subtypes, plus")
	, "Subtype fields in nominal records or variants, installed refined-callback acceptance and\nowned Subtypes remain unsupported."
	, "Synchronous `Fin` callbacks, retained or asynchronous refined callbacks and owned\nSubtypes remain unsupported.")
});
