/**
 * Prove the evidence-gated dependent-signature author documentation change.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	dependentSignatureCompleteDocumentationPaths
	, renderDependentSignatureCompleteDocumentation
} from "./dependent-signature-complete-documentation.mjs";

const readSource = async ([name, path]) => [name, await readFile(path, "utf8")];
const sources = Object.fromEntries(await Promise.all(Object.entries(
	dependentSignatureCompleteDocumentationPaths).map(readSource)));

test("complete dependent-signature docs state the exact live-bound contract", () => {
	const rendered = renderDependentSignatureCompleteDocumentation(sources);
	assert.match(rendered.existingPackage
		, /Export a direct value-dependent Fin parameter/u);
	assert.match(rendered.existingPackage
		, /rejects `value >= bound`[\s\S]*before constructing `Fin bound`/u);
	assert.match(rendered.existingPackage
		, /does not admit dependent results,[\s\S]*open dependent/u);
	assert.match(rendered.existingPackage
		, /all seventeen consumer profiles and both author/u);
	assert.doesNotMatch(rendered.existingPackage
		, /unresolved types, dependent runtime inputs, effects/u);
	assert.match(rendered.exportDecisions
		, /outside the supported direct earlier-Nat `Fin` parameter form/u);
	assert.doesNotMatch(rendered.exportDecisions
		, /Open generics, dependent signatures, asynchronous/u);
});

test("complete dependent-signature docs reject missing and repeated markers", () => {
	const rendered = renderDependentSignatureCompleteDocumentation(sources);
	assert.throws(() => renderDependentSignatureCompleteDocumentation(rendered)
		, /Expected one dependent-signature documentation marker/u);
	for(const name of Object.keys(sources))
		assert.throws(() => renderDependentSignatureCompleteDocumentation({
			...sources, [name]: "missing marker\n"
		}), /Expected one dependent-signature documentation marker/u);
});
