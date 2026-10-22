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

const existingPackageStart
	= "C/C++ execute closure inputs, Lean-produced results and arguments sent to host callbacks";
const existingPackageReplacement
	= "The [hosted synchronous callback Subtype matrix](../evidence/callback-subtype-promotion-20261022.md) establishes selected `Nat` Subtypes in all sixteen non-PHP-Wasm consumer profiles on ordinary-source and reviewed-IR packages. A selected Subtype produced by Lean crosses a host callback argument or returned-closure result as its proof-erased base value. A base value produced by the host is checked by the selected Lean constructor when it is returned from a callback or passed into a returned Lean closure. Host callback replies use the target's generated exact typed recovery value. Missing or invalid recovery prevents callback entry; rejection preserves caller values, and a later valid call succeeds. Recovery exists only for Lean's failure path and is never successful output. The matrix covers admitted copied containers and mixed refined and unrefined arguments. Retained or asynchronous callbacks, arbitrary predicates, checked-record or owned callback positions, recursive or generic refined payloads, dispatch cost and peak memory remain separate work. [PHP-Wasm callback Subtypes](../evidence/callback-subtype-php-wasm-local-qualification-20261022.md) have a separate local Node/Chromium qualification on both source routes. The [hosted callback checked-record matrix](../evidence/callback-checked-record-promotion-20261022.md) separately establishes synchronous proof-free checked records in all sixteen non-PHP-Wasm profiles.";

const exportDecisionsStart
	= "C, C++, Rust, Python, Ruby, C#, Java, Kotlin, Perl, native PHP, PHP-Wasm, JavaScript/TypeScript and WIT/WASI packages also support [parameter-anchored function results]";
const exportDecisionsReplacement
	= "For synchronous callback Subtypes, select each constructor according to who produces the value. A selected value produced by Lean crosses a host callback argument or returned-closure result as its proof-erased base value. A value produced by the host is checked by the selected Lean constructor when it is returned from a callback or passed into a returned Lean closure. Host callback replies use the target's generated exact typed recovery value. Missing or invalid recovery prevents callback entry, caller values remain unchanged and a later valid call succeeds. The [hosted synchronous callback Subtype matrix](../evidence/callback-subtype-promotion-20261022.md) establishes this directional contract in all sixteen non-PHP-Wasm profiles on ordinary-source and reviewed-IR packages. [PHP-Wasm callback Subtypes](../evidence/callback-subtype-php-wasm-local-qualification-20261022.md) have a separate local Node/Chromium qualification. Retained or asynchronous callbacks, arbitrary predicates, checked-record or owned callback positions, recursive or generic refined payloads, dispatch cost and peak memory require separate evidence.";

/**
 * Replace only the two stale Lean-author paragraphs after evidence promotion.
 *
 * @param docs - Current canonical Lean-author guides.
 * @param docs.existingPackage - Existing-package guide source.
 * @param docs.exportDecisions - Export-decision guide source.
 */
export const renderCallbackSubtypeLeanAuthorDocs = ({
	existingPackage, exportDecisions
}) => ({
	existingPackage: replaceParagraph(existingPackage
		, existingPackageStart, existingPackageReplacement)
	, exportDecisions: insertBeforeParagraph(exportDecisions
		, exportDecisionsStart, exportDecisionsReplacement)
});
