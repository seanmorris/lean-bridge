/**
 * Render the exact PHP-Wasm probe documentation after real archive acceptance.
 * Keep all surrounding type-support and package instructions unchanged.
 *
 * @file
 */
import assert from "node:assert/strict";
import { phpWasmEntryProbeEvidenceId } from "./php-wasm-refinement-entry-publication.mjs";

export const phpWasmEntryProbeDocumentationPaths = Object.freeze({
	consumer: "docs/php.md", publisher: "docs/publish/php.md"
	, author: "docs/lean/existing-package.md", reference: "docs/reference/types.md"
});
export const phpWasmEntryProbePreviousDocumentation = Object.freeze({
	consumer: `Entry measurements use separate instrumented fixture packages. The 24 copied,
owned and indexed routes count named validator, constructor, adapter and
Lean-source entries; the six callback routes record callback control totals.
The callback routes cover Fin, selected Subtype and checked-record families.
Together they form 30 ordinary/reviewed routes in 27 retained artifacts. These
measurements do not change a consumer package or widen its supported types. The [promotion
workflow](https://github.com/seanmorris/lean-bridge/actions/workflows/php-wasm-refinement-entry-promotion.yml)
is configured to rebuild the complete matrix at one revision and recheck the
retained artifacts. Until a completed run publishes that verified summary, the
documentation makes no hosted entry-count claim.`
	, publisher: `Lean Bridge uses separate instrumented fixture packages for measurement. The
24 copied, owned and indexed routes count validator, constructor, adapter and
Lean-source entries; the six callback routes record callback control totals.
Together they form 30 ordinary/reviewed routes in 27 retained artifacts. The
matrix does not widen the prepared-package type surface or become part of a
consumer release. The [promotion
workflow](https://github.com/seanmorris/lean-bridge/actions/workflows/php-wasm-refinement-entry-promotion.yml)
is configured to rebuild all four producer groups at one revision and verify
their retained bytes. Do not describe its counts as hosted evidence until a
completed promotion run publishes the verified summary.`
	, author: "Separate instrumented fixture packages use 24 copied, owned and indexed routes to count named validator, constructor, adapter and Lean-source entries; six callback routes record callback control totals. Together they form 30 ordinary/reviewed routes in 27 retained artifacts without widening the consumer type surface. The [promotion workflow](https://github.com/seanmorris/lean-bridge/actions/workflows/php-wasm-refinement-entry-promotion.yml) is configured to rebuild that matrix at one revision, but no hosted count claim exists until a completed run publishes its verified summary."
	, reference: `PHP-Wasm refinement support is established by unmodified prepared packages.
The separate entry-measurement probes instrument fixture packages only: their
24 copied, owned and indexed routes count validator, constructor, adapter and
Lean-source entries, while six callback routes record callback control totals.
Together they form 30 ordinary/reviewed routes in 27 retained artifacts and do
not widen any type-support cell. The configured [promotion
workflow](https://github.com/seanmorris/lean-bridge/actions/workflows/php-wasm-refinement-entry-promotion.yml)
is not a hosted result; entry counts become hosted evidence only when a
completed run publishes a verified summary for one revision.`
});
const workflow = "https://github.com/seanmorris/lean-bridge/actions/workflows/php-wasm-refinement-entry-promotion.yml";

/**
 * Format a verified probe reference, preserving its producer and archive link.
 * Formatting alone is not replay or publication authorization.
 *
 * @param evidence - Reference from the complete committed-archive reader.
 * @param page - One of the four explicitly scoped documentation pages.
 */
export const renderPhpWasmEntryProbeBoundary = (evidence, page = "reference") => {
	assert.ok(Object.hasOwn(phpWasmEntryProbeDocumentationPaths, page));
	assert.equal(evidence.id, phpWasmEntryProbeEvidenceId); assert.equal(evidence.kind, "test");
	assert.match(evidence.revision, /^[a-f0-9]{40}$/u);
	const index = evidence.files?.[0]; assert.ok(index);
	assert.match(index.path, /^docs\/evidence\/php-wasm-entry-hosted-[0-9]{8}\/index\.json$/u);
	assert.match(index.sha256, /^[a-f0-9]{64}$/u);
	const link = (page === "consumer" ? "" : "../") + index.path.slice("docs/".length);
	const text = `[Hosted entry probes](${link}) cover 30 ordinary/reviewed routes in 27 retained artifacts, plus the aggregate verifier artifact, at producer \`${evidence.revision}\`. The archive checker reconstructs the original artifacts and sources and reruns all thirty route verifiers. The 24 copied, owned and indexed routes count validator, constructor, adapter and Lean-source entries; six callback routes record callback control totals for Fin, selected Subtype and checked-record families. These separate instrumented fixture packages leave unmodified prepared packages and their supported types unchanged. The [promotion workflow](${workflow}) defines the complete matrix.`;
	return page === "reference"
		? "PHP-Wasm refinement support is established by unmodified prepared packages.\n\n" + text
		: text;
};

/**
 * Replace only the previous measurement paragraphs. Refuse missing, duplicate
 * or already replaced text instead of silently accepting a changed baseline.
 *
 * @param sources - Complete original text for each scoped page.
 * @param evidence - Reference obtained by real committed-archive verification.
 */
export const renderPhpWasmEntryProbeDocumentation = (sources, evidence) => {
	assert.deepEqual(Object.keys(sources).sort(), Object.keys(phpWasmEntryProbeDocumentationPaths).sort());
	return Object.fromEntries(Object.entries(sources).map(([page, source]) => {
		assert.equal(typeof source, "string");
		const previous = phpWasmEntryProbePreviousDocumentation[page];
		assert.equal(source.split(previous).length, 2, `exact previous probe paragraph: ${page}`);
		return [page, source.replace(previous, renderPhpWasmEntryProbeBoundary(evidence, page))];
	}));
};
