/**
 * Check exact probe documentation rendering without claiming a hosted result.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { phpWasmRefinementEntryBoundary } from "../../scripts/generate-type-docs.mjs";
import { phpWasmEntryProbeEvidenceId } from "./php-wasm-refinement-entry-publication.mjs";
import {
	phpWasmEntryProbeDocumentationPaths, phpWasmEntryProbePreviousDocumentation
	, renderPhpWasmEntryProbeBoundary, renderPhpWasmEntryProbeDocumentation
} from "./php-wasm-refinement-entry-publication-docs.mjs";

const reference = () => ({
	id: phpWasmEntryProbeEvidenceId, kind: "test", revision: "a".repeat(40)
	, files: [{ path: "docs/evidence/php-wasm-entry-hosted-20261025/index.json", sha256: "b".repeat(64) }] });
const sources = () => Object.fromEntries(Object.entries(phpWasmEntryProbePreviousDocumentation)
	.map(([page, paragraph]) => [page, "unchanged beginning\n\n" + paragraph + "\n\nunchanged ending\n"]));

test("PHP-Wasm probe docs preserve all text outside the four measurement paragraphs", () => {
	const evidence = reference(), original = sources(), before = structuredClone(original);
	assert.equal(phpWasmEntryProbePreviousDocumentation.reference, phpWasmRefinementEntryBoundary);
	const result = renderPhpWasmEntryProbeDocumentation(original, evidence);
	assert.deepEqual(original, before);
	assert.deepEqual(Object.keys(result), Object.keys(phpWasmEntryProbeDocumentationPaths));
	for(const [page, text] of Object.entries(result))
	{
		const current = renderPhpWasmEntryProbeBoundary(evidence, page);
		assert.equal(text.replace(current, phpWasmEntryProbePreviousDocumentation[page]), original[page]);
		assert.match(current, /30 ordinary\/reviewed routes in 27 retained artifacts/u);
		assert.match(current, /24 copied, owned and indexed routes count validator, constructor, adapter and Lean-source entries/u);
		assert.match(current, /six callback routes record callback control totals/u);
		assert.match(current, /unmodified prepared packages/u);
		assert.ok(current.includes(evidence.revision));
		assert.ok(current.includes(page === "consumer"
			? "](evidence/php-wasm-entry-hosted-20261025/index.json)"
			: "](../evidence/php-wasm-entry-hosted-20261025/index.json)"));
	}
});

test("PHP-Wasm probe docs reject changed baselines and invalid publication references", () => {
	for(const page of Object.keys(phpWasmEntryProbeDocumentationPaths))
	{
		for(const text of ["missing paragraph", phpWasmEntryProbePreviousDocumentation[page].repeat(2)])
			assert.throws(() => renderPhpWasmEntryProbeDocumentation({ ...sources(), [page]: text }, reference()));
	}
	assert.throws(() => renderPhpWasmEntryProbeDocumentation({ ...sources(), other: "extra" }, reference()));
	assert.throws(() => renderPhpWasmEntryProbeBoundary(reference(), "unrelated"));
	for(const mutate of [
		value => { value.id = "diagnostic-only"; }
		, value => { value.kind = "installed"; }
		, value => { value.revision = "latest"; }
		, value => { value.files = []; }
		, value => { value.files[0].sha256 = "changed"; }
		, value => { value.files[0].path = "docs/evidence/diagnostic/index.json"; }
	]) {
		const evidence = reference(); mutate(evidence);
		assert.throws(() => renderPhpWasmEntryProbeDocumentation(sources(), evidence));
	}
	assert.throws(() => renderPhpWasmEntryProbeDocumentation(
		renderPhpWasmEntryProbeDocumentation(sources(), reference()), reference()));
});
